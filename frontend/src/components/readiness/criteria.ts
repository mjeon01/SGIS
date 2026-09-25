import type {RiskRegion} from '@/types';

export const READINESS_CRITERIA=[
  {key:'elderly_ratio',title:'고령인구',description:'65세 이상 인구 비율이 높은 곳',icon:'people'},
  {key:'single_household_ratio',title:'1인가구',description:'혼자 사는 가구 비율이 높은 곳',icon:'person'},
  {key:'old_house_ratio',title:'노후주택',description:'30년 이상 주택 비율이 높은 곳',icon:'home'},
  {key:'heatwave_history_index',title:'폭염일수',description:'폭염 관측일수가 많은 곳',icon:'sun'},
] as const;
export type ReadinessCriterion=typeof READINESS_CRITERIA[number]['key'];

/** An explicit intersection of existing indicators; no new score or risk model. */
export function findReadinessRegions(regions:RiskRegion[],criteria:ReadinessCriterion[]) {
 const known=regions.filter(r=>criteria.length?criteria.every(key=>{
  const factor=r.factors.find(f=>f.key===key);return factor?.value!=null&&factor.comparison_average!=null;
 }):r.risk_score!=null);
 const matches=known.filter(r=>criteria.every(key=>{const f=r.factors.find(f=>f.key===key)!;return f.value!>f.comparison_average!;}));
 matches.sort((a,b)=>Number(a.risk_score==null)-Number(b.risk_score==null)||(b.risk_score??0)-(a.risk_score??0)||a.region_code.localeCompare(b.region_code));
 return {matches,unknown:regions.length-known.length};
}
