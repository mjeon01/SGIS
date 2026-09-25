'use client';
import {useEffect,useRef} from 'react';
import maplibregl from 'maplibre-gl';
import type {LandslideMapLayer} from '@/types/disasters';
import {mapPadding,motionDuration} from './viewport';

export default function LandslideLayer({map,layer}:{map:maplibregl.Map|null;layer:LandslideMapLayer|null}) {
  const latest=useRef(layer),lastFocus=useRef<number|null>(null),lastFit=useRef(0);
  latest.current=layer;
  useEffect(()=>{
    if(!map)return;
    map.addSource('landslides',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
    map.addLayer({id:'landslide-points',type:'circle',source:'landslides',paint:{'circle-color':'#956b42','circle-radius':['interpolate',['linear'],['zoom'],9,3,15,7],'circle-stroke-color':'#fff','circle-stroke-width':1.5}});
    map.addLayer({id:'landslide-selected',type:'circle',source:'landslides',filter:['==',['get','id'],''],paint:{'circle-color':'#ffffff00','circle-radius':12,'circle-stroke-color':'#694521','circle-stroke-width':3}});
    const click=(e:maplibregl.MapLayerMouseEvent)=>{const id=e.features?.[0]?.properties?.id;if(id)latest.current?.onSelect(id);};
    const enter=()=>{map.getCanvas().style.cursor='pointer';},leave=()=>{map.getCanvas().style.cursor='';};
    map.on('click','landslide-points',click);map.on('mouseenter','landslide-points',enter);map.on('mouseleave','landslide-points',leave);
    return()=>{map.off('click','landslide-points',click);map.off('mouseenter','landslide-points',enter);map.off('mouseleave','landslide-points',leave);};
  },[map]);
  useEffect(()=>{
    if(!map)return;
    (map.getSource('landslides') as maplibregl.GeoJSONSource).setData({type:'FeatureCollection',features:(layer?.records||[]).map(p=>({type:'Feature',geometry:{type:'Point',coordinates:[p.longitude,p.latitude]},properties:{id:p.id}}))});
    map.setFilter('landslide-selected',['==',['get','id'],layer?.selected||'']);
    if(layer?.focus&&lastFocus.current!==layer.focus.id){lastFocus.current=layer.focus.id;map.fitBounds([[layer.focus.longitude,layer.focus.latitude],[layer.focus.longitude,layer.focus.latitude]],{maxZoom:15,padding:mapPadding(map),duration:motionDuration()});}
  },[map,layer]);
  useEffect(()=>{
    if(!map||!layer?.fitRequest||lastFit.current===layer.fitRequest||!layer.records.length)return;
    lastFit.current=layer.fitRequest;
    const bounds=new maplibregl.LngLatBounds();layer.records.forEach(p=>bounds.extend([p.longitude,p.latitude]));
    map.fitBounds(bounds,{padding:mapPadding(map),maxZoom:14,duration:motionDuration()});
  },[map,layer]);
  useEffect(()=>{
    if(!map||!layer?.selected)return;
    const point=layer.records.find(p=>p.id===layer.selected);if(!point)return;
    const element=document.createElement('div');element.className='landslide-map-label';element.textContent=point.type||'지정 지점';
    const marker=new maplibregl.Marker({element,anchor:'bottom',offset:[0,-17]}).setLngLat([point.longitude,point.latitude]).addTo(map);
    return()=>{marker.remove();};
  },[map,layer]);
  return null;
}
