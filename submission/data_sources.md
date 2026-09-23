# 데이터 출처 및 확보 상태

검증일: 2026-09-22. 통계는 2024년, 경계는 사용자 승인에 따라 2025년이다.

| 지표 | 출처·조회 | 사용 기준 |
| --- | --- | --- |
| 총인구·인구밀도 | SGIS `/OpenAPI3/stats/population.json` | `tot_ppltn`, `ppltn_dnsty` |
| 고령인구 비율 | SGIS `/OpenAPI3/stats/searchpopulation.json`, `age_type=24` | 65세 이상 / 총인구 |
| 1인가구 비율 | SGIS `/OpenAPI3/stats/household.json`, `household_type=A0` | 1인가구 / 총가구 |
| 30년 이상 노후주택 비율 | SGIS 살고싶은 우리동네 `/view/house/getIndicatorAreaList`, `classId=B005` | 2024년 공식 비율, 223개 코드 모두 일치 |
| 여름 평균기온 | 기상청 ASOS/AWS 일 관측자료 | 2024.06.01~08.31 일 평균기온의 평균 |
| 여름 폭염일수 | 기상청 ASOS/AWS 일 관측자료 | 같은 기간 일 최고기온 33℃ 이상인 날의 수 |
| 행정경계 | SGIS `/OpenAPI3/boundary/hadmarea.geojson` | 2025년, EPSG:5179 → 4326 |

## 기상청 확보 결과

공개 자료 조회 화면 `selectAsosRltmList.do`, `selectAwsRltmList.do`의 일 자료를 수집했다. 로그인·인증키를 요구하는 파일 다운로드를 사용하지 않았다. 지점정보 화면의 기간별 위치 이력도 검증했다. 공식 인증 API를 사용한 것으로 설명하지 않는다.

| 관측소 | 일 평균기온 | 일 최고기온 | 비고 |
| --- | --- | --- | --- |
| 부산159, 북부산296, 사상904, 영도910, 기장923, 해운대937, 부산진938, 동래940, 북구941, 부산남구942 | 각각 92/92일 | 각각 92/92일 | 두 지표 산출 가능 |
| 부산(레)160 | 89/92일 | 89/92일 | 결측, 두 지표 미산출 |
| 가덕도921 | 90/92일 | 90/92일 | 결측, 두 지표 미산출 |
| 금정구939 | 88/92일 | 90/92일 | 결측, 두 지표 미산출 |
| 사하950 | 91/92일 | 91/92일 | 결측, 두 지표 미산출 |
| 남항968, 북항969 | 0/92일 | 0/92일 | 해당 기간 위치 확인 불가, 후보 제외 |

최근접 관측소 연결 후 188/223개 지역에 7개 지표가 모두 존재한다. 구·군은 14/16개(사하구·금정구 제외), 읍면동은 173/206개다. 관측소 값은 해당 동의 직접 실측값이 아니며 지형·고도에 따른 오차가 가능하다. 결측 관측소를 다른 관측소로 바꾸지 않는다.

## 노후주택 검증

SGIS 공식 지표 설명에서 자료시점 2024년·30년 이상·읍면동 단위를 확인했다. 조회의 `baseYear`는 경계연도이며 통계연도의 근거로 사용하지 않았다. 분자는 제공되지 않으므로 `old_house_count=null`을 유지한다. 비교에는 같은 출처의 공식 상위지역 비율을 사용한다.

KOSIS `101/DT_1YL202004`의 시군구 비율도 조회했으나 일부 SGIS 값과 차이가 있어 실제 분석에는 혼합하지 않았다. ERA5-Land는 탐색 조회만 했으며 사용자 선택에 따라 사용하지 않았다. SGIS 특보 이력 원본은 보관하되 폭염일수로 오인하여 사용하지 않았다.

## 공식 설명

- [SGIS 인구·가구·주택 OpenAPI](https://sgis.mods.go.kr/developer/html/newOpenApi/api/dataApi/census.html)
- [SGIS 살고싶은 우리동네 지표 설명](https://sgis.mods.go.kr/view/house/houseAnalysisMap)
- [기상청 AWS 자료](https://data.kma.go.kr/data/grnd/selectAwsRltmList.do)
- [기상청 ASOS 자료](https://data.kma.go.kr/data/grnd/selectAsosRltmList.do)
- [기상청 폭염일수 정의](https://data.kma.go.kr/climate/heatWave/selectHeatWaveChart.do)
- [기상청 관측지점 위치 이력](https://data.kma.go.kr/tmeta/stn/selectStnList.do?pgmNo=123)
- [기상청 API허브 공식 명세](https://apihub.kma.go.kr/apiList.do)

원천 캐시는 `data/raw/`, 기상 관측 스냅샷은 `data/processed/kma_observations_2024.json`, 최종 결합은 `data/processed/sgis.json`에 있다. 모두 Git에서 제외한다. 지표별 원천·기간·관측소·연결 근거를 최종 레코드에 보존한다. Sample은 모든 통계가 합성이며 경계만 실제다.

## 별도 현재 시설 화면 (2026년)

- 국민안전24 무더위쉼터 공개 안전지도: 2026년 등록 1,735개, 좌표·이용대상·운영시간·수용인원. https://www.safekorea.go.kr/safekorea-kor/flsm/flsm/facilitiesSafteyMap.do?menuSn=2
- 부산생활지도 폭염 그늘막 설치장소: 2026-04-30 기준 1,835개 중 좌표 유효 1,834개. https://lifemap.busan.go.kr/li/index.do
- 지도 배경: OpenStreetMap. 브라우저 화면에 필요한 타일만 요청하고 출처를 표시함. https://www.openstreetmap.org/copyright
- 시설 기준연도는 2026년, 위치 연결용 경계는 2025년. 2024년 취약도·인구와 수치 비교하지 않음. 상세 검증은 `docs/facility-data-review.md` 참조.

### 일별 최고·최저 보완자료

`data/processed/kma_extremes_2024.json`: 동일한 2024년 최근접 관측소 14곳의 6~8월 일별 최고·최저. 최고는 기존 캐시, 최저는 기상청 공개 조회의 `MIN_TA`(AWS `SFC02015002`, ASOS `SFC01013002`)를 3초 간격으로 수집했다. 원본은 `data/raw/kma/2024/minimum_*.json`. 화면 표시용으로만 사용하며 7개 지표·종합점수·순위 계산에는 넣지 않는다.


## 현재 기상과 동네 분석 (2026-09-23 갱신)

기상청 ASOS/AWS 공개 일 관측자료를 2026-09-22까지 조회했다. 최근 30일과 6~8월을 분리하며 관측소별 마지막 관측일과 결측을 표시한다. 동네 분석의 현재 기상은 2025년 행정동 내부 대표점에서 현재 위치 이력이 유효한 최근접 관측소를 연결한 값이다. 2024년 취약도 계산에는 사용하지 않으며 동 자체의 실측값이나 실시간 순간 기온으로 해석하지 않는다. 출처: https://data.kma.go.kr/data/grnd/selectAwsRltmList.do

## 침수 이력과 예상도 (2026-09-23 수집)

출처: [부산광역시 부산 안전 ON](https://safecity.busan.go.kr/).

- 과거 이력 공개 조회: `/iots/vmap/sensor_flood_trace.do`. 188건 중 좌표 오류 2건 제외, 186건 표시. `lat` 필드가 경도, `lon` 필드가 위도인 것을 공식 지도 및 부산 위치 범위와 대조했다. 녹산동 5-23 기록은 두 좌표가 모두 35.1238…이고 다른 한 건은 숫자가 아닌 좌표여서 임의 보정하지 않았다.
- 유효 기록의 연도: 2020년 53, 2021년 14, 2022년 1, 2023년 28, 2024년 81, 2025년 8, 날짜 미확인 1. 행정동은 좌표가 유일하게 포함되는 SGIS 경계에 연결하며, 등록된 지점 수를 사건 수 또는 위험도 순위로 바꾸지 않는다.
- 도심침수 예상도: `/geoserver/iots/wms` WMS 1.1.1 GetMap. `fldm_30`, `fldm_50`, `fldm_80`, `fldm_100`. 공식 앱에서 각각 시간당 98.1, 106.8, 114.7, 118.5mm 강우 조건 확인. 해안·하천 시나리오는 이번 범위에 포함하지 않는다.
- 침수심 범례: 공식 앱 `vue/img/legend-1.1.1.242cf8a0.png` 및 WMS GetStyles의 gridcode 1~6과 대조. 0.3–0.5m 미만 / 0.5–1m 미만 / 1–1.5m 미만 / 1.5–2m 미만 / 2–3m 미만 / 3m 이상.
- 제작 기준연도 미확인. 수집 시각은 원본 메타데이터에 기록한다. 저장 영역 WGS84 [128.79, 34.99, 129.30, 35.40]을 EPSG:3857로 투영한 GetMap 결과 4,096×4,096 PNG. 지점별 예상 깊이나 동별 면적·위험 점수를 계산하지 않는다.
- `scripts/collect_flood.py`로 수집. 캐시는 `data/raw/flood/`, API는 `/api/flood` 및 `/api/flood/forecast/{30|50|80|100}.png`. 모든 외부 요청 간격 최소 3초, 페이지 조작은 외부 WMS에 직접 요청하지 않는다.
