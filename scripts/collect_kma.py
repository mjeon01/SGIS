"""Cache public KMA daily observations; does not assign stations or update scores.

Uses the public data-view form (ten displayed observations per request).
No login, protected download endpoint, or third-party credential is used.
"""
import argparse
from datetime import date, datetime, timedelta, timezone
from html import unescape
from html.parser import HTMLParser
import json
import math
from pathlib import Path
import re
import sys
import time

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from backend.app.core.settings import DATA_ROOT
from backend.app.services.sgis.cache import atomic_json
from backend.app.services.public_http import public_client

BASE = 'https://data.kma.go.kr'
SOURCES = {
    'AWS': {'category': 'SFC02', 'page': 'selectAwsRltmList.do', 'program': '56',
            'elements': 'SFC02015001,SFC02015004', 'element_group': '127'},
    'ASOS': {'category': 'SFC01', 'page': 'selectAsosRltmList.do', 'program': '36',
             'elements': 'SFC01013001,SFC01013004', 'element_group': '179'},
}


def parse_daily(text, station_id, start, end):
    match = re.search(r"var egovMapList1 = '(.*?)';", text)
    if not match:
        raise ValueError('KMA public table missing; refusing to interpret an error as zero days')
    rows = json.loads(unescape(match[1])) if match[1] else []
    seen = set()
    for row in rows:
        day = date.fromisoformat(row['TM'])
        if int(row['STN_ID']) != int(station_id) or not start <= day <= end or day in seen:
            raise ValueError('KMA station/date mismatch or duplicate')
        seen.add(day)
        for field in ('AVG_TA', 'MAX_TA', 'MIN_TA'):
            value = row.get(field)
            if value in (None, ''):
                row[field] = None
            elif not isinstance(value, (int, float)) or not math.isfinite(value) or not -90 <= value <= 60:
                raise ValueError(f'Invalid KMA {field}')
        if row.get('AVG_TA') is not None and row.get('MAX_TA') is not None and row['AVG_TA'] > row['MAX_TA']:
            raise ValueError('Daily mean exceeds maximum')
        for field in ('AVG_TA', 'MAX_TA'):
            if row.get('MIN_TA') is not None and row.get(field) is not None and row['MIN_TA'] > row[field]:
                raise ValueError('Daily minimum exceeds mean or maximum')
    return rows


class TableRows(HTMLParser):
    def __init__(self):
        super().__init__()
        self.rows, self.row, self.cell = [], None, None

    def handle_starttag(self, tag, attrs):
        if tag == 'tr':
            self.row = []
        elif tag == 'td' and self.row is not None:
            self.cell = []

    def handle_data(self, value):
        if self.cell is not None:
            self.cell.append(value)

    def handle_endtag(self, tag):
        if tag == 'td' and self.cell is not None:
            self.row.append(''.join(self.cell).strip())
            self.cell = None
        elif tag == 'tr' and self.row is not None:
            self.rows.append(self.row)
            self.row = None


def parse_history(text, station_id):
    parser = TableRows()
    parser.feed(text)
    result = []
    for row in parser.rows:
        if len(row) != 9 or row[0] != str(station_id):
            continue
        result.append(dict(station_id=row[0], start_date=row[1], end_date=row[2] or None,
                           name=row[3], address=row[4], latitude=float(row[5]),
                           longitude=float(row[6]), altitude_m=float(row[7])))
    if not result:
        raise ValueError('KMA station location history missing')
    return result


def collect(year=2024, refresh=False):
    start, end = date(year, 6, 1), date(year, 8, 31)
    raw_root = DATA_ROOT / 'raw' / 'kma' / str(year)
    raw_root.mkdir(parents=True, exist_ok=True)
    client = public_client()

    def post(path, params):
        for attempt in range(3):
            try:
                response = client.post(BASE + path, data=params)
                if response.status_code == 429 and attempt < 2:
                    continue  # The shared transport honors Retry-After (30 seconds if absent).
                response.raise_for_status()
                return response.text
            except (httpx.TimeoutException, httpx.NetworkError):
                if attempt == 2:
                    raise
                time.sleep(3 * 2 ** attempt)

    def cached(name, path, params, parser):
        target = raw_root / f'{name}.json'
        if target.exists() and not refresh:
            return json.loads(target.read_text())['data']
        result = parser(post(path, params))
        atomic_json(target, {'source_url': BASE + path, 'request': params,
                            'collected_at': datetime.now(timezone.utc).isoformat(), 'data': result})
        return result

    stations = {}
    try:
        for kind, spec in SOURCES.items():
            params = {'lrgClssCd': 'SFC', 'mddlClssCd': spec['category'],
                      'dataFormCd': 'F00501', 'serviceSe': 'F00102'}

            def station_list(text):
                found = re.findall(r'groupNm\s*:\s*"부산광역시"[^\n]*?groupSn\s*:\s*"(\d+)"[^\n]*?stnId\s*:\s*"(\d+)"[^\n]*?stnNm\s*:\s*"([^"]+)"', text)
                if not found:
                    raise ValueError('Busan station catalog missing')
                return [{'group': group, 'station_id': code, 'name': name, 'kind': kind} for group, code, name in found]

            for station in cached(f'catalog_{kind}', '/cmmn/stnGroupPopup.do?type=button', params, station_list):
                stations[station['station_id']] = station  # ASOS preferred for duplicate station IDs.

        for code, station in sorted(stations.items()):
            spec = SOURCES[station['kind']]
            history = cached(f'history_{code}', '/tmeta/stn/selectStnList.do',
                             {'pgmNo': '123', 'mddlClssCd': spec['category'], 'stnIds': code,
                              'serviceSe': 'F00101', 'pageIndex': '1', 'schListCnt': '10'},
                             lambda text: parse_history(text, code))
            station['location_history'] = history
            # A station can move from AWS to ASOS; use its historical network's
            # location records instead of applying today's location retrospectively.
            if station['kind'] == 'ASOS' and not any(date.fromisoformat(r['start_date']) <= end for r in history):
                history += cached(f'history_{code}_AWS', '/tmeta/stn/selectStnList.do',
                                  {'pgmNo': '123', 'mddlClssCd': 'SFC02', 'stnIds': code,
                                   'serviceSe': 'F00101', 'pageIndex': '1', 'schListCnt': '10'},
                                  lambda text: parse_history(text, code))
            station['summer_locations'] = [r for r in history if date.fromisoformat(r['start_date']) <= end
                                          and (r['end_date'] is None or date.fromisoformat(r['end_date']) >= start)]
            rows = []
            cursor = start
            while cursor <= end:
                until = min(cursor + timedelta(days=9), end)
                params = {'lrgClssCd': 'SFC', 'mddlClssCd': spec['category'], 'dataFormCd': 'F00501',
                          'serviceSe': 'F00102', 'stnIds': f"{station['group']}_{code}",
                          'startDt': cursor.strftime('%Y%m%d'), 'endDt': until.strftime('%Y%m%d'),
                          'elementCds': spec['elements'], 'elementGroupSns': spec['element_group'],
                          'firstLoading': 'N', 'pageIndex': '1', 'pageRowCount': '31',
                          'startYear': str(year), 'endYear': str(year), 'startHh': '00', 'endHh': '23',
                          'cmmnCdList': 'F00501,F00502,F00503,F00512,F00513', 'upperCmmnCode': 'F005', 'menuNo': '33'}
                rows.extend(cached(f'daily_{code}_{cursor.isoformat()}',
                                   f"/data/grnd/{spec['page']}?pgmNo={spec['program']}", params,
                                   lambda text: parse_daily(text, code, cursor, until)))
                cursor = until + timedelta(days=1)
            expected = {(start + timedelta(days=i)).isoformat() for i in range((end-start).days + 1)}
            station['daily'] = sorted(rows, key=lambda r: r['TM'])
            station['missing_dates'] = sorted(expected - {r['TM'] for r in rows})
            station['valid_mean_days'] = sum(r.get('AVG_TA') is not None for r in rows)
            station['valid_max_days'] = sum(r.get('MAX_TA') is not None for r in rows)
            station['complete'] = not station['missing_dates'] and station['valid_mean_days'] == len(expected) and station['valid_max_days'] == len(expected)
            print(f"{station['kind']} {code} {station['name']}: mean {station['valid_mean_days']}/92, max {station['valid_max_days']}/92", flush=True)

        snapshot = {'source': '기상청 기상자료개방포털 ASOS/AWS 일 관측자료', 'reference_year': year,
                    'period': [start.isoformat(), end.isoformat()], 'timezone': 'Asia/Seoul',
                    'collected_at': datetime.now(timezone.utc).isoformat(),
                    'status': 'observations_only_pending_region_assignment', 'stations': stations}
        atomic_json(DATA_ROOT / 'processed' / f'kma_observations_{year}.json', snapshot)
        print(json.dumps({'stations': len(stations), 'complete': sum(s['complete'] for s in stations.values())}))
        return snapshot
    finally:
        client.close()


def collect_extremes(year=2024):
    """Supplement minima in a separate snapshot, keeping all scoring inputs intact."""
    base = json.loads((DATA_ROOT / 'processed' / f'kma_observations_{year}.json').read_text())
    census = json.loads((DATA_ROOT / 'processed/sgis.json').read_text())
    if base['reference_year'] != census['meta']['reference_year']:
        raise ValueError('Year mismatch')
    used = {r['source_detail']['heatwave_intensity']['station_id'] for r in census['observations'].values()}
    root = DATA_ROOT / 'raw/kma' / str(year)
    start, end = map(date.fromisoformat, base['period'])
    stations = {}
    with public_client() as client:
        for code in sorted(used):
            station = base['stations'][code]
            minima = {}
            cursor = start
            while cursor <= end:
                until = min(cursor + timedelta(days=9), end)
                original = json.loads((root / f'daily_{code}_{cursor.isoformat()}.json').read_text())
                params = {**original['request'], 'elementCds': 'SFC02015002' if station['kind'] == 'AWS' else 'SFC01013002'}
                path = root / f'minimum_{code}_{cursor.isoformat()}.json'
                if path.exists():
                    rows = json.loads(path.read_text())['data']
                else:
                    for attempt in range(3):
                        response = client.post(original['source_url'], data=params)
                        if response.status_code != 429 or attempt == 2:
                            break
                    response.raise_for_status()
                    rows = parse_daily(response.text, code, cursor, until)
                    atomic_json(path, {'source_url':original['source_url'], 'request':params,
                                      'collected_at':datetime.now(timezone.utc).isoformat(), 'data':rows})
                minima.update({r['TM']:r.get('MIN_TA') for r in rows})
                cursor = until + timedelta(days=1)
            original_rows = {r['TM']:r for r in station['daily']}
            rows = []
            for i in range((end-start).days+1):
                day = (start+timedelta(days=i)).isoformat()
                maximum = original_rows.get(day, {}).get('MAX_TA')
                minimum = minima.get(day)
                if minimum is not None and maximum is not None and minimum > maximum:
                    raise ValueError('Minimum exceeds original maximum')
                rows.append({'date':day, 'maximum':maximum, 'minimum':minimum})
            stations[code] = {'station_id':code, 'station_name':station['name'], 'daily':rows}
            print(f"{code} {station['name']}: minimum {sum(r['minimum'] is not None for r in rows)}/{len(rows)}", flush=True)
    result = {'reference_year':year, 'period':base['period'], 'source':'기상청 ASOS/AWS 일 관측자료',
              'source_url':'https://data.kma.go.kr/data/grnd/selectAwsRltmList.do',
              'collected_at':datetime.now(timezone.utc).isoformat(), 'stations':stations}
    atomic_json(DATA_ROOT / 'processed' / f'kma_extremes_{year}.json', result)
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--year', type=int, default=2024)
    parser.add_argument('--refresh', action='store_true')
    parser.add_argument('--extremes', action='store_true', help='Collect supplementary minimum temperatures without changing scores')
    parser.add_argument('--current', action='store_true', help='Collect current-year recent and summer observations in a separate snapshot')
    args = parser.parse_args()
    if args.current:
        from backend.app.services.weather.current import collect_current
        collect_current()
    elif args.extremes:
        collect_extremes(args.year)
    else:
        collect(args.year, args.refresh)
