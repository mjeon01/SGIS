# 추가 데이터 확보 검토

확인일: 2026-09-22. 아래 초기 탐색 이후 사용자 확인을 받아 기상청 관측자료와 SGIS 노후주택 비율을 서비스에 반영했다. 현재 기준은 methodology.md와 submission/data_sources.md를 따른다. 기존 2024 통계 / 2025 경계 기준을 유지한다.

## 노후주택

- SGIS [살고싶은 우리동네](https://sgis.mods.go.kr/view/house/houseAnalysisMap)의 지표 설명은 B005를 **2024년, 건축 후 30년 이상, 읍면동 단위 비율**로 명시한다.
- 해당 공개 화면에서 사용하는 `POST /view/house/getIndicatorAreaList`의 `classId=B005` 조회로 부산 1개, 구·군 16개, 읍면동 206개 비율을 받았다. 기존 관측자료 223개 코드에 모두 대응하며 누락 코드는 없다.
- 응답은 비율과 지역코드만 제공하며 노후주택 수와 통계연도 필드는 없다. `baseYear`는 화면 코드에서 경계연도(`bndYear`)를 사용한다. 이 요청값만으로 통계연도를 판정하면 안 된다.
- KOSIS [노후주택비율](https://kosis.kr/visual/eRegionIndex/eRegionWhole.do?unitySrvcId=1305), 통계표 `101 / DT_1YL202004`에서도 2024년 부산 16개 구·군 비율의 실제 조회가 성공했다. 이 자료의 단위는 시군구이며 읍면동 자료로 복제하지 않는다.
- 두 출처의 2024년 비율은 일부 다르다(중구 SGIS 45.6%, KOSIS 46.0%; 동구 SGIS 43.0%, KOSIS 46.6%). 차이 원인은 아직 확인되지 않았다. 서로 섞거나 평균하지 않는다.
- 비율을 주택 수에 곱해 노후주택 수를 역산하지 않는다. 분자·분모 원자료가 없는 상태에서 기존 합산 비율 비교를 임의로 변경하지 않는다.
- 연구용 응답: `var/external-data/housing_coverage.json`, `housing_*.json`, `kosis_housing_data.json`, `kosis_housing_series.json` (git 제외).

## 기상

- [기상청 AWS 자료](https://data.kma.go.kr/data/grnd/selectAwsRltmList.do)는 관측소 단위이며 공개 페이지의 CSV 다운로드 흐름에는 로그인이 필요하다. 관측소와 행정동의 연결 규칙은 별도로 정해야 한다.
- 기상청 [폭염일수](https://data.kma.go.kr/climate/heatWave/selectHeatWaveChart.do)는 일 최고기온 33℃ 이상인 날의 수로 정의된다. 폭염특보 발령 이력과는 다른 지표이다.
- [Open-Meteo Historical Weather API](https://open-meteo.com/en/docs/historical-weather-api)의 `era5_land`로 부산의 2024-06-01~2024-08-31 일 평균·최고기온 조회에 성공했다. 원 응답은 `var/external-data/climate_grid_probe.json`에 보관했다.
- ERA5-Land는 0.1도(약 11km) 재분석 격자자료이다. 동별 실측값이 아니며 작은 동 사이의 기상 차이를 충분히 표현하지 못할 수 있다. API의 기본 고도 보정 여부도 수집 시 명시해야 한다.
- 사용자 확인 요청: 동별 대표 위치에 재분석자료를 연결하여 여름 평균기온 및 33℃ 이상 일수를 산출할지, 기상청 관측자료 확보 후 진행할지. 확인 전 지표 변경이나 전체 지역 추정값 적용은 하지 않는다.

## 적용 결과

사용자는 ERA5-Land 대신 기상청 관측자료를 선택했다. 최근접 관측소 연결, 폭염일수로의 지표 변경, 노후주택 공식 지역 비율 비교도 승인했다. 기상청 공개 일자료와 223개 SGIS 노후주택 비율을 결합했으며 188개 지역에서 모든 지표가 유효하다. 요청 간격은 3초로 적용했다.
