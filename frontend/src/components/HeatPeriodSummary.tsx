'use client';
import {ArrowRight,Thermometer} from 'lucide-react';
import type {DailyWeather} from '@/types';
import {useSnapshot} from '@/hooks/useSnapshot';
import {fmt} from './constants';

export default function HeatPeriodSummary({code,onDetails,onMap}:{code:string;onDetails:()=>void;onMap:()=>void}) {
 const {data,error,retry}=useSnapshot<DailyWeather>(`/weather/${code}?mode=sgis`);
 return <section className="regional-weather compact heat-period-summary" aria-label="선택한 동의 분석기간 기온" data-region={code}>
  <div className="section-title"><h3><Thermometer size={15}/> 분석기간의 기온</h3><span>{data?.available?`${data.reference_year}년 여름`:'인근 관측자료'}</span></div>
  {error?<p className="temperature-error" role="alert">{error} <button onClick={retry}>다시 불러오기</button></p>:!data?<p className="regional-weather-loading">분석기간의 관측자료를 불러오고 있습니다…</p>:!data.available?<p className="temperature-note">{data.reason}</p>:<>
   <p className="heat-period-range">{data.period.join(' ~ ')}</p>
   <div className="temperature-extremes">{(['maximum','minimum'] as const).map(key=>{
    const record=data.summary[key];
    return <div className={key} key={key}><span>기간 {key==='maximum'?'최고':'최저'}기온</span><strong>{record.complete?fmt(record.value):'—'}<small>℃</small></strong><small>{record.complete?record.dates.join(', '):`관측 ${record.valid_days}/${data.summary.expected_days}일 · 기간값 미산출`}</small></div>;
   })}</div>
   <div className="heatwave-days"><span>폭염일수 <small>일 최고기온 33℃ 이상</small></span><strong>{data.heatwave_days==null?'미산출':`${fmt(data.heatwave_days,0)}일`}</strong></div>
   <p className="regional-station">{data.station_name} 관측소 · 동 대표점에서 {fmt(data.distance_km,2)}km</p>
   <p className="regional-caption">인근 관측값이며 동 자체의 실측값은 아닙니다.</p>
   <p className="heat-period-basis">취약도는 이 기간의 폭염일수와 인구·주거 특성 등을 함께 반영합니다.</p>
  </>}
  <button className="regional-map-link" onClick={onMap}>최근 기온을 지도에서 비교 <ArrowRight size={13}/></button>
  <button className="regional-details" onClick={onDetails}>최근 기온·올여름 기록 보기 <ArrowRight size={13}/></button>
 </section>;
}
