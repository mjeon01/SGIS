'use client';
import dynamic from 'next/dynamic';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import { ArrowRight, ArrowUpRight, Check, ChevronDown, ChevronRight, Compass, Database, Flame, Info, Layers3, Leaf, ListFilter, LoaderCircle, MapPin, Minus, PanelLeft, Plus, RotateCcw, Search, ShieldCheck, Sun, Waves, Wind, Mountain, Thermometer, X } from 'lucide-react';
import type { Mode, Layer, ViewData, GeoData, RiskRegion, RegionOption, Explanation, Facility, FacilityData, FacilityFilters } from '@/types';
import { api } from '@/services/api';
import { COLORS, fmt, INDICATORS, LAYERS, LEVELS, color } from './constants';
import DataBoard from './DataBoard';
import FacilityPanel from './FacilityPanel';
import RegionSearch from './RegionSearch';
import DisasterSwitch from './DisasterSwitch';
const FloodScreen = dynamic(() => import('./FloodScreen'), {ssr:false});

const CurrentWeatherScreen = dynamic(() => import('./CurrentWeatherScreen'), {ssr:false});
const ClimateMap = dynamic(() => import('./ClimateMap'), {ssr: false, loading: () => <div className="map-loading"><LoaderCircle className="spin"/> 지도를 준비하고 있습니다</div>});

export default function DashboardApp() {
  const [hazard, setHazard] = useState<'heat'|'flood'>('heat');
  const [floodExploreKey, setFloodExploreKey] = useState(0);
  const floodMode = hazard === 'flood';
  const [mode, setMode] = useState<Mode>('sgis');
  const [initialized, setInitialized] = useState(false);
  const [parent, setParent] = useState('21');
  const [level, setLevel] = useState<'children' | 'dong'>('dong');
  const [layer, setLayer] = useState<Layer>('risk');
  const [view, setView] = useState<ViewData | null>(null);
  const [context, setContext] = useState<GeoData | null>(null);
  const [allDongs, setAllDongs] = useState<{mode:Mode; layer:Layer; geojson:GeoData} | null>(null);
  const [overview, setOverview] = useState<{mode:Mode; layer:Layer; geojson:GeoData} | null>(null);
  const [displayLevel, setDisplayLevel] = useState<'sigungu' | 'dong' | 'sido'>('sigungu');
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<RiskRegion | null>(null);
  const [explanation, setExplanation] = useState<Explanation | null>(null);
  const [tab, setTab] = useState('위험현황');
  const [board, setBoard] = useState(true);
  const [panel, setPanel] = useState<'explore' | 'detail' | 'facilities' | 'weather'>('explore');
  const [legend, setLegend] = useState(true);
  const [layerMenu, setLayerMenu] = useState(false);
  const [sources, setSources] = useState(false);
  const [streets, setStreets] = useState(false);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [zoom, setZoom] = useState({step: 0, id: 0});
  const [reset, setReset] = useState(0);
  const [reload, setReload] = useState(0);
  const [province, setProvince] = useState('21');
  const [district, setDistrict] = useState('');
  const [dong, setDong] = useState('');
  const [provinces, setProvinces] = useState<RegionOption[]>([]);
  const [districts, setDistricts] = useState<RegionOption[]>([]);
  const [dongs, setDongs] = useState<RegionOption[]>([]);
  const [selectError, setSelectError] = useState<string | null>(null);
  const weatherMode = panel === 'weather';
  const facilityMode = panel === 'facilities';
  const [facilities, setFacilities] = useState<FacilityData | null>(null);
  const [facilityError, setFacilityError] = useState<string | null>(null);
  const [facilityRegion, setFacilityRegion] = useState('21');
  const [facilityKind, setFacilityKind] = useState('all');
  const [selectedFacility, setSelectedFacility] = useState<Facility | null>(null);
  const [facilityReload, setFacilityReload] = useState(0);
  const [facilityFilters,setFacilityFilters]=useState<FacilityFilters>({access:'all',day:'',time:''});
  const [weatherStation, setWeatherStation] = useState('159');
  const [weatherOrigin, setWeatherOrigin] = useState<{code:string;name:string;tab:string}|null>(null);
  const [weatherLinkedAnalysis, setWeatherLinkedAnalysis] = useState(false);
  const [reviewReturn, setReviewReturn] = useState<string|null>(null);
  const facilityRows = useMemo(() => facilities?.facilities.filter(r => (facilityRegion === '21' || r.region_code?.startsWith(facilityRegion)) && (facilityKind === 'all' || r.kind === facilityKind)) || [], [facilities, facilityRegion, facilityKind]);
  const savedAnalysis = useRef<{parent:string;level:'children'|'dong';selected:string|null}|null>(null);
  const modalRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!sources) return;
    const previous = document.activeElement as HTMLElement | null;
    const modal = modalRef.current;
    modal?.querySelector<HTMLButtonElement>('button')?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSources(false);
      if (event.key !== 'Tab' || !modal) return;
      const targets = Array.from(modal.querySelectorAll<HTMLElement>('button, a[href], select, [tabindex="0"]'));
      const first = targets[0], last = targets.at(-1);
      if (event.shiftKey && document.activeElement === first) {event.preventDefault();last?.focus();}
      else if (!event.shiftKey && document.activeElement === last) {event.preventDefault();first?.focus();}
    };
    document.addEventListener('keydown', handleKey);
    return () => {document.removeEventListener('keydown', handleKey);previous?.focus();};
  }, [sources]);

  useEffect(() => {
    if (!facilityMode) return;
    const abort = new AbortController();
    setFacilityError(null);setFacilities(null);setSelectedFacility(null);
    const query=new URLSearchParams({region:facilityRegion,kind:facilityKind,access:facilityKind==='shade'?'all':facilityFilters.access});
    if(facilityKind!=='shade'&&facilityFilters.day!=='')query.set('day',facilityFilters.day);
    if(facilityKind!=='shade'&&facilityFilters.time&&facilityFilters.day!=='')query.set('time',facilityFilters.time);
    api<FacilityData>(`/facilities?${query}`, abort.signal).then(setFacilities).catch(e => {if(e.name !== 'AbortError') setFacilityError(e.message);});
    return () => abort.abort();
  }, [facilityMode, facilityReload,facilityRegion,facilityKind,facilityFilters]);


  useEffect(() => { api<{default_mode: Mode}>('/health').then(data => setMode(data.default_mode)).catch(() => {}).finally(() => setInitialized(true)); }, []);
  useEffect(() => {
    if (!initialized) return;
    const abort = new AbortController();
    setLoading(true); setError(null);
    api<ViewData>(`/view?parent_code=${parent}&mode=${mode}&layer=${layer}&level=${level}`, abort.signal)
      .then(data => { setView(data); if (parent === '21' && level === 'dong') setAllDongs({mode,layer,geojson:data.geojson}); if (parent === '00') { setContext(data.geojson); setProvinces(data.regions); } })
      .catch(e => { if (e.name !== 'AbortError') setError(e.message); })
      .finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, [parent, mode, layer, level, reload, initialized]);

  useEffect(() => {
    if (!initialized) return;
    const abort = new AbortController();
    api<ViewData>(`/view?parent_code=00&mode=${mode}`, abort.signal)
      .then(data => {setContext(data.geojson); setProvinces(data.regions);})
      .catch(() => {});
    return () => abort.abort();
  }, [mode, initialized]);

  useEffect(() => {
    if (!initialized || !parent.startsWith('21')) return;
    const abort = new AbortController();
    api<ViewData>(`/view?parent_code=21&mode=${mode}&layer=${layer}`, abort.signal)
      .then(data => setOverview({mode, layer, geojson:data.geojson})).catch(() => {});
    return () => abort.abort();
  }, [mode, layer, initialized, parent]);

  useEffect(() => {
    if (!initialized || parent !== '21' || level !== 'children' || (allDongs?.mode === mode && allDongs.layer === layer)) return;
    const abort = new AbortController();
    api<ViewData>(`/view?parent_code=21&mode=${mode}&layer=${layer}&level=dong`, abort.signal).then(data => setAllDongs({mode,layer,geojson:data.geojson})).catch(() => {});
    return () => abort.abort();
  }, [mode, layer, parent, level, initialized, allDongs]);

  useEffect(() => {
    if (!initialized) return;
    const abort = new AbortController();
    setDistricts([]); setSelectError(null);
    api<RegionOption[]>(`/regions?parent_code=${province}&mode=${mode}`, abort.signal).then(setDistricts)
      .catch(e => { if (e.name !== 'AbortError') setSelectError(e.message); });
    return () => abort.abort();
  }, [province, mode, initialized]);
  useEffect(() => {
    setDongs([]);
    if (!district) return;
    const abort = new AbortController();
    api<RegionOption[]>(`/regions?parent_code=${district}&mode=${mode}`, abort.signal).then(setDongs)
      .catch(e => { if (e.name !== 'AbortError') setSelectError(e.message); });
    return () => abort.abort();
  }, [district, mode]);

  useEffect(() => {
    setDetail(null); setExplanation(null); setDetailError(null);
    if (!selected || facilityMode) {setDetailLoading(false); return;}
    const abort = new AbortController();
    setDetailLoading(true);
    Promise.all([
      api<RiskRegion>(`/risk/${selected}?parent_code=${parent}&mode=${mode}&level=${level}`, abort.signal),
      api<Explanation>('/ai/explain', abort.signal, {region_code: selected, parent_code: parent, mode, level}),
    ]).then(([result, text]) => {setDetail(result); setExplanation(text);})
      .catch(e => { if (e.name !== 'AbortError') setDetailError(e.message); })
      .finally(() => { if (!abort.signal.aborted) setDetailLoading(false); });
    return () => abort.abort();
  }, [selected, parent, mode, level, facilityMode]);

  const navigate = useCallback((code: string, select: string | null = null) => {
    setPanel(select ? 'detail' : 'explore'); setParent(code); setLevel(code === '21' ? 'dong' : 'children'); setSelected(select); setBoard(true); setReset(n => n + 1);
    if (code === '00') { setProvince('21'); setDistrict(''); setDong(''); }
    else { setProvince(code.slice(0, 2)); setDistrict(select?.length === 8 ? select.slice(0, 5) : code.length === 5 ? code : ''); setDong(select?.length === 8 ? select : ''); }
  }, []);
  const selectRegion = useCallback((code: string) => {
    if (facilityMode) {setFacilityRegion(code);setSelected(code);setSelectedFacility(null);setBoard(true);return;}
    if (code.length === 2) {navigate(code); return;}
    if (code.length === 8 && parent === '21' && level === 'children') {navigate('21', code);return;}
    setSelected(code); setBoard(true); setPanel('detail');
    setProvince(code.slice(0, 2)); setDistrict(code.slice(0, 5)); setDong(code.length === 8 ? code : '');
  }, [navigate, facilityMode, parent, level]);
  const changeMode = (next: Mode) => {setPanel('explore');setMode(next); setSelected(null); setDetail(null); setExplanation(null); setView(null); setContext(null); setParent('21'); setLevel('dong'); setProvince('21'); setDistrict(''); setDong('');};
  const visibleView = view?.meta.mode === mode && view.parent_code === parent && view.level === level ? view : null;
  const selectedRegion = detail?.region_code === selected ? detail : visibleView?.regions.find(r => r.region_code === selected) || null;
  const layerName = LAYERS.find(l => l.key === layer)?.name || INDICATORS.find(l => l.key === layer)?.name || '';
  const place = visibleView?.breadcrumbs.at(-1)?.region_name || '대한민국';
  const isRisk = layer === 'risk';
  const cityDongs = parent === '21' && level === 'dong';
  const enterFacilities = (code = '21') => {if(!facilityMode)savedAnalysis.current={parent,level,selected};setHazard('heat');setPanel('facilities');setBoard(true);setParent('21');setLevel('dong');setFacilityRegion(code);setFacilityKind('all');setFacilityFilters({access:'all',day:'',time:''});setSelected(code.length === 8 ? code : null);setSelectedFacility(null);setStreets(true);setReset(n=>n+1);};
  const changeFacilityRegion = (code: string) => {setFacilityRegion(code);setSelected(code.length === 8 ? code : null);setSelectedFacility(null);if(code.length !== 8)setReset(n=>n+1);};
  const switchLevel = (next: 'children' | 'dong') => {setPanel('explore');setLevel(next);setSelected(null);setDistrict('');setDong('');setReset(n => n + 1);};

  const changeHazard = (next:'heat'|'flood') => {setHazard(next);setBoard(true);setPanel('explore');setLayerMenu(false);};
  const openAnalysis = (next:'explore'|'detail') => {setBoard(true);if(floodMode){setFloodExploreKey(n=>n+1);return;}if(facilityMode&&savedAnalysis.current){const saved=savedAnalysis.current;setParent(saved.parent);setLevel(saved.level);setSelected(saved.selected);setProvince(saved.parent.slice(0,2));setDistrict(saved.selected?.slice(0,5)|| (saved.parent.length===5?saved.parent:''));setDong(saved.selected?.length===8?saved.selected:'');}setPanel(next);};
  const enterWeather = (stationId?:string) => {
    if(stationId)setWeatherStation(stationId);
    if(mode==='sgis'&&selectedRegion?.region_code.length===8&&selectedRegion.region_code.startsWith('21'))setWeatherOrigin({code:selectedRegion.region_code,name:selectedRegion.region_name,tab});
    else setWeatherOrigin(null);
    setHazard('heat');setPanel('weather');setBoard(true);
  };
  const analyzeFromWeather = (code:string,name:string) => {setDetail(null);setExplanation(null);setMode('sgis');setWeatherOrigin({code,name,tab:'위험현황'});setWeatherLinkedAnalysis(true);navigate('21',code);setTab('위험현황');};
  const returnFromWeather = () => {if(weatherOrigin){setMode('sgis');navigate('21',weatherOrigin.code);setTab(weatherOrigin.tab);setWeatherLinkedAnalysis(true);}};
  const searchRegions = useMemo(() => allDongs?.geojson.features.map(f=>({region_code:f.properties.region_code,region_name:f.properties.region_name,full_name:`부산광역시 ${overview?.geojson.features.find(d=>d.properties.region_code===f.properties.region_code.slice(0,5))?.properties.region_name||''} ${f.properties.region_name}`}))||[], [allDongs,overview]);

  return <main className={`app-shell ${board ? '' : 'board-hidden'}`}>
    <header className="app-header"><a href="/" className="brand" aria-label="기후안심지도 처음으로"><span className="brand-mark"><Leaf size={23}/></span><span><strong>기후안심지도</strong><small>ClimateGuard</small></span></a><nav className="main-nav" aria-label="서비스 메뉴"><span className="nav-active">{floodMode?'침수 이력·예상도':weatherMode?'기상 비교 · 동네 분석':'폭염 취약성 지도'}</span><button onClick={() => setSources(true)}>데이터 안내 <ArrowUpRight size={13}/></button></nav><div className="header-right">{floodMode ? <span className="facility-mode-badge">부산 침수지도</span> : weatherMode ? <span className="facility-mode-badge">기상 비교</span> : facilityMode ? <span className="facility-mode-badge">현재 시설</span> : <label className={`mode-selector ${mode === 'sample' ? 'sample' : ''}`}><span className="status-dot"/><select aria-label="데이터 모드" value={mode} onChange={e => changeMode(e.target.value as Mode)}><option value="sgis">실제 공공데이터</option><option value="sample">테스트용 Sample</option></select><ChevronDown size={12}/></label>}</div></header>

    <nav className="tool-rail" aria-label="지도 작업 메뉴"><button aria-controls="left-workspace" aria-expanded={board} className={board && panel === 'explore' ? 'active' : ''} onClick={() => openAnalysis('explore')}><Search size={22}/><span>지역 탐색</span></button>{!floodMode && <button aria-controls="left-workspace" aria-expanded={board} className={board && panel === 'detail' ? 'active' : ''} onClick={() => openAnalysis('detail')}><ListFilter size={22}/><span>동네 분석</span></button>}<button className={facilityMode ? 'active' : ''} onClick={() => {setReviewReturn(null);enterFacilities();}}><MapPin size={22}/><span>{floodMode?'폭염 시설':'현재 시설'}</span></button><button className={weatherMode ? 'active' : ''} onClick={() => enterWeather()}><Thermometer size={22}/><span>기상 비교</span></button><button onClick={() => setSources(true)}><Database size={22}/><span>데이터 안내</span></button><button className="rail-collapse" aria-label="왼쪽 패널 접기 펼치기" aria-controls="left-workspace" aria-expanded={board} onClick={() => setBoard(!board)}><PanelLeft size={21}/><span>{board ? '패널 접기' : '패널 열기'}</span></button></nav>
    {!floodMode && <><div id="left-workspace" className="left-workspace" hidden={!board || weatherMode}>
    <div className="workspace-tools"><DisasterSwitch value="heat" onChange={changeHazard}/><RegionSearch regions={searchRegions} onSelect={code=>navigate('21',code)}/></div>
    <aside className="sidebar" aria-label="분석 설정" hidden={panel !== 'explore'}>
      <div className="sidebar-title"><span className="eyebrow">CLIMATE INSIGHT</span><h1>폭염 대응이 필요한<br/>동네부터 살펴보기</h1><p>읍면동별 취약성을 비교해 우선 대응지역을 찾습니다.</p></div>
      <section className="sidebar-section"><div className="section-label"><span>분석할 지역</span><MapPin size={14}/></div><div className="region-selectors"><label><span>시·도</span><select aria-label="시·도" value={province} onChange={e => navigate(e.target.value)}>{provinces.length ? provinces.map(r => <option key={r.region_code} value={r.region_code}>{r.region_name}</option>) : <option value="21">부산광역시</option>}</select></label><label><span>시·군·구</span><select aria-label="시·군·구" value={district} onChange={e => navigate(e.target.value || province)}><option value="">전체 구·군</option>{districts.map(r => <option key={r.region_code} value={r.region_code}>{r.region_name}</option>)}</select></label><label><span>읍·면·동</span><select aria-label="읍·면·동" disabled={!district} value={dong} onChange={e => navigate(district || province, e.target.value || null)}><option value="">전체 읍·면·동</option>{dongs.map(r => <option key={r.region_code} value={r.region_code}>{r.region_name}</option>)}</select></label></div>{selectError && <p className="select-error" role="alert">{selectError}</p>}<p className="select-hint">선택하면 바로 지도로 이동합니다.</p></section>
      <section className="sidebar-section ranking-section"><div className="section-label"><span>우선 검토지역 <b>TOP 5</b></span><span className="ranking-scope">{cityDongs ? '부산 전체 동' : parent === '00' ? '부산 분석' : place}</span></div>{visibleView?.ranking.length ? <ol className="ranking-list">{visibleView.ranking.map((r, i) => <li key={r.region_code}><button className={selected === r.region_code ? 'active' : ''} onClick={() => selectRegion(r.region_code)}><span className="rank-number">{i + 1}</span><span>{r.region_name}{cityDongs && <small className="rank-district">{r.full_name.replace('부산광역시', '').replace(r.region_name, '').trim()}</small>}</span><strong style={{color: color(r.risk_score)}}>{fmt(r.risk_score)}</strong><ChevronRight size={12}/></button></li>)}</ol> : <div className="ranking-empty"><ListFilter size={20}/><p>{parent === '00' ? '지역을 선택하면 비교범위 내\n취약지역 순위를 확인할 수 있습니다.' : '종합점수가 확보된 지역이 없어\n순위를 표시하지 않습니다.'}</p>{parent !== '00' && <small>결측치를 임의로 대체하지 않습니다.</small>}</div>}</section>
      <section className="sidebar-section layer-section"><div className="section-label"><span>지도 레이어</span><Layers3 size={14}/></div><div className="layer-options">{LAYERS.map(l => <button key={l.key} className={layer === l.key ? 'active' : ''} onClick={() => setLayer(l.key)} aria-pressed={layer === l.key}><span className="radio-dot"/><span>{l.name}<small>{l.english}</small></span>{layer === l.key && <Check size={14}/>}</button>)}</div><details className="indicator-details"><summary>세부지표로 살펴보기 <ChevronDown size={12}/></summary><div>{INDICATORS.map(i => <button className={layer === i.key ? 'active' : ''} key={i.key} onClick={() => setLayer(i.key)}><span className="indicator-bullet"/>{i.name}</button>)}</div></details></section>

      <div className="sidebar-footer"><ShieldCheck size={15}/><span>데이터로 이해하고, 함께 대비합니다.</span></div>
    </aside>
    <div className="detail-workspace" hidden={panel !== 'detail'}>{<DataBoard onWeather={enterWeather} onWeatherBack={weatherLinkedAnalysis&&weatherOrigin?.code===selected?()=>enterWeather(weatherStation):undefined} region={selectedRegion} explanation={explanation} tab={tab} setTab={setTab} loading={detailLoading} error={detailError} parent={parent} sample={mode === 'sample'} onDrill={navigate} onClose={() => setPanel('explore')} onBusan={() => navigate('21')} cityDongs={cityDongs} mode={mode} onFacilities={code => {setReviewReturn(code);enterFacilities(code);}}/>}</div>
    {facilityMode && <>{reviewReturn && <button className="facility-review-return" onClick={() => {navigate('21',reviewReturn);setTab('보고서');}}>← 선택한 동의 보고서로 돌아가기</button>}<FacilityPanel filters={facilityFilters} onFilters={setFacilityFilters} data={facilities} error={facilityError} region={facilityRegion} kind={facilityKind} rows={facilityRows} selected={selectedFacility} onRegion={changeFacilityRegion} onKind={kind => {setFacilityKind(kind);setSelectedFacility(null);}} onSelect={setSelectedFacility} onRetry={() => setFacilityReload(n=>n+1)}/></>}
    </div>

    <section className="map-section" aria-label="지도 탐색" hidden={weatherMode}>
      <div className="map-topbar"><div className="breadcrumb"><button onClick={() => navigate('00')} aria-label="대한민국 전체 지도"><Compass size={16}/></button>{(visibleView?.breadcrumbs || [{region_code:'00',region_name:'대한민국'}]).map((r,i) => <span key={r.region_code}>{i > 0 && <ChevronRight size={12}/>}<button className={r.region_code === parent ? 'current' : ''} onClick={() => navigate(r.region_code)}>{r.region_name}</button></span>)}</div><div className="map-scope">{parent === '21' && !facilityMode && <div className="scope-toggle" aria-label="부산 분석 단위"><button aria-pressed={cityDongs} onClick={() => switchLevel('dong')}>전체 읍면동</button><button aria-pressed={!cityDongs} onClick={() => switchLevel('children')}>구·군 요약</button></div>}<span className="map-level">{facilityMode ? '쉼터·그늘막' : parent === '00' ? '시·도별 보기' : parent.length === 2 && !cityDongs ? '시·군·구별 보기' : '축척에 따라 경계 전환'}</span></div></div>
      <div className="map-stage">
        {view?.meta.mode === mode && <ClimateMap data={parent === '21' && level === 'children' && allDongs?.mode === mode && allDongs.layer === layer ? allDongs.geojson : view.geojson} summaryMode={parent === '21' && level === 'children'} context={context} overview={(parent === '21' || facilityMode || parent.length === 5) && parent.startsWith('21') && overview?.mode === mode && overview.layer === layer ? overview.geojson : null} onDisplayLevel={setDisplayLevel} parent={view.parent_code} selected={selected} layer={view.layer} onSelect={selectRegion} onDrill={navigate} zoom={zoom} reset={reset} streets={streets} facilityMode={facilityMode} facilityRegion={facilityRegion} facilities={facilityRows} selectedFacility={selectedFacility} onFacilitySelect={id => setSelectedFacility(facilities?.facilities.find(r=>r.id === id) || null)}/>}
        {!visibleView && !error && <div className="map-loading"><LoaderCircle className="spin" size={24}/><span>지도를 불러오고 있습니다</span></div>}
        {loading && visibleView && <div className="updating-pill"><LoaderCircle size={13} className="spin"/> 지도 갱신 중</div>}
        <div className="map-title-card"><span className="eyebrow"><span className="live-dot"/> {facilityMode ? '현재 시설 위치' : mode === 'sample' ? 'SAMPLE DATA' : '우리 동네 살펴보기'}</span><h2>{facilityMode ? '부산 쉼터·그늘막 위치' : parent === '00' ? '지역을 선택해 시작하세요' : cityDongs && isRisk ? '부산 읍면동 우선 대응지역' : `${place} ${layerName}`}</h2><p>{facilityMode ? '등록시설 위치와 이용정보를 확인합니다' : parent === '00' ? '대한민국에서 부산, 그리고 우리 동네까지' : cityDongs ? '부산 전체 읍면동을 같은 기준으로 비교합니다' : isRisk ? '통계로 살펴보는 지역별 상대적 폭염 취약성' : '현재 비교범위에서 정규화한 상대 지표 점수'}</p></div>
        <div className="map-boundary-badge">{displayLevel === 'sigungu' ? '구·군 경계' : displayLevel === 'dong' ? '읍·면·동 경계' : '시·도 경계'}{(cityDongs || facilityMode) && <small>{displayLevel === 'sigungu' ? '확대하면 읍·면·동' : '축소하면 구·군'}</small>}</div><div className="basemap-toggle"><button className={!streets ? 'active' : ''} onClick={() => setStreets(false)}>{facilityMode ? '행정경계' : '취약도 지도'}</button><button className={streets ? 'active' : ''} onClick={() => setStreets(true)}>상세 도로지도</button></div><div className="map-tools"><button className={board ? 'active' : ''} title="데이터보드" aria-label="데이터보드 표시 전환" aria-pressed={board} onClick={() => setBoard(!board)}><PanelLeft size={19}/></button>{!facilityMode && <button className={layerMenu ? 'active' : ''} title="레이어" aria-label="레이어 메뉴" aria-expanded={layerMenu} onClick={() => setLayerMenu(!layerMenu)}><Layers3 size={19}/></button>}<button className={legend ? 'active' : ''} title="범례" aria-label="범례 표시 전환" aria-pressed={legend} onClick={() => setLegend(!legend)}><ListFilter size={19}/></button><span/><button title="현재 지역 지도 초기화" aria-label="지도 초기화" onClick={() => {setSelected(null);setSelectedFacility(null);setFacilityRegion('21');setReset(n => n + 1);}}><RotateCcw size={17}/></button></div>
        {layerMenu && !facilityMode && <div className="floating-layer-menu"><h4>지도 레이어</h4>{LAYERS.map(l => <button className={layer === l.key ? 'active' : ''} key={l.key} onClick={() => {setLayer(l.key);setLayerMenu(false);}}>{l.name}{layer === l.key && <Check size={13}/>}</button>)}</div>}
        <div className="zoom-tools"><span className="north-marker">N<svg viewBox="0 0 14 20"><path d="M7 1L13 18L7 14L1 18Z" fill="#54766a"/></svg></span><button aria-label="지도 확대" onClick={() => setZoom(z => ({step:1,id:z.id+1}))}><Plus size={19}/></button><button aria-label="지도 축소" onClick={() => setZoom(z => ({step:-1,id:z.id+1}))}><Minus size={19}/></button></div>
        {mode === 'sample' && !facilityMode && <div className="sample-map-banner"><Info size={15}/><span>시연용 합성 데이터 · 실제 지역 위험도가 아닙니다</span></div>}
        {error && <div className="map-error-card" role="alert"><Database size={25}/><h3>데이터를 불러오지 못했습니다</h3><p>{error}</p><button className="primary-button" onClick={() => setReload(n => n+1)}>다시 시도 <RotateCcw size={14}/></button>{mode === 'sgis' && <button className="text-button" onClick={() => changeMode('sample')}>테스트용 Sample로 기능 확인</button>}</div>}
        {legend && !facilityMode && <div className="map-legend"><div><strong>{displayLevel === 'sigungu' ? '구·군 ' : displayLevel === 'dong' ? '읍·면·동 ' : ''}{isRisk ? '폭염 취약도' : '상대 지표 점수'}</strong><span>0—100</span></div><small className="legend-comparison">{cityDongs && displayLevel === 'sigungu' ? '색상: 구·군끼리 비교 · 순위: 읍면동' : parent === '21' && !cityDongs && displayLevel === 'dong' ? '색상: 부산 전체 읍면동 · 순위: 구·군' : '현재 비교범위 내 상대 점수'}</small><div className="legend-ramp">{COLORS.map(c => <i key={c} style={{background:c}}/>)}</div><div className="legend-labels"><span>{isRisk ? '매우 낮음' : '낮음'}</span><span>{isRisk ? '매우 높음' : '높음'}</span></div><div className="legend-missing"><i/> {isRisk ? '데이터 부족 · 점수 미산출' : '지표 미확보'}</div></div>}
        {parent === '00' && <button className="busan-shortcut" onClick={() => navigate('21')}><span><MapPin size={17}/><b>부산광역시</b><small>대표 분석 지역</small></span><ArrowRight size={17}/></button>}
        {parent !== '00' && !facilityMode && mode === 'sgis' && !error && <div className="map-data-notice"><Info size={14}/><span>{visibleView?.in_analysis_scope ? (visibleView.meta.available_indicator_count === 7 ? '지역 간 상대적인 취약성을 비교합니다. 현재 날씨는 동네 분석에서 확인하세요.' : '필수 지표가 부족한 지역은 종합 위험도를 산출하지 않습니다.') : '이 지역은 경계 탐색을 제공합니다. 실제 통계 분석은 부산에서 확인하세요.'}</span>{visibleView?.in_analysis_scope && <button onClick={() => setSources(true)}>데이터 안내 <ChevronRight size={12}/></button>}</div>}
        <>{facilityMode && <>{legend && <div className="facility-map-legend"><span><i className="shelter-dot"/>무더위쉼터</span><span><i className="shade-dot"/>그늘막</span>{facilityRows.some(f=>f.filter_status==='unknown')&&<span><i style={{background:'#849099'}}/>조건 확인 필요</span>}</div>}<div className="map-data-notice">시설별 기준일이 다릅니다. 실시간 개방 여부는 제공하지 않습니다.</div></>}</><div className="map-attribution">경계 © SGIS{streets && <> · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors</>}</div>
      </div>
      <div className="map-statusbar"><span>{facilityMode ? <><span className="status-dot"/>{facilityRows.length.toLocaleString()}개 시설 위치 · 취약성 분석과 별도</> : <><span className="status-dot"/>{visibleView ? `${visibleView.regions.length}개 지역` : '데이터 연결 중'}<i/> {visibleView?.scored_count || 0}개 종합점수 산출{cityDongs && visibleView && ` · ${visibleView.regions.length - visibleView.scored_count}개 자료 부족`}</>}</span><button onClick={() => setSources(true)}><Database size={12}/> 데이터 안내 <ChevronRight size={12}/></button></div>
    </section>


    {weatherMode && <CurrentWeatherScreen board={board} context={context} stationId={weatherStation} onStationChange={setWeatherStation} onAnalyze={analyzeFromWeather} returnRegion={weatherOrigin} onReturn={returnFromWeather}/>}</>}
    {floodMode && <FloodScreen board={board} onHazard={changeHazard} onSources={()=>setSources(true)} exploreKey={floodExploreKey}/>}
    {sources && <div className="modal-backdrop" onClick={() => setSources(false)}><section ref={modalRef} className="sources-modal" role="dialog" aria-modal="true" aria-labelledby="sources-title" onClick={e => e.stopPropagation()}><div className="modal-heading"><span className="eyebrow">DATA & METHODOLOGY</span><button className="icon-button" aria-label="데이터 안내 닫기" onClick={() => setSources(false)}><X size={20}/></button></div>{floodMode ? <><h2 id="sources-title">침수 자료 안내</h2><h3>과거 침수 이력</h3><p>부산광역시 부산 안전 ON의 공개 침수 기록입니다. 지점·발생 기간·당시 깊이·면적을 원문 기준으로 표시합니다. 좌표가 유효하지 않은 기록은 제외하고, 연도가 불명확한 기록은 ‘연도 확인 필요’로 구분합니다. 지도에서 선택한 동은 지점 좌표가 속하는 행정구역입니다. 지점 수를 재난 발생 횟수나 위험 순위로 해석하지 않습니다.</p><h3>침수 예상도</h3><p>부산시 도심침수 예상도 원본을 사용합니다. 30·50·80·100년 빈도는 각각 시간당 98.1·106.8·114.7·118.5mm 강우 시나리오입니다. 현재 침수나 실시간 예보가 아니며, 미래의 발생 확률을 동별 점수로 계산하지 않습니다. 원본의 제작 기준연도는 확인되지 않았습니다.</p><h3>표시 범위와 한계</h3><p>부산 전역의 원본 지도를 4,096 × 4,096 픽셀로 저장해 표시하므로 크게 확대하면 픽셀이 보일 수 있습니다. 개별 건물의 침수 깊이 판정이나 대피 경로 결정용 자료가 아닙니다. 통계·인구·폭염 취약도와 수치 비교하지 않습니다.</p><a href="https://safecity.busan.go.kr/" target="_blank" rel="noreferrer">부산광역시 부산 안전 ON ↗</a></> : weatherMode ? <><h2 id="sources-title">기상 비교 자료 안내</h2><p>기상청 ASOS/AWS 관측소별 일 최고·최저기온을 제공합니다. 기상 지도는 조회 종료일의 일 최고기온을 같은 날짜로 비교하며, 해당 날짜의 결측을 과거 값으로 채우지 않습니다. 관측소 선택 후 각 동 대표점에서 가장 가까운 관측소로 연결된 동 목록을 통해 분석으로 이동합니다. 최신 기온을 기존 취약도 점수에 합산하지 않습니다. 완료된 일 관측자료이며 실시간 기온은 아닙니다. 관측일·조회 범위·저장 시각을 구분하고 결측은 보간하지 않습니다. 관측소 실측값을 행정동 전체의 기온으로 해석하지 마세요.</p><a href="https://data.kma.go.kr" target="_blank" rel="noreferrer">기상청 기상자료개방포털 ↗</a></> : facilityMode ? <><h2 id="sources-title">현재 시설 자료 안내</h2><div className="source-pills"><span>시설 2026년</span><span>경계 2025년</span></div><h3>공식 등록시설 위치</h3><p>무더위쉼터는 국민안전24의 2026년 등록자료, 그늘막은 부산생활지도의 2026년 4월 30일 기준 공개자료입니다. 시설명·주소·이용대상·등록 운영시간 등 출처가 제공하는 항목을 표시합니다.</p><h3>자료를 읽을 때</h3><p>시설 위치와 이용정보를 확인하는 화면입니다. 실시간 개방 여부나 시설의 부족 여부를 판정하지 않습니다. 공개 목록에 없는 시설이 있을 수 있으며, 좌표가 확인되지 않은 시설은 지도에서 제외합니다. 2025년 행정경계에 포함되지 않는 좌표는 특정 동으로 임의 연결하지 않습니다.</p><a href="https://www.safekorea.go.kr/safekorea-kor/flsm/flsm/facilitiesSafteyMap.do?menuSn=2" target="_blank" rel="noreferrer">국민안전24 시설안전지도 ↗</a><a href="https://lifemap.busan.go.kr/li/index.do" target="_blank" rel="noreferrer">부산생활지도 ↗</a><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">도로지도 © OpenStreetMap contributors ↗</a></> : <><h2 id="sources-title">데이터를 이해하면<br/>지도가 더 명확해집니다.</h2><div className="source-pills"><span>통계 {visibleView?.meta.reference_year || 2024}년</span><span>경계 {visibleView?.meta.boundary_year || 2025}년</span><span>{mode === 'sgis' ? 'SGIS + 기상청' : 'Sample · 합성 통계'}</span></div><h3>무엇을 분석하나요?</h3><p>SGIS의 인구·가구·30년 이상 노후주택 비율과 기상청 ASOS/AWS 관측자료를 결합합니다. 기상지표는 6~8월 평균기온과 일 최고기온 33℃ 이상인 날의 수입니다.</p><h3>점수는 어떻게 계산하나요?</h3><div className="formula">Risk = Hazard × Exposure × Vulnerability</div><p>동일 비교지역 내 지표를 Min–Max 정규화하고, 가중합으로 H·E·V를 계산한 뒤 곱한 값을 0~100으로 정규화합니다. 지표 또는 최종 값이 모두 같으면 중간값을 사용합니다. 필수 지표가 없으면 종합점수와 순위를 제공하지 않습니다.</p><h3>현재 데이터의 한계</h3><p>기상은 지역 내부 대표점의 최근접 관측소 값이며 해당 동의 직접 실측값이 아닙니다. 관측소의 고도·해안과의 거리 등으로 지역 실제 기온과 차이가 날 수 있습니다. 여름 92일 중 결측이 있는 지표는 산출하지 않습니다. 통계는 2024년, 경계는 2025년입니다. 고령인구·1인가구 비교는 분자·분모 합산, 노후주택 비교는 SGIS 공식 상위지역 비율을 사용합니다. 점수 평균과 순위는 산출 가능한 지역 기준입니다.</p><div className="risk-thresholds">{LEVELS.map((l,i) => <span key={l}><i style={{background:COLORS[i]}}/>{l}<small>{i*20}~{(i+1)*20}{i<4?' 미만':''}</small></span>)}</div><p className="source-notice">점수는 실제 재난 발생확률이 아니며 비교범위가 다른 점수를 직접 비교할 수 없습니다.</p><a href="https://sgis.mods.go.kr/developer/html/newOpenApi/api/dataApi/census.html" target="_blank" rel="noreferrer">SGIS 공식 데이터 설명 <ArrowUpRight size={14}/></a><a href="https://data.kma.go.kr/data/grnd/selectAwsRltmList.do" target="_blank" rel="noreferrer">기상청 관측자료 설명 <ArrowUpRight size={14}/></a></>}</section></div>}
  </main>;
}
