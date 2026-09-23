"""Read-only report artifacts. Serving a report never starts an LLM or an HTTP call."""
import hashlib
import json
import re
from pathlib import Path

from pydantic import BaseModel, ConfigDict, Field, ValidationError
from ...core.settings import DATA_ROOT
from .guidance import action_plans

REPORT_ROOT = DATA_ROOT / 'reports' / 'heatwave'
PROMPT_VERSION = 'heatwave-editor-3'


class Narrative(BaseModel):
    model_config = ConfigDict(extra='forbid', strict=True)
    overview: str = Field(min_length=30, max_length=240)
    next_step: str = Field(min_length=20, max_length=160)


def edit_proposal_voice(value):
    """Keep reviewed wording edits explicit; do not rewrite facts or action choices."""
    replacements = {
        '실행할 계획입니다': '실행하는 방안을 검토할 수 있습니다',
        '협의할 계획입니다': '협의하는 방안을 검토할 수 있습니다',
        '실시할 계획입니다': '실시하는 방안을 검토할 수 있습니다',
        '강화하겠습니다': '강화하는 방안을 검토할 수 있습니다',
        '노력하겠습니다': '지원 방안을 검토할 수 있습니다',
        '협의해 나가겠습니다': '협의할 수 있습니다',
        '안전을 확보할 수 있습니다': '안전을 위한 대응을 검토할 수 있습니다',
        '체계를 구축합니다': '체계를 검토할 수 있습니다',
        '즉시 실행 가능한 조치를 취하고': '실행 가능한 조치를 검토하고',
    }
    edited = Narrative.model_validate(value).model_dump()
    for key, text in edited.items():
        for old, new in replacements.items():
            text = text.replace(old, new)
        edited[key] = text
    return edited


def validate_narrative(value):
    narrative = Narrative.model_validate(value)
    text = narrative.overview + ' ' + narrative.next_step
    # Numbers, source links and metrics are always rendered from trusted data.
    # These checks are conservative publication gates, not a factual-truth proof.
    if re.search(r'[0-9<>\[\]{}]|https?://|[\u3400-\u9fff]', text):
        raise ValueError('Unexpected number, markup, URL or non-Korean prose')
    if re.search(r'반드시|무조건|최고|최저|배 이상|확실|예측|발생합니다|발생할 것입니다|설치해야|신설해야|시행 중|시행하고|운영 중|운영되고|부족합니다|부족하여|부족하므로|평균보다|기준보다|(?:높|낮)(?:은|고|아|습|다|으)|많|적은|밀집|증가|감소', text):
        raise ValueError('Unverified claim in narrative')
    if not all(re.search(r'검토|확인|점검|협의', s) for s in [narrative.overview, narrative.next_step]):
        raise ValueError('Report must describe proposed checks')
    return narrative.model_dump()


def report_input(region):
    plans = action_plans(region)
    return {
        'prompt_version': PROMPT_VERSION, 'region_code': region['region_code'],
        'region_name': region['full_name'], 'reference_year': region['reference_year'],
        'is_sample': region['is_sample'], 'risk_score': region['risk_score'],
        'risk_level': region['risk_level'], 'comparison_region': region['comparison_region'],
        'missing_indicators': region['missing_indicators'], 'top_factors': region['top_factors'],
        'plans': plans,
    }


def fingerprint(context):
    return hashlib.sha256(json.dumps(context, ensure_ascii=False, sort_keys=True, allow_nan=False).encode()).hexdigest()


def report_content(region, root: Path | None = None):
    context = report_input(region)
    plans = context['plans']
    sources = {s['id']: s for p in plans for s in p['sources']}
    result = {'status': 'not_prepared', 'narrative': None, 'prepared_at': None,
              'plans': plans, 'sources': list(sources.values()),
              'guidance_note': '전국 대책의 대응 원칙을 지역 특성에 연결한 제안입니다. 아래 실행 항목과 협의 대상은 이 지역의 확정된 사업계획이 아닙니다.'}
    if region['is_sample']:
        return {**result, 'status': 'sample'}
    if region['risk_score'] is None:
        return {**result, 'status': 'insufficient'}
    code = region['region_code']
    if not re.fullmatch(r'21\d{6}', code):
        return result
    path = (root or REPORT_ROOT) / f'{code}.json'
    try:
        artifact = json.loads(path.read_text())
        if not isinstance(artifact, dict):
            return {**result, 'status': 'stale'}
        if artifact.get('fingerprint') != fingerprint(context) or artifact.get('region_code') != code:
            return {**result, 'status': 'stale'}
        narrative = validate_narrative(artifact['narrative'])
        if not isinstance(artifact['prepared_at'], str) or not isinstance(artifact['provenance'], dict):
            return {**result, 'status': 'stale'}
        return {**result, 'status': 'prepared', 'narrative': narrative,
                'prepared_at': artifact['prepared_at'], 'provenance': artifact['provenance']}
    except FileNotFoundError:
        return result
    except (ValueError, KeyError, TypeError, ValidationError):
        # A damaged or old generated artifact cannot replace the trusted analysis.
        return {**result, 'status': 'stale'}
