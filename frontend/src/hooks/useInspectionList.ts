'use client';
import {useEffect,useState} from 'react';
import type {InspectionDraft,InspectionItem} from '@/components/readiness/inspection';
const KEY='climateguard.inspection.v1';
function valid(value:unknown):value is InspectionItem {
 if(!value||typeof value!=='object')return false;const r=value as Partial<InspectionItem>;
 if(r.analysisScope&&(!/^\d{2}(\d{3})?$/.test(r.analysisScope.parent)||!['children','dong'].includes(r.analysisScope.level)))return false;
 return ['id','title','regionCode','regionName','reference','source','sourceUrl','sourceId','note','addedAt'].every(key=>typeof r[key as keyof InspectionItem]==='string')&&/^https?:\/\//.test(r.sourceUrl||'')&&['region','facility','flood','landslide'].includes(r.kind||'')&&['heat','flood','landslide','typhoon','cold'].includes(r.hazard||'')&&typeof r.checked==='boolean'&&Array.isArray(r.evidence)&&r.evidence.every(v=>typeof v==='string');
}
export function useInspectionList(){
 const [items,setItems]=useState<InspectionItem[]>([]),[ready,setReady]=useState(false),[error,setError]=useState<string|null>(null);
 const [canPersist,setCanPersist]=useState(true);
 useEffect(()=>{try{const saved=JSON.parse(localStorage.getItem(KEY)||'[]');if(!Array.isArray(saved)||!saved.every(valid))throw new Error('Invalid saved list');setItems(saved);}catch{setCanPersist(false);setError('저장한 목록을 읽지 못해 자동 저장을 중단했습니다. 기존 저장 내용은 유지됩니다. 새 목록은 파일로 내려받아 주세요.');}setReady(true);},[]);
 useEffect(()=>{if(!ready||!canPersist)return;try{localStorage.setItem(KEY,JSON.stringify(items));}catch{setError('브라우저 저장 공간을 사용할 수 없습니다. 목록을 파일로 내려받아 주세요.');}},[items,ready,canPersist]);
 const add=(item:InspectionDraft)=>setItems(rows=>rows.some(r=>r.id===item.id)?rows:[{...item,checked:false,note:'',addedAt:new Date().toISOString()},...rows]);
 return {items,ready,error,add,has:(id:string)=>items.some(r=>r.id===id),remove:(id:string)=>setItems(rows=>rows.filter(r=>r.id!==id)),update:(id:string,patch:Pick<Partial<InspectionItem>,'checked'|'note'>)=>setItems(rows=>rows.map(r=>r.id===id?{...r,...patch}:r))};
}
