import {LocateFixed} from 'lucide-react';
import type {PendingDisaster} from '@/types/disasters';
import type {DisasterController} from '@/hooks/useDisasters';
import {coldColor} from '../map/ColdLayer';
import {fmt} from '../constants';

export default function DisasterOverlay({hazard,controller:c,legend,onExplore}:{hazard:PendingDisaster;controller:DisasterController;legend:boolean;onExplore:()=>void}) {
  const point=c.currentPoint,closest=c.typhoon.data?.closest;
  const phase=!closest?'선택 시각':c.timestamp===closest.timestamp?'가장 가까웠던 기록':c.timestamp<closest.timestamp?'최근접 이전 기록':'최근접 이후 기록';
  return <>
    {hazard==='typhoon'&&point&&<section className="map-story-card" aria-label="지도에서 보는 태풍과 동네의 관계"><div><span className="story-phase">{phase}</span><time>{point.timestamp.slice(5,16).replace('T',' ')} KST</time></div>{c.typhoon.data?.region?<><h2>{c.typhoon.data.region.region_name}까지 <strong>{fmt(point.distance_km)}<small> km</small></strong></h2><p>주황 점선은 동네 기준점과 태풍 중심을 잇습니다.</p></>:<><h2>{c.typhoon.data?.storm.name} · 과거 이동 기록</h2><p>선택 지역과의 거리 분석은 아직 연결되지 않았습니다.</p></>}<button onClick={()=>{onExplore();c.showMoment(c.timestamp);}}><LocateFixed size={15}/>{c.typhoon.data?.region?'동네와 태풍 위치 함께 보기':'태풍 위치 보기'}</button></section>}
    {hazard==='landslide'&&<div className="map-context-hint"><i/>갈색 점을 누르면 지정 주소와 현황을 볼 수 있어요</div>}
    {hazard==='cold'&&<div className="map-context-hint">{c.date} · 관측소의 일 최저기온</div>}
    {legend&&<div className="flood-map-legend disaster-legend" aria-label={`${hazard} 범례`}>
      {hazard==='cold'?<><strong>일 최저기온 · 고정 범례</strong>{[[-9,'−9℃ 이하'],[-6,'−9℃ 초과 ~ −6℃'],[-3,'−6℃ 초과 ~ −3℃'],[-1,'−3℃ 초과 ~ 0℃ 미만'],[0,'0℃ 이상']].map(([v,label])=><span key={v}><i style={{background:coldColor(Number(v))}}/>{label}</span>)}<span><i style={{background:coldColor(null)}}/>관측 없음</span></>:hazard==='landslide'?<><span><i style={{background:'#956b42'}}/>공식 지정 대표 지점</span><small>실제 발생 지점·위험면적 아님</small></>:<><span><i style={{background:'#465f99'}}/>선택 시각까지의 이동</span><span><i style={{background:'#94a0b0'}}/>이후에 기록된 이동</span><span><i style={{background:'#bd7427'}}/>동네와 중심 사이 거리</span><small>과거 기록 · 피해 정도를 뜻하지 않음</small></>}
    </div>}
  </>;
}
