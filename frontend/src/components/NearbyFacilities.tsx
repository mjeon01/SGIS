'use client';
import {useEffect,useRef} from 'react';
import {Building2,Check,ChevronRight,MapPin,MousePointer2,Umbrella,X} from 'lucide-react';
import {distanceKm,distanceLabel} from '@/hooks/useNearbyFacilities';
import type {NearbyFacilitiesController,NearbyFacility} from '@/hooks/useNearbyFacilities';

export default function NearbyFacilities({controller:c,onPick}:{controller:NearbyFacilitiesController;onPick:()=>void}){
  const {selected,anchor}=c;
  const resultsRef=useRef<HTMLDivElement>(null),detailRef=useRef<HTMLElement>(null);
  useEffect(()=>{if(anchor)resultsRef.current?.scrollIntoView({block:'start'});},[anchor,c.loading]);
  useEffect(()=>{if(selected)detailRef.current?.scrollIntoView({block:'nearest'});},[selected?.id]);
  const result=(row:NearbyFacility,i:number)=><button key={row.id} className="nearby-result" aria-pressed={selected?.id===row.id} onClick={()=>c.select(row.id)} data-id={row.id} data-distance={row.distanceKm}><span className={`nearby-kind ${row.kind}`}>{row.kind==='shade'?<Umbrella size={17}/>:<Building2 size={17}/>}</span><span><strong>{i+1}. {row.name}</strong><small>{row.kind==='shade'?'그늘막':`쉼터 · ${row.access||'이용대상 확인 필요'}`} · {row.region_name||'행정동 미확인'}</small></span><b>{distanceLabel(row.distanceKm)}</b><ChevronRight size={13}/></button>;
  return <section className="nearby-facilities" aria-label="기온과 주변 대비시설">
    <div className="nearby-heading"><span className="eyebrow">기온을 확인했다면</span><h2>주변에서 더위 피할 곳</h2><p>기온 지도 위에 등록시설을 함께 표시해요.</p></div>
    <div className="nearby-toggles" role="group" aria-label="기온 지도 시설 표시">{(['shade','shelter'] as const).map(kind=><button key={kind} aria-pressed={c.visible[kind]} onClick={()=>c.setVisible(v=>({...v,[kind]:!v[kind]}))}>{kind==='shade'?<Umbrella size={16}/>:<Building2 size={16}/>}<span>{kind==='shade'?'그늘막':'무더위쉼터'}</span>{c.visible[kind]?<Check size={14}/>:<span className="nearby-toggle-off">표시</span>}</button>)}</div>
    <button className={`nearby-pick ${c.picking?'is-picking':''}`} onClick={c.picking?c.cancelPicking:onPick}><MousePointer2 size={16}/>{c.picking?'위치 선택 취소':anchor?'기준 위치 바꾸기':'지도에 위치 찍고 가까운 3곳 찾기'}</button>
    {c.picking&&<p className="nearby-note" role="status">지도에서 원하는 위치를 눌러주세요. 키보드로는 화살표로 지도를 옮기고 Enter로 중앙을 선택할 수 있어요.</p>}
    <details className="nearby-filters"><summary>쉼터 이용조건 <span>{c.filters.access==='anyone'?'누구나 이용':'전체 이용대상'}</span></summary><label>이용대상<select aria-label="가까운 쉼터 이용대상" value={c.filters.access} onChange={e=>c.setFilters({...c.filters,access:e.target.value})}><option value="anyone">누구나 이용 가능한 쉼터</option><option value="all">전체 · 특정인 이용 포함</option></select></label><div><label>등록 운영요일<select aria-label="가까운 쉼터 운영요일" value={c.filters.day} onChange={e=>c.setFilters({...c.filters,day:e.target.value,time:e.target.value===''?'':c.filters.time})}><option value="">요일 무관</option>{['월','화','수','목','금','토','일'].map((day,i)=><option key={day} value={i}>{day}요일</option>)}</select></label><label>등록 운영시간<input type="time" aria-label="가까운 쉼터 운영시간" disabled={c.filters.day===''} value={c.filters.time} onChange={e=>c.setFilters({...c.filters,time:e.target.value})}/></label></div><p>쉼터에만 적용합니다. 공휴일·실시간 개방 여부는 확인이 필요합니다.</p></details>
    {c.error?<p role="alert" className="nearby-error">시설을 불러오지 못했어요. <button onClick={c.retry}>다시 시도</button></p>:c.loading?<p className="nearby-note" role="status">등록시설을 불러오고 있어요…</p>:anchor&&<>
      <div ref={resultsRef} className="nearby-results-heading"><h3>선택 위치에서 가까운 곳</h3><button aria-label="기준 위치 지우기" onClick={c.clear}><X size={15}/></button></div>
      <p className="nearby-note">직선거리순 · 인접 행정동 포함 · 부산 등록자료</p>
      <div className="nearby-results" aria-label="가까운 시설 3곳">{c.nearest.map(result)}</div>
      {!c.nearest.length&&<p className="nearby-note">{!c.visible.shelter&&!c.visible.shade?'표시할 시설 유형을 켜주세요.':'선택 조건에 맞는 등록시설이 없습니다. 조건을 바꾸거나 확인 필요 자료를 살펴보세요.'}</p>}
      {!!c.unknown.length&&<details className="nearby-unknown"><summary>이용조건 확인이 필요한 가까운 곳</summary><p>이용대상이나 등록 운영정보가 부족해 조건 일치를 확인하지 못했습니다.</p>{c.unknown.map(result)}</details>}
    </>}
    {selected&&<article ref={detailRef} className="nearby-selected" aria-label="선택한 주변 시설"><div><span className={`nearby-kind ${selected.kind}`}>{selected.kind==='shade'?<Umbrella size={15}/>:<Building2 size={15}/>}</span><h3>{selected.name}</h3><button aria-label="주변 시설 상세 닫기" onClick={()=>c.select('')}><X size={15}/></button></div><p><MapPin size={13}/>{selected.address}</p><dl>{anchor&&<><dt>기준점과 직선거리</dt><dd>{distanceLabel(distanceKm(anchor,selected))}</dd></>}{selected.kind==='shelter'?<><dt>이용대상</dt><dd>{selected.access||'확인 필요'}</dd><dt>등록 운영시간</dt><dd>{selected.hours||'확인 필요'}</dd>{selected.filter_status==='unknown'&&<><dt>조건 판정</dt><dd>정보 확인 필요</dd></>}</>:<><dt>시설 종류</dt><dd>그늘막</dd></>}<dt>시설 자료 기준</dt><dd>{selected.reference_date}</dd></dl><a href={selected.source_url} target="_blank" rel="noreferrer">시설 출처 확인 ↗</a></article>}
    <p className="nearby-note nearby-provenance">시설: {c.data?.meta.reference_year||2026}년 등록자료. 선택한 과거 관측일 당시의 시설 현황은 아닙니다. 거리는 도보거리·소요시간이 아니며, 방문 전 운영정보를 확인하세요.</p>
  </section>;
}
