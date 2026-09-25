'use client';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {api} from '@/services/api';
import type {FloodData,FloodRecord} from '@/types';
import type {FloodMapLayer} from '@/types/disasters';

const EMPTY:FloodRecord[]=[];
export function useFlood(enabled:boolean,region:string) {
  const [data,setData]=useState<FloodData|null>(null),[error,setError]=useState<string|null>(null),[retry,setRetry]=useState(0);
  const [tab,setTab]=useState<'history'|'forecast'>('history'),[year,setYear]=useState('all');
  const [selected,setSelected]=useState<FloodRecord|null>(null),[scenario,setScenario]=useState(30);
  const [image,setImage]=useState<{scenario:number;url:string}|null>(null),[imageError,setImageError]=useState<string|null>(null),[imageRetry,setImageRetry]=useState(0);
  const images=useRef(new Map<number,string>());
  const imageUrls=useRef(new Set<string>());
  useEffect(()=>()=>{imageUrls.current.forEach(url=>URL.revokeObjectURL(url));},[]);
  useEffect(()=>{
    if(!enabled||data)return;
    const abort=new AbortController();setError(null);
    api<FloodData>('/flood',abort.signal).then(setData).catch(e=>{if(e.name!=='AbortError')setError(e.message);});
    return()=>abort.abort();
  },[enabled,data,retry]);
  // Keep this controller mounted: filters and the loaded image survive hazard changes.
  useEffect(()=>{setSelected(null);},[region,year,tab]);
  useEffect(()=>{
    if(!data||tab!=='forecast')return;
    const cached=images.current.get(scenario);
    if(cached){setImage({scenario,url:cached});setImageError(null);return;}
    const abort=new AbortController();
    setImage(null);setImageError(null);
    fetch(`/api/flood/forecast/${scenario}.png`,{signal:abort.signal}).then(async response=>{
      if(!response.ok||!response.headers.get('content-type')?.includes('image/png'))throw new Error('예상도를 불러오지 못했습니다. 다시 시도해 주세요.');
      const blob=await response.blob();if(abort.signal.aborted)return;
      const url=URL.createObjectURL(blob);
      images.current.set(scenario,url);imageUrls.current.add(url);setImage({scenario,url});
    }).catch(e=>{if(e.name!=='AbortError')setImageError(e.message);});
    // MapLibre may still decode the image during a rapid tab change. Keep the
    // four source images valid until this controller (and its map) unmounts.
    return()=>abort.abort();
  },[data,scenario,tab,imageRetry]);
  const years=useMemo(()=>[...new Set(data?.records.map(r=>r.year).filter((y):y is number=>y!=null))].sort((a,b)=>b-a),[data]);
  const rows=useMemo(()=>data?.records.filter(r=>(region==='21'||r.region_code?.startsWith(region))&&(year==='all'||(year==='unknown'?r.year==null:r.year===Number(year))))||EMPTY,[data,region,year]);
  const selectPoint=useCallback((id:string)=>setSelected(rows.find(r=>r.id===id)||null),[rows]);
  const layer=useMemo<FloodMapLayer|null>(()=>data?{
    kind:'flood',tab,records:tab==='history'?rows:EMPTY,selected:tab==='history'?selected:null,
    onSelect:selectPoint,imageUrl:tab==='forecast'&&image?.scenario===scenario?image.url:null,bbox:data.meta.bbox,
  }:null,[data,tab,rows,selected,selectPoint,image,scenario]);
  return {data,error,tab,setTab,year,setYear,years,rows,selected,setSelected,selectPoint,scenario,setScenario,
    imageError,layer,retry:()=>setRetry(n=>n+1),retryImage:()=>{images.current.delete(scenario);setImageRetry(n=>n+1);}};
}
export type FloodController=ReturnType<typeof useFlood>;
