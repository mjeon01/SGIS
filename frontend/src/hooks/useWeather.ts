'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {api} from '@/services/api';
import type {WeatherComparison} from '@/types';
import type {WeatherMapLayer} from '@/types/disasters';

type Job={state:string;message:string|null};
export function useWeather(enabled:boolean,stationId:string,onStationChange:(id:string)=>void) {
  const [data,setData]=useState<WeatherComparison|null>(null),[error,setError]=useState<string|null>(null),[retry,setRetry]=useState(0);
  const [period,setPeriod]=useState<'recent'|'summer'>('recent'),[date,setDate]=useState('');
  const [job,setJob]=useState<Job>({state:'idle',message:null});
  const [focus,setFocus]=useState<WeatherMapLayer['focus']>(null);
  const [fitRequest,setFitRequest]=useState(0);
  const loadedRetry=useRef(-1);
  useEffect(()=>{
    if(!enabled||loadedRetry.current===retry)return;
    const c=new AbortController();setError(null);
    api<WeatherComparison>('/current-weather/comparison',c.signal).then(result=>{loadedRetry.current=retry;setData(result);}).catch(e=>{if(e.name!=='AbortError')setError(e.message);});
    api<Job>('/current-weather/refresh',c.signal).then(setJob).catch(()=>{});
    return()=>c.abort();
  },[enabled,retry]);
  useEffect(()=>{
    if(job.state!=='running')return;
    const c=new AbortController();
    const timer=setTimeout(()=>api<Job>('/current-weather/refresh',c.signal).then(j=>{setJob(j);if(j.state==='complete')setRetry(n=>n+1);}).catch(e=>{if(e.name!=='AbortError')setJob({state:'error',message:e.message});}),3000);
    return()=>{clearTimeout(timer);c.abort();};
  },[job]);
  const refresh=async()=>{
    setJob({state:'running',message:'저장자료와 기상청 조회 상태를 확인합니다.'});
    try{const j=await api<Job>('/current-weather/refresh',undefined,{});setJob(j);if(j.state==='fresh')setRetry(n=>n+1);}
    catch(e){setJob({state:'error',message:(e as Error).message});}
  };
  const dates=useMemo(()=>[...new Set(data?.stations.flatMap(s=>s[period]?.daily.map(d=>d.date)||[])||[])].sort(),[data,period]);
  const observedOn=dates.includes(date)?date:dates.at(-1)||data?.observed_on||'';
  const comparison=useMemo<WeatherComparison|null>(()=>data?{
    ...data,observed_on:observedOn,
    stations:data.stations.map(s=>{
      const day=s[period]?.daily.find(d=>d.date===observedOn);
      const location=s.location&&s.location.start_date<=observedOn&&(!s.location.end_date||s.location.end_date>=observedOn)?s.location:null;
      return {...s,location,maximum:day?.maximum??null,minimum:day?.minimum??null};
    }).sort((a,b)=>Number(a.maximum==null)-Number(b.maximum==null)||(b.maximum??0)-(a.maximum??0)),
    observed_count:data.stations.filter(s=>s[period]?.daily.some(d=>d.date===observedOn&&d.maximum!=null)).length,
  }:null,[data,period,observedOn]);
  const station=comparison?.stations.find(s=>s.station_id===stationId)||comparison?.stations[0];
  const changePeriod=useCallback((next:'recent'|'summer')=>{setPeriod(next);setDate('');},[]);
  const focusStation=()=>{if(station?.location)setFocus({id:Date.now(),longitude:station.location.longitude,latitude:station.location.latitude});};
  const layer=useMemo<WeatherMapLayer|null>(()=>comparison?{
    kind:'weather',observed_on:observedOn,stations:comparison.stations,
    selectedStationId:station?.station_id||'',onSelect:onStationChange,focus,fitRequest,
  }:null,[comparison,observedOn,station?.station_id,onStationChange,focus,fitRequest]);
  return {data:comparison,snapshot:data,error,period,setPeriod:changePeriod,date:observedOn,setDate,dates,
    station,series:station?.[period],job,refresh,focus:focusStation,fitStations:()=>setFitRequest(n=>n+1),layer,retry:()=>setRetry(n=>n+1)};
}
export type WeatherController=ReturnType<typeof useWeather>;
