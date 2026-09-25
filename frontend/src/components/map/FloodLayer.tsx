'use client';
import {useEffect, useRef} from 'react';
import type maplibregl from 'maplibre-gl';
import type {FloodMapLayer} from '@/types/disasters';

export default function FloodLayer({map,layer}:{map:maplibregl.Map|null;layer:FloodMapLayer|null}) {
  const lastSelected=useRef<string|null>(null);
  useEffect(()=>{
    if(!map)return;
    (map.getSource('flood-history') as maplibregl.GeoJSONSource).setData({type:'FeatureCollection',features:(layer?.records||[]).map(r=>({type:'Feature',geometry:{type:'Point',coordinates:[r.longitude,r.latitude]},properties:{id:r.id}}))});
    map.setFilter('flood-selected',['==',['get','id'],layer?.selected?.id||'']);
  },[map,layer?.records,layer?.selected]);
  useEffect(()=>{
    if(!map)return;
    if(map.getLayer('flood-forecast'))map.removeLayer('flood-forecast');
    if(map.getSource('flood-forecast'))map.removeSource('flood-forecast');
    if(layer?.imageUrl){
      const [west,south,east,north]=layer.bbox;
      map.addSource('flood-forecast',{type:'image',url:layer.imageUrl,coordinates:[[west,north],[east,north],[east,south],[west,south]]});
      map.addLayer({id:'flood-forecast',type:'raster',source:'flood-forecast',paint:{'raster-opacity':.72,'raster-fade-duration':0}},'area-lines');
    }
  },[map,layer?.imageUrl,layer?.bbox]);
  useEffect(()=>{
    if(layer?.selected&&lastSelected.current!==layer.selected.id){
      map?.flyTo({center:[layer.selected.longitude,layer.selected.latitude],zoom:15,duration:500});
      lastSelected.current=layer.selected.id;
    }
    if(layer&&!layer.selected)lastSelected.current=null;
  },[map,layer]);
  return null;
}
