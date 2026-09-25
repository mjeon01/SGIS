'use client';
import {useEffect,useRef,useState} from 'react';
import {ChevronDown,Globe2,MapPin,X} from 'lucide-react';
import type {RegionOption} from '@/types';

type Props={place:string;province:string;district:string;dong:string;provinces:RegionOption[];districts:RegionOption[];dongs:RegionOption[];onNavigate:(code:string,selected?:string|null)=>void;error:string|null;coverage:string};
export default function RegionNavigator({place,province,district,dong,provinces,districts,dongs,onNavigate,error,coverage}:Props){
 const [open,setOpen]=useState(false);const root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null),first=useRef<HTMLSelectElement>(null);
 useEffect(()=>{if(open)first.current?.focus();},[open]);
 useEffect(()=>{if(!open)return;const close=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false);};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close);},[open]);
 const close=()=>{setOpen(false);trigger.current?.focus();};
 return <div ref={root} className="region-navigator" onKeyDown={e=>{if(e.key==='Escape'){close();e.stopPropagation();}}}>
  <button ref={trigger} className="region-navigator-trigger" aria-label="지역 선택" aria-expanded={open} aria-controls="region-navigator-options" onClick={()=>setOpen(v=>!v)}><MapPin size={15}/><span>{place}</span><ChevronDown size={14}/></button>
  {open&&<section className="region-navigator-popover" id="region-navigator-options" aria-label="전국 지역 탐색">
   <div className="region-navigator-heading"><div><span>대한민국</span><h2>살펴볼 지역 선택</h2></div><button aria-label="지역 선택 닫기" onClick={close}><X size={19}/></button></div>
   <div className="region-navigator-fields">
    <label>시·도<select ref={first} aria-label="탐색 시·도" value={province} onChange={e=>onNavigate(e.target.value)}>{provinces.map(r=><option key={r.region_code} value={r.region_code}>{r.region_name}</option>)}</select></label>
    <label>시·군·구<select aria-label="탐색 시·군·구" value={district} onChange={e=>onNavigate(e.target.value||province)}><option value="">전체 시·군·구</option>{districts.map(r=><option key={r.region_code} value={r.region_code}>{r.region_name}</option>)}</select></label>
    <label>읍·면·동<select aria-label="탐색 읍·면·동" value={dong} disabled={!district} onChange={e=>onNavigate(district||province,e.target.value||null)}><option value="">전체 읍·면·동</option>{dongs.map(r=><option key={r.region_code} value={r.region_code}>{r.region_name}</option>)}</select></label>
   </div>
   {error&&<p role="alert">{error}</p>}
   <p className="region-coverage-note"><i/>지역별 분석자료 연결 · {coverage}<small>전국 경계를 탐색할 수 있습니다. 분석자료는 연결된 지역에서 제공합니다.</small></p>
   <div className="region-navigator-actions"><button onClick={()=>{onNavigate('00');close();}}><Globe2 size={16}/>전국 지도</button><button onClick={close}>선택 지역 보기</button></div>
  </section>}
 </div>;
}
