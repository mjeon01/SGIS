'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,BookmarkPlus,Check,ChevronRight,House,MapPin,Search,SlidersHorizontal,Sun,UserRound,UsersRound} from 'lucide-react';
import type {RegionOption,RiskRegion,ViewData} from '@/types';
import {READINESS_CRITERIA,findReadinessRegions} from './criteria';
import type {ReadinessCriterion} from './criteria';
import {color,fmt} from '../constants';

type Props={view:ViewData|null;province:string;district:string;provinces:RegionOption[];districts:RegionOption[];criteria:ReadinessCriterion[];onCriteria:(keys:ReadinessCriterion[])=>void;applied:boolean;onApply:()=>void;onEdit:()=>void;onScope:(code:string)=>void;onSelect:(code:string)=>void;onSave:(region:RiskRegion)=>void;isSaved:(code:string)=>boolean;onAdvanced:()=>void;error:string|null};
export default function ReadinessFinder({view,province,district,provinces,districts,criteria,onCriteria,applied,onApply,onEdit,onScope,onSelect,onSave,isSaved,onAdvanced,error}:Props){
 const root=useRef<HTMLDivElement>(null);const [count,setCount]=useState(5);
 const {matches,unknown}=useMemo(()=>findReadinessRegions(view?.regions||[],criteria),[view,criteria]);
 useEffect(()=>{setCount(5);root.current?.scrollTo({top:0});},[applied,view?.parent_code]);
 const scope=view?.breadcrumbs.at(-1)?.region_name||'선택 지역',supported=!!view?.in_analysis_scope;
 const icons={people:UsersRound,person:UserRound,home:House,sun:Sun};
 return <section className="readiness-finder" aria-label="기후 대비할 동네 찾기"><div className="readiness-scroll" ref={root}>
  <div className="readiness-intro"><span className="eyebrow">우리 동네 기후 대비</span><h1>{applied?'먼저 살펴볼 동네를\n찾았어요':'어떤 동네를\n먼저 살펴볼까요?'}</h1><p>{applied?'선정 근거를 읽고, 시설과 현장에서 확인할 곳을 점검 목록에 담으세요.':'지역의 인구·주거환경을 기준으로 기후 대비가 필요한 곳을 찾아보세요.'}</p></div>
  <ol className="readiness-steps" aria-label="이용 순서"><li className={!applied?'active':''}><b>1</b>조건 선택</li><li className={applied?'active':''}><b>2</b>동네 확인</li><li><b>3</b>시설·점검</li></ol>
  {!applied?<>
   <section className="readiness-section"><h2><MapPin size={17}/>어디를 살펴볼까요?</h2><div className="readiness-region-fields"><label>시·도<select aria-label="동네 찾기 시·도" value={province} onChange={e=>onScope(e.target.value)}>{provinces.length?provinces.map(p=><option key={p.region_code} value={p.region_code}>{p.region_name}</option>):<option value={province}>지역 확인 중</option>}</select></label><label>시·군·구<select aria-label="동네 찾기 시·군·구" value={district} onChange={e=>onScope(e.target.value||province)}><option value="">전체 시·군·구</option>{districts.map(p=><option key={p.region_code} value={p.region_code}>{p.region_name}</option>)}</select></label></div></section>
   <section className="readiness-section"><h2><SlidersHorizontal size={17}/>무엇을 중점적으로 볼까요?</h2><p className="readiness-hint">관심 조건을 함께 선택할 수 있어요.</p><div className="readiness-criteria">{READINESS_CRITERIA.map(option=>{const Icon=icons[option.icon],selected=criteria.includes(option.key);return <button key={option.key} aria-pressed={selected} onClick={()=>onCriteria(selected?criteria.filter(k=>k!==option.key):[...criteria,option.key])}><span className="criterion-icon"><Icon size={24} strokeWidth={1.6}/></span><strong>{option.title}</strong><small>{option.description}</small><span className="criterion-check">{selected&&<Check size={12}/>}</span></button>;})}</div><p className="readiness-rule">선택한 지표가 모두 {scope}의 비교 기준을 넘는 지역을 찾습니다. 조건을 고르지 않으면 기존 폭염 취약도 순으로 보여줍니다.</p></section>

  </>:<>
   <section className="readiness-results-summary"><button onClick={onEdit}><ArrowLeft size={14}/>조건 수정</button><div><span>{scope} · 조건에 맞는 지역</span><strong>{matches.length}<small>곳</small></strong></div><p>{criteria.length?READINESS_CRITERIA.filter(c=>criteria.includes(c.key)).map(c=>c.title).join(' + '):'전체 · 기존 폭염 취약도 순'}</p><small>조건 판정 자료 부족 {unknown}곳 · 점수 미산출 지역은 목록 뒤에 표시</small></section>
   <div className="readiness-results" aria-label="조건에 맞는 지역 목록">{matches.slice(0,count).map((r,i)=><article key={r.region_code} data-region={r.region_code}><div className="readiness-result-title"><span className="result-order">{i+1}</span><button onClick={()=>onSelect(r.region_code)}><strong>{r.region_name}</strong><small>{r.full_name.replace(r.region_name,'').trim()}</small></button><span className="result-score" style={{color:color(r.risk_score)}}>{fmt(r.risk_score)}<small>폭염 취약도</small></span></div><ul>{(criteria.length?r.factors.filter(f=>criteria.includes(f.key as ReadinessCriterion)):r.top_factors.slice(0,2)).map(f=><li key={f.key}><span>{f.name}</span><strong>{fmt(f.value,f.unit==='명'?0:1)}{f.unit}</strong><small>비교 기준 {fmt(f.comparison_average)}{f.unit}</small></li>)}</ul><div className="readiness-result-actions"><button onClick={()=>onSelect(r.region_code)}>근거·대응 확인<ArrowRight size={14}/></button>{!r.is_sample&&<button aria-label={`${r.region_name} 점검 목록에 담기`} aria-pressed={isSaved(r.region_code)} disabled={isSaved(r.region_code)} onClick={()=>onSave(r)}>{isSaved(r.region_code)?<Check size={15}/>:<BookmarkPlus size={15}/>}담기</button>}</div></article>)}</div>
   {!matches.length&&<div className="readiness-no-results"><Search size={26}/><h2>선택 조건에 맞는 지역이 없어요</h2><p>조건을 줄이거나 지역 범위를 넓혀보세요.</p><button onClick={onEdit}>조건 다시 선택</button></div>}
   {matches.length>count&&<button className="readiness-more" onClick={()=>setCount(n=>n+5)}>다음 5곳 더 보기 · {count}/{matches.length}</button>}
   <p className="readiness-method">지역의 상대적 특성을 기준으로 고른 검토 후보입니다. 재난 발생확률이나 개별 시설의 부족 여부를 의미하지 않습니다. 고령·1인가구는 합산 비율, 노후주택은 공식 상위지역 비율을 비교 기준으로 사용합니다.</p>
  </>}</div>
  {!applied&&<div className="readiness-submit"><button className="primary-button" disabled={!supported} onClick={onApply}><Search size={17}/>조건에 맞는 동네 찾기<ArrowRight size={17}/></button>{error?<p role="alert">{error}</p>:!view?<p>지역 자료를 확인하고 있습니다.</p>:!supported?<p>이 지역의 분석자료는 준비 중입니다. 현재 부산에서 동네 찾기를 이용할 수 있습니다.</p>:<p>{view.meta.reference_year}년 지역통계 · 현재 {scope} 분석</p>}<button className="readiness-advanced" onClick={onAdvanced}>전체 순위와 세부지표 보기<ChevronRight size={14}/></button></div>}
 </section>;
}
