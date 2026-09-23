'use client';
import {useEffect,useMemo,useState} from 'react';
import dynamic from 'next/dynamic';
import {ArrowUpRight,ChevronRight,Info,LoaderCircle,MapPin,Minus,Plus,RotateCcw,Waves,X} from 'lucide-react';
import {api} from '@/services/api';
import type {FloodData,FloodRecord,ViewData} from '@/types';
import RegionSearch from './RegionSearch';
import DisasterSwitch from './DisasterSwitch';

const ClimateMap=dynamic(()=>import('./ClimateMap'),{ssr:false});
const EMPTY_RECORDS:FloodRecord[]=[];
const EMPTY_FACILITIES:[]=[];
const DEPTHS=[['#0000fd','0.3~0.5m 미만'],['#00e7fd','0.5~1.0m 미만'],['#00fcb6','1.0~1.5m 미만'],['#00ff57','1.5~2.0m 미만'],['#fde900','2.0~3.0m 미만'],['#ff0000','3.0m 이상']];

export default function FloodScreen({board,onHazard,onSources,exploreKey}:{board:boolean;onHazard:(h:'heat'|'flood')=>void;onSources:()=>void;exploreKey:number}) {
 const [data,setData]=useState<FloodData|null>(null),[view,setView]=useState<ViewData|null>(null),[overview,setOverview]=useState<ViewData|null>(null);
 const [error,setError]=useState<string|null>(null),[retry,setRetry]=useState(0);
 const [tab,setTab]=useState<'history'|'forecast'>('history'),[year,setYear]=useState('all'),[region,setRegion]=useState('21'),[selected,setSelected]=useState<FloodRecord|null>(null);
 const [scenario,setScenario]=useState(30),[image,setImage]=useState<{scenario:number;url:string}|null>(null),[imageError,setImageError]=useState<string|null>(null),[imageRetry,setImageRetry]=useState(0);
 const [zoom,setZoom]=useState({id:0,step:0}),[reset,setReset]=useState(0),[streets,setStreets]=useState(true),[displayLevel,setDisplayLevel]=useState<'sigungu'|'dong'|'sido'>('sigungu');
 useEffect(()=>{const abort=new AbortController();setError(null);Promise.all([api<FloodData>('/flood',abort.signal),api<ViewData>('/view?parent_code=21&level=dong&mode=sgis',abort.signal),api<ViewData>('/view?parent_code=21&mode=sgis',abort.signal)]).then(([d,v,o])=>{setData(d);setView(v);setOverview(o);}).catch(e=>{if(e.name!=='AbortError')setError(e.message);});return()=>abort.abort();},[retry]);
 useEffect(()=>{setSelected(null);},[exploreKey]);
 useEffect(()=>{
  if(tab!=='forecast')return;
  const abort=new AbortController();let url:string|undefined;setImage(null);setImageError(null);
  fetch(`/api/flood/forecast/${scenario}.png`,{signal:abort.signal}).then(async response=>{
   if(!response.ok||!response.headers.get('content-type')?.includes('image/png'))throw new Error('예상도를 불러오지 못했습니다. 다시 시도해 주세요.');
   const blob=await response.blob();if(abort.signal.aborted)return;url=URL.createObjectURL(blob);setImage({scenario,url});
  }).catch(e=>{if(e.name!=='AbortError')setImageError(e.message);});
  return()=>{abort.abort();if(url)URL.revokeObjectURL(url);};
 },[scenario,tab,imageRetry]);
 const years=useMemo(()=>[...new Set(data?.records.map(r=>r.year).filter((y):y is number=>y!=null))].sort((a,b)=>b-a),[data]);
 const rows=useMemo(()=>data?.records.filter(r=>(region==='21'||r.region_code?.startsWith(region))&&(year==='all'||(year==='unknown'?r.year==null:r.year===Number(year))))||[],[data,region,year]);
 const place=data?.regions.find(r=>r.region_code===region)?.region_name||'부산광역시';
 const selectRegion=(code:string)=>{setRegion(code);setSelected(null);if(code==='21')setReset(n=>n+1);};
 const selectPoint=(id:string)=>setSelected(rows.find(r=>r.id===id)||null);
 const selectedScenario=data?.meta.scenarios.find(s=>s.years===scenario);
 const points=tab==='history'?rows:EMPTY_RECORDS;
 const activeImage=tab==='forecast'&&image?.scenario===scenario?image.url:null;
 const flood=useMemo(()=>data?{records:points,selected:tab==='history'?selected:null,onSelect:selectPoint,imageUrl:activeImage,bbox:data.meta.bbox}:undefined,[data,points,selected,tab,activeImage]);
 return <>
  <aside id="left-workspace" className="left-workspace flood-workspace" hidden={!board} aria-label="침수 탐색">
   <div className="workspace-tools"><DisasterSwitch value="flood" onChange={onHazard}/><RegionSearch regions={data?.regions.filter(r=>r.region_code.length>=5)||[]} onSelect={selectRegion}/></div>
   <div className="flood-content">
    <div className="flood-intro"><span className="eyebrow">우리 동네 물길 살펴보기</span><h1>침수에 대비하는 지도</h1><p>어디가 잠겼었는지, 큰비가 내리면 어디를 살펴봐야 할지 확인하세요.</p></div>
    <div className="flood-tabs" role="tablist" aria-label="침수 자료"><button role="tab" aria-selected={tab==='history'} onClick={()=>{if(tab==='history')return;setImage(null);setTab('history');setSelected(null);}}>과거 침수 이력</button><button role="tab" aria-selected={tab==='forecast'} onClick={()=>{if(tab==='forecast')return;setImage(null);setTab('forecast');setSelected(null);}}>침수 예상도</button></div>
    {error?<div className="inline-error" role="alert">{error}<button onClick={()=>setRetry(n=>n+1)}>다시 시도</button></div>:!data?<p className="flood-loading"><LoaderCircle className="spin" size={17}/> 침수 자료를 불러오고 있습니다</p>:<>
     <div className="flood-region-select"><label>구·군<select aria-label="침수 구·군" value={region.length>=5?region.slice(0,5):'21'} onChange={e=>selectRegion(e.target.value)}><option value="21">부산 전체</option>{data.regions.filter(r=>r.region_code.length===5).map(r=><option key={r.region_code} value={r.region_code}>{r.region_name}</option>)}</select></label><label>읍·면·동<select aria-label="침수 읍·면·동" disabled={region.length<5} value={region.length===8?region:''} onChange={e=>selectRegion(e.target.value||region.slice(0,5))}><option value="">전체 동</option>{data.regions.filter(r=>r.region_code.length===8&&r.region_code.startsWith(region.slice(0,5))).map(r=><option key={r.region_code} value={r.region_code}>{r.region_name}</option>)}</select></label></div>
     {tab==='history'?<>
      <label className="flood-year">발생 연도<select aria-label="침수 발생 연도" value={year} onChange={e=>{setYear(e.target.value);setSelected(null);}}><option value="all">전체 기록</option>{years.map(y=><option key={y} value={y}>{y}년</option>)}{data.meta.unknown_year_count>0&&<option value="unknown">연도 확인 필요</option>}</select></label>
      <div className="flood-count"><span>{place}의 공개 이력</span><strong>{rows.length}<small>건</small></strong></div>
      <p className="flood-caption">공개된 침수 지점을 표시합니다. 기록이 없다는 뜻이 안전하다는 뜻은 아닙니다.</p>
      {selected&&<article className="flood-record-detail"><button className="icon-button" aria-label="침수 이력 상세 닫기" onClick={()=>setSelected(null)}><X size={17}/></button><small>{selected.region_name||selected.source_district||'소속 동 확인 필요'}</small><h2>{selected.name}</h2><dl><dt>발생 기간</dt><dd>{selected.period||'확인 필요'}</dd><dt>당시 상황</dt><dd>{selected.event||'미등록'}</dd><dt>침수 원인</dt><dd>{selected.cause||'미등록'}</dd><dt>기록된 깊이</dt><dd>{selected.depth||'미등록'}</dd><dt>기록된 면적</dt><dd>{selected.area||'미등록'}</dd></dl><p>당시 기록된 값입니다. 지점 표시는 침수 범위 전체를 뜻하지 않습니다.</p></article>}
      <div className="flood-record-list" aria-label="침수 이력 목록">{rows.length?rows.map(r=><button key={r.id} aria-pressed={selected?.id===r.id} onClick={()=>setSelected(r)}><MapPin size={16}/><span><b>{r.name}</b><small>{r.period||'발생 시기 확인 필요'} · {r.region_name||r.source_district||'소속 동 미확인'}</small></span><ChevronRight size={14}/></button>):<div className="flood-empty">선택한 지역·연도의 공개 기록이 없습니다.<button onClick={()=>{setRegion('21');setYear('all');setSelected(null);setReset(n=>n+1);}}>부산 전체 기록 보기</button></div>}</div>
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
  </aside>
  <section className="map-section flood-map-section" aria-label="침수 지도 탐색"><div className="map-topbar"><div className="breadcrumb"><button onClick={()=>selectRegion('21')}>부산광역시</button>{region!=='21'&&<><ChevronRight size={13}/><span>{place}</span></>}</div><span className="map-level">{tab==='history'?'과거에 발생한 침수':'폭우를 가정한 예상 범위'}</span></div><div className="map-stage">
   {view&&overview&&data&&<ClimateMap data={view.geojson} overview={overview.geojson} context={overview.geojson} parent="21" selected={region==='21'?null:region} layer="risk" summaryMode={false} onDisplayLevel={setDisplayLevel} onSelect={selectRegion} onDrill={selectRegion} zoom={zoom} reset={reset} streets={streets} facilityMode={false} facilityRegion="21" facilities={EMPTY_FACILITIES} selectedFacility={null} onFacilitySelect={()=>{}} flood={flood}/>}
   {!view&&!error&&<div className="map-loading"><LoaderCircle className="spin"/> 침수 지도를 준비하고 있습니다</div>}
   <div className="map-title-card"><span className="eyebrow"><Waves size={14}/> {tab==='history'?'과거 기록':'강우 시나리오'}</span><h2>{tab==='history'?'부산 과거 침수 이력':`시간당 ${selectedScenario?.rainfall_mm_hour??'—'}mm 강우 예상도`}</h2><p>{tab==='history'?'지점이나 왼쪽 목록을 선택해 당시 기록을 확인하세요.':`${scenario}년 빈도 · 현재 침수 상황이 아닙니다.`}</p></div>
   <div className="map-boundary-badge">{displayLevel==='sigungu'?'구·군 경계':'읍·면·동 경계'}<small>{displayLevel==='sigungu'?'확대하면 읍·면·동':'축소하면 구·군'}</small></div>
   <div className="basemap-toggle"><button className={!streets?'active':''} onClick={()=>setStreets(false)}>행정경계</button><button className={streets?'active':''} onClick={()=>setStreets(true)}>상세 도로지도</button></div>
   <div className="zoom-tools"><button aria-label="침수 지도 초기화" onClick={()=>{setRegion('21');setSelected(null);setReset(n=>n+1);}}><RotateCcw size={18}/></button><button aria-label="지도 확대" onClick={()=>setZoom(z=>({id:z.id+1,step:1}))}><Plus size={19}/></button><button aria-label="지도 축소" onClick={()=>setZoom(z=>({id:z.id+1,step:-1}))}><Minus size={19}/></button></div>
   {tab==='forecast'&&!activeImage&&!imageError&&<div className="updating-pill"><LoaderCircle size={14} className="spin"/> 선택한 강우 조건을 불러오는 중</div>}
   {tab==='forecast'&&imageError&&<div className="map-error-card" role="alert"><p>{imageError}</p><button onClick={()=>setImageRetry(n=>n+1)}>예상도 다시 시도</button></div>}
   {error&&<div className="map-error-card" role="alert"><p>{error}</p><button onClick={()=>setRetry(n=>n+1)}>침수 자료 다시 시도</button></div>}
   <div className="map-data-notice"><Info size={14}/><span>{tab==='history'?'지점은 과거 침수 기록의 위치이며, 침수 면적 전체를 나타내지 않습니다.':'색칠되지 않은 곳도 안전이 보장되지는 않습니다. 자세한 현황은 공식 재난정보를 확인하세요.'}</span></div>
   <div className="map-attribution">침수 © 부산광역시 · 경계 © SGIS{streets&&<> · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors</>}</div>
  </div><div className="map-statusbar"><span>{tab==='history'?`공개 이력 ${rows.length}건`:`예상 침수 깊이 · ${scenario}년 빈도`}</span><button onClick={onSources}>데이터 안내 <ChevronRight size={12}/></button></div></section>
 </>;
}
