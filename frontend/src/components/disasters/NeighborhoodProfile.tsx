'use client';
import type {DisasterProfile} from '@/types/disasters';
import {useSnapshot} from '@/hooks/useSnapshot';
import {fmt} from '../constants';

export default function NeighborhoodProfile({region,typhoonId='2022-11',compact=false}:{region:string;typhoonId?:string;compact?:boolean}) {
  const {data,error,retry}=useSnapshot<DisasterProfile>(`/disaster-profile/${region}?typhoon_id=${typhoonId}`,region.startsWith('21'));
  if(!region.startsWith('21'))return <p className="disaster-note">부산 지역을 선택하면 저장된 SGIS 통계를 확인할 수 있습니다.</p>;
  return <section className={compact?'neighborhood-context':undefined}>
    {compact&&data&&<div className="neighborhood-glance"><h3>{data.region.region_name}의 생활환경</h3><div><span>주민 <strong>{fmt(data.stats.total_population,0)}명</strong></span><span>65세 이상 <strong>{fmt(data.stats.elderly_ratio)}%</strong></span></div><p>{data.reference_year}년 · 행정동 전체 통계이며 위험지역 안의 인구가 아닙니다.</p></div>}
    <details className="neighborhood-profile"><summary>{compact?'주택·인구와 다른 재해 기록 더 보기':'우리 동네 기록 · SGIS 지역 특성'}</summary>
    {error?<p role="alert">{error} <button onClick={retry}>다시 불러오기</button></p>:!data?<p>지역 통계를 불러오는 중…</p>:<>
      <h3>{data.region.region_name}</h3><p>{data.reference_year}년 통계 · {data.boundary_year}년 경계</p>
      <dl className="disaster-metrics">{[['total_population','총인구','명'],['elderly_population','65세 이상','명'],['elderly_ratio','65세 이상 비율','%'],['single_household_count','1인가구','가구'],['total_houses','주택','호'],['old_house_ratio','30년 이상 주택','%'],['infant_population','유아인구','명'],['business_count','사업체','개'],['worker_count','종사자','명']].map(([key,label,unit])=><div key={key}><dt>{label}</dt><dd>{data.stats[key]==null?'자료 없음':`${fmt(data.stats[key],unit==='%'?1:0)}${unit}`}</dd></div>)}</dl>
      <p className="disaster-note">{data.spatial_scope}. 미확보 항목은 자료 없음으로 표시합니다.</p>
      <dl className="profile-records"><div><dt>{data.hazards.heat?.period[0].slice(0,4)}년 여름 최고</dt><dd>{data.hazards.heat?`${data.hazards.heat.station_name} · ${fmt(data.hazards.heat.maximum.value)}℃`:"자료 없음"}<br/>{data.hazards.heat?.maximum.dates.join(", ")}</dd></div><div><dt>과거 침수 기록 지점</dt><dd>{data.hazards.flood?`${data.hazards.flood.count}개`:"자료 없음"}</dd></div><div><dt>산사태 지정 대표 지점</dt><dd>{data.hazards.landslide?`${data.hazards.landslide.count}개`:'자료 없음'}</dd></div><div><dt>인근 관측소 겨울 최저</dt><dd>{data.hazards.cold?`${data.hazards.cold.station_name} · ${fmt(data.hazards.cold.minimum.value)}℃`:'자료 없음'}</dd></div><div><dt>겨울 영하 발생일수</dt><dd>{data.hazards.cold?.freezing_days==null?'자료 불완전 / 없음':`${data.hazards.cold.freezing_days}일`}</dd></div><div><dt>{data.hazards.typhoon?.year} {data.hazards.typhoon?.name||'태풍'} 최근접</dt><dd>{data.hazards.typhoon?`${fmt(data.hazards.typhoon.closest.distance_km)}km`:'자료 없음'}</dd></div></dl>
      <p className="disaster-note">기온은 인근 관측소 기록입니다. 태풍 거리는 기록된 시각의 중심 위치 기준이며 피해 정도가 아닙니다.</p>
      <a href={data.source_url} target="_blank" rel="noreferrer">SGIS 통계 출처 ↗</a>
    </>}
    </details>
  </section>;
}
