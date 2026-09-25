'use client';
import {useEffect,useRef} from 'react';
import maplibregl from 'maplibre-gl';
import {fmt} from '../constants';

type Observation={id:string;name:string;latitude:number;longitude:number;value:number|null;color:string;label:string;title:string};

/** Update existing markers during playback, retaining focus and avoiding flicker. */
export function useObservationMarkers(map:maplibregl.Map|null,rows:Observation[],selected:string,onSelect:((id:string)=>void)|undefined,cold=false){
  const markers=useRef(new Map<string,maplibregl.Marker>()),callback=useRef(onSelect);callback.current=onSelect;
  useEffect(()=>{
    const current=markers.current;
    return()=>{current.forEach(marker=>marker.remove());current.clear();};
  },[map]);
  useEffect(()=>{
    if(!map)return;
    const ids=new Set(rows.map(r=>r.id));
    for(const [id,marker] of markers.current){if(!ids.has(id)){marker.remove();markers.current.delete(id);}}
    for(const row of rows){
      let marker=markers.current.get(row.id);
      if(!marker){
        const button=document.createElement('button');button.type='button';
        button.append(document.createElement('span'),document.createElement('strong'));
        button.onclick=()=>callback.current?.(row.id);
        marker=new maplibregl.Marker({element:button}).setLngLat([row.longitude,row.latitude]).addTo(map);
        markers.current.set(row.id,marker);
      }
      const button=marker.getElement();
      button.className=`weather-marker observation-marker ${cold?'cold-marker':''} ${row.id===selected?'active':''}`;
      button.setAttribute('aria-pressed',String(row.id===selected));button.setAttribute('aria-label',row.label);button.title=row.title;
      button.querySelector('span')!.textContent=row.name;
      button.querySelector('strong')!.textContent=row.value==null?'관측 없음':`${fmt(row.value)}℃`;
      button.style.setProperty('--weather-color',row.color);
      marker.setLngLat([row.longitude,row.latitude]);
    }
  },[map,rows,selected,cold]);
}
