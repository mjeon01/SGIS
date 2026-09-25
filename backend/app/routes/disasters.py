"""Small read-only API surface for collected disaster datasets."""
from typing import Annotated, Literal
from fastapi import APIRouter, Query, Path
from ..services import disasters

Region = Annotated[str | None, Query(pattern=r'^21(?:\d{3}(?:\d{3})?)?$')]
StormId = Annotated[str, Path(pattern=r'^20\d{2}-\d{2}$')]


def router_for(repo):
    router = APIRouter(prefix='/api')

    @router.get('/disasters')
    def inventory():
        return disasters.inventory()

    @router.get('/landslides')
    def landslides():
        return disasters.snapshot('landslide')

    @router.get('/typhoons')
    def typhoons(region: Region = None):
        data = disasters.snapshot('typhoon')
        reference = disasters.region_reference(repo, region) if region else None
        storms = []
        for storm in data['storms']:
            summary = {k: v for k, v in storm.items() if k != 'points'}
            if reference:
                closest = min(storm['points'], key=lambda point: disasters.distance(reference, point))
                summary.update(closest_distance_km=round(disasters.distance(reference, closest), 2), closest_timestamp=closest['timestamp'])
            storms.append(summary)
        if reference:
            storms.sort(key=lambda s: (s['year'], s['closest_distance_km'], s['number']))
        return {'meta': data['meta'], 'storms': storms}

    @router.get('/typhoons/{identifier}')
    def typhoon(identifier: StormId, region: Region = None):
        return disasters.typhoon_detail(identifier, disasters.region_reference(repo, region) if region else None)

    @router.get('/climate/seasons/{season_id}')
    def season(season_id: Literal['winter-2025-2026'], region: Region = None):
        return disasters.winter_season(disasters.region_reference(repo, region) if region else None)

    @router.get('/disaster-profile/{region_code}')
    def profile(region_code: Annotated[str, Path(pattern=r'^21(?:\d{3}(?:\d{3})?)?$')],
                typhoon_id: Annotated[str, Query(pattern=r'^20\d{2}-\d{2}$')] = '2022-11'):
        return disasters.region_profile(repo, region_code, typhoon_id)

    return router
