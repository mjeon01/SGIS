import type {RiskRegion,Facility,FloodRecord,FloodData} from '@/types';
import type {Disaster,LandslidePoint,DatasetProvenance} from '@/types/disasters';
import {fmt} from '../constants';
export type InspectionItem={id:string;kind:'region'|'facility'|'flood'|'landslide';hazard:Disaster;sourceId:string;title:string;regionCode:string;regionName:string;reference:string;source:string;sourceUrl:string;evidence:string[];checked:boolean;note:string;addedAt:string;analysisScope?:{parent:string;level:'children'|'dong'}};
export type InspectionDraft=Omit<InspectionItem,'checked'|'note'|'addedAt'>;
export function regionInspection(region:RiskRegion,analysisScope:InspectionItem['analysisScope']):InspectionDraft {
 return {id:`region:${region.region_code}`,kind:'region',hazard:'heat',sourceId:region.region_code,title:region.region_name,regionCode:region.region_code,regionName:region.full_name,reference:region.reference_year?`${region.reference_year}년 지역통계`:'통계 기준연도 미확인',analysisScope,source:'SGIS · 기상청',sourceUrl:'https://sgis.mods.go.kr/',evidence:[region.risk_score==null?'폭염 취약도 미산출':`폭염 취약도 ${fmt(region.risk_score)} / 100 · ${region.comparison_region} 내 상대 지수`,...region.top_factors.slice(0,3).map(f=>`${f.name} ${fmt(f.value)}${f.unit} · 비교 기준 ${fmt(f.comparison_average)}${f.unit}`)]};
}
export function facilityInspection(f:Facility):InspectionDraft {
 return {id:`facility:${f.id}`,kind:'facility',hazard:'heat',sourceId:f.id,title:f.name,regionCode:f.region_code||'21',regionName:f.region_name||'부산 · 행정동 미확인',reference:`${f.reference_date||f.reference_year} 기준`,source:f.source,sourceUrl:f.source_url,evidence:[f.address||'주소 미제공',`이용대상: ${f.access||'확인 필요'}`,`등록 운영시간: ${f.hours||'확인 필요'}`]};
}
export function floodInspection(p:FloodRecord,meta:FloodData['meta']):InspectionDraft {
 return {id:`flood:${p.id}`,kind:'flood',hazard:'flood',sourceId:p.id,title:p.name,regionCode:p.region_code||'21',regionName:p.region_name||'부산 · 행정동 미확인',reference:p.period||'발생 시기 미확인',source:meta.source,sourceUrl:meta.source_url,evidence:[`과거 기록: ${p.event||'상세 미제공'}`,`당시 침수 깊이: ${p.depth||'미제공'}`,`당시 침수 면적: ${p.area||'미제공'}`]};
}
export function landslideInspection(p:LandslidePoint,meta:DatasetProvenance):InspectionDraft {
 return {id:`landslide:${p.id}`,kind:'landslide',hazard:'landslide',sourceId:p.id,title:p.name,regionCode:p.region_code||'21',regionName:p.region_name||'부산 · 행정동 미확인',reference:`지정일 ${p.designated_date||'미확인'}`,source:meta.source,sourceUrl:meta.source_url,evidence:[`지정 유형: ${p.type||'미제공'}`,`지정 상태: ${p.status||'미제공'}`,`공개자료 현황: ${p.current_status||'미제공'}`]};
}
export function inspectionMarkdown(items:InspectionItem[]) {
 return ['# 기후 대비 점검 목록','', '등록자료와 지역통계를 참고해 사용자가 선택한 점검 목록입니다. 현재 안전 상태나 재난 발생확률을 판정하지 않습니다.','',...items.flatMap(item=>[
  `## ${item.checked?'[x]':'[ ]'} ${item.title}`,'',`${item.regionName} · ${item.reference}`,`담은 날짜: ${item.addedAt.slice(0,10)}`,'',...item.evidence.map(line=>`- ${line}`),'',`메모: ${item.note||'없음'}`,'',`출처: ${item.source} (${item.sourceUrl})`,'',
 ])].join('\n');
}
