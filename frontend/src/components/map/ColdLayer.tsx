'use client';
import type maplibregl from 'maplibre-gl';
import type {ColdMapLayer} from '@/types/disasters';
import {coldColor} from './observation-colors';
import {useObservationMarkers} from './useObservationMarkers';
export {coldColor} from './observation-colors';

export default function ColdLayer({map,layer}:{map:maplibregl.Map|null;layer:ColdMapLayer|null}) {
  const rows=layer?.stations.flatMap(station=>{
    const locations=station.locations.filter(l=>l.start_date<=layer.date&&(!l.end_date||l.end_date>=layer.date));
    if(locations.length!==1)return [];
    const value=station.daily.find(d=>d.date===layer.date)?.minimum??null;
    return [{id:station.station_id,name:station.station_name,latitude:locations[0].latitude,longitude:locations[0].longitude,
      value,color:coldColor(value),label:`${station.station_name} 겨울 관측소 선택`,title:`${layer.date} 일 최저기온`}];
  })||[];
  useObservationMarkers(map,rows,layer?.selected||'',layer?.onSelect,true);
  return null;
}
