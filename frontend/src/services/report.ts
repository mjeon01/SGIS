import type {Mode,ReviewSheet} from '@/types';

const number=(value:number|null)=>value==null?'미확보':value.toLocaleString('ko-KR',{minimumFractionDigits:1,maximumFractionDigits:1});

export function reportMarkdown(data:ReviewSheet,mode:Mode) {
  const r=data.region, report=data.report;
  const climate=r.factors.find(f=>f.key==='heatwave_intensity')?.source_detail;
  return [
    `# ${r.full_name} 지역 분석보고서`,
    mode==='sample'?'시연용 합성 데이터 — 실제 정책 판단용 아님':'SGIS·기상청 공개자료 및 행정안전부 대응 자료',
    `${data.scope}: ${data.rank==null?'자료 부족으로 순위 미산출':`${data.scored_count}개 산출 지역 중 ${data.rank}위 (${data.rank_method})`}`,
    `전체 ${data.total_count}개 동 중 ${data.total_count-data.scored_count}개 자료 부족`,
    `취약도 ${number(r.risk_score)} / 100 · ${r.risk_level}`,
    '## 지역 분석 요약',data.explanation.summary,
    ...(report.narrative?['## 대응의 초점',report.narrative.overview,'### 먼저 할 일',report.narrative.next_step]:[]),
    '## 선정 근거',...r.top_factors.map(f=>`- ${f.name}: ${number(f.value)}${f.unit} / 부산 기준 ${number(f.comparison_average)}${f.unit}`),
    '## 우선 검토할 대응방안',report.guidance_note,
    ...report.plans.flatMap((plan,index)=>[
      `### ${index+1}. ${plan.title}`,`연결 지표: ${plan.factor_names.join(' · ')}`,plan.reason,
      '실행 제안:',...plan.steps.map((step,i)=>`${i+1}. ${step}`),
      `함께 확인할 곳: ${plan.partners}`,`점검 후 남길 결과: ${plan.completion}`,
      `공식 자료의 대응 원칙: ${plan.basis}`,
      ...plan.sources.map(s=>`근거: [${s.publisher} — ${s.title}](${s.url})`),`적용 조건: ${plan.condition}`,
    ]),
    '## 현장 확인 사항',...data.field_checks.map(c=>`- ${c.text}`),
    '## 자료와 해석',`통계 기준: ${r.reference_year}년`,`출처: ${r.source}`,
    climate?.station_id?`기상: ${climate.station_name} (${climate.station_id}), 대표 위치에서 ${climate.distance_km}km 떨어진 인근 관측소. 동 자체의 실측값이 아닙니다.`:'기상: 실제 관측자료 연결 없음',
    data.facility_note,data.purpose,
    '대응 자료는 현재 확인한 전국 지침이며, 해당 동의 사업 시행 여부나 시설 부족을 뜻하지 않습니다.',
    ...report.sources.map(s=>`- [${s.title}](${s.url}) · 확인일 ${s.checked_on}\n  ${s.summary}`),
    ...(report.prepared_at?[`대응 설명 작성: ${report.prepared_at}`]:[]),
    `보고서 조회: ${data.generated_at}`,
  ].join('\n\n');
}
