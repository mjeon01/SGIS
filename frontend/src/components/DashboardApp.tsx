'use client';
import dynamic from 'next/dynamic';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, BookmarkPlus, ClipboardCheck, Check, ChevronDown, ChevronRight, Compass, Database, Info, Layers3, Leaf, ListFilter, LoaderCircle, MapPin, Minus, PanelLeft, Plus, RotateCcw, Search, ShieldCheck, SlidersHorizontal, Thermometer, X } from 'lucide-react';
import type { Mode, Layer, ViewData, GeoData, RiskRegion, RegionOption, Explanation, Facility, FacilityData, FacilityFilters } from '@/types';
import { api } from '@/services/api';
import { COLORS, fmt, INDICATORS, LAYERS, LEVELS, color } from './constants';
import DataBoard from './DataBoard';
import FacilityPanel from './FacilityPanel';
import RegionSearch from './RegionSearch';
import MapGuide from './MapGuide';
import RegionNavigator from './RegionNavigator';
import ReadinessFinder from './readiness/ReadinessFinder';
import InspectionList from './readiness/InspectionList';
import type {ReadinessCriterion} from './readiness/criteria';
import {findReadinessRegions} from './readiness/criteria';
import type {InspectionItem} from './readiness/inspection';
import {regionInspection,facilityInspection,floodInspection,landslideInspection} from './readiness/inspection';
import {useInspectionList} from '@/hooks/useInspectionList';
import RegionCoverage from './disasters/RegionCoverage';
import {hasLocalData,LOCAL_DATA_AREAS} from './disasters/coverage';
import DisasterSwitch from './DisasterSwitch';
import type {Disaster,DisasterMapLayer,MapCamera} from '@/types/disasters';
import {useFlood} from '@/hooks/useFlood';
import {useWeather} from '@/hooks/useWeather';
import {useDisasters} from '@/hooks/useDisasters';
import DisasterPanel, {SourceInfo,disasterMeaning} from './disasters/DisasterPanel';
import DisasterOverlay from './disasters/DisasterOverlay';
import NeighborhoodProfile from './disasters/NeighborhoodProfile';
import {DISASTERS,isPendingDisaster,PENDING_MESSAGES} from './disasters/catalog';
import EmptyDisaster from './disasters/EmptyDisaster';
import FloodMapOverlay from './disasters/FloodMapOverlay';
import Timeline from './map/Timeline';
import WeatherLegend from './map/WeatherLegend';
import ObservationOverlay from './map/ObservationOverlay';
import {thermalColor,coldColor} from './map/observation-colors';
import {useNearbyFacilities} from '@/hooks/useNearbyFacilities';
const EMPTY_MAP:GeoData={type:'FeatureCollection',features:[]};
const FloodScreen = dynamic(() => import('./FloodScreen'), {ssr:false});

const CurrentWeatherScreen = dynamic(() => import('./CurrentWeatherScreen'), {ssr:false});
const ClimateMap = dynamic(() => import('./ClimateMap'), {ssr: false, loading: () => <div className="map-loading"><LoaderCircle className="spin"/> 지도를 준비하고 있습니다</div>});

export default function DashboardApp() {
  const [hazard, setHazard] = useState<Disaster>('heat');
  const additional = isPendingDisaster(hazard);
  const [camera,setCamera]=useState<MapCamera|null>(null);
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
  const [panel, setPanel] = useState<'find' | 'explore' | 'detail' | 'facilities' | 'weather'>('find');
  const inspection=useInspectionList();
  const [listOpen,setListOpen]=useState(false);
  const [criteria,setCriteria]=useState<ReadinessCriterion[]>([]);
  const [appliedScope,setAppliedScope]=useState<string|null>(null);
  const [pendingInspection,setPendingInspection]=useState<InspectionItem|null>(null);
  const [inspectionNotice,setInspectionNotice]=useState<string|null>(null);
  const [legend, setLegend] = useState(true);
  const [layerMenu, setLayerMenu] = useState(false);
  const [sources, setSources] = useState(false);
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
  const weatherMode = hazard === 'heat' && panel === 'weather';
  const facilityMode = hazard === 'heat' && panel === 'facilities';
  const [facilities, setFacilities] = useState<FacilityData | null>(null);
  const [facilityError, setFacilityError] = useState<string | null>(null);
  const [facilityKind, setFacilityKind] = useState('all');
  const [selectedFacility, setSelectedFacility] = useState<Facility | null>(null);
  const [facilityReload, setFacilityReload] = useState(0);
  const [facilityFilters,setFacilityFilters]=useState<FacilityFilters>({access:'all',day:'',time:''});
  const [weatherStation, setWeatherStation] = useState('159');
  const [weatherOrigin, setWeatherOrigin] = useState<{code:string;name:string;tab:string}|null>(null);
  const [weatherLinkedAnalysis, setWeatherLinkedAnalysis] = useState(false);
  const [reviewReturn, setReviewReturn] = useState<string|null>(null);
  const sharedRegion=selected||parent;
  const facilityRegion=sharedRegion;
  const facilityRows = useMemo(() => facilities?.facilities.filter(r => (facilityRegion === '21' || r.region_code?.startsWith(facilityRegion)) && (facilityKind === 'all' || r.kind === facilityKind)) || [], [facilities, facilityRegion, facilityKind]);
  const savedAnalysis = useRef<{parent:string;level:'children'|'dong';selected:string|null}|null>(null);
  const modalRef = useRef<HTMLElement>(null);
  const regionalAvailable=hasLocalData(hazard,sharedRegion);
  const localUnavailable=!regionalAvailable&&hazard!=='typhoon';
  const flood=useFlood(floodMode&&regionalAvailable,sharedRegion);
  const openDisaster=useCallback(()=>setBoard(true),[]);
  const disasters=useDisasters(hazard,sharedRegion,openDisaster);
  const pending=additional&&!disasters.active.data;
  const chooseStation=useCallback((id:string)=>{setWeatherStation(id);setBoard(true);},[]);
  const weather=useWeather(weatherMode&&regionalAvailable,weatherStation,chooseStation);
  const nearby=useNearbyFacilities(weatherMode&&regionalAvailable,sharedRegion);
  const beginNearbyPick=()=>{
    nearby.startPicking();
    if(window.matchMedia('(max-width:1000px), (max-height:600px)').matches)setBoard(false);
    requestAnimationFrame(()=>document.querySelector<HTMLCanvasElement>('.weather-map canvas')?.focus());
  };
  const weatherOriginPending=useRef<string|null>(null);
  useEffect(()=>{
    if(!weatherMode||!weather.snapshot||!weatherOriginPending.current)return;
    const station=weather.snapshot.stations.find(s=>s.regions.some(r=>r.region_code===weatherOriginPending.current));
    if(station)setWeatherStation(station.station_id);
    weatherOriginPending.current=null;
  },[weatherMode,weather.snapshot,selected]);

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

  const loadedFacilities=useRef('');
  useEffect(() => {
    if (!facilityMode || !regionalAvailable) return;
    const abort = new AbortController();
    const query=new URLSearchParams({region:facilityRegion,kind:facilityKind,access:facilityKind==='shade'?'all':facilityFilters.access});
    if(facilityKind!=='shade'&&facilityFilters.day!=='')query.set('day',facilityFilters.day);
    if(facilityKind!=='shade'&&facilityFilters.time&&facilityFilters.day!=='')query.set('time',facilityFilters.time);
    const key=`${query}:${facilityReload}`;
    if(loadedFacilities.current===key)return;
    // Clearing the displayed snapshot also invalidates its cache marker. A quick
    // A → B → A change must refetch A if the request for B was aborted.
    loadedFacilities.current='';
    setFacilityError(null);setFacilities(null);setSelectedFacility(null);
    api<FacilityData>(`/facilities?${query}`, abort.signal).then(data=>{loadedFacilities.current=key;setFacilities(data);}).catch(e => {if(e.name !== 'AbortError') setFacilityError(e.message);});
    return () => abort.abort();
  }, [facilityMode, regionalAvailable,facilityReload,facilityRegion,facilityKind,facilityFilters]);


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
    setListOpen(false);setInspectionNotice(null);setPanel(select ? 'detail' : 'explore'); setParent(code); setLevel(code === '21' ? 'dong' : 'children'); setSelected(select); setBoard(true); setReset(n => n + 1);
    if (code === '00') { setProvince('21'); setDistrict(''); setDong(''); }
    else { setProvince(code.slice(0, 2)); setDistrict(select?.length === 8 ? select.slice(0, 5) : code.length === 5 ? code : ''); setDong(select?.length === 8 ? select : ''); }
  }, []);
  const selectRegion = useCallback((code: string) => {
    setListOpen(false);
    if (facilityMode) {navigate(code.length===8?code.slice(0,5):code.length===5?code.slice(0,2):code,code.length>2?code:null);setPanel('facilities');setSelectedFacility(null);return;}
    if (code.length === 2) {navigate(code); return;}
    if (code.length === 8 && parent === '21' && level === 'children') {navigate('21', code);return;}
    setSelected(code); setBoard(true); setPanel('detail');
    setProvince(code.slice(0, 2)); setDistrict(code.slice(0, 5)); setDong(code.length === 8 ? code : '');
  }, [navigate, facilityMode, parent, level]);
  const selectSharedRegion=useCallback((code:string)=>{
    if(hazard==='heat'&&!weatherMode){selectRegion(code);return;}
    if(code.length===2){navigate(code);return;}
    setParent(code.length===8&&code.startsWith('21')?'21':code.length===8?code.slice(0,5):code.slice(0,2));setLevel(code.length===8&&code.startsWith('21')?'dong':'children');setSelected(code);
    setProvince(code.slice(0,2));setDistrict(code.slice(0,5));setDong(code.length===8?code:'');setBoard(true);
  },[hazard,weatherMode,navigate,selectRegion]);
  const changeMode = (next: Mode) => {setPanel('explore');setMode(next); setSelected(null); setDetail(null); setExplanation(null); setView(null); setContext(null); setParent('21'); setLevel('dong'); setProvince('21'); setDistrict(''); setDong('');};
  const visibleView = view?.meta.mode === mode && view.parent_code === parent && view.level === level ? view : null;
  const selectedRegion = detail?.region_code === selected ? detail : visibleView?.regions.find(r => r.region_code === selected) || null;
  const layerName = LAYERS.find(l => l.key === layer)?.name || INDICATORS.find(l => l.key === layer)?.name || '';
  const place = visibleView?.breadcrumbs.at(-1)?.region_name || '대한민국';
  const isRisk = layer === 'risk';
  const cityDongs = parent === '21' && level === 'dong';
  const enterFacilities = (code = sharedRegion) => {
    setListOpen(false);if(!facilityMode)savedAnalysis.current={parent,level,selected};
    if(code!==sharedRegion)navigate(code.length===8?code.slice(0,5):code.length===5?code.slice(0,2):code,code.length>2?code:null);
    setHazard('heat');setPanel('facilities');setBoard(true);setFacilityKind('all');setFacilityFilters({access:'all',day:'',time:''});setSelectedFacility(null);
  };
  const changeFacilityRegion = (code: string) => {navigate(code.length===8?code.slice(0,5):code.length===5?code.slice(0,2):code,code.length>2?code:null);setPanel('facilities');setSelectedFacility(null);};
  const switchLevel = (next: 'children' | 'dong') => {setPanel('explore');setLevel(next);setSelected(null);setDistrict('');setDong('');setReset(n => n + 1);};

  const changeHazard = (next:Disaster) => {setListOpen(false);setPendingInspection(null);setInspectionNotice(null);setHazard(next);setBoard(true);setLayerMenu(false);};
  const revealDisasterMap = () => {if(window.matchMedia('(max-width:1000px), (max-height:600px)').matches)setBoard(false);};
  const openAnalysis = (next:'explore'|'detail') => {setListOpen(false);setBoard(true);if(hazard!=='heat')return;if(facilityMode&&savedAnalysis.current){const saved=savedAnalysis.current;setParent(saved.parent);setLevel(saved.level);setSelected(saved.selected);setProvince(saved.parent.slice(0,2));setDistrict(saved.selected?.slice(0,5)|| (saved.parent.length===5?saved.parent:''));setDong(saved.selected?.length===8?saved.selected:'');}setPanel(next);};
  const openNeighborhood = () => {
    setHazard('heat');setListOpen(false);setBoard(true);setTab('위험현황');
    if(facilityMode&&savedAnalysis.current?.selected===selected){const saved=savedAnalysis.current;setParent(saved.parent);setLevel(saved.level);}
    setPanel(selected?'detail':'explore');
  };
  const enterWeather = (stationId?:string) => {
    setListOpen(false);
    if(stationId)setWeatherStation(stationId);
    weatherOriginPending.current=stationId?null:selected;
    if(mode==='sgis'&&selectedRegion?.region_code.length===8&&selectedRegion.region_code.startsWith('21'))setWeatherOrigin({code:selectedRegion.region_code,name:selectedRegion.region_name,tab});
    else setWeatherOrigin(null);
    setHazard('heat');setPanel('weather');setBoard(true);
  };
  const analyzeFromWeather = (code:string,name:string) => {setDetail(null);setExplanation(null);setMode('sgis');setWeatherOrigin({code,name,tab:'위험현황'});setWeatherLinkedAnalysis(true);navigate('21',code);setTab('위험현황');};
  const returnFromWeather = () => {if(weatherOrigin){setMode('sgis');navigate('21',weatherOrigin.code);setTab(weatherOrigin.tab);setWeatherLinkedAnalysis(true);}};
  const searchRegions = useMemo(() => allDongs?.geojson.features.map(f=>({region_code:f.properties.region_code,region_name:f.properties.region_name,full_name:`부산광역시 ${overview?.geojson.features.find(d=>d.properties.region_code===f.properties.region_code.slice(0,5))?.properties.region_name||''} ${f.properties.region_name}`}))||[], [allDongs,overview]);
  const searchableRegions=useMemo(()=>Array.from(new Map([
    ...provinces.map(r=>({...r,full_name:r.region_name})),
    ...districts.map(r=>({...r,full_name:`${provinces.find(p=>p.region_code===r.region_code.slice(0,2))?.region_name||''} ${r.region_name}`})),
    ...dongs.map(r=>({...r,full_name:`${provinces.find(p=>p.region_code===r.region_code.slice(0,2))?.region_name||''} ${districts.find(d=>d.region_code===r.region_code.slice(0,5))?.region_name||''} ${r.region_name}`})),
    ...searchRegions,
  ].map(r=>[r.region_code,r])).values()),[provinces,districts,dongs,searchRegions]);
  const navigateFromHeader=(code:string,select:string|null=null)=>{
    navigate(code,select);
    if(panel==='weather'){setPanel('weather');weatherOriginPending.current=select;setWeatherOrigin(select?.length===8?{code:select,name:searchableRegions.find(r=>r.region_code===select)?.region_name||select,tab}:null);}
    if(panel==='facilities'){setPanel('facilities');setSelectedFacility(null);}
  };
  const findRegion=(code:string)=>{if(code.length===2)navigateFromHeader(code);else navigateFromHeader(code.length===8?(code.startsWith('21')?'21':code.slice(0,5)):code.slice(0,2),code);};


  const finderScope=`${mode}:${parent}:${level}`;
  const finderApplied=appliedScope===finderScope;
  const candidates=useMemo(()=>finderApplied&&criteria.length?findReadinessRegions(visibleView?.regions||[],criteria).matches.map(r=>r.region_code):[],[finderApplied,criteria,visibleView]);
  const openFinder=()=>{setHazard('heat');setListOpen(false);setPanel('find');setBoard(true);setLayer('risk');if(parent==='21'&&level!=='dong')setLevel('dong');};
  const openInspection=()=>{setListOpen(true);setBoard(true);};
  const activeInspection=localUnavailable?null:facilityMode&&selectedFacility?facilityInspection(selectedFacility):hazard==='heat'&&panel==='detail'&&selectedRegion&&!selectedRegion.is_sample?regionInspection(selectedRegion,{parent,level}):floodMode&&flood.tab==='history'&&flood.selected&&flood.data?floodInspection(flood.selected,flood.data.meta):hazard==='landslide'&&disasters.selectedPoint&&disasters.landslide.data?landslideInspection(disasters.selectedPoint,disasters.landslide.data.meta):null;
  const reopenInspection=(item:InspectionItem)=>{
    setInspectionNotice(null);setPendingInspection(null);setListOpen(false);setHazard(item.hazard);setMode('sgis');
    if(item.kind==='facility'){enterFacilities(item.regionCode);setPendingInspection(item);return;}
    const code=item.regionCode;
    if(item.kind==='region'&&item.analysisScope){navigate(item.analysisScope.parent,code);setLevel(item.analysisScope.level);setTab('위험현황');return;}
    navigate(code.length===8?(code.startsWith('21')?'21':code.slice(0,5)):code.length===5?code.slice(0,2):code,code.length>2?code:null);
    if(item.kind==='region')setTab('위험현황');
    else {if(item.kind==='flood'){flood.setTab('history');flood.setYear('all');}setPendingInspection(item);}
  };
  // Restore the selected source record only after its real dataset and region have loaded.
  useEffect(()=>{
    if(!pendingInspection)return;
    const item=pendingInspection;
    if(item.kind==='facility'){
      if(!facilityMode||!facilities||facilityRegion!==item.regionCode||!loadedFacilities.current.startsWith(`region=${item.regionCode}&kind=all&access=all`))return;
      const record=facilities.facilities.find(r=>r.id===item.sourceId);
      setSelectedFacility(record||null);if(!record)setInspectionNotice('이 시설이 현재 자료에 없습니다. 저장한 내용은 점검 목록에서 확인할 수 있습니다.');
    }else if(item.kind==='flood'){
      if(!floodMode||!flood.data||sharedRegion!==item.regionCode)return;
      const record=flood.rows.find(r=>r.id===item.sourceId);
      flood.setSelected(record||null);if(!record)setInspectionNotice('이 침수 기록이 현재 자료에 없습니다. 점검 목록의 출처를 확인해 주세요.');
    }else if(item.kind==='landslide'){
      if(hazard!=='landslide'||!disasters.landslide.data||sharedRegion!==item.regionCode)return;
      const record=disasters.records.find(r=>r.id===item.sourceId);
      if(record)disasters.selectPoint(record.id);else setInspectionNotice('이 지정 지점이 현재 자료에 없습니다. 점검 목록의 출처를 확인해 주세요.');
    }
    setPendingInspection(null);
  },[pendingInspection,facilityMode,facilities,facilityRegion,floodMode,flood.data,flood.rows,flood.setSelected,sharedRegion,hazard,disasters.landslide.data,disasters.records,disasters.selectPoint]);

  const mapData=parent==='21'&&level==='children'&&allDongs?.mode===mode&&allDongs.layer===layer?allDongs.geojson:view?.meta.mode===mode?view.geojson:EMPTY_MAP;
  const mapLayer:DisasterMapLayer=localUnavailable&&(additional||floodMode||weatherMode||facilityMode)?{kind:'base'}:additional?(disasters.layer||{kind:'unavailable',hazard}):floodMode?(flood.layer||{kind:'base'}):weatherMode?(weather.layer||{kind:'base'}):{kind:facilityMode?'facilities':'heat'};
  const sharedPlace=searchRegions.find(r=>r.region_code===sharedRegion)?.full_name||overview?.geojson.features.find(f=>f.properties.region_code===sharedRegion)?.properties.region_name||selectedRegion?.region_name||place;
  const hazardName=DISASTERS.find(d=>d.id===hazard)!.name;
  const timelineReason=localUnavailable?'선택한 지역의 시간별 자료가 아직 연결되지 않았습니다.':hazard==='typhoon'?(!disasters.steps.length?'태풍 데이터를 연결하면 시간별 경로를 재생할 수 있습니다.':undefined):hazard==='cold'?(!disasters.steps.length?'겨울 기온 데이터가 아직 연결되지 않았습니다.':undefined):hazard==='landslide'?'공식 지정 위치 자료입니다. 날짜 애니메이션을 제공하지 않습니다.':floodMode?'침수 이력은 발생 연도로, 예상도는 강우 조건으로 선택합니다.':facilityMode?'시설 위치에는 시간별 관측자료가 없습니다.':weatherMode?(!weather.dates.length?'연결된 일별 관측자료가 없습니다.':undefined):'날짜별 관측기온으로 우리 동네의 더위를 살펴보세요.';
  const weatherDaily=weather.series?.daily||[];
  const weatherPrevious=weatherDaily[weatherDaily.findIndex(row=>row.date===weather.date)-1];
  const coldDaily=disasters.station?.daily||[],coldCurrent=coldDaily.find(row=>row.date===disasters.date);
  const coldPrevious=coldDaily[coldDaily.findIndex(row=>row.date===disasters.date)-1];
  const observedPeak=weatherDaily.reduce<(typeof weatherDaily)[number]|null>((best,row)=>row.maximum!=null&&(best?.maximum==null||row.maximum>best.maximum)?row:best,null);
  const timelineMetric=localUnavailable?undefined:weatherMode?{label:'일 최고기온',unit:'℃',records:weatherDaily.map(row=>({timestamp:row.date,value:row.maximum,color:thermalColor(row.maximum)}))}:hazard==='cold'?{label:'일 최저기온',unit:'℃',records:coldDaily.map(row=>({timestamp:row.date,value:row.minimum,color:coldColor(row.minimum)}))}:undefined;
  return <main className={`app-shell climate-shell ${board?'':'board-hidden'}`} data-hazard={hazard} data-region={sharedRegion} data-camera={camera?JSON.stringify(camera):undefined}>
    <header className="app-header">
      <a href="/" className="brand" aria-label="기후안심지도 처음으로"><span className="brand-mark"><Leaf size={23}/></span><span><strong>기후안심지도</strong><small>우리 동네 기후 대비</small></span></a>
      <RegionSearch regions={searchableRegions} onSelect={findRegion}/>
      <RegionNavigator place={sharedPlace} province={province} district={district} dong={dong} provinces={provinces} districts={districts} dongs={dongs} onNavigate={navigateFromHeader} error={selectError} coverage={LOCAL_DATA_AREAS[hazard].map(a=>a.name).join(', ')}/>
      <div className="header-right"><MapGuide onWeather={()=>enterWeather()}/><button className="header-finder" aria-label="동네 찾기" aria-pressed={panel==='find'&&hazard==='heat'&&!listOpen&&board} onClick={openFinder}><Search size={16}/><span>동네 찾기</span></button><button className="header-inspection" aria-label={`점검 목록 ${inspection.items.length}곳`} aria-pressed={listOpen&&board} onClick={openInspection}><ClipboardCheck size={17}/><span>점검 목록</span><b>{inspection.items.length}</b></button>{hazard==='heat'&&!weatherMode&&!facilityMode&&<label className={`mode-selector ${mode==='sample'?'sample':''}`}><span className="status-dot"/><select aria-label="데이터 모드" value={mode} onChange={e=>changeMode(e.target.value as Mode)}><option value="sgis">실제 공공데이터</option><option value="sample">테스트용 Sample</option></select><ChevronDown size={12}/></label>}<button className="icon-button" aria-label="데이터 안내" onClick={()=>setSources(true)}><Database size={19}/></button></div>
    </header>
    <div className="hazard-dock"><DisasterSwitch value={hazard} onChange={changeHazard} availability={disasters.inventory.data}/>
      <nav className="tool-rail heat-journey" aria-label={hazard==='heat'?'폭염 정보 보기':'동네 기록 탐색'}>
        {hazard==='heat'?<><button aria-pressed={!weatherMode&&!facilityMode} className={!weatherMode&&!facilityMode?'active':''} onClick={openNeighborhood}><span>동네 현황</span></button><button aria-pressed={weatherMode} className={weatherMode?'active':''} onClick={()=>enterWeather()}><span>기온 기록</span></button><button aria-pressed={facilityMode} className={facilityMode?'active':''} onClick={()=>{setReviewReturn(null);enterFacilities();}}><span>쉼터·그늘막</span></button></>:<><button onClick={openNeighborhood}><ArrowLeft size={16}/><span>동네 현황으로</span></button><button onClick={()=>setBoard(true)}><ListFilter size={16}/><span>{hazardName} 기록 상세</span></button></>}
      </nav>
    </div>
    <div id="left-workspace" className="left-workspace floating-detail" hidden={!board}>
      <div className="panel-heading"><span>{listOpen?'나의 점검 목록':hazard==='heat'&&panel==='find'?'기후 대비할 동네 찾기':`${hazardName} · ${weatherMode?'기온 기록':facilityMode?'쉼터·그늘막':sharedPlace}`}</span>{hazard==='heat'&&!listOpen&&<button className="icon-button panel-analysis-settings" aria-label="지역 탐색" title="지역 순위·분석 설정" onClick={()=>openAnalysis('explore')}><SlidersHorizontal size={16}/></button>}<button className="icon-button" aria-label="상세 패널 닫기" onClick={()=>setBoard(false)}><X size={19}/></button></div>
      {listOpen?<InspectionList list={inspection} onOpen={reopenInspection} onClose={()=>setListOpen(false)} onFind={openFinder}/>:<>
      {inspectionNotice&&<p className="inspection-notice" role="status">{inspectionNotice}</p>}
      {hazard==='heat'&&panel==='find'&&<ReadinessFinder view={visibleView} province={province} district={parent.length===5?parent:''} provinces={provinces} districts={districts} criteria={criteria} onCriteria={setCriteria} applied={finderApplied} onApply={()=>setAppliedScope(finderScope)} onEdit={()=>setAppliedScope(null)} onScope={code=>{navigate(code);setPanel('find');}} onSelect={code=>{selectRegion(code);setTab('보고서');}} onSave={r=>inspection.add(regionInspection(r,{parent,level}))} isSaved={code=>inspection.has(`region:${code}`)} onAdvanced={()=>openAnalysis('explore')} error={error||selectError}/>}
      {hazard==='heat'&&!weatherMode&&<>
    <aside className="sidebar" aria-label="분석 설정" hidden={panel !== 'explore'}>
      <div className="sidebar-title"><span className="eyebrow">CLIMATE INSIGHT</span><h1>폭염 대응이 필요한<br/>동네부터 살펴보기</h1><p>읍면동별 취약성을 비교해 우선 대응지역을 찾습니다.</p></div>
      <section className="sidebar-section"><div className="section-label"><span>분석할 지역</span><MapPin size={14}/></div><div className="region-selectors"><label><span>시·도</span><select aria-label="시·도" value={province} onChange={e => navigate(e.target.value)}>{provinces.length ? provinces.map(r => <option key={r.region_code} value={r.region_code}>{r.region_name}</option>) : <option value="21">부산광역시</option>}</select></label><label><span>시·군·구</span><select aria-label="시·군·구" value={district} onChange={e => navigate(e.target.value || province)}><option value="">전체 구·군</option>{districts.map(r => <option key={r.region_code} value={r.region_code}>{r.region_name}</option>)}</select></label><label><span>읍·면·동</span><select aria-label="읍·면·동" disabled={!district} value={dong} onChange={e => navigate(district || province, e.target.value || null)}><option value="">전체 읍·면·동</option>{dongs.map(r => <option key={r.region_code} value={r.region_code}>{r.region_name}</option>)}</select></label></div>{selectError && <p className="select-error" role="alert">{selectError}</p>}<p className="select-hint">선택하면 바로 지도로 이동합니다.</p></section>
      <section className="sidebar-section ranking-section"><div className="section-label"><span>우선 검토지역 <b>TOP 5</b></span><span className="ranking-scope">{cityDongs ? '부산 전체 동' : parent === '00' ? '부산 분석' : place}</span></div>{visibleView?.ranking.length ? <ol className="ranking-list">{visibleView.ranking.map((r, i) => <li key={r.region_code}><button className={selected === r.region_code ? 'active' : ''} onClick={() => selectRegion(r.region_code)}><span className="rank-number">{i + 1}</span><span>{r.region_name}{cityDongs && <small className="rank-district">{r.full_name.replace('부산광역시', '').replace(r.region_name, '').trim()}</small>}</span><strong style={{color: color(r.risk_score)}}>{fmt(r.risk_score)}</strong><ChevronRight size={12}/></button></li>)}</ol> : <div className="ranking-empty"><ListFilter size={20}/><p>{parent === '00' ? '지역을 선택하면 비교범위 내\n취약지역 순위를 확인할 수 있습니다.' : '종합점수가 확보된 지역이 없어\n순위를 표시하지 않습니다.'}</p>{parent !== '00' && <small>결측치를 임의로 대체하지 않습니다.</small>}</div>}</section>
      <section className="sidebar-section layer-section"><div className="section-label"><span>지도 레이어</span><Layers3 size={14}/></div><div className="layer-options">{LAYERS.map(l => <button key={l.key} className={layer === l.key ? 'active' : ''} onClick={() => setLayer(l.key)} aria-pressed={layer === l.key}><span className="radio-dot"/><span>{l.name}<small>{l.english}</small></span>{layer === l.key && <Check size={14}/>}</button>)}</div><details className="indicator-details"><summary>세부지표로 살펴보기 <ChevronDown size={12}/></summary><div>{INDICATORS.map(i => <button className={layer === i.key ? 'active' : ''} key={i.key} onClick={() => setLayer(i.key)}><span className="indicator-bullet"/>{i.name}</button>)}</div></details></section>

      <div className="sidebar-footer"><ShieldCheck size={15}/><span>데이터로 이해하고, 함께 대비합니다.</span></div>
    </aside>
    <div className="detail-workspace" hidden={panel !== 'detail'}>{<DataBoard onHazard={changeHazard} typhoonId={disasters.stormId} onWeather={enterWeather} onWeatherBack={weatherLinkedAnalysis&&weatherOrigin?.code===selected?()=>enterWeather(weatherStation):undefined} region={selectedRegion} explanation={explanation} tab={tab} setTab={setTab} loading={detailLoading} error={detailError} parent={parent} sample={mode === 'sample'} onDrill={navigate} onClose={() => setPanel('explore')} onBusan={() => navigate('21')} cityDongs={cityDongs} mode={mode} onFacilities={code => {setReviewReturn(tab==='보고서'?code:null);enterFacilities(code);}}/>}</div>
    {facilityMode && !localUnavailable && <>{reviewReturn && <button className="facility-review-return" onClick={() => {navigate('21',reviewReturn);setTab('보고서');}}>← 선택한 동의 보고서로 돌아가기</button>}<FacilityPanel place={sharedPlace} onWeather={()=>enterWeather()} filters={facilityFilters} onFilters={setFacilityFilters} data={facilities} error={facilityError} region={facilityRegion} kind={facilityKind} rows={facilityRows} selected={selectedFacility} onRegion={changeFacilityRegion} onKind={kind => {setFacilityKind(kind);setSelectedFacility(null);}} onSelect={setSelectedFacility} onRetry={() => setFacilityReload(n=>n+1)}/></>}

      </>}
      {localUnavailable&&(weatherMode||facilityMode||floodMode||additional)?<RegionCoverage hazard={hazard} place={sharedPlace} onRegion={selectSharedRegion}/>:<>
      {weatherMode&&<CurrentWeatherScreen nearby={nearby} onPick={beginNearbyPick} place={sharedPlace} onFacilities={()=>{setReviewReturn(null);enterFacilities();}} controller={weather} onStationChange={chooseStation} onAnalyze={analyzeFromWeather} returnRegion={weatherOrigin} onReturn={returnFromWeather}/>}
      {floodMode&&<FloodScreen controller={flood} region={sharedRegion} onRegion={selectSharedRegion} onSources={()=>setSources(true)}/>}
      {additional&&<DisasterPanel hazard={hazard} controller={disasters} region={sharedRegion} place={sharedPlace} onExplore={revealDisasterMap} onRegion={selectSharedRegion} onReturn={()=>setReset(n=>n+1)}/>}
      {floodMode&&<NeighborhoodProfile region={flood.selected?.region_code||sharedRegion} typhoonId={disasters.stormId}/>}</>}
      {activeInspection&&<div className="inspection-savebar"><button disabled={!inspection.ready||inspection.has(activeInspection.id)} onClick={()=>inspection.add(activeInspection)}>{inspection.has(activeInspection.id)?<Check size={17}/>:<BookmarkPlus size={17}/>}<span>{inspection.has(activeInspection.id)?'점검 목록에 담았어요':'점검 목록에 담기'}<small>{activeInspection.title}</small></span></button><button aria-label="나의 점검 목록 보기" onClick={openInspection}><ClipboardCheck size={17}/></button></div>}
      </>}
    </div>
    <section className="map-section" aria-label="지도 탐색">
      {hazard==='heat'&&!weatherMode&&<div className="map-topbar"><div className="breadcrumb"><button onClick={() => navigate('00')} aria-label="대한민국 전체 지도"><Compass size={16}/></button>{(visibleView?.breadcrumbs || [{region_code:'00',region_name:'대한민국'}]).map((r,i) => <span key={r.region_code}>{i > 0 && <ChevronRight size={12}/>}<button className={r.region_code === parent ? 'current' : ''} onClick={() => navigate(r.region_code)}>{r.region_name}</button></span>)}</div><div className="map-scope">{parent === '21' && !facilityMode && <div className="scope-toggle" aria-label="부산 분석 단위"><button aria-pressed={cityDongs} onClick={() => switchLevel('dong')}>전체 읍면동</button><button aria-pressed={!cityDongs} onClick={() => switchLevel('children')}>구·군 요약</button></div>}<span className="map-level">{facilityMode ? '쉼터·그늘막' : parent === '00' ? '시·도별 보기' : parent.length === 2 && !cityDongs ? '시·군·구별 보기' : '축척에 따라 경계 전환'}</span></div></div>}
      <div className="map-stage">
        <ClimateMap nearby={weatherMode&&!localUnavailable?{...nearby,pick:point=>{nearby.pick(point);setBoard(true);}}:null} candidateCodes={hazard==='heat'&&!weatherMode&&!facilityMode?candidates:[]} dataReady={!!visibleView} data={mapData} mapLayer={mapLayer} onCameraChange={setCamera} summaryMode={parent==='21'&&level==='children'} context={context} overview={parent.startsWith('21')&&overview?.mode===mode&&overview.layer===layer?overview.geojson:null} onDisplayLevel={setDisplayLevel} parent={parent} selected={selected} layer={layer} onSelect={selectSharedRegion} onDrill={navigate} zoom={zoom} reset={reset} facilityMode={facilityMode} facilityRegion={facilityRegion} facilities={localUnavailable?[]:facilityRows} selectedFacility={localUnavailable?null:selectedFacility} onFacilitySelect={id=>setSelectedFacility(facilities?.facilities.find(r=>r.id===id)||null)}/>
        {hazard==='heat'&&!weatherMode&&<>
        {!visibleView && !error && <div className="map-loading"><LoaderCircle className="spin" size={24}/><span>지도를 불러오고 있습니다</span></div>}
        {loading && visibleView && <div className="updating-pill"><LoaderCircle size={13} className="spin"/> 지도 갱신 중</div>}
        <div className="map-title-card"><span className="eyebrow"><span className="live-dot"/> {facilityMode ? '현재 시설 위치' : mode === 'sample' ? 'SAMPLE DATA' : '우리 동네 살펴보기'}</span><h2>{facilityMode ? '부산 쉼터·그늘막 위치' : parent === '00' ? '지역을 선택해 시작하세요' : cityDongs && isRisk ? '부산 읍면동 우선 대응지역' : `${place} ${layerName}`}</h2><p>{facilityMode ? '등록시설 위치와 이용정보를 확인합니다' : parent === '00' ? '전국 지역 탐색 · 분석자료는 지역별로 연결됩니다' : cityDongs ? '부산 전체 읍면동을 같은 기준으로 비교합니다' : isRisk ? '통계로 살펴보는 지역별 상대적 폭염 취약성' : '현재 비교범위에서 정규화한 상대 지표 점수'}</p></div>

        {mode === 'sample' && !facilityMode && <div className="sample-map-banner"><Info size={15}/><span>시연용 합성 데이터 · 실제 지역 위험도가 아닙니다</span></div>}
        {error && <div className="map-error-card" role="alert"><Database size={25}/><h3>데이터를 불러오지 못했습니다</h3><p>{error}</p><button className="primary-button" onClick={() => setReload(n => n+1)}>다시 시도 <RotateCcw size={14}/></button>{mode === 'sgis' && <button className="text-button" onClick={() => changeMode('sample')}>테스트용 Sample로 기능 확인</button>}</div>}
        {legend && !facilityMode && <div className="map-legend"><div><strong>{displayLevel === 'sigungu' ? '구·군 ' : displayLevel === 'dong' ? '읍·면·동 ' : ''}{isRisk ? '폭염 취약도' : '상대 지표 점수'}</strong><span>0—100</span></div><small className="legend-comparison">{cityDongs && displayLevel === 'sigungu' ? '색상: 구·군끼리 비교 · 순위: 읍면동' : parent === '21' && !cityDongs && displayLevel === 'dong' ? '색상: 부산 전체 읍면동 · 순위: 구·군' : '현재 비교범위 내 상대 점수'}</small><div className="legend-ramp">{COLORS.map(c => <i key={c} style={{background:c}}/>)}</div><div className="legend-labels"><span>{isRisk ? '매우 낮음' : '낮음'}</span><span>{isRisk ? '매우 높음' : '높음'}</span></div>{candidates.length>0&&<div className="legend-candidates"><i/>조건에 맞는 {candidates.length}곳 · 경계 강조</div>}<div className="legend-missing"><i/> {isRisk ? '데이터 부족 · 점수 미산출' : '지표 미확보'}</div></div>}
        {parent === '00' && <button className="busan-shortcut" onClick={() => navigate('21')}><span><MapPin size={17}/><b>부산광역시</b><small>대표 분석 지역</small></span><ArrowRight size={17}/></button>}
        {parent !== '00' && !facilityMode && mode === 'sgis' && !error && <div className="map-data-notice"><Info size={14}/><span>{visibleView?.in_analysis_scope ? (visibleView.meta.available_indicator_count === 7 ? '지역 간 상대적인 취약성을 비교합니다. 현재 날씨는 동네 분석에서 확인하세요.' : '필수 지표가 부족한 지역은 종합 위험도를 산출하지 않습니다.') : '이 지역은 경계 탐색을 제공합니다. 실제 통계 분석은 부산에서 확인하세요.'}</span>{visibleView?.in_analysis_scope && <button onClick={() => setSources(true)}>데이터 안내 <ChevronRight size={12}/></button>}</div>}
        <>{facilityMode && !localUnavailable && <>{legend && <div className="facility-map-legend"><span><i className="shelter-dot"/>무더위쉼터</span><span><i className="shade-dot"/>그늘막</span>{facilityRows.some(f=>f.filter_status==='unknown')&&<span><i style={{background:'#849099'}}/>조건 확인 필요</span>}</div>}<div className="map-data-notice">시설별 기준일이 다릅니다. 실시간 개방 여부는 제공하지 않습니다.</div></>}</></>}
        {localUnavailable&&(floodMode||additional||weatherMode)&&<div className="map-context-hint">{sharedPlace} · 분석자료 준비 중</div>}
        {floodMode&&!localUnavailable&&<FloodMapOverlay controller={flood} legend={legend} onSources={()=>setSources(true)}/>}
        {pending&&additional&&!localUnavailable&&<EmptyDisaster hazard={hazard} place={sharedPlace} loading={disasters.active.loading} error={disasters.active.error} onRetry={disasters.active.retry}/>}
        {hazard==='cold'&&!localUnavailable&&disasters.station&&coldCurrent&&<ObservationOverlay stationName={disasters.station.station_name} date={disasters.date} maximum={coldCurrent.maximum} minimum={coldCurrent.minimum} metric="minimum" previous={coldPrevious?{date:coldPrevious.date,value:coldPrevious.minimum}:undefined}/>}
        {weatherMode&&nearby.picking&&<div className="nearby-map-prompt" role="status"><MapPin size={16}/>위치를 클릭하세요 · Enter: 지도 중앙 선택<button onClick={nearby.cancelPicking}>취소</button></div>}
        {additional&&!pending&&!localUnavailable&&<DisasterOverlay hazard={hazard} controller={disasters} legend={legend} onExplore={revealDisasterMap}/>}
        {weatherMode&&!localUnavailable&&<>{weather.station&&<ObservationOverlay stationName={weather.station.station_name} date={weather.date} maximum={weather.station.maximum} minimum={weather.station.minimum} metric="maximum" previous={weatherPrevious?{date:weatherPrevious.date,value:weatherPrevious.maximum}:undefined} onFocus={weather.station.location?weather.focus:undefined} onOverview={weather.fitStations}/>}<div className="map-title-card"><span className="eyebrow">일별 관측기록</span><h2>관측소별 일 최고기온</h2><p>{weather.date||'자료 확인 중'} · 관측소를 선택해 동네 분석으로 연결하세요.</p></div>{legend&&<WeatherLegend/>}</>}
        <div className="map-boundary-badge">{displayLevel === 'sigungu' ? '구·군 경계' : displayLevel === 'dong' ? '읍·면·동 경계' : '시·도 경계'}{(cityDongs || facilityMode) && <small>{displayLevel === 'sigungu' ? '확대하면 읍·면·동' : '축소하면 구·군'}</small>}</div><div className="map-tools"><button className={board ? 'active' : ''} title="데이터보드" aria-label="데이터보드 표시 전환" aria-pressed={board} onClick={() => setBoard(!board)}><PanelLeft size={19}/></button>{hazard==='heat'&&!weatherMode&&!facilityMode && <button className={layerMenu ? 'active' : ''} title="레이어" aria-label="레이어 메뉴" aria-expanded={layerMenu} onClick={() => setLayerMenu(!layerMenu)}><Layers3 size={19}/></button>}<button className={legend ? 'active' : ''} title="범례" aria-label="범례 표시 전환" aria-pressed={legend} onClick={() => setLegend(!legend)}><ListFilter size={19}/></button><span/><button title="현재 지역 지도 초기화" aria-label="지도 초기화" onClick={() => {setReset(n => n + 1);}}><RotateCcw size={17}/></button></div>
        {layerMenu && hazard==='heat' && !weatherMode && !facilityMode && <div className="floating-layer-menu"><h4>지도 레이어</h4>{LAYERS.map(l => <button className={layer === l.key ? 'active' : ''} key={l.key} onClick={() => {setLayer(l.key);setLayerMenu(false);}}>{l.name}{layer === l.key && <Check size={13}/>}</button>)}</div>}
        <div className="zoom-tools"><span className="north-marker">N<svg viewBox="0 0 14 20"><path d="M7 1L13 18L7 14L1 18Z" fill="#54766a"/></svg></span><button aria-label="지도 확대" onClick={() => setZoom(z => ({step:1,id:z.id+1}))}><Plus size={19}/></button><button aria-label="지도 축소" onClick={() => setZoom(z => ({step:-1,id:z.id+1}))}><Minus size={19}/></button></div>
        <div className="map-attribution">경계 © SGIS · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors</div>
      </div>
      <div className="map-statusbar"><span>{localUnavailable?`${visibleView?.regions.length||0}개 지역 · 선택 지역 분석자료 준비 중 · 전국 경계 탐색`:additional?(pending?'데이터 준비 중 · 행정경계만 표시':`${hazardName} · ${disasters.active.data?.meta.source}`):floodMode?`침수 ${flood.tab==='history'?'이력':'예상도'} · 부산 공개자료`:weatherMode?`기상청 일 관측자료 · ${weather.date}`:facilityMode ? <><span className="status-dot"/>{facilityRows.length.toLocaleString()}개 시설 위치 · 취약성 분석과 별도</> : <><span className="status-dot"/>{visibleView ? `${visibleView.regions.length}개 지역` : '데이터 연결 중'}<i/> {visibleView?.scored_count || 0}개 종합점수 산출{cityDongs && visibleView && ` · ${visibleView.regions.length - visibleView.scored_count}개 자료 부족`}</>}</span><button onClick={() => setSources(true)}><Database size={12}/> 데이터 안내 <ChevronRight size={12}/></button></div>
    </section>
    {hazard!=='landslide'&&<div className="timeline-dock"><Timeline metric={timelineMetric} focusControl={{focused:!board,onToggle:()=>setBoard(v=>!v)}} key={`${hazard}-${weatherMode?'weather':panel}`} title={`${hazardName} ${weatherMode?'관측 타임라인':'타임라인'}`} steps={localUnavailable?[]:additional?disasters.steps:weatherMode?weather.dates:[]} value={localUnavailable?'':additional?disasters.timelineValue:weatherMode?weather.date:''} onChange={additional?disasters.onTimeChange:weather.setDate} hourly={hazard==='typhoon'} playRequest={hazard==='typhoon'?disasters.playRequest:0} pauseRequest={hazard==='typhoon'?disasters.pauseRequest:0} resetToken={`${sharedRegion}:${hazard==='typhoon'?`${disasters.stormId}:${disasters.trackScope}`:weatherMode?`${weather.period}:${weather.station?.station_id}`:hazard}`} onPlay={()=>{revealDisasterMap();if(hazard==='typhoon')disasters.onPlay();}} context={localUnavailable?sharedPlace:hazard==='typhoon'?`${disasters.year} ${disasters.typhoon.data?.storm.name||''}`:hazard==='cold'?`${disasters.station?.station_name||''} 관측소`:weatherMode?`${weather.station?.station_name||''} 관측소`:sharedPlace} highlight={hazard==='typhoon'&&disasters.typhoon.data?.closest?{value:disasters.typhoon.data.closest.timestamp,label:'최근접 기록',onSelect:()=>{revealDisasterMap();disasters.showMoment(disasters.typhoon.data!.closest!.timestamp);}}:hazard==='cold'&&disasters.station?.summary.minimum.dates[0]?{value:disasters.station.summary.minimum.dates[0],label:'겨울 최저일'}:weatherMode&&observedPeak?{value:observedPeak.date,label:weather.series?.summary.maximum.complete?'기간 최고일':'관측 최고일'}:undefined} caption={hazard==='typhoon'?(disasters.trackScope==='approach'?'동네 최근접 전후 기록':'전체 이동 기록'):undefined} disabledReason={timelineReason}/>{hazard==='heat'&&!weatherMode&&!facilityMode&&<button className="timeline-link" onClick={()=>enterWeather()}>일별 기온 살펴보기 <ArrowRight size={14}/></button>}</div>}
    {sources && <div className="modal-backdrop" onClick={() => setSources(false)}><section ref={modalRef} className="sources-modal" role="dialog" aria-modal="true" aria-labelledby="sources-title" onClick={e => e.stopPropagation()}><div className="modal-heading"><span className="eyebrow">DATA & METHODOLOGY</span><button className="icon-button" aria-label="데이터 안내 닫기" onClick={() => setSources(false)}><X size={20}/></button></div>{additional&&disasters.active.data ? <><h2 id="sources-title">{hazardName} 자료 안내</h2><p>{disasterMeaning[hazard]}</p><p>저장된 공식 자료를 표시합니다. 데이터가 없는 날짜나 위치는 임의로 채우지 않습니다.</p><SourceInfo meta={disasters.active.data.meta}/></> : additional ? <><h2 id="sources-title">{DISASTERS.find(d=>d.id===hazard)?.name} 데이터 준비 중</h2><p>{PENDING_MESSAGES[hazard]}</p><p>현재 지도에는 행정경계만 표시합니다. 해당 재해의 관측·위험 자료는 아직 연결되지 않았습니다.</p></> : floodMode ? <><h2 id="sources-title">침수 자료 안내</h2><h3>과거 침수 이력</h3><p>부산광역시 부산 안전 ON의 공개 침수 기록입니다. 지점·발생 기간·당시 깊이·면적을 원문 기준으로 표시합니다. 좌표가 유효하지 않은 기록은 제외하고, 연도가 불명확한 기록은 ‘연도 확인 필요’로 구분합니다. 지도에서 선택한 동은 지점 좌표가 속하는 행정구역입니다. 지점 수를 재난 발생 횟수나 위험 순위로 해석하지 않습니다.</p><h3>침수 예상도</h3><p>부산시 도심침수 예상도 원본을 사용합니다. 30·50·80·100년 빈도는 각각 시간당 98.1·106.8·114.7·118.5mm 강우 시나리오입니다. 현재 침수나 실시간 예보가 아니며, 미래의 발생 확률을 동별 점수로 계산하지 않습니다. 원본의 제작 기준연도는 확인되지 않았습니다.</p><h3>표시 범위와 한계</h3><p>부산 전역의 원본 지도를 4,096 × 4,096 픽셀로 저장해 표시하므로 크게 확대하면 픽셀이 보일 수 있습니다. 개별 건물의 침수 깊이 판정이나 대피 경로 결정용 자료가 아닙니다. 통계·인구·폭염 취약도와 수치 비교하지 않습니다.</p><a href="https://safecity.busan.go.kr/" target="_blank" rel="noreferrer">부산광역시 부산 안전 ON ↗</a></> : weatherMode ? <><h2 id="sources-title">기상 비교 자료 안내</h2><p>기상청 ASOS/AWS 관측소별 일 최고·최저기온을 제공합니다. 기상 지도는 선택한 관측일의 일 최고기온을 같은 날짜로 비교하며, 해당 날짜의 결측을 과거 값으로 채우지 않습니다. 관측소 선택 후 각 동 대표점에서 가장 가까운 관측소로 연결된 동 목록을 통해 분석으로 이동합니다. 최신 기온을 기존 취약도 점수에 합산하지 않습니다. 완료된 일 관측자료이며 실시간 기온은 아닙니다. 관측일·조회 범위·저장 시각을 구분하고 결측은 보간하지 않습니다. 관측소 실측값을 행정동 전체의 기온으로 해석하지 마세요.</p><a href="https://data.kma.go.kr" target="_blank" rel="noreferrer">기상청 기상자료개방포털 ↗</a></> : facilityMode ? <><h2 id="sources-title">현재 시설 자료 안내</h2><div className="source-pills"><span>시설 2026년</span><span>경계 2025년</span></div><h3>공식 등록시설 위치</h3><p>무더위쉼터는 국민안전24의 2026년 등록자료, 그늘막은 부산생활지도의 2026년 4월 30일 기준 공개자료입니다. 시설명·주소·이용대상·등록 운영시간 등 출처가 제공하는 항목을 표시합니다.</p><h3>자료를 읽을 때</h3><p>시설 위치와 이용정보를 확인하는 화면입니다. 실시간 개방 여부나 시설의 부족 여부를 판정하지 않습니다. 공개 목록에 없는 시설이 있을 수 있으며, 좌표가 확인되지 않은 시설은 지도에서 제외합니다. 2025년 행정경계에 포함되지 않는 좌표는 특정 동으로 임의 연결하지 않습니다.</p><a href="https://www.safekorea.go.kr/safekorea-kor/flsm/flsm/facilitiesSafteyMap.do?menuSn=2" target="_blank" rel="noreferrer">국민안전24 시설안전지도 ↗</a><a href="https://lifemap.busan.go.kr/li/index.do" target="_blank" rel="noreferrer">부산생활지도 ↗</a><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">도로지도 © OpenStreetMap contributors ↗</a></> : <><h2 id="sources-title">데이터를 이해하면<br/>지도가 더 명확해집니다.</h2><div className="source-pills"><span>통계 {visibleView?.meta.reference_year || 2024}년</span><span>경계 {visibleView?.meta.boundary_year || 2025}년</span><span>{mode === 'sgis' ? 'SGIS + 기상청' : 'Sample · 합성 통계'}</span></div><h3>무엇을 분석하나요?</h3><p>SGIS의 인구·가구·30년 이상 노후주택 비율과 기상청 ASOS/AWS 관측자료를 결합합니다. 기상지표는 6~8월 평균기온과 일 최고기온 33℃ 이상인 날의 수입니다.</p><h3>점수는 어떻게 계산하나요?</h3><div className="formula">Risk = Hazard × Exposure × Vulnerability</div><p>동일 비교지역 내 지표를 Min–Max 정규화하고, 가중합으로 H·E·V를 계산한 뒤 곱한 값을 0~100으로 정규화합니다. 지표 또는 최종 값이 모두 같으면 중간값을 사용합니다. 필수 지표가 없으면 종합점수와 순위를 제공하지 않습니다.</p><h3>현재 데이터의 한계</h3><p>기상은 지역 내부 대표점의 최근접 관측소 값이며 해당 동의 직접 실측값이 아닙니다. 관측소의 고도·해안과의 거리 등으로 지역 실제 기온과 차이가 날 수 있습니다. 여름 92일 중 결측이 있는 지표는 산출하지 않습니다. 통계는 2024년, 경계는 2025년입니다. 고령인구·1인가구 비교는 분자·분모 합산, 노후주택 비교는 SGIS 공식 상위지역 비율을 사용합니다. 점수 평균과 순위는 산출 가능한 지역 기준입니다.</p><div className="risk-thresholds">{LEVELS.map((l,i) => <span key={l}><i style={{background:COLORS[i]}}/>{l}<small>{i*20}~{(i+1)*20}{i<4?' 미만':''}</small></span>)}</div><p className="source-notice">점수는 실제 재난 발생확률이 아니며 비교범위가 다른 점수를 직접 비교할 수 없습니다.</p><a href="https://sgis.mods.go.kr/developer/html/newOpenApi/api/dataApi/census.html" target="_blank" rel="noreferrer">SGIS 공식 데이터 설명 <ArrowUpRight size={14}/></a><a href="https://data.kma.go.kr/data/grnd/selectAwsRltmList.do" target="_blank" rel="noreferrer">기상청 관측자료 설명 <ArrowUpRight size={14}/></a></>}</section></div>}
  </main>;
}
