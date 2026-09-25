'use client';
import {useEffect,useRef} from 'react';
import maplibregl from 'maplibre-gl';
import type {NearbyFacilitiesController} from '@/hooks/useNearbyFacilities';
import {distanceKm,distanceLabel} from '@/hooks/useNearbyFacilities';
import {mapPadding,motionDuration} from './viewport';

function facilityIcon(kind:'shade'|'shelter'){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=64;
  const ctx=canvas.getContext('2d')!;
  ctx.fillStyle=kind==='shade'?'#ae571c':'#2563eb';ctx.strokeStyle='#fff';ctx.lineWidth=3;
  ctx.beginPath();ctx.arc(32,32,27,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.lineWidth=3;ctx.lineCap='round';ctx.lineJoin='round';
  ctx.beginPath();
  if(kind==='shade'){ctx.moveTo(16,31);ctx.quadraticCurveTo(32,6,48,31);ctx.lineTo(16,31);ctx.moveTo(32,17);ctx.lineTo(32,46);ctx.quadraticCurveTo(39,50,40,42);}
  else{ctx.moveTo(17,29);ctx.lineTo(32,17);ctx.lineTo(47,29);ctx.moveTo(22,27);ctx.lineTo(22,46);ctx.lineTo(42,46);ctx.lineTo(42,27);ctx.moveTo(29,46);ctx.lineTo(29,35);ctx.lineTo(35,35);ctx.lineTo(35,46);}
  ctx.stroke();return ctx.getImageData(0,0,64,64);
}

export default function NearbyFacilityLayer({map,controller:c}:{map:maplibregl.Map|null;controller:NearbyFacilitiesController|null}){
  const latest=useRef(c);latest.current=c;
  const pin=useRef<maplibregl.Marker|null>(null),popup=useRef<maplibregl.Popup|null>(null),lastSelection=useRef('');
  useEffect(()=>{
    if(!map)return;
    for(const kind of ['shade','shelter'] as const)map.addImage(`nearby-${kind}`,facilityIcon(kind),{pixelRatio:2});
    map.addSource('nearby-facilities',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
    map.addLayer({id:'nearby-facility-icons',type:'symbol',source:'nearby-facilities',layout:{'icon-image':['match',['get','kind'],'shade','nearby-shade','nearby-shelter'],'icon-size':['interpolate',['linear'],['zoom'],9,.48,14,.9,17,1],'icon-allow-overlap':true},paint:{'icon-opacity':['case',['==',['get','status'],'unknown'],.5,.95]}});
    map.addLayer({id:'nearby-facility-selected',type:'circle',source:'nearby-facilities',filter:['==',['get','id'],''],paint:{'circle-radius':19,'circle-color':'transparent','circle-stroke-color':'#1d4ed8','circle-stroke-width':3}});
    const select=(e:maplibregl.MapLayerMouseEvent)=>{if(latest.current?.picking)return;const id=e.features?.[0]?.properties?.id;if(id)latest.current?.select(id);};
    map.on('click','nearby-facility-icons',select);
    return()=>{map.off('click','nearby-facility-icons',select);pin.current?.remove();popup.current?.remove();pin.current=null;popup.current=null;};
  },[map]);
  useEffect(()=>{
    if(!map)return;
    (map.getSource('nearby-facilities') as maplibregl.GeoJSONSource).setData({type:'FeatureCollection',features:c?.rows.map(r=>({type:'Feature',geometry:{type:'Point',coordinates:[r.longitude,r.latitude]},properties:{id:r.id,kind:r.kind,status:r.filter_status}}))||[]});
    map.setFilter('nearby-facility-selected',['==',['get','id'],c?.selected?.id||'']);
    if(!c?.anchor){pin.current?.remove();pin.current=null;}
    else{
      if(!pin.current){const element=document.createElement('div');element.className='nearby-anchor';element.setAttribute('role','img');element.setAttribute('aria-label','가까운 시설 검색 기준점');const label=document.createElement('span');label.textContent='내가 선택한 위치';element.append(label,document.createElement('i'));pin.current=new maplibregl.Marker({element,anchor:'bottom'}).setLngLat([c.anchor.longitude,c.anchor.latitude]).addTo(map);}
      pin.current.setLngLat([c.anchor.longitude,c.anchor.latitude]);
    }
    const selected=c?.selected,key=selected?`${selected.id}:${c?.anchor?.longitude}:${c?.anchor?.latitude}`:'';
    if(!selected){popup.current?.remove();popup.current=null;lastSelection.current='';return;}
    if(key===lastSelection.current)return;
    lastSelection.current=key;popup.current?.remove();
    const content=document.createElement('div');content.className='nearby-popup-content';
    for(const [tag,text] of [['small',selected.kind==='shade'?'그늘막':'무더위쉼터'],['strong',selected.name],['p',selected.kind==='shelter'?selected.access||'이용대상 확인 필요':'공식 등록 그늘막']]){const el=document.createElement(tag);el.textContent=text;content.append(el);}
    if(c?.anchor){const distance=document.createElement('b');distance.textContent=`선택 위치에서 직선 ${distanceLabel(distanceKm(c.anchor,selected))}`;content.append(distance);}
    popup.current=new maplibregl.Popup({offset:22,maxWidth:'260px',className:'nearby-popup',closeButton:false,closeOnClick:false}).setLngLat([selected.longitude,selected.latitude]).setDOMContent(content).addTo(map);
    const bounds=new maplibregl.LngLatBounds().extend([selected.longitude,selected.latitude]);
    if(c?.anchor)bounds.extend([c.anchor.longitude,c.anchor.latitude]);
    map.fitBounds(bounds,{padding:mapPadding(map),maxZoom:16,duration:motionDuration()});
  },[map,c?.rows,c?.selected,c?.anchor]);
  return null;
}
