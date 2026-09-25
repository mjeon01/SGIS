'use client';
import {ArrowRight,LocateFixed,Play,Route} from 'lucide-react';
import type {DisasterController} from '@/hooks/useDisasters';
import NeighborhoodProfile from './NeighborhoodProfile';
import {fmt} from '../constants';
import {LOCAL_DATA_AREAS} from './coverage';

const time=(v:string)=>v.slice(5,16).replace('T',' ');
export default function TyphoonPanel({controller:c,region,onExplore,onReturn}:{controller:DisasterController;region:string;onExplore:()=>void;onReturn:()=>void}) {
  const data=c.typhoon.data;if(!data)return null;
  const {storm,closest}=data,point=c.currentPoint,local=data.region?.region_name||'선택 지역';
  const milestones=[{label:'이전 기록',point:c.approach[0]},{label:'최근접',point:closest},{label:'이후 기록',point:c.approach.at(-1)}];
  const explore=(action:()=>void)=>{onExplore();action();};
  return <>
    <span className="eyebrow">우리 동네와 과거 태풍</span><h2>{closest?'얼마나 가까이 지나갔을까?':'과거 태풍은 어디로 이동했을까?'}</h2>
    {closest?<article className="local-answer typhoon-closest">
      <span>{storm.year}년 {storm.name} · {local} 기준</span><h3>가장 가까웠을 때</h3>
      <strong>{fmt(closest.distance_km)}<small>km</small></strong>
      <p>{time(closest.timestamp)} · 한국시간</p>
      <p className="answer-explanation">동네 기준점과 태풍 중심 사이의 거리입니다.</p>
    </article>:<article className="local-answer"><h3>선택 지역의 거리 분석은 준비 중입니다</h3><p>현재 거리 분석 연결 지역: {LOCAL_DATA_AREAS.typhoon.map(area=>area.name).join(', ')}. 과거 태풍 경로는 지역을 바꾸지 않고 살펴볼 수 있습니다.</p></article>}
    <button className="disaster-primary" onClick={()=>explore(c.replayApproach)} disabled={c.approach.length<2}><Play size={17} aria-hidden="true"/><span>{closest?'우리 동네 접근 과정 보기':'태풍 이동 과정 보기'}<small>{closest?'최근접 전 24시간부터 이후 12시간의 기록':'저장된 중심 위치 순서대로 재생'}</small></span><ArrowRight size={17} aria-hidden="true"/></button>
    <p className="action-caption">{closest?'누르면 동네와 이동 경로가 함께 보이도록 지도를 맞춥니다.':'누르면 저장된 태풍 이동 경로가 화면에 들어오도록 지도를 맞춥니다.'}</p>
    <div className="disaster-fields compact-fields"><label>연도<select aria-label="태풍 연도" value={c.year} onChange={e=>c.setYear(Number(e.target.value))}>{(c.list.data?.meta.years||[c.year]).map(y=><option key={y} value={y}>{y}년</option>)}</select></label><label>{closest?'태풍 · 동네에 가까웠던 순':'태풍 · 기록 목록'}<select aria-label="태풍 선택" value={c.stormId} onChange={e=>c.setStormId(e.target.value)}>{(c.list.data?.storms.filter(s=>s.year===c.year)||[storm]).map(s=><option key={s.id} value={s.id}>{s.number}호 {s.name}{s.closest_distance_km!=null?` · ${fmt(s.closest_distance_km)}km`:""}</option>)}</select></label></div>
    {c.list.error&&<p role="alert">{c.list.error} <button onClick={c.list.retry}>목록 다시 불러오기</button></p>}
    {closest&&<div className="track-milestones" aria-label="태풍 주요 시점">{milestones.map(({label,point:p})=>p&&<button key={label} aria-pressed={p.timestamp===c.timestamp} onClick={()=>explore(()=>c.showMoment(p.timestamp))}><span>{label}</span><strong>{fmt(p.distance_km)}<small> km</small></strong><time>{time(p.timestamp)}</time></button>)}</div>}
    <div className="disaster-actions secondary-actions">{closest&&<button onClick={()=>explore(()=>c.showMoment(closest.timestamp))}><LocateFixed size={14}/>최근접 시각 보기</button>}<button onClick={()=>explore(c.fitTrack)}><Route size={14}/>전체 태풍 경로 보기</button><button onClick={onReturn}>선택 지역으로 돌아가기</button></div>
    <p className="disaster-note">과거 이동 기록으로 동네와 태풍의 위치 관계를 살펴봅니다. 가까웠던 거리만으로 실제 피해나 지금의 위험을 판단할 수 없습니다.</p>
    {point&&<details className="record-details"><summary>선택 시각의 기압·풍속 보기</summary><p>{point.timestamp.slice(0,16).replace('T',' ')} KST</p><dl className="disaster-metrics"><div><dt>중심기압</dt><dd>{fmt(point.pressure_hpa,0)}<small> hPa</small></dd></div><div><dt>최대풍속</dt><dd>{fmt(point.wind_speed_ms,0)}<small> m/s</small></dd></div></dl><p className="disaster-note">기록된 시각 사이의 위치는 추정하지 않습니다. 태풍 전후 열대저압부·온대저기압 기록이 포함될 수 있습니다.</p></details>}
    <NeighborhoodProfile region={region} typhoonId={c.stormId}/>
  </>;
}
