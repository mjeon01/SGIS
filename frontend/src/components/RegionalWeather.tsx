'use client';
import {useEffect,useState} from 'react';
import {ArrowRight,RefreshCw,Thermometer} from 'lucide-react';
import {CartesianGrid,Line,LineChart,ReferenceLine,ResponsiveContainer,Tooltip,XAxis,YAxis} from 'recharts';
import type {RegionalCurrentWeather} from '@/types';
import {api} from '@/services/api';
import {fmt} from './constants';

type Job={state:string;message:string|null};
export default function RegionalWeather({code,detailed,onDetails,onMap}:{code:string;detailed:boolean;onDetails:()=>void;onMap:(stationId:string)=>void}){
 const [data,setData]=useState<RegionalCurrentWeather|null>(null),[error,setError]=useState<string|null>(null),[retry,setRetry]=useState(0);
 const [period,setPeriod]=useState<'recent'|'summer'>('recent'),[job,setJob]=useState<Job>({state:'idle',message:null});
 useEffect(()=>{
  const controller=new AbortController();setError(null);
  api<RegionalCurrentWeather>(`/current-weather/regions/${code}`,controller.signal).then(setData).catch(e=>{if(e.name!=='AbortError')setError(e.message);});
  api<Job>('/current-weather/refresh',controller.signal).then(setJob).catch(()=>{});
  return()=>controller.abort();
 },[code,retry]);
 useEffect(()=>{
  if(job.state!=='running')return;
  const controller=new AbortController();const timer=setTimeout(()=>{
   api<Job>('/current-weather/refresh',controller.signal).then(next=>{setJob(next);if(next.state==='complete')setRetry(n=>n+1);}).catch(e=>{if(e.name!=='AbortError')setJob({state:'error',message:e.message});});
  },3000);
  return()=>{clearTimeout(timer);controller.abort();};
 },[job]);
 const refresh=async()=>{setJob({state:'running',message:'기상청 일 관측자료를 확인합니다.'});try{const next=await api<Job>('/current-weather/refresh',undefined,{});setJob(next);if(next.state==='fresh'||next.state==='complete')setRetry(n=>n+1);}catch(e){setJob({state:'error',message:(e as Error).message});}};
 const visible=data?.region_code===code?data:null,station=visible?.station,latest=station?.latest,series=station?.[period];
 return <section className={`regional-weather ${detailed?'expanded':'compact'}`} aria-label="선택한 동의 현재 기상" data-region={code}>
  <div className="section-title"><h3><Thermometer size={15}/> 현재 기상</h3><span>{visible?`${visible.meta.reference_year}년 · 일 관측`: '인근 관측자료'}</span></div>
  {error&&<p className="temperature-error" role="alert">{error} <button onClick={()=>setRetry(n=>n+1)}>다시 불러오기</button></p>}
  {!visible&&!error&&<p className="regional-weather-loading">최근 기상자료를 불러오고 있습니다…</p>}
  {visible&&!visible.available&&<p className="temperature-note">{visible.reason}</p>}
  {station&&<>
   <p className="regional-observed-date">마지막 관측일 <strong>{latest?.date||'미확인'}</strong></p>
   <div className="regional-latest"><span>최고 <strong>{fmt(latest?.maximum??null)}<small>℃</small></strong></span><span>최저 <strong>{fmt(latest?.minimum??null)}<small>℃</small></strong></span></div>
   <p className="regional-station">{station.station_name} 관측소 · 동 대표점에서 {fmt(visible?.distance_km??null,2)}km</p>
   <p className="regional-caption">인근 관측값이며 동 자체의 실측값은 아닙니다.</p><button className="regional-map-link" onClick={()=>onMap(station.station_id)}>다른 지역 기온과 지도에서 비교 <ArrowRight size={13}/></button>
   {latest&&visible&&latest.date<visible.meta.requested_through&&<p className="regional-outdated">조회 종료일({visible.meta.requested_through})보다 이전 관측값입니다.</p>}
   {visible?.meta.outdated&&<p className="regional-outdated">최신 조회가 필요합니다. 저장된 관측기록을 표시합니다.</p>}
   {!detailed&&<button className="regional-details" onClick={onDetails}>최근 기온·올여름 기록 보기 <ArrowRight size={13}/></button>}
   {detailed&&<>
    <div className="facility-kind" role="group" aria-label="동네 기상 조회 기간"><button aria-pressed={period==='recent'} onClick={()=>setPeriod('recent')}>최근 30일</button><button aria-pressed={period==='summer'} onClick={()=>setPeriod('summer')}>올여름 · 6~8월</button></div>
    {series?<><p className="weather-period">{series.period.join(' ~ ')}</p><div className="temperature-extremes">{(['maximum','minimum'] as const).map(key=><div className={key} key={key}><span>기간 {key==='maximum'?'최고':'최저'}기온</span><strong>{fmt(series.summary[key].value)}<small>℃</small></strong><small>{series.summary[key].complete?series.summary[key].dates.join(', '):'결측으로 기간값 미산출'}<br/>{series.summary[key].valid_days}/{series.summary.expected_days}일 확보</small></div>)}</div>
     <div className="regional-weather-chart" role="img" aria-label={`${visible?.meta.reference_year}년 인근 관측소 일별 최고·최저기온`}><ResponsiveContainer width="100%" height={195}><LineChart data={series.daily} margin={{top:12,left:-25,right:6,bottom:0}}><CartesianGrid strokeDasharray="3 3" stroke="#e3e9e2"/><XAxis dataKey="date" tickFormatter={d=>d.slice(5)} tick={{fontSize:9}} minTickGap={35}/><YAxis unit="℃" tick={{fontSize:9}} domain={['auto','auto']}/><Tooltip labelFormatter={d=>String(d)} formatter={(v,n)=>[`${v}℃`,n]}/><ReferenceLine y={33} stroke="#d58b45" strokeDasharray="4 3"/><Line name="최고기온" dataKey="maximum" stroke="#c95f45" dot={false} strokeWidth={2} isAnimationActive={false} connectNulls={false}/><Line name="최저기온" dataKey="minimum" stroke="#3f819f" dot={false} strokeWidth={2} isAnimationActive={false} connectNulls={false}/></LineChart></ResponsiveContainer></div>
     <div className="temperature-key"><span>━ 최고기온</span><span>━ 최저기온</span></div><div className="heatwave-days"><span>일 최고기온 33℃ 이상</span><strong>{series.heatwave_days==null?'미산출':`${series.heatwave_days}일`}</strong></div>
     <details className="temperature-table"><summary>일별 관측값 보기</summary><div><table><thead><tr><th>관측일</th><th>최고 ℃</th><th>최저 ℃</th></tr></thead><tbody>{series.daily.map(row=><tr key={row.date}><td>{row.date}</td><td>{fmt(row.maximum)}</td><td>{fmt(row.minimum)}</td></tr>)}</tbody></table></div></details>
    </>:<p className="temperature-note">올해 여름 관측기간이 시작되지 않았습니다.</p>}
   </>}
  </>}
  {detailed&&<div className="regional-weather-source"><button className="weather-refresh" disabled={job.state==='running'} onClick={refresh}><RefreshCw size={14} className={job.state==='running'?'spin':''}/>{job.state==='running'?'기상청 조회 중':'기상청 자료 갱신'}</button>{job.message&&<p role="status" className="temperature-note">{job.message}</p>}{visible&&<p className="weather-freshness">조회 범위: {visible.meta.requested_through}까지<br/>저장: {new Date(visible.meta.collected_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})} KST</p>}<p className="temperature-note">완료된 일 관측기록으로 실시간 기온은 아닙니다. 취약도 점수와 별도로 제공합니다. 관측소는 현재 위치로 연결하며 결측을 다른 관측소 값으로 대체하지 않습니다.</p>{station&&<a className="weather-source" href={station.source_url} target="_blank" rel="noreferrer">기상청 기상자료개방포털 ↗</a>}</div>}
 </section>;
}
