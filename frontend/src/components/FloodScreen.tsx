'use client';
import {ArrowUpRight,ChevronRight,Info,LoaderCircle,MapPin,X} from 'lucide-react';
import type {FloodController} from '@/hooks/useFlood';

export const DEPTHS=[['#0000fd','0.3~0.5m 미만'],['#00e7fd','0.5~1.0m 미만'],['#00fcb6','1.0~1.5m 미만'],['#00ff57','1.5~2.0m 미만'],['#fde900','2.0~3.0m 미만'],['#ff0000','3.0m 이상']];

export default function FloodScreen({controller,region,onRegion,onSources}:{controller:FloodController;region:string;onRegion:(code:string)=>void;onSources:()=>void}) {
 const {data,error,tab,setTab,year,setYear,years,rows,selected,setSelected,scenario,setScenario}=controller;
 const place=data?.regions.find(r=>r.region_code===region)?.region_name||(region==='21'?'부산광역시':'선택 지역');
 const selectRegion=(code:string)=>{onRegion(code);setSelected(null);};
 return <aside className="flood-workspace" aria-label="침수 탐색">
   <div className="flood-content">
    <div className="flood-intro"><span className="eyebrow">우리 동네 물길 살펴보기</span><h1>침수에 대비하는 지도</h1><p>어디가 잠겼었는지, 큰비가 내리면 어디를 살펴봐야 할지 확인하세요.</p></div>
    <div className="flood-tabs" role="tablist" aria-label="침수 자료"><button role="tab" aria-selected={tab==='history'} onClick={()=>{if(tab==='history')return;setTab('history');setSelected(null);}}>과거 침수 이력</button><button role="tab" aria-selected={tab==='forecast'} onClick={()=>{if(tab==='forecast')return;setTab('forecast');setSelected(null);}}>침수 예상도</button></div>
    {error?<div className="inline-error" role="alert">{error}<button onClick={()=>controller.retry()}>다시 시도</button></div>:!data?<p className="flood-loading"><LoaderCircle className="spin" size={17}/> 침수 자료를 불러오고 있습니다</p>:<>
     {!region.startsWith('21')&&<p className="inline-error">침수 자료는 부산만 연결되어 있습니다. 선택 지역에는 자료가 없습니다.</p>}<div className="flood-region-select"><label>구·군<select aria-label="침수 구·군" value={region.length>=5?region.slice(0,5):region} onChange={e=>selectRegion(e.target.value)}><option value="21">부산 전체</option>{!region.startsWith('21')&&<option value={region.length>=5?region.slice(0,5):region}>선택 지역 · 부산 외</option>}{data.regions.filter(r=>r.region_code.length===5).map(r=><option key={r.region_code} value={r.region_code}>{r.region_name}</option>)}</select></label><label>읍·면·동<select aria-label="침수 읍·면·동" disabled={region.length<5} value={region.length===8?region:''} onChange={e=>selectRegion(e.target.value||region.slice(0,5))}><option value="">전체 동</option>{data.regions.filter(r=>r.region_code.length===8&&r.region_code.startsWith(region.slice(0,5))).map(r=><option key={r.region_code} value={r.region_code}>{r.region_name}</option>)}</select></label></div>
     {tab==='history'?<>
      <label className="flood-year">발생 연도<select aria-label="침수 발생 연도" value={year} onChange={e=>{setYear(e.target.value);setSelected(null);}}><option value="all">전체 기록</option>{years.map(y=><option key={y} value={y}>{y}년</option>)}{data.meta.unknown_year_count>0&&<option value="unknown">연도 확인 필요</option>}</select></label>
      <div className="flood-count"><span>{place}의 공개 이력</span><strong>{rows.length}<small>건</small></strong></div>
      <p className="flood-caption">공개된 침수 지점을 표시합니다. 기록이 없다는 뜻이 안전하다는 뜻은 아닙니다.</p>
      {selected&&<article className="flood-record-detail"><button className="icon-button" aria-label="침수 이력 상세 닫기" onClick={()=>setSelected(null)}><X size={17}/></button><small>{selected.region_name||selected.source_district||'소속 동 확인 필요'}</small><h2>{selected.name}</h2><dl><dt>발생 기간</dt><dd>{selected.period||'확인 필요'}</dd><dt>당시 상황</dt><dd>{selected.event||'미등록'}</dd><dt>침수 원인</dt><dd>{selected.cause||'미등록'}</dd><dt>기록된 깊이</dt><dd>{selected.depth||'미등록'}</dd><dt>기록된 면적</dt><dd>{selected.area||'미등록'}</dd></dl><p>당시 기록된 값입니다. 지점 표시는 침수 범위 전체를 뜻하지 않습니다.</p></article>}
      <div className="flood-record-list" aria-label="침수 이력 목록">{rows.length?rows.map(r=><button key={r.id} aria-pressed={selected?.id===r.id} onClick={()=>setSelected(r)}><MapPin size={16}/><span><b>{r.name}</b><small>{r.period||'발생 시기 확인 필요'} · {r.region_name||r.source_district||'소속 동 미확인'}</small></span><ChevronRight size={14}/></button>):<div className="flood-empty">선택한 지역·연도의 공개 기록이 없습니다.<button onClick={()=>{selectRegion('21');setYear('all');}}>부산 전체 기록 보기</button></div>}</div>
     </>:<>
      <section className="flood-scenarios"><h2>어느 정도의 비를 가정할까요?</h2><p>부산시가 제공하는 강우 조건을 선택하세요.</p><div role="group" aria-label="침수 예상 강우 조건">{data.meta.scenarios.map(s=><button key={s.years} aria-pressed={scenario===s.years} onClick={()=>setScenario(s.years)}><strong>{s.rainfall_mm_hour}<small>mm/h</small></strong><span>{s.years}년 빈도</span></button>)}</div><p>빈도는 강우 규모를 나타내는 통계 기준입니다. 해당 주기마다 침수가 발생한다는 뜻이 아닙니다.</p></section>
      <section className="flood-depth-key"><h2>예상 침수 깊이</h2>{DEPTHS.map(([c,t])=><div key={t}><i style={{background:c}}/>{t}</div>)}</section>
      <div className="flood-reading"><Info size={17}/><p>선택한 폭우를 가정한 예상도입니다. 지금 침수된 곳이나 오늘의 예보를 보여주는 지도는 아닙니다.</p></div>
      <section className="flood-next-steps"><h2>이렇게 활용하세요</h2><p>집·가게 주변 예상 구역을 확대해 보고, 과거 이력과 번갈아 확인하세요. 배수구·지하 출입구·차수시설의 현장 점검 위치를 정할 때 참고할 수 있습니다.</p><p>화면의 색만으로 개별 건물의 안전이나 대피 경로를 판단하지 마세요.</p></section>
     </>}
     <a className="flood-official-link" href="https://safecity.busan.go.kr/" target="_blank" rel="noreferrer">부산시 공식 재난정보 확인 <ArrowUpRight size={14}/></a>
     <button className="flood-source-link" onClick={onSources}>자료 출처와 범위 확인</button>
    </>}
   </div>
  </aside>;
}
