'use client';
import {useRef} from 'react';
import {LineChart,Line,XAxis,YAxis,CartesianGrid,Tooltip,ResponsiveContainer,ReferenceLine} from 'recharts';
import {ArrowLeft,ArrowRight,ChevronRight,MapPin,RefreshCw} from 'lucide-react';
import {fmt} from './constants';
import {thermalColor} from './map/WeatherLayer';
import type {WeatherController} from '@/hooks/useWeather';

type Props={place:string;onFacilities:()=>void;controller:WeatherController;onStationChange:(id:string)=>void;onAnalyze:(code:string,name:string)=>void;returnRegion:{code:string;name:string}|null;onReturn:()=>void};
export default function CurrentWeatherScreen({controller,onStationChange,onAnalyze,returnRegion,onReturn,place,onFacilities}:Props){
 const {data,error,period,setPeriod,job,refresh,station,series,focus}=controller;
 const linksRef=useRef<HTMLElement>(null);
 const selectStation=(id:string)=>{onStationChange(id);requestAnimationFrame(()=>linksRef.current?.scrollIntoView({block:'nearest',behavior:'smooth'}));};
 return <aside className="current-weather-panel" aria-label="기온 기록">
   <div className="facility-heading weather-heading"><span className="eyebrow">폭염 대비 · 기온 기록</span><h1>우리 동네 기온 비교</h1><p>{place}에서 출발해 인근 관측기온을 비교합니다.</p></div>
   <div className="weather-content">
    {returnRegion&&<button className="weather-return-analysis" onClick={onReturn}><ArrowLeft size={14}/>{returnRegion.name} 분석으로 돌아가기</button>}
    <button className="weather-refresh" disabled={job.state==='running'||job.state==='disabled'} onClick={refresh}><RefreshCw size={14} className={job.state==='running'?'spin':''}/>{job.state==='disabled'?'저장된 관측자료 제공':job.state==='running'?'기상청 조회 중':'기상청 자료 갱신'}</button>
    {job.message&&<p role="status" className="temperature-note">{job.message}</p>}
    {error&&<div role="alert" className="inline-error">{error}<button onClick={()=>controller.retry()}>다시 불러오기</button></div>}
    {!data&&!error?<p>관측자료를 불러오고 있습니다…</p>:data&&station&&<>
     <section className="weather-comparison-list" aria-label="같은 날 최고기온 비교"><div className="section-title"><h2>같은 날 최고기온</h2><time>{data.observed_on}</time></div><p>관측값이 있는 {data.observed_count}곳 · 높은 기온부터 표시</p><div>{data.stations.map(s=><button key={s.station_id} aria-pressed={station.station_id===s.station_id} onClick={()=>selectStation(s.station_id)}><i style={{background:thermalColor(s.maximum)}}/><span>{s.station_name}</span><strong>{s.maximum==null?'관측 없음':`${fmt(s.maximum)}℃`}</strong><ChevronRight size={12}/></button>)}</div></section>
     {data.meta.outdated&&<p className="inline-error">저장된 {data.meta.requested_through}까지의 관측자료입니다.</p>}
     <label className="weather-station-select">관측소<select aria-label="기상 관측소" value={station.station_id} onChange={e=>selectStation(e.target.value)}>{data.stations.map(s=><option key={s.station_id} value={s.station_id}>{s.station_name} · {s.kind}{!s.latest?' · 최근 관측 미확인':''}</option>)}</select></label>
     <section ref={linksRef} className="weather-linked-regions" aria-label="관측소와 연결된 동네 분석"><div className="section-title"><h2>{station.station_name} 관측소 인근 동네</h2><span>{station.regions.length}개 동</span></div><p>현재 연결 기준으로 각 동의 대표 위치에서 가장 가까운 관측소입니다. 동을 선택해 취약요인과 대응 방향을 확인하세요.</p><div className="weather-linked-list">{[...station.regions].sort((a,b)=>Number(b.region_code===returnRegion?.code)-Number(a.region_code===returnRegion?.code)).map(r=><button key={r.region_code} aria-current={r.region_code===returnRegion?.code?'location':undefined} onClick={()=>onAnalyze(r.region_code,r.region_name)}><span><b>{r.region_name}</b><small>{r.full_name.replace('부산광역시 ','').replace(r.region_name,'').trim()} · {fmt(r.distance_km,2)}km</small></span><span>동네 분석 <ArrowRight size={13}/></span></button>)}</div>{!station.regions.length&&<p className="weather-linked-empty">현재 연결된 부산 읍·면·동이 없습니다.</p>}<small>같은 관측값을 참고하는 동도 인구·주거 취약성은 다를 수 있습니다.</small></section>
     <div className="weather-station-note"><strong>{station.station_name} 관측소 · {station.kind}</strong><p>{station.location?.address||'현재 관측소 위치 미확인'}</p><small>관측소 위치의 실측값입니다. 동 전체의 기온을 뜻하지 않습니다.</small>{station.location&&<button onClick={focus}>지도에서 관측소 위치 보기 ↗</button>}</div>
     <section className="weather-latest"><span>{data.observed_on} 관측값{station.maximum==null&&' · 최고기온 미확인'}</span><div><b>최고 {fmt(station.maximum)}℃</b><b>최저 {fmt(station.minimum)}℃</b></div></section>
    <button className="heat-facility-link weather-facility-link" onClick={onFacilities}><MapPin size={19}/><span><strong>선택 동네의 쉼터·그늘막 확인</strong><small>{place} · 등록 이용대상과 운영시간</small></span><ArrowRight size={17}/></button>
     <div className="facility-kind" role="group" aria-label="기상 조회 기간"><button aria-pressed={period==='recent'} onClick={()=>setPeriod('recent')}>최근 30일</button><button aria-pressed={period==='summer'} onClick={()=>setPeriod('summer')}>여름 기록 · 6~8월</button></div>
     {series?<><p className="weather-period">{series.period.join(' ~ ')}</p><div className="temperature-extremes">{(['maximum','minimum'] as const).map(key=><div className={key} key={key}><span>기간 {key==='maximum'?'최고':'최저'}기온</span><strong>{fmt(series.summary[key].value)}<small>℃</small></strong><small>{series.summary[key].complete?series.summary[key].dates.join(', '):'결측으로 기간값 미산출'}<br/>{series.summary[key].valid_days}/{series.summary.expected_days}일 확보</small></div>)}</div>
      <div className="current-weather-chart" role="img" aria-label="2026년 일별 최고·최저기온 그래프"><ResponsiveContainer width="100%" height={195}><LineChart data={series.daily} margin={{top:15,left:-25,right:6,bottom:0}}><CartesianGrid strokeDasharray="3 3" stroke="#e3e9e2"/><XAxis dataKey="date" tickFormatter={d=>d.slice(5)} tick={{fontSize:9}} minTickGap={35}/><YAxis unit="℃" tick={{fontSize:9}} domain={['auto','auto']}/><Tooltip labelFormatter={d=>String(d)} formatter={(v,n)=>[`${v}℃`,n]}/><ReferenceLine y={33} stroke="#d58b45" strokeDasharray="4 3"/><Line name="최고기온" dataKey="maximum" stroke="#c95f45" dot={false} strokeWidth={2} isAnimationActive={false} connectNulls={false}/><Line name="최저기온" dataKey="minimum" stroke="#3f819f" dot={false} strokeWidth={2} isAnimationActive={false} connectNulls={false}/></LineChart></ResponsiveContainer></div>
      <div className="temperature-key"><span>━ 최고기온</span><span>━ 최저기온</span></div><div className="heatwave-days"><span>일 최고기온 33℃ 이상</span><strong>{series.heatwave_days==null?'미산출':`${series.heatwave_days}일`}</strong></div>
      <details className="temperature-table"><summary>일별 관측값 보기</summary><div><table><thead><tr><th>관측일</th><th>최고 ℃</th><th>최저 ℃</th></tr></thead><tbody>{series.daily.map(d=><tr key={d.date}><td>{d.date}</td><td>{fmt(d.maximum)}</td><td>{fmt(d.minimum)}</td></tr>)}</tbody></table></div></details>
     </>:<p className="temperature-note">아직 올해 여름 관측기간이 시작되지 않았습니다.</p>}
     <p className="temperature-note">완료된 하루의 관측값으로, 실시간 기온은 아닙니다. 기온 비교는 동별 취약도 점수와 별도로 제공합니다.</p><details className="weather-data-details"><summary>조회한 자료 확인</summary><p className="weather-freshness">조회 범위: {data.meta.requested_through}까지<br/>저장: {new Date(data.meta.collected_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})} KST</p></details><a className="weather-source" href={station.source_url} target="_blank" rel="noreferrer">기상청 기상자료개방포털 ↗</a>
    </>}
   </div>
  </aside>;
}
