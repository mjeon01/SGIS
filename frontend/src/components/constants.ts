import type { Layer } from '@/types';
export const LAYERS: {key: Layer; name: string; english: string; short: string}[] = [
  {key: 'risk', name: '종합 위험도', english: 'HEAT RISK', short: '종합'},
  {key: 'hazard', name: '폭염 강도', english: 'HAZARD', short: 'H'},
  {key: 'exposure', name: '인구 노출', english: 'EXPOSURE', short: 'E'},
  {key: 'vulnerability', name: '사회적 취약성', english: 'VULNERABILITY', short: 'V'},
];
export const INDICATORS: {key: Layer; name: string; group: string}[] = [
  {key: 'heatwave_intensity', name: '여름 평균기온', group: 'hazard'}, {key: 'heatwave_history_index', name: '여름 폭염일수', group: 'hazard'},
  {key: 'total_population', name: '총인구', group: 'exposure'}, {key: 'population_density', name: '인구밀도', group: 'exposure'},
  {key: 'elderly_ratio', name: '65세 이상 인구 비율', group: 'vulnerability'}, {key: 'single_household_ratio', name: '1인가구 비율', group: 'vulnerability'},
  {key: 'old_house_ratio', name: '30년 이상 노후주택 비율', group: 'vulnerability'},
];
export const COLORS = ['#c8e7de', '#91c6ae', '#edcf7b', '#e79258', '#c95040'];
export const LEVELS = ['매우 낮음', '낮음', '보통', '높음', '매우 높음'];
export const fmt = (n: number | null | undefined, digits = 1) => n == null ? '—' : n.toLocaleString('ko-KR', {maximumFractionDigits: digits, minimumFractionDigits: digits});
export const color = (n: number | null) => n == null ? '#a7b5b3' : COLORS[Math.min(4, Math.floor(n / 20))];
