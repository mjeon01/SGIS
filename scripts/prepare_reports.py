"""Generate resumable report prose with an already installed, local Ollama model.

No cloud keys, paid APIs, model downloads or web requests. Only reviewed guidance
and the local SGIS snapshot enter the model. Failed checks never replace an artifact.
"""
import argparse
from datetime import datetime, timezone
import fcntl
import json
from pathlib import Path
import sys
import time
from urllib.parse import urlparse

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import httpx
from backend.app.repositories.dataset import DatasetRepository
from backend.app.services.ai.prepared import (
    Narrative, REPORT_ROOT, fingerprint, report_content, report_input, validate_narrative, edit_proposal_voice,
)
from backend.app.services.sgis.cache import atomic_json

SYSTEM = '''한국어 지역 분석보고서의 대응 설명을 작성합니다. 통계 진단은 별도로 표시되므로 오직 입력된 대응 항목을 어떻게 실행할지 설명합니다.
overview: 대응 항목들을 연결해 무엇부터 확인하고 어떤 협의를 이어갈지 두 문장, 약 백 자로 설명합니다.
next_step: 현장에서 먼저 확인할 구체적인 행동 하나를 한 문장으로 설명합니다.
제공된 계획과 조건 안에서만 작성하세요. 지역명, 숫자, 연도, 수치, 순위, 점수, 출처 주소는 별도 표시하므로 쓰지 마세요.
고령인구·혼자 사는 가구·노후주택처럼 숫자 없는 명칭을 쓰세요. 주요 요인이라는 사실을 평균보다 높다는 뜻으로 바꾸지 마세요.
비교·증감·미래 기상 예측, 시설 부족·존재·위치, 정책 시행 여부, 주민의 건강·소득·고립 상태를 추정하지 마세요.
계획은 검토·확인·점검·협의의 제안으로 표현하세요. 시급·반드시·무조건·신설해야 같은 단정은 금지합니다.
새 대응책, 예산, 수량, 새로운 담당기관을 추가하지 마세요. 전국 지침이 이 동에서 시행된다고 표현하지 마세요.
두 필드에는 자연스러운 한국어 완결문장만 쓰고 JSON 형식을 지키세요.
올바른 예시: {"overview":"주민이 더위를 피할 공간을 이용할 수 있도록 시설 상태와 운영시간을 함께 점검할 수 있습니다. 현장 확인 결과를 토대로 운영기관과 필요한 조정을 협의합니다.","next_step":"현재 시설의 운영시간과 이용대상을 확인하고, 등록정보가 없는 곳은 운영기관에 문의합니다."}
잘못된 예시: 인구밀도가 높아, 폭염일수가 많아, 고령인구가 증가하여. 입력에 없는 진단이므로 쓰지 마세요.'''


def generate(client, model, digest, context, refresh=False):
    prompt_context = {
        '대응 항목': [{k: p[k] for k in ['title', 'basis', 'steps', 'condition']} for p in context['plans']],
    }
    cache_key = fingerprint({'system': SYSTEM, 'input': prompt_context, 'schema': Narrative.model_json_schema(),
                             'model': model, 'digest': digest})
    cache_path = REPORT_ROOT.parents[1] / 'raw' / 'reports' / 'prose' / f'{cache_key}.json'
    if cache_path.exists() and not refresh:
        cached = json.loads(cache_path.read_text())
        return validate_narrative(edit_proposal_voice(cached['narrative'])), {**cached['usage'], 'reused_prose': True}
    try:
        response = client.post('/api/chat', json={
            'model': model, 'stream': False, 'format': Narrative.model_json_schema(),
            'messages': [{'role': 'system', 'content': SYSTEM},
                         {'role': 'user', 'content': json.dumps(prompt_context, ensure_ascii=False)}],
            'options': {'temperature': 0, 'seed': 42, 'num_ctx': 8192, 'num_predict': 450},
            'keep_alive': '5m',
        })
        response.raise_for_status()
        result = response.json()
    finally:
        # Also space refused, timed-out and malformed responses.
        time.sleep(3)
    if not result.get('done') or result.get('done_reason') == 'length':
        raise ValueError('Incomplete model output')
    atomic_json(REPORT_ROOT.parents[1] / 'raw' / 'reports' / f"{context['region_code']}.json", {
        'input': context, 'prompt_context': prompt_context, 'response': result,
    })
    narrative = validate_narrative(edit_proposal_voice(json.loads(result['message']['content'])))
    usage = {k: result.get(k) for k in ['prompt_eval_count', 'eval_count', 'total_duration']}
    atomic_json(cache_path, {'narrative': narrative, 'usage': usage})
    return narrative, {**usage, 'reused_prose': False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--model', default='qwen2.5:7b')
    parser.add_argument('--host', default='http://127.0.0.1:11434')
    parser.add_argument('--code', action='append', help='Repeat to prepare specific Busan dongs')
    parser.add_argument('--limit', type=int)
    parser.add_argument('--refresh', action='store_true')
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()
    address = urlparse(args.host)
    if address.scheme != 'http' or address.hostname not in {'127.0.0.1', 'localhost', '::1'} or address.username or address.password:
        parser.error('Only a local Ollama HTTP endpoint is supported')
    if args.limit is not None and args.limit < 1:
        parser.error('--limit must be positive')
    repo = DatasetRepository()
    regions = repo.results('21', 'sgis', 'dong')
    if args.code and set(args.code) - {r['region_code'] for r in regions}:
        parser.error('Unknown Busan dong code')
    regions = [r for r in regions if r['risk_score'] is not None and (not args.code or r['region_code'] in args.code)]
    regions.sort(key=lambda r: (-r['risk_score'], r['region_code']))
    pending = [r for r in regions if args.refresh or report_content(r)['status'] != 'prepared']
    if args.limit:
        pending = pending[:args.limit]
    print(json.dumps({'eligible': len(regions), 'pending': len(pending), 'model': args.model}, ensure_ascii=False), flush=True)
    if args.dry_run or not pending:
        return
    REPORT_ROOT.mkdir(parents=True, exist_ok=True)
    # Concurrent generators must not issue duplicate work or overwrite each other.
    lock_path = REPORT_ROOT.parents[1] / 'raw' / 'reports' / 'prepare.lock'
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    with lock_path.open('w') as lock, httpx.Client(base_url=args.host, timeout=180, trust_env=False) as client:
        try:
            fcntl.flock(lock.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise SystemExit('A report generator is already running')
        response = client.get('/api/tags')
        response.raise_for_status()
        installed = {m['name']: m for m in response.json()['models']}
        if args.model not in installed:
            raise SystemExit('Requested model is not installed; no automatic downloads are performed')
        failures = []
        for index, region in enumerate(pending, 1):
            started = time.monotonic()
            context = report_input(region)
            try:
                narrative, usage = generate(client, args.model, installed[args.model]['digest'], context, args.refresh)
                artifact = {
                    'region_code': region['region_code'], 'fingerprint': fingerprint(context),
                    'prepared_at': datetime.now(timezone.utc).isoformat(), 'narrative': narrative,
                    'provenance': {'engine': 'ollama', 'model': args.model,
                                   'model_digest': installed[args.model]['digest'],
                                   'prompt_version': context['prompt_version'], 'editorial_version': 1, **usage},
                }
                atomic_json(REPORT_ROOT / f"{region['region_code']}.json", artifact)
                print(json.dumps({'done': index, 'total': len(pending), 'region': region['region_name'],
                                  'seconds': round(time.monotonic() - started, 1), **narrative}, ensure_ascii=False), flush=True)
            except (httpx.HTTPError, ValueError, KeyError, TypeError) as exc:
                failures.append(region['region_code'])
                print(json.dumps({'rejected': region['region_code'], 'error': type(exc).__name__ + ': ' + str(exc)}, ensure_ascii=False), flush=True)
        if failures:
            raise SystemExit(f'Rejected reports left unpublished: {failures}')


if __name__ == '__main__':
    main()
