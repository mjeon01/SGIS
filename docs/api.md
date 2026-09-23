# 로컬 API

기본 포트 8000. 실행 중인 검증 인스턴스는 8018입니다. `/docs`에서 OpenAPI 명세를 확인할 수 있습니다.

공통 파라미터:

- `mode=sgis|sample`: 생략 시 `DATA_MODE`, 기본 `sgis`.
- `parent_code=00|시도코드|시군구코드`: 비교범위. `00`은 전국 시도, `21`은 부산 구·군, `21090`은 해운대구 읍면동.
- `region_code`: SGIS 통계코드. 비교범위 안에 속하지 않으면 404.

| API | 설명 |
| --- | --- |
| GET `/api/health` | 상태, 기본 모드, rules 엔진 |
| GET `/api/meta` | 출처·연도·수집 로그·지표 사전 |
| GET `/api/regions?parent_code=00` | 바로 아래 지역 목록 |
| GET `/api/regions/{region_code}` | 지역 및 GeoJSON geometry |
| GET `/api/regions/{region_code}/children` | 하위 지역 목록 |
| GET `/api/view?parent_code=21&layer=exposure` | 지도·결과·순위·경로의 일관된 스냅샷 |
| GET `/api/risk?parent_code=21` | 같은 비교범위의 위험도 결과 |
| GET `/api/risk/ranking?parent_code=21` | 점수 있는 지역 중 Top 5 |
| GET `/api/risk/{region_code}?parent_code=21` | 상세 결과와 부산 평균 비교 |
| GET `/api/risk/{region_code}/factors` | 7개 지표, 결측·기여도·원천 근거 |
| GET `/api/risk/{region_code}/comparison` | 해당 상위지역 및 부산 평균 |
| GET `/api/map/heatwave` | 종합 위험도 GeoJSON |
| GET `/api/map/layer/{layer_name}` | 그룹 또는 개별 지표 GeoJSON |
| POST `/api/ai/explain` | 서버 계산 결과의 규칙 기반 설명 |

레이어: `risk`, `hazard`, `exposure`, `vulnerability`, `heatwave_intensity`, `heatwave_history_index`, `total_population`, `population_density`, `elderly_ratio`, `single_household_ratio`, `old_house_ratio`.

설명 요청 예:

```json
{"region_code":"21090","parent_code":"21","mode":"sgis"}
```

점수·등급·임의 문장 등의 추가 필드는 422로 거부합니다. 입력 수치가 아닌 서버의 저장된 결과를 읽습니다.

`risk_score=null`과 `risk_level="데이터 부족"`은 정상 결과입니다. 같은 지역의 `exposure_score`는 있을 수 있습니다. `data_completeness`는 0~1이며 프런트엔드에서 백분율로 표시합니다. H/E/V 점수와 개별 지도값은 0~100입니다.

`comparison_average`는 지표별 비교 기준입니다. 고령·1인가구 비율은 합산 비율, 실제 노후주택은 SGIS 공식 상위지역 비율, 인구밀도는 총인구/총면적, 총인구와 기후지표는 산술평균입니다. `relative_ratio`는 평균 0일 때 null입니다. 서로 다른 비교범위의 최종 위험도 점수를 비교하지 않습니다.

실제 캐시 없음은 503, SGIS 경계 연동 실패는 502, 없는 지역은 404, 잘못된 모드·레이어·지역코드는 422로 응답합니다. 인증키·토큰·키가 붙은 요청 URL은 오류 응답이나 캐시에 포함하지 않습니다.

`heatwave_intensity`는 6~8월 평균기온(℃), `heatwave_history_index`는 같은 기간 일 최고기온 33℃ 이상 일수(일)입니다. 두 번째 키 이름은 호환성을 유지했지만 의미는 사용자 승인에 따라 폭염특보 이력에서 폭염일수로 변경했습니다. 기상지표 `source_detail`에 관측소명·ID·위치·대표점·거리·유효 관측일수·기간·연결 방법이 있습니다. `is_local_measurement=false`는 해당 지역 자체의 실측값이 아님을 뜻합니다.

## 부산 전체 읍면동 비교

`/api/view?parent_code=21&level=dong&mode=sgis`는 부산 206개 읍면동을 하나의 비교범위로 정규화한다. `level=children`(기존 기본값)은 상위지역의 직계 하위지역을 반환한다. `level`은 view/risk/ranking/factors/comparison/map API와 설명 요청 본문에 동일하게 적용한다. 화면의 기본 요청은 `parent_code=21&level=dong`이다. 같은 동이라도 구 내부 비교 점수와 부산 전체 비교 점수는 정규화 범위가 달라 직접 비교하지 않는다.

## 현재 시설

`GET /api/facilities`는 2026년 공식 등록시설의 좌표, 시설명, 주소, 이용대상, 등록 운영시간, 수용인원, 출처별 기준일을 반환한다. 통계 모드와 별도의 실제 자료이며 인구·취약도 점수·인구 대비 시설 수는 포함하지 않는다. `region_code`는 2025년 SGIS 경계 내 좌표 포함 여부로 연결하며, 연결되지 않거나 둘 이상의 경계와 겹치면 null이다. 좌표 오류는 제외하고 제외 개수를 meta에 표시한다. 파일이 없으면 503이며 시설 0개로 응답하지 않는다.

## 최고·최저 기온 및 지역 분석보고서

- `GET /api/weather/{region_code}?mode=sgis`: 기존 분석에 연결한 관측소의 2024년 6~8월 일별 최고·최저, 기간 극값과 날짜, 유효 일수, 출처·거리 및 폭염일수. 표시용 자료이며 점수에 반영하지 않는다. 극값은 각각 92일 모두 유효할 때만 산출한다. 실제 자료가 없는 지역/Sample은 `available=false`, 보완 캐시가 없으면 503.
- `GET /api/review/{region_code}?mode=sgis`: 부산 읍면동만 지원하며 항상 부산 전체 읍면동 비교를 사용한다. 순위(동점 동일), 산출/전체 지역수, 기존 상세 지표, 설명·대응안, 요인별 현장 확인 항목을 반환한다. 사용자 입력 점수를 받지 않는다. 현재 시설 개수나 인구 대비 시설 수는 포함하지 않는다. `report`에는 `plans`(실행 단계·협의 대상·점검 결과·근거 출처), `sources`, 사전 작성한 `narrative`와 작성일을 담는다. `status`는 prepared/not_prepared/stale/sample/insufficient 중 하나다. 현재 입력 검증값과 일치하는 정상 파일만 읽으며 GET 요청에서 모델을 호출하지 않는다. 생성용 POST API는 없다.

## 현재 기상 및 쉼터 운영조건

- `GET /api/current-weather`: 당해 연도 저장자료. 최근 30일·6~8월 일 최고/최저, 유효 일수, 기간 극값(완전 관측일 때), 폭염일수, 관측소 현재 위치, 마지막 관측일, 수집 시각, `outdated`, `is_realtime=false`. 2024년 분석과 독립된 파일이다.
- `POST /api/current-weather/refresh`: 서버의 단일 수집 작업 시작. `running|fresh` 상태를 반환한다. 6시간 캐시 및 호스트별 최소 3초 간격을 적용한다.
- `GET /api/current-weather/refresh`: `idle|running|complete|error`, 진행 메시지. 실패 시 이전 파일은 유지한다.
- `GET /api/facilities?region=21110600&kind=shelter&access=anyone&day=0&time=14:00`: 2026년 등록자료 필터. `region` 기본 부산 `21`, `kind=all|shelter|shade`, `access=all|anyone`, `day=0..6`(월..일), `time=HH:mm`(요일 선택 필요). 운영·이용조건이 미등록이면 `filter_status=unknown`으로 반환하며 제외하지 않는다. 확인된 불일치만 제외한다. `filter_counts`로 일치/미확인을 구분한다.

- `GET /api/current-weather/regions/{region_code}`: 실제 부산 읍면동의 현재 기상. 현재 조회일의 유효 위치를 가진 최근접 관측소의 최근/여름 기록, 마지막 관측일, 거리, 연결 방식, `is_local_measurement=false`를 반환한다. 2024년 위험도와 독립적으로 연결하며 관측 결측 때문에 다른 관측소로 바꾸지 않는다. 부산 읍면동이 아닌 코드는 404, 현재 기상 파일 미확보는 503, 유효 위치가 없으면 `available=false`다.
