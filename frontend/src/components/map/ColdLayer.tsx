'use client';
import {useEffect} from 'react';
import maplibregl from 'maplibre-gl';
import type {ColdMapLayer} from '@/types/disasters';
import {fmt} from '../constants';

export const coldColor=(v:number|null)=>v==null?'#86918b':v<=-9?'#344c94':v<=-6?'#437fbd':v<=-3?'#56a2b8':v<0?'#6fb9bc':'#748985';
export default function ColdLayer({map,layer}:{map:maplibregl.Map|null;layer:ColdMapLayer|null}) {
  useEffect(()=>{
    if(!map||!layer)return;
    const markers:maplibregl.Marker[]=[];
    for(const station of layer.stations){
      const locations=station.locations.filter(l=>l.start_date<=layer.date&&(!l.end_date||l.end_date>=layer.date));
      if(locations.length!==1)continue;
      const value=station.daily.find(d=>d.date===layer.date)?.minimum??null;
      const button=document.createElement('button');button.className=`weather-marker cold-marker ${station.station_id===layer.selected?'active':''}`;
      const name=document.createElement('span');name.textContent=station.station_name;
      const temperature=document.createElement('strong');temperature.textContent=value==null?'관측 없음':fmt(value)+'℃';
      button.append(name,temperature);button.style.setProperty('--weather-color',coldColor(value));
      button.setAttribute('aria-label',`${station.station_name} 겨울 관측소 선택`);button.title=`${layer.date} 일 최저기온`;
      button.onclick=()=>layer.onSelect(station.station_id);
      markers.push(new maplibregl.Marker({element:button}).setLngLat([locations[0].longitude,locations[0].latitude]).addTo(map));
    }
    return()=>markers.forEach(m=>m.remove());
  },[map,layer]);
  return null;
}
