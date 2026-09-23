"""Collect published 30+ year housing ratios from the public SGIS housing map."""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from backend.app.core.settings import DATA_ROOT
from backend.app.services.public_http import public_client
from backend.app.services.sgis.cache import atomic_json
from scripts.collect_kma import TableRows

URL = 'https://sgis.mods.go.kr/view/house/'


def collect(refresh=False):
    actual = json.loads((DATA_ROOT / 'processed' / 'sgis.json').read_text())
    year = actual['meta']['reference_year']
    target = DATA_ROOT / 'raw' / f'sgis_housing_{year}.json'
    if target.exists() and not refresh:
        return json.loads(target.read_text())
    with public_client() as client:
        page = client.get(URL + 'houseAnalysisMap')
        page.raise_for_status()
        parser = TableRows()
        parser.feed(page.text)
        definition = next((r for r in parser.rows if r and r[0] == '노후주택 비율'), None)
        if not definition or definition[-1] != str(year) or '30년' not in ''.join(definition):
            raise ValueError('Published SGIS housing definition/year differs from the selected census year')
        rows, log = {}, []
        districts = [c for c in actual['observations'] if len(c) == 5]
        queries = ['21', '21010'] + [min(c for c in actual['observations'] if len(c) == 8 and c.startswith(d)) for d in sorted(districts)]
        for code in queries:
            params = {'regionCd': code, 'classId': 'B005', 'baseYear': str(actual['meta']['boundary_year'])}
            response = client.post(URL + 'getIndicatorAreaList', json=params)
            response.raise_for_status()
            data = response.json()
            if data.get('unit') != '%':
                raise ValueError('Unexpected housing ratio unit')
            log.append({'request': params, 'response': data})
            for row in data['indicatorAreaList']:
                if row['region_cd'].startswith('21'):
                    value = row['value']
                    if not isinstance(value, (int, float)) or not 0 <= value <= 100:
                        raise ValueError('Invalid published housing ratio')
                    rows[row['region_cd']] = row
        if set(actual['observations']) - set(rows):
            raise ValueError('Published housing ratios do not cover the census region codes')
        result = {'reference_year': year, 'definition': definition, 'source_url': URL + 'houseAnalysisMap',
                  'collected_at': datetime.now(timezone.utc).isoformat(), 'regions': rows, 'requests': log}
        atomic_json(target, result)
        print(f'Published housing ratios: {len(rows)} regions', flush=True)
        return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--refresh', action='store_true')
    collect(parser.parse_args().refresh)
