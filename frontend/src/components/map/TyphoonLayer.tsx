'use client';
import {useEffect,useRef} from 'react';
import maplibregl from 'maplibre-gl';
import type {TyphoonMapLayer} from '@/types/disasters';
import {mapPadding,motionDuration} from './viewport';
import {fmt} from '../constants';

export default function TyphoonLayer({map,layer}:{map:maplibregl.Map|null;layer:TyphoonMapLayer|null}) {
  const lastFit=useRef(0),latest=useRef(layer);latest.current=layer;
  const position=useRef<maplibregl.Marker|null>(null),neighborhood=useRef<maplibregl.Marker|null>(null);
  const clearMarkers=()=>{position.current?.remove();neighborhood.current?.remove();position.current=null;neighborhood.current=null;};
  const alignLabel=()=>{if(map&&position.current)position.current.getElement().classList.toggle('label-left',map.project(position.current.getLngLat()).x>map.getContainer().clientWidth-195);};
  const fit=(current:TyphoonMapLayer,duration:number)=>{
    if(!map||!current.viewRequest||!current.points.length)return;
    const scope=current.viewRequest.scope;
    const rows=scope==='full'?current.points:scope==='approach'?current.approach:current.points.filter(p=>p.timestamp===current.timestamp);
    if(!rows.length)return;
    const bounds=new maplibregl.LngLatBounds();rows.forEach(p=>bounds.extend([p.longitude,p.latitude]));
    if(current.region)bounds.extend([current.region.longitude,current.region.latitude]);
    map.setMaxBounds(null);map.setMinZoom(1);
    map.fitBounds(bounds,{padding:mapPadding(map),maxZoom:scope==='moment'?10.5:8,duration});
  };
  useEffect(()=>{
    if(!map)return;
    for(const name of ['typhoon-route','typhoon-past','typhoon-positions','typhoon-distance'])map.addSource(name,{type:'geojson',data:{type:'FeatureCollection',features:[]}});
    map.addLayer({id:'typhoon-route',type:'line',source:'typhoon-route',paint:{'line-color':'#94a0b0','line-width':3,'line-dasharray':[2,2]}});
    map.addLayer({id:'typhoon-past',type:'line',source:'typhoon-past',paint:{'line-color':'#465f99','line-width':4}});
    map.addLayer({id:'typhoon-positions',type:'circle',source:'typhoon-positions',paint:{'circle-color':'#465f99','circle-radius':4,'circle-stroke-color':'#fff','circle-stroke-width':1}});
    map.addLayer({id:'typhoon-distance',type:'line',source:'typhoon-distance',paint:{'line-color':'#bd7427','line-width':2,'line-dasharray':[3,2]}});
    const click=(e:maplibregl.MapLayerMouseEvent)=>{const time=e.features?.[0]?.properties?.timestamp;if(time)latest.current?.onSelect(time);};
    const resize=()=>{if(latest.current?.viewRequest)fit(latest.current,0);};
    map.on('click','typhoon-positions',click);map.on('move',alignLabel);map.on('resize',resize);
    return()=>{map.off('click','typhoon-positions',click);map.off('move',alignLabel);map.off('resize',resize);clearMarkers();};
  },[map]);
  useEffect(()=>{
    if(!map)return;
    const points=layer?.points||[];
    const past=points.filter(p=>p.timestamp<=(layer?.timestamp||''));
    for(const [name,rows] of [['typhoon-route',points],['typhoon-past',past]] as const){
      (map.getSource(name) as maplibregl.GeoJSONSource).setData({type:'FeatureCollection',features:rows.length>1?[{type:'Feature',geometry:{type:'LineString',coordinates:rows.map(p=>[p.longitude,p.latitude])},properties:{}}]:[]});
    }
    (map.getSource('typhoon-positions') as maplibregl.GeoJSONSource).setData({type:'FeatureCollection',features:points.map(p=>({type:'Feature',geometry:{type:'Point',coordinates:[p.longitude,p.latitude]},properties:{timestamp:p.timestamp}}))});
    const point=points.find(p=>p.timestamp===layer?.timestamp),region=layer?.region;
    (map.getSource('typhoon-distance') as maplibregl.GeoJSONSource).setData({type:'FeatureCollection',features:point&&region?[{type:'Feature',geometry:{type:'LineString',coordinates:[[region.longitude,region.latitude],[point.longitude,point.latitude]]},properties:{}}]:[]});
    if(!point||!layer){clearMarkers();return;}
    // Keep the same marker through playback; update real recorded positions.
    if(!position.current){
      const element=document.createElement('div');element.className='typhoon-position';element.setAttribute('role','img');
      const dot=document.createElement('i');dot.className='typhoon-eye';
      const label=document.createElement('span');label.className='typhoon-position-label';
      label.append(document.createElement('strong'),document.createElement('small'),document.createElement('b'));
      element.append(dot,label);
      position.current=new maplibregl.Marker({element}).setLngLat([point.longitude,point.latitude]).addTo(map);
    }
    position.current.setLngLat([point.longitude,point.latitude]);
    const element=position.current.getElement();element.setAttribute('aria-label',`태풍 중심 ${point.timestamp}`);
    element.querySelector('strong')!.textContent=layer.stormName+' 중심';
    element.querySelector('small')!.textContent=point.timestamp.slice(5,16).replace('T',' ')+' KST';
    element.querySelector('b')!.textContent=point.distance_km==null?'':`동네까지 ${fmt(point.distance_km)} km`;
    alignLabel();
    if(region){
      if(!neighborhood.current){
        const anchor=document.createElement('div');anchor.className='typhoon-neighborhood';anchor.append(document.createElement('i'),document.createElement('span'));
        neighborhood.current=new maplibregl.Marker({element:anchor}).setLngLat([region.longitude,region.latitude]).addTo(map);
      }
      neighborhood.current.setLngLat([region.longitude,region.latitude]);
      neighborhood.current.getElement().querySelector('span')!.textContent=region.region_name+' · 기준점';
    }else{neighborhood.current?.remove();neighborhood.current=null;}

  },[map,layer]);
  useEffect(()=>{
    if(!map||!layer?.viewRequest||lastFit.current===layer.viewRequest.id||!layer.points.length)return;
    lastFit.current=layer.viewRequest.id;
    fit(layer,motionDuration());
  },[map,layer]);
  return null;
}
