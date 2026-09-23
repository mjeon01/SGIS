# 테스트용 Sample

통계는 `scripts/build_sample.py`에서 `region_code`를 seed로 생성한 합성값입니다. 실제 지역의 인구·기온·위험도를 뜻하지 않습니다. 모든 레코드에 `is_sample=true`를 저장합니다.

`regions.geojson`의 행정경계만 실제 SGIS OpenAPI(2025년 경계)를 사용했습니다. 좌표계는 EPSG:4326이며 속성에 `geometry_source`와 `boundary_year`를 명시했습니다. 모든 행정동 통계·부모지역 집계는 합성입니다.

CSV는 PRD의 구분에 따라 기후·인구·가구·주택 자료를 검토하기 위한 파일이며 서버는 같은 값의 `observations.json`을 읽습니다. `metadata.json`은 출처와 연도를 표시합니다.

API 장애·키 미설정 환경의 테스트에만 사용하며, 기본 실행모드는 실제 SGIS입니다.

기후 필드 `heatwave_history_index`는 여름 폭염일수(일)의 합성값입니다. 부모지역은 합성 하위지역의 평균이므로 소수일 수 있으며 실제 관측자료가 아닙니다.
