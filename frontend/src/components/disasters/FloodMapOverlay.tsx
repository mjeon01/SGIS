import {Info,LoaderCircle,Waves} from 'lucide-react';
import type {FloodController} from '@/hooks/useFlood';
import {DEPTHS} from '../FloodScreen';

export default function FloodMapOverlay({controller,onSources,legend}:{controller:FloodController;onSources:()=>void;legend:boolean}) {
  const {data,error,tab,rows,scenario,layer,imageError}=controller;
  const selectedScenario=data?.meta.scenarios.find(s=>s.years===scenario);
  return <>
    <div className="map-title-card"><span className="eyebrow"><Waves size={14}/> {tab==='history'?'과거 기록':'강우 시나리오'}</span><h2>{tab==='history'?'부산 과거 침수 이력':`시간당 ${selectedScenario?.rainfall_mm_hour??'—'}mm 강우 예상도`}</h2><p>{tab==='history'?'지점을 선택해 당시 기록을 확인하세요.':`${scenario}년 빈도 · 현재 침수 상황이 아닙니다.`}</p></div>
    {legend&&tab==='forecast'&&<div className="flood-map-legend" aria-label="예상 침수 깊이 범례"><strong>예상 침수 깊이</strong>{DEPTHS.map(([c,t])=><span key={t}><i style={{background:c}}/>{t}</span>)}</div>}
    {legend&&tab==='history'&&<div className="flood-map-legend compact"><span><i style={{background:'#227db6'}}/>과거 침수 기록 지점</span><small>{rows.length}건</small></div>}
    {tab==='forecast'&&!layer?.imageUrl&&!imageError&&!error&&<div className="updating-pill"><LoaderCircle size={14} className="spin"/> 선택한 강우 조건을 불러오는 중</div>}
    {tab==='forecast'&&imageError&&<div className="map-error-card" role="alert"><p>{imageError}</p><button onClick={controller.retryImage}>예상도 다시 시도</button></div>}
    {error&&<div className="map-error-card" role="alert"><p>{error}</p><button onClick={controller.retry}>침수 자료 다시 시도</button></div>}
    <div className="map-data-notice"><Info size={14}/><span>{tab==='history'?'과거 기록의 대표 지점이며 침수 면적 전체를 나타내지 않습니다.':'선택한 강우 조건의 예상도입니다. 실시간 침수·예보가 아닙니다.'}</span><button onClick={onSources}>자료 안내</button></div>
  </>;
}
