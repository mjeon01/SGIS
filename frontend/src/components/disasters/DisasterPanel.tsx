'use client';
import {useEffect,useRef} from 'react';
import {CartesianGrid,Line,LineChart,ReferenceLine,ResponsiveContainer,Tooltip,XAxis,YAxis} from 'recharts';
import type {PendingDisaster,DatasetProvenance} from '@/types/disasters';
import type {DisasterController} from '@/hooks/useDisasters';
import NeighborhoodProfile from './NeighborhoodProfile';
import {fmt} from '../constants';
import TyphoonPanel from './TyphoonPanel';
import LandslidePanel from './LandslidePanel';

export const disasterMeaning={
  landslide:'공식 지정 산사태 취약지역의 대표 지점이며 실제 산사태 발생 지점이나 위험 면적을 의미하지 않습니다.',
  typhoon:'태풍 중심과의 거리는 위치 관계를 나타내며 해당 지역의 실제 피해 정도를 의미하지 않습니다. 기록된 시각 사이를 보간하지 않습니다.',
  cold:'일최저기온 < 0℃인 날을 셉니다. 0℃는 제외하며 공식 한파특보 일수와 다른 값입니다. 관측소 기온은 행정동 전체의 실측기온이 아닙니다.',
};
export function SourceInfo({meta}:{meta:DatasetProvenance}) {
  return <footer className="disaster-source"><a href={meta.source_url} target="_blank" rel="noreferrer">{meta.source} ↗</a><p>수집 {new Date(meta.collected_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})} KST</p>{meta.period&&<p>관측기간 {meta.period.join(' ~ ')}</p>}</footer>;
}

export default function DisasterPanel({hazard,controller:c,region,place,onReturn,onExplore,onRegion}:{hazard:PendingDisaster;controller:DisasterController;region:string;place:string;onReturn:()=>void;onExplore:()=>void;onRegion:(code:string)=>void}) {
  const panel=useRef<HTMLElement>(null);
  useEffect(()=>{if(panel.current)panel.current.scrollTop=0;},[hazard,region]);
  const active=c.active;
  if(!active.data)return <section className="disaster-panel"><h2>{active.error?'데이터를 불러오지 못했습니다':'공식 자료를 불러오는 중'}</h2><p role="status">{active.error||'저장된 자료를 확인하고 있습니다.'}</p>{active.error&&<button className="primary-button" onClick={active.retry}>다시 불러오기</button>}</section>;
  const station=c.station;
  const daily=station?.daily.find(d=>d.date===c.date);
  return <section ref={panel} className="disaster-panel" data-kind={hazard}>
    {hazard==='landslide'&&<LandslidePanel controller={c} region={region} place={place} onExplore={onExplore} onRegion={onRegion}/>}
    {hazard==='typhoon'&&<TyphoonPanel controller={c} region={region} onExplore={onExplore} onReturn={onReturn}/>}
    {hazard==='cold'&&c.winter.data&&<>
      <span className="eyebrow">2025–2026 겨울 관측기록</span><h2>지난겨울, 얼마나 추웠을까?</h2>{station&&<article className="local-answer cold-answer"><span>{station.station_name} 관측소 · 겨울 전체 최저</span><strong>{fmt(station.summary.minimum.value)}<small>℃</small></strong><p>일최저기온이 0℃ 미만인 날 {station.freezing_days==null?"자료 불완전":`${station.freezing_days}일`}</p>{station.summary.minimum.dates[0]&&<button className="text-button" onClick={()=>c.setDate(station.summary.minimum.dates[0])}>가장 추웠던 날 보기 →</button>}</article>}
      <div className="disaster-fields"><label>관측소<select aria-label="겨울 관측소" value={c.stationId} onChange={e=>c.selectStation(e.target.value)}>{c.winter.data.stations.map(s=><option key={s.station_id} value={s.station_id}>{s.station_name}</option>)}</select></label><label>관측일<input aria-label="겨울 관측 날짜" type="date" min={c.winter.data.meta.period[0]} max={c.winter.data.meta.period[1]} value={c.date} onChange={e=>{if(c.steps.includes(e.target.value))c.setDate(e.target.value);}}/></label></div>
      <p className="disaster-note">지역 대표점에서 가까운 관측소: {c.winter.data.nearby_stations.slice(0,3).map(s=>`${s.station_name} ${fmt(s.distance_km)}km`).join(' · ')||'연결된 관측소 없음'}</p>
      {station&&<><dl className="disaster-metrics"><div><dt>{c.date} 최저</dt><dd>{fmt(daily?.minimum??null)}℃</dd></div><div><dt>같은 날 최고</dt><dd>{fmt(daily?.maximum??null)}℃</dd></div><div><dt>겨울 전체 최저</dt><dd>{fmt(station.summary.minimum.value)}℃</dd></div><div><dt>영하 발생일수</dt><dd>{station.freezing_days==null?'미산출':`${station.freezing_days}일`}</dd></div></dl>
      <p className="disaster-note">최저기온 {station.summary.minimum.valid_days}/{station.summary.expected_days}일 확보 · {station.summary.minimum.complete?`겨울 최저일 ${station.summary.minimum.dates.join(', ')}`:`자료 불완전 · 확보된 기록 중 영하 ${station.observed_freezing_days}일`}</p>
      <div role="img" aria-label="겨울 일별 최고·최저기온 그래프"><ResponsiveContainer width="100%" height={180}><LineChart data={station.daily} margin={{top:10,left:-25,right:8,bottom:0}}><CartesianGrid strokeDasharray="3 3" stroke="#e3e9e2"/><XAxis dataKey="date" tickFormatter={d=>d.slice(5)} tick={{fontSize:9}} minTickGap={35}/><YAxis unit="℃" tick={{fontSize:9}}/><Tooltip labelFormatter={d=>String(d)} formatter={(v,n)=>[`${v}℃`,n]}/><ReferenceLine y={0} stroke="#6d7d83" strokeDasharray="4 3"/><Line name="최고기온" dataKey="maximum" stroke="#c95f45" dot={false} strokeWidth={1.5} isAnimationActive={false} connectNulls={false}/><Line name="최저기온" dataKey="minimum" stroke="#3f819f" dot={false} strokeWidth={2} isAnimationActive={false} connectNulls={false}/></LineChart></ResponsiveContainer></div><div className="temperature-key"><span>━ 최고기온</span><span>━ 최저기온</span></div>
      <details className="temperature-table"><summary>겨울 일별 관측값</summary><div><table><thead><tr><th>관측일</th><th>최고 ℃</th><th>최저 ℃</th></tr></thead><tbody>{station.daily.map(d=><tr key={d.date}><td>{d.date}</td><td>{fmt(d.maximum)}</td><td>{fmt(d.minimum)}</td></tr>)}</tbody></table></div></details></>}
      <p className="disaster-note">{disasterMeaning.cold} 결측은 다른 날짜·관측소로 대체하지 않습니다.</p><NeighborhoodProfile region={region} typhoonId={c.stormId}/>
    </>}
    <SourceInfo meta={active.data.meta}/>
  </section>;
}
