'use client';
import { useEffect, useRef, useState } from 'react';
import maplibregl, { GeoJSONSource, LngLatBounds } from 'maplibre-gl';
import type { GeoData, Layer, MapProperties, Facility } from '@/types';
import type { Geometry } from 'geojson';
import type {DisasterMapLayer,MapCamera} from '@/types/disasters';
import FloodLayer from './map/FloodLayer';
import NearbyFacilityLayer from './map/NearbyFacilityLayer';
import type {NearbyFacilitiesController} from '@/hooks/useNearbyFacilities';
import WeatherLayer from './map/WeatherLayer';
import LandslideLayer from './map/LandslideLayer';
import TyphoonLayer from './map/TyphoonLayer';
import ColdLayer from './map/ColdLayer';
import {mapPadding} from './map/viewport';
import { COLORS, fmt, INDICATORS, LAYERS } from './constants';

type Props = {
  dataReady:boolean; data: GeoData; context: GeoData | null; parent: string; selected: string | null; layer: Layer;
  overview: GeoData | null;
  nearby?:NearbyFacilitiesController|null;
  summaryMode: boolean;
  candidateCodes?:string[];
  onDisplayLevel: (level: 'sigungu' | 'dong' | 'sido') => void;
  onSelect: (code: string) => void; onDrill: (code: string) => void;
  zoom: {step: number; id: number}; reset: number;
  mapLayer:DisasterMapLayer; onCameraChange?:(camera:MapCamera)=>void;
  facilityMode: boolean; facilityRegion: string; facilities: Facility[]; selectedFacility: Facility | null; onFacilitySelect: (id: string) => void;
};

const DETAIL_ZOOM = 11.4;

function bounds(geometry: Geometry): LngLatBounds {
  const result = new LngLatBounds();
  const visit = (node: unknown) => {
    if (!Array.isArray(node)) return;
    if (typeof node[0] === 'number') result.extend([node[0], node[1]]);
    else node.forEach(visit);
  };
  if ('coordinates' in geometry) visit(geometry.coordinates);
  return result;
}

export default function ClimateMap(props: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const propsRef = useRef(props);
  const labels = useRef<maplibregl.Marker[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [rendered, setRendered] = useState(false);
  const [near, setNear] = useState(false);
  const neutral = props.mapLayer.kind !== 'heat';
  const flood = props.mapLayer.kind === 'flood' ? props.mapLayer : null;
  const instanceId = useRef<string>('');
  const lastFacilityFocus=useRef<string|null>(null);
  const lastFacilityBounds=useRef('');
  const popupRef=useRef<maplibregl.Popup|null>(null);
  const displayData = props.overview && !near ? props.overview : props.data;
  const displayLevel = props.overview && !near ? 'sigungu' : props.data.features[0]?.properties.region_code.length === 8 ? 'dong' : props.parent === '00' ? 'sido' : 'sigungu';
  useEffect(() => { propsRef.current = props; }, [props]);
  useEffect(() => {props.onDisplayLevel(displayLevel);}, [displayLevel, props.onDisplayLevel]);

  const selectOnMap = (code: string) => {
    const current = map.current;
    if (!current) return;
    const p = propsRef.current;
    if(p.nearby?.picking)return;
    if (p.overview && current.getZoom() < DETAIL_ZOOM && code.length === 5) {
      const feature = p.overview.features.find(f => f.properties.region_code === code);
      if (feature) {
        const camera = current.cameraForBounds(bounds(feature.geometry), {padding:90, maxZoom:13});
        if (camera) current.easeTo({...camera, zoom:Math.max(DETAIL_ZOOM + .2, camera.zoom || 12), duration:500});
      }
      if (p.facilityMode || p.summaryMode || p.mapLayer.kind !== 'heat') p.onSelect(code);
      else if (p.parent.length === 5 && p.parent !== code) p.onDrill(code);
      return;
    }
    p.onSelect(code);
  };

  useEffect(() => {
    if (!container.current) return;
    let current: maplibregl.Map;
    try {
      current = new maplibregl.Map({
        container: container.current,
        style: { version: 8, sources: {}, layers: [{id: 'background', type: 'background', paint: {'background-color': '#e8f0f0'}}] },
        center: [129.07, 35.18], zoom: 10, minZoom: 4.7, maxZoom: 19,
        attributionControl: false, renderWorldCopies: false,
        maxBounds: [[120, 29], [136, 44]],
      });
    } catch { setError(true); return; }
    map.current = current;
    instanceId.current=crypto.randomUUID();
    const reportCamera=()=>{const center=current.getCenter();propsRef.current.onCameraChange?.({longitude:center.lng,latitude:center.lat,zoom:current.getZoom()});};
    current.on('moveend',reportCamera);
    current.on('zoom', () => setNear(current.getZoom() >= DETAIL_ZOOM));
    current.doubleClickZoom.disable();
    const popup = new maplibregl.Popup({closeButton: false, closeOnClick: true, offset: 15, className: 'climate-tooltip'});
    popupRef.current=popup;
    current.on('load', () => {
      current.addSource('streets', {type: 'raster', tiles: [process.env.NEXT_PUBLIC_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, maxzoom: 19});
      current.addLayer({id: 'streets', type: 'raster', source: 'streets', paint:{'raster-saturation':-.15}});
      current.addSource('context', {type: 'geojson', data: {type: 'FeatureCollection', features: []}});
      current.addSource('analysis', {type: 'geojson', data: {type: 'FeatureCollection', features: []}});
      current.addLayer({id: 'areas', type: 'fill', source: 'analysis', paint: {
        'fill-color': ['case', ['==', ['get', 'value'], null], '#d3dfda', ['step', ['get', 'value'], COLORS[0], 20, COLORS[1], 40, COLORS[2], 60, COLORS[3], 80, COLORS[4]]],
        'fill-opacity': 0.54,
      }});
      current.addLayer({id: 'area-lines', type: 'line', source: 'analysis', paint: {'line-color': '#ffffff', 'line-width': 1.4}});
      current.addSource('readiness', {type:'geojson',data:{type:'FeatureCollection',features:[]}});
      current.addLayer({id:'readiness-hit',type:'fill',source:'readiness',paint:{'fill-opacity':0}});
      current.addLayer({id:'readiness-outline',type:'line',source:'readiness',paint:{'line-color':'#15594f','line-width':['interpolate',['linear'],['zoom'],9,1,14,2.5]}});
      current.addLayer({id: 'selected', type: 'line', source: 'analysis', filter: ['==', ['get', 'region_code'], ''], paint: {'line-color': '#164f45', 'line-width': 3}});
      current.addSource('flood-history', {type:'geojson',data:{type:'FeatureCollection',features:[]}});
      current.addLayer({id:'flood-history',type:'circle',source:'flood-history',paint:{'circle-color':'#227db6','circle-radius':['interpolate',['linear'],['zoom'],9,4,15,8],'circle-stroke-color':'#fff','circle-stroke-width':1.5}});
      current.addLayer({id:'flood-selected',type:'circle',source:'flood-history',filter:['==',['get','id'],''],paint:{'circle-color':'#ffffff00','circle-radius':13,'circle-stroke-color':'#11476f','circle-stroke-width':3}});
      current.addSource('facilities', {type: 'geojson', data: {type: 'FeatureCollection', features: []}});
      current.addLayer({id: 'facility-points', type: 'circle', source: 'facilities', paint: {
        'circle-color': ['case',['==',['get','status'],'unknown'],'#849099',['match', ['get', 'kind'], 'shelter', '#216db0', '#b96319']],
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 3, 15, 7],
        'circle-stroke-color': '#fff', 'circle-stroke-width': 1.4,
      }});
      current.addLayer({id: 'facility-selected', type: 'circle', source: 'facilities', filter: ['==', ['get', 'id'], ''], paint: {'circle-color': '#ffffff00', 'circle-radius': 12, 'circle-stroke-color': '#163d4b', 'circle-stroke-width': 3}});
      setReady(true);
    });
    current.on('mousemove', 'areas', event => {
      if(propsRef.current.nearby?.picking){current.getCanvas().style.cursor='crosshair';popup.remove();return;}
      current.getCanvas().style.cursor = 'pointer';
      const p = event.features?.[0]?.properties as MapProperties | undefined;
      if (!p) return;
      const div = document.createElement('div');
      const name = document.createElement('strong'); name.textContent = p.region_name;
      if (propsRef.current.mapLayer.kind !== 'heat') {
        div.append(name);
        popup.setLngLat(event.lngLat).setDOMContent(div).addTo(current);
        return;
      }
      const label = document.createElement('span'); label.textContent = LAYERS.find(l => l.key === propsRef.current.layer)?.name || INDICATORS.find(l => l.key === propsRef.current.layer)?.name || '';
      const score = document.createElement('b'); score.textContent = p.value == null ? '데이터 없음' : `${fmt(Number(p.value))} / 100`;
      const hint = document.createElement('small'); hint.textContent = propsRef.current.layer === 'risk' ? (p.risk_level || '클릭하여 지역 탐색') : '비교범위 내 정규화 점수';
      div.append(name, label, score, hint);
      popup.setLngLat(event.lngLat).setDOMContent(div).addTo(current);
    });
    current.on('mouseleave', 'areas', () => { current.getCanvas().style.cursor = ''; popup.remove(); });
    current.on('click', 'areas', event => {
      if(propsRef.current.nearby?.picking)return;
      if(current.getLayer('nearby-facility-icons')&&current.queryRenderedFeatures(event.point,{layers:['nearby-facility-icons']}).length)return;
      if(current.queryRenderedFeatures(event.point,{layers:['readiness-hit']}).length)return;
      if (['landslide-points','typhoon-positions'].some(id=>current.getLayer(id)&&current.queryRenderedFeatures(event.point,{layers:[id]}).length)) return;
      if (propsRef.current.mapLayer.kind === 'flood' && current.queryRenderedFeatures(event.point, {layers:['flood-history']}).length) return;
      if (propsRef.current.facilityMode && current.queryRenderedFeatures(event.point, {layers:['facility-points']}).length) return;
      const code = event.features?.[0]?.properties?.region_code;
      if (code) { popup.remove(); selectOnMap(code); }
    });
    current.on('click','readiness-hit',event=>{const code=event.features?.[0]?.properties?.region_code;if(code){popup.remove();selectOnMap(code);}});
    current.on('click', 'facility-points', event => {
      const id = event.features?.[0]?.properties?.id;
      if (id) {popup.remove();propsRef.current.onFacilitySelect(id);}
    });
    current.on('mouseenter', 'facility-points', () => {current.getCanvas().style.cursor='pointer';});
    current.on('mouseleave', 'facility-points', () => {current.getCanvas().style.cursor='';});
    current.on('click','flood-history',event=>{const id=event.features?.[0]?.properties?.id;if(id){popup.remove();const layer=propsRef.current.mapLayer;if(layer.kind==='flood')layer.onSelect(id);}});
    current.on('mouseenter','flood-history',()=>{current.getCanvas().style.cursor='pointer';});
    current.on('mouseleave','flood-history',()=>{current.getCanvas().style.cursor='';});
    current.on('dblclick', 'areas', event => {
      if(propsRef.current.nearby?.picking)return;
      const code = event.features?.[0]?.properties?.region_code;
      if (code && code.length < 8) propsRef.current.onDrill(code);
    });
    current.on('click',event=>{if(propsRef.current.nearby?.picking){popup.remove();propsRef.current.nearby.pick({longitude:event.lngLat.lng,latitude:event.lngLat.lat});}});
    const keyboardPick=(event:KeyboardEvent)=>{
      if(!propsRef.current.nearby?.picking)return;
      if(event.key==='Escape'){event.preventDefault();propsRef.current.nearby.cancelPicking();}
      if(event.key==='Enter'){event.preventDefault();const point=current.getCenter();propsRef.current.nearby.pick({longitude:point.lng,latitude:point.lat});}
    };
    current.getCanvas().addEventListener('keydown',keyboardPick);
    const observer = new ResizeObserver(() => {
      const canvas = current.getCanvas();
      const element = current.getContainer();
      if (canvas.clientWidth !== element.clientWidth || canvas.clientHeight !== element.clientHeight) current.resize();
    });
    observer.observe(container.current);
    return () => { current.getCanvas().removeEventListener('keydown',keyboardPick); observer.disconnect(); labels.current.forEach(m => m.remove()); popup.remove(); current.remove(); map.current = null; };
  }, []);

  useEffect(()=>{
    if(ready&&map.current)map.current.getCanvas().style.cursor=props.nearby?.picking?'crosshair':'';
  },[ready,props.nearby?.picking]);

  useEffect(()=>{
    if(!ready||!map.current)return;
    const codes=new Set(props.candidateCodes||[]);
    (map.current.getSource('readiness') as GeoJSONSource).setData({type:'FeatureCollection',features:neutral?[]:props.data.features.filter(f=>codes.has(f.properties.region_code))});
  },[ready,props.candidateCodes,props.data,neutral]);

  useEffect(() => {
    if (!ready || !map.current) return;
    setRendered(false);
    const onIdle = () => setRendered(true);
    map.current.once('idle', onIdle);
    (map.current.getSource('context') as GeoJSONSource).setData(props.context || props.data);
    (map.current.getSource('analysis') as GeoJSONSource).setData(displayData);
    labels.current.forEach(m => m.remove());
    labels.current = displayData.features.map(feature => {
      const p = feature.properties;
      const button = document.createElement('button');
      button.className = 'map-region-label';
      button.dataset.code = p.region_code;
      button.dataset.level = p.region_code.length === 8 ? 'dong' : p.region_code.length === 5 ? 'sigungu' : 'sido';
      button.textContent = p.region_name;
      button.setAttribute('aria-label', `${p.region_name} 지도에서 선택`);
      button.onclick = e => { e.stopPropagation(); selectOnMap(p.region_code); };
      button.ondblclick = e => { e.stopPropagation(); if (p.region_code.length < 8) propsRef.current.onDrill(p.region_code); };
      return new maplibregl.Marker({element: button}).setLngLat(bounds(feature.geometry).getCenter()).addTo(map.current!);
    });
    const arrange = () => {
      const placed: {x: number; y: number; w: number}[] = [];
      const dense = displayData.features.length > 50 || map.current!.getZoom() < 8;
      const ordered = [...labels.current].sort((a, b) => Number(b.getElement().dataset.code === propsRef.current.selected) - Number(a.getElement().dataset.code === propsRef.current.selected));
      ordered.forEach(marker => {
        const element = marker.getElement();
        const point = map.current!.project(marker.getLngLat());
        const width = element.offsetWidth || 60;
        const overlaps = dense && placed.some(p => Math.abs(p.x - point.x) < (p.w + width) / 2 + 5 && Math.abs(p.y - point.y) < 29);
        element.style.visibility = overlaps ? 'hidden' : 'visible';
        if (!overlaps) placed.push({x: point.x, y: point.y, w: width});
      });
    };
    arrange();
    map.current.on('moveend', arrange);
    return () => {map.current?.off('moveend', arrange);map.current?.off('idle', onIdle);};
  }, [ready, displayData, props.context]);

  useEffect(() => {
    if (!ready || !map.current) return;
    popupRef.current?.remove();
    map.current.setPaintProperty('areas', 'fill-opacity', neutral ? 0 : 0.54);
    map.current.setPaintProperty('area-lines', 'line-color', neutral ? '#85998b' : '#ffffff');
  }, [ready, neutral]);

  useEffect(() => {
    if (!ready || !map.current) return;
    (map.current.getSource('facilities') as GeoJSONSource).setData({type:'FeatureCollection', features:props.facilityMode ? props.facilities.map(f => ({type:'Feature' as const, geometry:{type:'Point' as const, coordinates:[f.longitude,f.latitude]}, properties:{id:f.id,kind:f.kind,name:f.name,status:f.filter_status}})) : []});
  }, [ready, props.facilities, props.facilityMode]);



  useEffect(() => {
    if (!ready || !map.current) return;
    map.current.setFilter('facility-selected', ['==', ['get','id'], props.selectedFacility?.id || '']);
    if(!props.facilityMode)return;
    if(!props.selectedFacility){lastFacilityFocus.current=null;return;}
    if(lastFacilityFocus.current!==props.selectedFacility.id){lastFacilityFocus.current=props.selectedFacility.id;map.current.flyTo({center:[props.selectedFacility.longitude,props.selectedFacility.latitude],zoom:16,duration:600});}
  }, [ready, props.selectedFacility, props.facilityMode]);

  useEffect(() => {
    if (!ready || !map.current || !props.facilityMode) return;
    const key=`${props.facilityRegion}:${props.reset}`;
    if(lastFacilityBounds.current===key)return;
    const features = props.data.features.filter(f => f.properties.region_code.startsWith(props.facilityRegion));
    if (!features.length) return;
    lastFacilityBounds.current=key;
    const area = new LngLatBounds();
    features.forEach(f => area.extend(bounds(f.geometry)));
    const camera = map.current.cameraForBounds(area, {padding:80,maxZoom:14});
    if (camera) map.current.easeTo({...camera, zoom:props.facilityRegion.length === 8 ? Math.max(DETAIL_ZOOM + .2, camera.zoom || 12) : camera.zoom, duration:400});
  }, [ready, props.facilityRegion, props.facilityMode, props.data, props.reset]);

  useEffect(() => {
    if (!ready || !map.current || !props.dataReady || !props.data.features.length || props.facilityMode) return;
    map.current.setMinZoom(4.7);
    map.current.setMaxBounds([[120,29],[136,44]]);
    if (props.parent === '00') map.current.fitBounds([[124.9, 32.9], [130, 38.7]], {padding: 45, duration: 0});
    else {
      const all = new LngLatBounds();
      props.data.features.forEach(f => all.extend(bounds(f.geometry)));
      map.current.fitBounds(all, {padding:mapPadding(map.current),duration: 0, maxZoom: 13});
    }
    // Layer changes preserve the user's view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, props.parent, props.reset, props.dataReady]);

  useEffect(() => {
    if (!ready || !map.current) return;
    map.current.setFilter('selected', ['==', ['get', 'region_code'], props.selected || '']);
    labels.current.forEach(marker => {
      marker.getElement().classList.toggle('is-selected', marker.getElement().dataset.code === props.selected);
    });
    if(!props.dataReady)return;
    const feature = props.data.features.find(f => f.properties.region_code === props.selected) || props.overview?.features.find(f => f.properties.region_code === props.selected);
    if (feature && props.selected) {
      const camera = map.current.cameraForBounds(bounds(feature.geometry), {padding:mapPadding(map.current), maxZoom:props.selected.length === 8 ? 13 : 11});
      if (camera) map.current.easeTo({...camera, zoom:props.selected.length === 8 || props.summaryMode || props.mapLayer.kind === 'flood' ? Math.max(DETAIL_ZOOM + .2, camera.zoom || 12) : camera.zoom, duration:600});
    }
    // Keep zoom stable when only the displayed layer changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, props.selected, props.parent, props.reset, props.dataReady]);

  useEffect(() => { if (ready && props.zoom.id) map.current?.zoomTo((map.current?.getZoom() || 6) + props.zoom.step, {duration: 250}); }, [ready, props.zoom]);

  return <><div className={`map-canvas ${props.mapLayer.kind==='weather'?'weather-map':''} ${props.nearby?.picking?'is-picking-location':''}`} data-nearby-count={props.nearby?.rows.length||0} data-ready={rendered} data-map-instance={instanceId.current} data-layer={props.mapLayer.kind} data-display-level={displayLevel} data-feature-count={displayData.features.length} data-flood-layer={flood?.tab} ref={container} aria-label="우리 동네 기후재해 지도">{error && <div className="map-error">지도 표시를 위해 브라우저의 WebGL 지원이 필요합니다. 지역 목록에서도 상세 통계를 확인할 수 있습니다.</div>}</div>
    <FloodLayer map={ready?map.current:null} layer={flood}/>
    <NearbyFacilityLayer map={ready?map.current:null} controller={props.nearby||null}/>
    <WeatherLayer map={ready?map.current:null} layer={props.mapLayer.kind==='weather'?props.mapLayer:null}/>
    <LandslideLayer map={ready?map.current:null} layer={props.mapLayer.kind==='landslide'?props.mapLayer:null}/>
    <TyphoonLayer map={ready?map.current:null} layer={props.mapLayer.kind==='typhoon'?props.mapLayer:null}/>
    <ColdLayer map={ready?map.current:null} layer={props.mapLayer.kind==='cold'?props.mapLayer:null}/>
  </>;
}
