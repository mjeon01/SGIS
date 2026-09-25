'use client';
import {useCallback,useMemo,useState} from 'react';
import type {Disaster,DisasterMapLayer,PendingDisaster,DatasetProvenance,LandslideData,TyphoonList,TyphoonData,WinterData} from '@/types/disasters';
import {useSnapshot} from './useSnapshot';

export function useDisasters(hazard:Disaster,region:string,onOpen:()=>void) {
  const inventory=useSnapshot<Partial<Record<PendingDisaster,{status:'ready'|'unavailable';meta?:DatasetProvenance}>>>('/disasters');
  const landslide=useSnapshot<LandslideData>('/landslides',hazard==='landslide');
  const [year,setYear]=useState(2022),[stormId,setStormId]=useState('2022-11');
  const regionQuery=region.startsWith('21')?`?region=${region}`:'';
  const list=useSnapshot<TyphoonList>(`/typhoons${regionQuery}`,hazard==='typhoon');
  const typhoon=useSnapshot<TyphoonData>(`/typhoons/${stormId}${regionQuery}`,hazard==='typhoon');
  const winter=useSnapshot<WinterData>(`/climate/seasons/winter-2025-2026${regionQuery}`,hazard==='cold');
  const [pointId,setPointId]=useState('');
  const [focus,setFocus]=useState<{id:number;longitude:number;latitude:number}|null>(null);
  const [timestamps,setTimestamps]=useState<Record<string,string>>({});
  const [winterDate,setWinterDate]=useState('');
  const [stationOverride,setStationOverride]=useState<{region:string;id:string}|null>(null);
  const [landslideFit,setLandslideFit]=useState(0);
  const [trackScope,setTrackScope]=useState<'approach'|'full'>('approach');
  const [viewRequest,setViewRequest]=useState<{id:number;scope:'full'|'approach'|'moment'}|null>(null);
  const [playRequest,setPlayRequest]=useState(0);
  const [pauseRequest,setPauseRequest]=useState(0);
  const records=useMemo(()=>landslide.data?.records.filter(p=>region==='21'||p.region_code?.startsWith(region))||[],[landslide.data,region]);
  const selectedPoint=records.find(p=>p.id===pointId)||null;
  const selectPoint=useCallback((id:string)=>{setPointId(id);onOpen();const p=landslide.data?.records.find(p=>p.id===id);if(p)setFocus({id:Date.now(),longitude:p.longitude,latitude:p.latitude});},[landslide.data,onOpen]);
  const approach=useMemo(()=>{
    const points=typhoon.data?.storm.points||[],closest=typhoon.data?.closest;
    if(!closest)return points;
    const center=Date.parse(closest.timestamp);
    return points.filter(p=>Date.parse(p.timestamp)>=center-24*3600000&&Date.parse(p.timestamp)<=center+12*3600000);
  },[typhoon.data]);
  const timestamp=timestamps[stormId]||typhoon.data?.closest?.timestamp||typhoon.data?.storm.points[0]?.timestamp||'';
  // A map click or region change can select a record outside the local approach window.
  const visibleTrackScope=trackScope==='approach'&&!approach.some(p=>p.timestamp===timestamp)?'full':trackScope;
  const setTimestamp=useCallback((value:string)=>setTimestamps(v=>({...v,[stormId]:value})),[stormId]);
  const frame=useCallback((scope:'full'|'approach'|'moment')=>setViewRequest(v=>({id:(v?.id||0)+1,scope})),[]);
  const chooseTimestamp=useCallback((value:string)=>{setTimestamp(value);setPauseRequest(n=>n+1);},[setTimestamp]);
  const fitTrack=()=>{setTrackScope('full');setPauseRequest(n=>n+1);frame('full');};
  const showMoment=(value:string)=>{chooseTimestamp(value);frame('moment');};
  const replayApproach=()=>{if(!approach.length)return;setTrackScope('approach');setTimestamp(approach[0].timestamp);frame('approach');setPlayRequest(n=>n+1);};
  const currentPoint=typhoon.data?.storm.points.find(p=>p.timestamp===timestamp);
  const stationId=(stationOverride?.region===region?stationOverride.id:null)||winter.data?.nearest?.station_id||winter.data?.stations[0]?.station_id||'';
  const station=winter.data?.stations.find(s=>s.station_id===stationId);
  const dates=useMemo(()=>winter.data?.stations[0]?.daily.map(d=>d.date)||[],[winter.data]);
  const date=dates.includes(winterDate)?winterDate:dates[0]||'';
  const selectStation=useCallback((id:string)=>{setStationOverride({region,id});onOpen();},[region,onOpen]);
  const active=hazard==='landslide'?landslide:hazard==='typhoon'?typhoon:winter;
  const layer=useMemo<DisasterMapLayer|null>(()=>{
    if(hazard==='landslide'&&landslide.data)return {kind:'landslide',records,selected:selectedPoint?.id||'',onSelect:selectPoint,focus,fitRequest:landslideFit};
    if(hazard==='typhoon'&&typhoon.data)return {kind:'typhoon',points:typhoon.data.storm.points,timestamp,onSelect:chooseTimestamp,region:typhoon.data.region,closest:typhoon.data.closest,stormName:typhoon.data.storm.name,approach,viewRequest};
    if(hazard==='cold'&&winter.data)return {kind:'cold',stations:winter.data.stations,date,selected:stationId,onSelect:selectStation};
    return null;
  },[hazard,landslide.data,records,selectedPoint,selectPoint,focus,landslideFit,typhoon.data,timestamp,chooseTimestamp,approach,viewRequest,winter.data,date,stationId,selectStation]);
  const steps=useMemo(()=>hazard==='typhoon'?(visibleTrackScope==='approach'?approach:typhoon.data?.storm.points||[]).map(p=>p.timestamp):hazard==='cold'?dates:[],[hazard,visibleTrackScope,approach,typhoon.data,dates]);
  return {inventory,landslide,list,typhoon,winter,active,layer,records,selectedPoint,selectPoint,year,stormId,
    setYear:(value:number)=>{const first=list.data?.storms.find(s=>s.year===value);if(first){setYear(value);setStormId(first.id);}},setStormId,
    timestamp,setTimestamp,currentPoint,fitTrack,showMoment,replayApproach,approach,trackScope:visibleTrackScope,playRequest,pauseRequest,onPlay:()=>frame(visibleTrackScope),fitLandslides:()=>setLandslideFit(n=>n+1),date,setDate:setWinterDate,stationId,station,selectStation,steps,
    timelineValue:hazard==='typhoon'?timestamp:date,onTimeChange:hazard==='typhoon'?setTimestamp:setWinterDate};
}
export type DisasterController=ReturnType<typeof useDisasters>;
