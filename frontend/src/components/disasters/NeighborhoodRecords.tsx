'use client';
import {ArrowRight,ChevronDown,Layers3} from 'lucide-react';
import type {Disaster,DisasterProfile} from '@/types/disasters';
import {useSnapshot} from '@/hooks/useSnapshot';
import {DISASTERS} from './catalog';
import {fmt} from '../constants';

export default function NeighborhoodRecords({region,typhoonId,onSelect}:{region:string;typhoonId:string;onSelect:(hazard:Disaster)=>void}) {
 const {data,error,retry}=useSnapshot<DisasterProfile>(`/disaster-profile/${region}?typhoon_id=${typhoonId}`);
 const facts:Partial<Record<Disaster,{value:string;note:string}>>=data?{
  flood:{value:data.hazards.flood?`${data.hazards.flood.count}개 기록 지점`:'자료 없음',note:'행정구역 안의 과거 기록 · 발생 횟수가 아닙니다'},
  landslide:{value:data.hazards.landslide?`${data.hazards.landslide.count}개 지정 지점`:'자료 없음',note:'공식 지정 대표 위치 · 실시간 발생 정보가 아닙니다'},
  typhoon:{value:data.hazards.typhoon?`${data.hazards.typhoon.year} ${data.hazards.typhoon.name} · 최근접 ${fmt(data.hazards.typhoon.closest.distance_km)}km`:'자료 없음',note:'선택한 과거 태풍 중심과의 거리 · 피해 정도가 아닙니다'},
  cold:{value:data.hazards.cold?.minimum.value!=null?`겨울 최저 ${fmt(data.hazards.cold.minimum.value)}℃`:'관측자료 불완전 / 없음',note:data.hazards.cold?`${data.hazards.cold.station_name} 관측소 · 동 전체의 실측값이 아닙니다`:'겨울 관측자료를 연결하면 확인할 수 있습니다'},
 }:{};
 return <details className="neighborhood-records" onToggle={e=>{if(e.currentTarget.open)e.currentTarget.scrollIntoView({block:'start'});}}><summary><Layers3 size={16}/><span>이 동네의 다른 재해 기록<small>침수 · 산사태 · 태풍 · 한파</small></span><ChevronDown size={15}/></summary>
  {error?<p role="alert">{error}<button onClick={retry}>다시 불러오기</button></p>:!data?<p>저장된 동네 기록을 확인하고 있습니다.</p>:<div>{DISASTERS.filter(d=>d.id!=='heat').map(({id,name,icon:Icon})=><button key={id} aria-label={`${name} 기록 보기`} onClick={()=>onSelect(id)}><Icon size={18}/><span><b>{name}</b><strong>{facts[id]?.value}</strong><small>{facts[id]?.note}</small></span><ArrowRight size={15}/></button>)}</div>}
 </details>;
}
