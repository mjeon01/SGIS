"""Display-only daily temperatures; no writes to observations or risk calculations."""
from datetime import date, timedelta
import math


def summarize_daily(rows, period):
    start, end = map(date.fromisoformat, period)
    days = [(start + timedelta(days=i)).isoformat() for i in range((end-start).days+1)]
    indexed = {}
    for row in rows:
        if row['date'] not in days or row['date'] in indexed:
            raise ValueError('Invalid or duplicate daily date')
        for key in ('maximum', 'minimum'):
            value = row.get(key)
            if value is not None and (not isinstance(value, (int, float)) or not math.isfinite(value) or not -90 <= value <= 60):
                raise ValueError('Invalid temperature')
        if row.get('minimum') is not None and row.get('maximum') is not None and row['minimum'] > row['maximum']:
            raise ValueError('Daily minimum exceeds maximum')
        indexed[row['date']] = row
    daily = [{'date':day, 'maximum':indexed.get(day, {}).get('maximum'),
              'minimum':indexed.get(day, {}).get('minimum')} for day in days]
    summary = {'expected_days':len(days)}
    for key, operation in [('maximum', max), ('minimum', min)]:
        values = [r[key] for r in daily if r[key] is not None]
        complete = len(values) == len(days)
        value = operation(values) if complete else None
        summary[key] = {'value':value, 'dates':[r['date'] for r in daily if r[key] == value] if complete else [],
                        'valid_days':len(values), 'complete':complete}
    return {'daily':daily, 'summary':summary}
