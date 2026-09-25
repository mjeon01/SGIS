'use client';
import {useEffect,useRef} from 'react';
import {ArrowRight,MapPin,Maximize2} from 'lucide-react';
import type {DisasterController} from '@/hooks/useDisasters';
import NeighborhoodProfile from './NeighborhoodProfile';

export default function LandslidePanel({controller:c,region,place,onExplore,onRegion}:{controller:DisasterController;region:string;place:string;onExplore:()=>void;onRegion:(code:string)=>void}) {
  const detail=useRef<HTMLElement>(null);
  useEffect(()=>{
    const element=detail.current,panel=element?.closest('.disaster-panel');
    if(element&&panel)panel.scrollTop+=element.getBoundingClientRect().top-panel.getBoundingClientRect().top-14;
  },[c.selectedPoint?.id]);
  if(!c.landslide.data)return null;
  const selected=c.selectedPoint,local=place.replace('부산광역시 ','');
  const focus=(id:string)=>{onExplore();c.selectPoint(id);};
  return <>
    <span className="eyebrow">동네 주변의 공식 지정 위치</span><h2>어디가 취약지역으로 지정됐을까?</h2>
    <article className="local-answer landslide-answer"><span>{local} 안에 연결된 지정 지점</span><strong>{c.records.length}<small>곳</small></strong><p>{c.records.length?'집·학교·자주 가는 길 주변의 지정 위치를 확인해 보세요.':'이 행정구역에 연결된 지정 지점이 없습니다.'}</p></article>
    {c.records.length>0?<><button className="disaster-primary" onClick={()=>{onExplore();c.fitLandslides();}}><MapPin size={18}/><span>지정 위치 한눈에 보기<small>지도에서 위치를 고르면 상세 주소를 확인할 수 있어요</small></span><ArrowRight size={17}/></button><p className="action-caption">실제 발생 지점이나 위험 면적을 나타내는 자료는 아닙니다.</p></>:<p className="disaster-note">지정 지점이 없다는 뜻이며, 산사태가 발생하지 않는다는 의미는 아닙니다.</p>}
    {selected&&<article ref={detail} className="landslide-detail" data-id={selected.id}><span className="eyebrow">선택한 지정 지점</span><h3><MapPin size={16}/>{selected.name}</h3><dl className="profile-records"><div><dt>유형</dt><dd>{selected.type||'자료 없음'}</dd></div><div><dt>지정 상태</dt><dd>{selected.status||'자료 없음'}</dd></div><div><dt>지정일</dt><dd>{selected.designated_date||'자료 없음'}</dd></div><div><dt>행정동</dt><dd>{selected.region_name||'경계 연결 안 됨'}</dd></div></dl>{selected.current_status&&<div className="designation-memo"><strong>공개자료에 기재된 현황</strong><p>{selected.current_status}</p></div>}{selected.region_code?<NeighborhoodProfile region={selected.region_code} compact/>:<p className="disaster-note">행정동을 확인하지 못해 통계를 연결하지 않습니다.</p>}</article>}
    <div className="landslide-list-heading"><h3>지정 지점 목록</h3><span>눌러서 지도에서 확인</span></div>
    <div className="landslide-list" aria-label="산사태 취약지역 목록">{c.records.map((p,i)=><button key={p.id} aria-pressed={selected?.id===p.id} onClick={()=>focus(p.id)}><b className="point-number">{i+1}</b><span>{p.name.replace('부산광역시 ','')}<small>{p.type||'유형 미확인'} · {p.status||'상태 미확인'}</small></span><ArrowRight size={15}/></button>)}</div>
    {region!=='21'&&<div className="disaster-actions secondary-actions">{region.length===8&&<button onClick={()=>onRegion(region.slice(0,5))}><Maximize2 size={14}/>구·군 범위에서 보기</button>}<button onClick={()=>onRegion('21')}>부산 전체 보기</button></div>}
    {!selected&&region!=='21'&&<NeighborhoodProfile region={region} compact/>}
    <details className="record-details"><summary>지정 자료를 읽는 방법</summary><p>지도 점은 공식 지정 산사태 취약지역의 대표 위치입니다. 점 주변을 위험 면적으로 칠하거나 지점 수로 동네의 위험도를 매기지 않습니다.</p><p>원자료 {c.landslide.data.meta.source_count}개 중 좌표 검증 제외 {c.landslide.data.meta.excluded_count}개. 행정동 미연결 {c.landslide.data.meta.unassigned_count}개는 부산 전체에서 표시합니다. 원자료 기준일은 미확인입니다.</p></details>
  </>;
}
