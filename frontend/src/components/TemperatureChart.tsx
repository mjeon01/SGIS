'use client';
import {useEffect, useState} from 'react';
import {CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis} from 'recharts';
import type {DailyWeather, Mode} from '@/types';
import {api} from '@/services/api';
import {fmt} from './constants';

export default function TemperatureChart({code, mode}:{code:string; mode:Mode}) {
 const [data,setData]=useState<DailyWeather|null>(null);
 const [error,setError]=useState<string|null>(null);
 const [retry,setRetry]=useState(0);
 useEffect(()=>{
  const abort=new AbortController();setData(null);setError(null);
  api<DailyWeather>(`/weather/${code}?mode=${mode}`,abort.signal).then(setData).catch(e=>{if(e.name!=='AbortError')setError(e.message);});
  return ()=>abort.abort();
 },[code,mode,retry]);
 if(mode==='sample')return null;
 return <section className="temperature-section" aria-label="여름 일별 최고·최저 기온">
  <div className="section-title"><h3>여름 기온의 변화</h3><span>2024 · 6–8월</span></div>
  {error?<p className="temperature-error" role="alert">{error} <button onClick={()=>setRetry(n=>n+1)}>다시 시도</button></p>:!data?<p className="temperature-loading">일별 관측자료를 불러오고 있습니다…</p>:!data.available?<p className="section-caption">{data.reason}</p>:<>
   <p className="section-caption">{data.station_name} 관측소 · 인근 관측값</p>
   <div className="temperature-extremes">{(['maximum','minimum'] as const).map(key=><div key={key} className={key}><span>기간 {key==='maximum'?'최고':'최저'}기온</span><strong>{fmt(data.summary[key].value)}<small>℃</small></strong><small>{data.summary[key].complete ? data.summary[key].dates.map(d=>d.slice(5).replace('-','/')).join(', ') : `관측 ${data.summary[key].valid_days}/${data.summary.expected_days}일 · 기간값 미산출`}</small></div>)}</div>
   <div className="temperature-chart" role="img" aria-label={`${data.reference_year}년 6월부터 8월까지 일별 최고기온과 최저기온, 33도 기준선`}><ResponsiveContainer width="100%" height={190}><LineChart data={data.daily} margin={{top:18,left:-23,right:10,bottom:0}}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e9e5"/><XAxis dataKey="date" ticks={['2024-06-01','2024-07-01','2024-08-01','2024-08-31']} tickFormatter={v=>v.slice(5).replace('-','/')} tick={{fontSize:10}} tickLine={false}/><YAxis domain={['auto','auto']} unit="°" tick={{fontSize:10}} tickLine={false} axisLine={false}/><Tooltip labelFormatter={v=>String(v)} formatter={(value,name)=>[`${fmt(value as number)}℃`,name]}/><ReferenceLine y={33} stroke="#aa6253" strokeDasharray="4 4" label={{value:'33℃',position:'insideTopRight',fontSize:10,fill:'#aa6253'}}/><Line dataKey="maximum" name="일 최고기온" stroke="#cc6148" strokeWidth={1.7} dot={false} connectNulls={false} isAnimationActive={false}/><Line dataKey="minimum" name="일 최저기온" stroke="#4284a3" strokeWidth={1.7} dot={false} connectNulls={false} isAnimationActive={false}/></LineChart></ResponsiveContainer></div>
   <div className="temperature-key"><span>● 일 최고기온</span><span>● 일 최저기온</span></div>
   <div className="heatwave-days"><span>최고기온 33℃ 이상</span><strong>{fmt(data.heatwave_days,0)}일</strong></div>
   <p className="temperature-note">6~8월 중 가장 높았던 기온과 가장 낮았던 기온입니다. 결측 구간은 연결하지 않으며 기간값도 산출하지 않습니다.</p>
   <details className="temperature-table"><summary>일별 기온 표 보기</summary><div><table><thead><tr><th>날짜</th><th>최고 ℃</th><th>최저 ℃</th></tr></thead><tbody>{data.daily.map(r=><tr key={r.date}><td>{r.date}</td><td>{fmt(r.maximum)}</td><td>{fmt(r.minimum)}</td></tr>)}</tbody></table></div></details>
  </>}
 </section>;
}
