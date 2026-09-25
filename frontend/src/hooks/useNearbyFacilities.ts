'use client';
import {useEffect,useMemo,useState} from 'react';
import type {Facility,FacilityData,FacilityFilters} from '@/types';
import {useSnapshot} from './useSnapshot';

export type FacilityAnchor={longitude:number;latitude:number};
export type NearbyFacility=Facility&{distanceKm:number};
/** Great-circle straight-line distance, never a walking route or travel time. */
export function distanceKm(a:FacilityAnchor,b:FacilityAnchor){
  const rad=Math.PI/180,dlat=(b.latitude-a.latitude)*rad,dlon=(b.longitude-a.longitude)*rad;
  const h=Math.sin(dlat/2)**2+Math.cos(a.latitude*rad)*Math.cos(b.latitude*rad)*Math.sin(dlon/2)**2;
  return 6371.0088*2*Math.asin(Math.sqrt(Math.min(1,Math.max(0,h))));
}
export const distanceLabel=(km:number)=>km<1?`${Math.round(km*1000).toLocaleString()}m`:`${km.toFixed(1)}km`;

export function useNearbyFacilities(enabled:boolean,region:string){
  const [visible,setVisible]=useState({shelter:false,shade:false});
  const [filters,setFilters]=useState<FacilityFilters>({access:'anyone',day:'',time:''});
  const [anchor,setAnchor]=useState<FacilityAnchor|null>(null),[picking,setPicking]=useState(false),[selectedId,setSelectedId]=useState('');
  const query=new URLSearchParams({region:'21',kind:'all',access:filters.access});
  if(filters.day!=='')query.set('day',filters.day);
  if(filters.day!==''&&filters.time)query.set('time',filters.time);
  const snapshot=useSnapshot<FacilityData>(`/facilities?${query}`,enabled);
  // Keep the query city-wide so crossing a dong boundary never hides a closer facility.
  const rows=useMemo(()=>snapshot.data?.facilities.filter(r=>visible[r.kind])||[],[snapshot.data,visible]);
  const ranked=useMemo(()=>anchor?rows.map(row=>({...row,distanceKm:distanceKm(anchor,row)})).sort((a,b)=>a.distanceKm-b.distanceKm||a.id.localeCompare(b.id)):[],[anchor,rows]);
  const nearest=ranked.filter(r=>r.filter_status!=='unknown').slice(0,3);
  const unknown=ranked.filter(r=>r.filter_status==='unknown').slice(0,3);
  const selected=rows.find(r=>r.id===selectedId)||null;
  useEffect(()=>{setAnchor(null);setSelectedId('');setPicking(false);},[region]);
  useEffect(()=>{if(!enabled)setPicking(false);},[enabled]);
  const startPicking=()=>{if(!visible.shelter&&!visible.shade)setVisible({shelter:true,shade:true});setPicking(true);};
  return {...snapshot,visible,setVisible,filters,setFilters,anchor,picking,startPicking,cancelPicking:()=>setPicking(false),
    pick:(point:FacilityAnchor)=>{setAnchor(point);setPicking(false);setSelectedId('');},clear:()=>{setAnchor(null);setSelectedId('');setPicking(false);},
    rows,nearest,unknown,selected,select:setSelectedId};
}
export type NearbyFacilitiesController=ReturnType<typeof useNearbyFacilities>;
