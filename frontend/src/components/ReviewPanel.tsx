'use client';
import {useEffect,useState} from 'react';
import {Download,MapPin,ArrowRight} from 'lucide-react';
import type {Mode,ReviewSheet} from '@/types';
import {api} from '@/services/api';
import {reportMarkdown} from '@/services/report';
import {fmt} from './constants';
import ResponsePlans from './ResponsePlans';

export default function ReviewPanel({code,mode,onFacilities,variant='report',onReport}:{code:string;mode:Mode;onFacilities:(code:string)=>void;variant?:'report'|'actions';onReport?:()=>void}) {
  const [data,setData]=useState<ReviewSheet|null>(null),[error,setError]=useState<string|null>(null),[retry,setRetry]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();setData(null);setError(null);
    api<ReviewSheet>(`/review/${code}?mode=${mode}`,controller.signal).then(setData).catch(e=>{if(e.name!=='AbortError')setError(e.message);});
    return()=>controller.abort();
  },[code,mode,retry]);
  const save=()=>{
    if(!data)return;
    const url=URL.createObjectURL(new Blob([reportMarkdown(data,mode)],{type:'text/markdown;charset=utf-8'}));
    const link=document.createElement('a');link.href=url;
    link.download=`${data.region.region_name}_분석보고서_${data.region.reference_year}${mode==='sample'?'_SAMPLE':''}.md`;
    link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  if(error)return <div role="alert" className="inline-error">{error}<button onClick={()=>setRetry(n=>n+1)}>다시 시도</button></div>;
  if(!data)return <p className="review-loading">지역 분석보고서를 불러오고 있습니다…</p>;
  const {region,report}=data, full=variant==='report';
  return <article className={`review-panel ${full?'':'response-panel'}`} aria-label={full?'지역 분석보고서':'동별 대응방안'} data-prepared={report.status}>
    <div className="review-intro"><span className="eyebrow">우리 동네 대응 방향</span><h3>{region.region_name} {full?'분석보고서':'우선 대응'}</h3><p>지역의 특성을 실행 제안과 연결하고, 판단에 필요한 근거를 살펴보세요.</p></div>
    {full&&<div className="review-rank"><span>{data.scope} 우선 검토 순위</span><strong>{data.rank==null?'미산출':`${data.rank}위`}<small> / {data.scored_count}개 산출 지역</small></strong><p>전체 {data.total_count}개 동 중 {data.total_count-data.scored_count}개 자료 부족 · {data.rank_method}</p></div>}
    {report.narrative?<section className="report-focus"><h3>대응의 초점</h3><p>{report.narrative.overview}</p><div className="report-next-step"><span>먼저 할 일</span><p>{report.narrative.next_step}</p></div></section>:<section className="report-summary"><h3>지역 분석 요약</h3><p>{data.explanation.summary}</p></section>}
    {full&&<section><h3>판단의 근거</h3>{region.top_factors.map(f=><div className="review-evidence" key={f.key}><b>{f.name}</b><strong>{fmt(f.value)}{f.unit}</strong><small>부산 기준 {fmt(f.comparison_average)}{f.unit}{f.difference_pp!=null&&` · ${f.difference_pp>0?'+':''}${fmt(f.difference_pp)}%p`}</small></div>)}<p className="section-caption">주요 요인은 지표의 상대 기여도를 기준으로 선정했습니다. 시설 부족이나 재난 발생확률을 뜻하지 않습니다.</p></section>}
    <section className="report-plan-section"><h3>우선 검토할 대응방안</h3><p className="section-caption">{report.guidance_note}</p><ResponsePlans plans={report.plans}/></section>
    {full&&<section><h3>현장 확인 사항</h3><ul className="report-checks">{data.field_checks.map(c=><li key={c.id}>{c.text}</li>)}</ul></section>}
    {mode==='sgis'&&<div className="review-facilities"><button onClick={()=>onFacilities(code)}><MapPin size={16}/> 이 동의 현재 시설 확인</button><p>쉼터·그늘막 위치와 이용조건을 확인하세요. 시설 현황은 취약도 계산과 별도로 제공합니다.</p></div>}
    {full?<>
      <details className="report-sources"><summary>자료와 작성 정보</summary><div>
        <p>{data.explanation.summary}</p><p>분석 통계: {region.reference_year}년 · {region.source}</p><p>{data.facility_note}</p>
        {report.sources.map(s=><div className="report-source" key={s.id}><a href={s.url} target="_blank" rel="noreferrer">{s.publisher} · {s.title} ↗</a><p>{s.summary}</p><small>자료 확인일 {s.checked_on}</small></div>)}
        {report.prepared_at&&<p>대응 설명 작성일 {new Date(report.prepared_at).toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul'})}</p>}
      </div></details>
      <button className="primary-button review-save" onClick={save}><Download size={16}/> 보고서 저장 (.md)</button>
    </>:<button className="primary-button review-save" onClick={onReport}>전체 분석보고서 보기 <ArrowRight size={16}/></button>}
    <p className="review-notice">{data.purpose}</p>
  </article>;
}
