# SGIS 활용 로그

검증일: 2026-09-22. 인증키·토큰은 기록하지 않습니다. 아래는 수집기의 원본 조회 조합이며 캐시 재사용도 포함합니다.

- 통계연도: 2024
- 경계연도: 2025
- 전국 시도 + 부산 전체 경계: 239개
- 부산 실제 통계: 223개 (부산 1 + 구·군 16 + 읍면동 206)
- region_code 미일치: 0개
- 실제 제공 핵심지표: 7종 (SGIS 5종 + 기상청 2종), 관측 결측 지역은 일부 미확보
- 실제 종합점수: 구·군 14/16개, 읍면동 173/206개

| 데이터/API | 조회 조건 | 응답 항목 수 | 서비스 내 사용 |
| --- | --- | --- | --- |
| `/year/data.json` | `{}` | 11 | 연도 정합성 |
| `/boundary/hadmarea.geojson` | `{"year": "2025", "low_search": "1"}` | 17 | 경계 탐색·지도 |
| `/boundary/hadmarea.geojson` | `{"year": "2025", "low_search": "1", "adm_cd": "21"}` | 16 | 경계 탐색·지도 |
| `/boundary/hadmarea.geojson` | `{"year": "2025", "adm_cd": "21010", "low_search": "1"}` | 9 | 경계 탐색·지도 |
| `/boundary/hadmarea.geojson` | `{"year": "2025", "adm_cd": "21020", "low_search": "1"}` | 13 | 경계 탐색·지도 |
| `/boundary/hadmarea.geojson` | `{"year": "2025", "adm_cd": "21030", "low_search": "1"}` | 12 | 경계 탐색·지도 |
| `/boundary/hadmarea.geojson` | `{"year": "2025", "adm_cd": "21040", "low_search": "1"}` | 11 | 경계 탐색·지도 |
| `/boundary/hadmarea.geojson` | `{"year": "2025", "adm_cd": "21050", "low_search": "1"}` | 20 | 경계 탐색·지도 |
| `/boundary/hadmarea.geojson` | `{"year": "2025", "adm_cd": "21060", "low_search": "1"}` | 13 | 경계 탐색·지도 |
| `/boundary/hadmarea.geojson` | `{"year": "2025", "adm_cd": "21070", "low_search": "1"}` | 17 | 경계 탐색·지도 |
| `/boundary/hadmarea.geojson` | `{"year": "2025", "adm_cd": "21080", "low_search": "1"}` | 13 | 경계 탐색·지도 |
| `/boundary/hadmarea.geojson` | `{"year": "2025", "adm_cd": "21090", "low_search": "1"}` | 18 | 경계 탐색·지도 |
| `/boundary/hadmarea.geojson` | `{"year": "2025", "adm_cd": "21100", "low_search": "1"}` | 16 | 경계 탐색·지도 |
| `/boundary/hadmarea.geojson` | `{"year": "2025", "adm_cd": "21110", "low_search": "1"}` | 16 | 경계 탐색·지도 |
| `/boundary/hadmarea.geojson` | `{"year": "2025", "adm_cd": "21120", "low_search": "1"}` | 9 | 경계 탐색·지도 |
| `/boundary/hadmarea.geojson` | `{"year": "2025", "adm_cd": "21130", "low_search": "1"}` | 12 | 경계 탐색·지도 |
| `/boundary/hadmarea.geojson` | `{"year": "2025", "adm_cd": "21140", "low_search": "1"}` | 10 | 경계 탐색·지도 |
| `/boundary/hadmarea.geojson` | `{"year": "2025", "adm_cd": "21150", "low_search": "1"}` | 12 | 경계 탐색·지도 |
| `/boundary/hadmarea.geojson` | `{"year": "2025", "adm_cd": "21510", "low_search": "1"}` | 5 | 경계 탐색·지도 |
| `/stats/population.json` | `{"year": "2024", "adm_cd": "21", "low_search": "0"}` | 1 | 통계·노출·비율·지역 비교 |
| `/stats/searchpopulation.json` | `{"year": "2024", "adm_cd": "21", "low_search": "0", "age_type": "24"}` | 1 | 통계·노출·비율·지역 비교 |
| `/stats/household.json` | `{"year": "2024", "adm_cd": "21", "low_search": "0", "household_type": "A0"}` | 1 | 통계·노출·비율·지역 비교 |
| `/stats/population.json` | `{"year": "2024", "adm_cd": "21", "low_search": "1"}` | 16 | 통계·노출·비율·지역 비교 |
| `/stats/searchpopulation.json` | `{"year": "2024", "adm_cd": "21", "low_search": "1", "age_type": "24"}` | 16 | 통계·노출·비율·지역 비교 |
| `/stats/household.json` | `{"year": "2024", "adm_cd": "21", "low_search": "1", "household_type": "A0"}` | 16 | 통계·노출·비율·지역 비교 |
| `/stats/population.json` | `{"year": "2024", "adm_cd": "21", "low_search": "2"}` | 206 | 통계·노출·비율·지역 비교 |
| `/stats/searchpopulation.json` | `{"year": "2024", "adm_cd": "21", "low_search": "2", "age_type": "24"}` | 206 | 통계·노출·비율·지역 비교 |
| `/stats/household.json` | `{"year": "2024", "adm_cd": "21", "low_search": "2", "household_type": "A0"}` | 206 | 통계·노출·비율·지역 비교 |
| `/ndsm/prevHwSpcnwsList.json` | `{"searchYear": "2024", "searchMonth": "06"}` | 134 | 원본 검토만, 점수 미사용 |
| `/ndsm/prevHwSpcnwsList.json` | `{"searchYear": "2024", "searchMonth": "07"}` | 161 | 원본 검토만, 점수 미사용 |
| `/ndsm/prevHwSpcnwsList.json` | `{"searchYear": "2024", "searchMonth": "08"}` | 108 | 원본 검토만, 점수 미사용 |

## 전처리

- 인구·밀도·가구·주택 분모 필드의 숫자/결측 파싱.
- 고령인구 24 코드, 1인가구 A0 코드의 실제 필드를 region_code로 결합.
- 비율 계산은 유효한 분자·분모가 있을 때만 수행.
- 원본 경계 좌표를 EPSG:5179 → 4326 변환.
- 원본 캐시 data/raw/, 표준 데이터 data/processed/sgis.json.
- 통계 확보 후 샘플과 분리하여 서비스.

## 근거

공식 API·필드·미확보 사유는 [data_sources.md](data_sources.md), 판단은 [결정 기록](../docs/decisions.md)에 있습니다.

## 추가 공개 자료 활용

SGIS 살고싶은 우리동네의 `POST /view/house/getIndicatorAreaList`, `classId=B005`로 2024년 30년 이상 노후주택 비율 223개를 확보했습니다. 공식 비율만 사용하고 노후주택 수를 역산하지 않습니다. 지도 설명의 통계연도와 요청의 경계연도를 구분합니다.

기상청 ASOS/AWS 2024년 여름 일 관측자료를 결합했습니다. SGIS 인구·가구·주택의 5개 지표는 E/V 계산에 직접 사용하며, 기상청의 2개 지표는 H에 사용합니다. 공식 출처 및 결측 현황은 `data_sources.md`에 기록합니다.
