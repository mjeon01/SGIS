import {ArrowDownRight,ArrowUpRight,LocateFixed,Scan,Snowflake,Sun} from 'lucide-react';
import {fmt} from '../constants';
import {timeLabel} from './timeline-scale';

type Props={stationName:string;date:string;maximum:number|null;minimum:number|null;
  metric:'maximum'|'minimum';previous:{date:string;value:number|null}|undefined;
  onFocus?:()=>void;onOverview?:()=>void;};

/** Read the selected observation without leaving the map or losing playback. */
export default function ObservationOverlay({stationName,date,maximum,minimum,metric,previous,onFocus,onOverview}:Props){
  const value=metric==='maximum'?maximum:minimum,cold=metric==='minimum';
  const difference=value!=null&&previous?.value!=null?value-previous.value:null;
  const Icon=cold?Snowflake:Sun;
  return <section className={`map-story-card observation-card ${cold?'is-cold':'is-heat'}`} aria-label="선택 관측소 기온" data-date={date}>
    <div className="observation-heading"><span><Icon size={14} aria-hidden="true"/>관측 기록</span><time dateTime={date}>{timeLabel(date,false,'full')}</time></div>
    <h2>{stationName}<span>관측소</span></h2>
    <div className="observation-reading"><div><span>이날 {cold?'최저':'최고'}기온</span><strong>{fmt(value)}<small>℃</small></strong></div><Icon size={43} strokeWidth={1.3} aria-hidden="true"/></div>
    <dl className="observation-facts"><div><dt>이날 {cold?'최고':'최저'}기온</dt><dd>{fmt(cold?maximum:minimum)}<small>℃</small></dd></div><div><dt title={previous?.date}>이전 기록 대비</dt><dd>{difference==null?<span className="observation-missing">비교 자료 없음</span>:<>{difference>0?<ArrowUpRight size={15} aria-hidden="true"/>:difference<0?<ArrowDownRight size={15} aria-hidden="true"/>:null}{difference>0?'+':''}{fmt(difference)}<small>℃</small></>}</dd></div></dl>
    <p className="observation-basis">{difference!=null&&previous?`${previous.date.slice(5).replace('-','.')} ${cold?'최저':'최고'}기온과 비교 · `:''}관측소 실측값</p>
    <div className="observation-actions">{onFocus&&<button onClick={onFocus}><LocateFixed size={15} aria-hidden="true"/>관측소 위치</button>}{onOverview&&<button onClick={onOverview}><Scan size={15} aria-hidden="true"/>관측소 한눈에</button>}</div>
  </section>;
}
