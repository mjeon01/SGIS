'use client';
import {useEffect,useRef} from 'react';
import maplibregl from 'maplibre-gl';
import type {WeatherMapLayer} from '@/types/disasters';
import {thermalColor} from './observation-colors';
import {useObservationMarkers} from './useObservationMarkers';
import {mapPadding,motionDuration} from './viewport';
export {thermalColor} from './observation-colors';

export default function WeatherLayer({map,layer}:{map:maplibregl.Map|null;layer:WeatherMapLayer|null}) {
  const lastFocus=useRef<number|null>(null),lastFit=useRef(0);
  useObservationMarkers(map,layer?.stations.filter(s=>s.location).map(s=>({
    id:s.station_id,name:s.station_name,latitude:s.location!.latitude,longitude:s.location!.longitude,
    value:s.maximum,color:thermalColor(s.maximum),label:`${s.station_name} 관측소 선택`,title:`${layer.observed_on} 일 최고기온`,
  }))||[],layer?.selectedStationId||'',layer?.onSelect);
  useEffect(()=>{
    if(!map||!layer?.fitRequest||lastFit.current===layer.fitRequest)return;
    const stations=layer.stations.filter(s=>s.location);
    if(!stations.length)return;
    lastFit.current=layer.fitRequest;
    const bounds=new maplibregl.LngLatBounds();stations.forEach(s=>bounds.extend([s.location!.longitude,s.location!.latitude]));
    map.fitBounds(bounds,{padding:mapPadding(map),maxZoom:11,duration:motionDuration()});
  },[map,layer]);
  useEffect(()=>{
    if(map&&layer?.focus&&lastFocus.current!==layer.focus.id){
      lastFocus.current=layer.focus.id;
      map.flyTo({center:[layer.focus.longitude,layer.focus.latitude],zoom:12,duration:motionDuration(400)});
    }
    // Focus is an explicit user action, never a side effect of changing hazards.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[map,layer?.focus?.id]);
  return null;
}
