'use client';
import {useEffect,useRef} from 'react';
import maplibregl from 'maplibre-gl';
import type {WeatherMapLayer} from '@/types/disasters';
import {fmt} from '../constants';

export const thermalColor=(value:number|null)=>value==null?'#86918b':value>=33?'#b74132':value>=30?'#c76b30':value>=27?'#ad8432':'#477f93';
export default function WeatherLayer({map,layer}:{map:maplibregl.Map|null;layer:WeatherMapLayer|null}) {
  const lastFocus=useRef<number|null>(null);
  useEffect(()=>{
    if(!map||!layer)return;
    const markers=layer.stations.filter(s=>s.location).map(s=>{
      const button=document.createElement('button');
      button.className=`weather-marker ${s.station_id===layer.selectedStationId?'active':''}`;
      const name=document.createElement('span');name.textContent=s.station_name;
      const value=document.createElement('strong');value.textContent=s.maximum==null?'관측 없음':fmt(s.maximum)+'℃';
      button.append(name,value);button.style.setProperty('--weather-color',thermalColor(s.maximum));
      button.title=`${layer.observed_on} 일 최고기온`;
      button.setAttribute('aria-label',`${s.station_name} 관측소 선택`);
      button.onclick=()=>layer.onSelect(s.station_id);
      return new maplibregl.Marker({element:button}).setLngLat([s.location!.longitude,s.location!.latitude]).addTo(map);
    });
    return()=>markers.forEach(marker=>marker.remove());
  },[map,layer]);
  useEffect(()=>{
    if(map&&layer?.focus&&lastFocus.current!==layer.focus.id){
      lastFocus.current=layer.focus.id;
      map.flyTo({center:[layer.focus.longitude,layer.focus.latitude],zoom:12,duration:400});
    }
    // Focus is an explicit user action, never a side effect of changing hazards.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[map,layer?.focus?.id]);
  return null;
}
