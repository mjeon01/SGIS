'use client';
import {useEffect,useId,useRef,useState} from 'react';
import {Check,ChevronDown} from 'lucide-react';
import type {Disaster,PendingDisaster} from '@/types/disasters';
import {DISASTERS, isPendingDisaster} from './disasters/catalog';
export default function DisasterSwitch({value,onChange,availability}:{value:Disaster;onChange:(value:Disaster)=>void;availability?:Partial<Record<PendingDisaster,{status:string}>>|null}) {
 const [open,setOpen]=useState(false),root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null),id=useId();
 const current=DISASTERS.find(d=>d.id===value)!,Icon=current.icon;
 const descriptions={heat:'기온 기록과 쉼터·그늘막',flood:'과거 침수 지점과 강우별 예상도',landslide:'공식 지정 지점과 동네 특성',typhoon:'과거 태풍의 접근 경로',cold:'겨울 기온과 영하 발생일'};
 useEffect(()=>{if(!open)return;root.current?.querySelector<HTMLButtonElement>('.disaster-switch button[aria-pressed=true]')?.focus();const outside=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node))setOpen(false);};document.addEventListener('pointerdown',outside);return()=>document.removeEventListener('pointerdown',outside);},[open]);
 const close=()=>{setOpen(false);trigger.current?.focus();};
 return <div className="disaster-picker" ref={root} onKeyDown={e=>{if(e.key==='Escape'){close();e.stopPropagation();}}}>
  <button ref={trigger} className="disaster-picker-trigger" aria-label="재해 기록 선택" aria-expanded={open} aria-controls={id} onClick={()=>setOpen(v=>!v)}><span className="disaster-picker-icon"><Icon size={23}/></span><span><small>이 동네에서 살펴보기</small><strong>{value==='heat'?'폭염 대비':`${current.name} 기록`}</strong></span><span className="disaster-picker-change">재해 변경<ChevronDown size={15}/></span></button>
  {open&&<div id={id} className="disaster-picker-popover"><p>같은 동네의 기록으로 전환합니다.</p><div className="disaster-switch" role="group" aria-label="재난 유형">{DISASTERS.map(({id,name,icon:ItemIcon})=><button key={id} aria-label={name} aria-pressed={value===id} data-hazard={id} onClick={()=>{onChange(id);close();}}><ItemIcon size={20} aria-hidden="true"/><span><b>{name}</b><small>{isPendingDisaster(id)&&availability?.[id]?.status==='unavailable'?'데이터 준비 중':descriptions[id]}</small></span>{value===id&&<Check size={17}/>}</button>)}</div></div>}
 </div>;
}
