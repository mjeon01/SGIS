"""Registered schedule matching. Unknown never means closed."""
import json
from functools import lru_cache
from ..core.settings import DATA_ROOT


@lru_cache(maxsize=2)
def _load(stamp):
    return json.loads((DATA_ROOT/'processed/facilities_2026.json').read_text())


def inventory():
    path=DATA_ROOT/'processed/facilities_2026.json'
    return _load(path.stat().st_mtime_ns)


def minute(value):
    if not isinstance(value,str):return None
    value=value.replace(':','')
    if len(value)!=4 or not value.isdigit():return None
    h,m=int(value[:2]),int(value[2:])
    return h*60+m if (0<=h<24 and 0<=m<60) or (h==24 and m==0) else None


def match(row, access='all', day=None, time=None):
    if row['kind']!='shelter':return 'excluded'
    unknown=False
    if access=='anyone':
        if row['access']=='특정인':return 'excluded'
        if row['access']!='누구나':unknown=True
    if row.get('operating')=='N':return 'excluded'
    if day is not None:
        schedule=row.get('schedule') or {}
        days=schedule.get('days')
        weekend=schedule.get('weekend_open')
        if days is None:unknown=True
        elif day not in days:
            if day>=5 and weekend=='Y':unknown=True
            else:return 'excluded'
        if day>=5 and weekend=='N' and days and day in days:unknown=True
        if time:
            window=schedule.get('weekend' if day>=5 else 'weekday') or [None,None]
            begin,end=map(minute,window)
            selected=minute(time)
            if begin is None or end is None or end<=begin:unknown=True
            elif not begin<=selected<end:return 'excluded'
    return 'unknown' if unknown else 'matched'


def filtered(region='21',kind='all',access='all',day=None,time=None):
    data=inventory()
    rows=[]
    for row in data['facilities']:
        if region!='21' and not (row['region_code'] or '').startswith(region):continue
        if kind!='all' and row['kind']!=kind:continue
        status=match(row,access,day,time) if row['kind']=='shelter' else 'matched'
        if status!='excluded':rows.append({**row,'filter_status':status})
    return {**data,'facilities':rows,'filter_counts':{s:sum(r['filter_status']==s for r in rows) for s in ['matched','unknown']}}
