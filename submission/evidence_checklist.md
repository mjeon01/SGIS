# 제출 근거 체크리스트

## 검증 완료

- [x] 인증키를 백엔드 환경변수에서 읽고 실제 SGIS 인증 성공
- [x] 실제 인구·가구 통계 연결 및 원본/처리 캐시 저장
- [x] 전국 경계 탐색, 부산 구·군/읍면동 탐색
- [x] 부산 223개 통계의 경계 코드 결합, 미일치 없음
- [x] 통계 2024 / 경계 2025 별도 표시
- [x] 7개 핵심지표를 지원하는 표준 모델
- [x] Python H/E/V·최종 점수·5등급·기여도·순위 엔진
- [x] 실제 모드의 관측 결측 표시 및 해당 지역 종합 점수·순위 제외
- [x] Sample 모드의 종합 점수·순위·원인·대응 시연
- [x] 지도·데이터보드·순위 선택 동기화
- [x] 레이어·범례·데이터보드 토글·확대·축소·초기화
- [x] 합산 비율, %p, 지역 평균 비교 차트
- [x] 규칙 기반 설명 및 Top Factor에 연결된 대응안
- [x] Sample 합성 통계 표시와 명시적인 장애 전환
- [x] 테스트·타입 검사·프로덕션 빌드
- [x] README·분석 기준·API·데이터 출처·보고서 초안

- [x] 실제 7지표가 유효한 구·군 14개·읍면동 173개 종합점수와 순위
- [x] 기상청 관측소명·연결 거리·유효 일수·출처 표시
- [x] 공개 요청 3초 간격 및 Retry-After 대기 검증

## 아직 주장할 수 없는 내용

- [ ] 위험도 모델의 실증적 예측 성능 또는 정책 효과
- [ ] 전국 실제 통계 분석
- [ ] 외부 LLM 분석 — 현재 범위는 사용자 요청에 따른 규칙 기반

## 추천 캡처

| 파일 | 용도 | 데이터 구분 |
| --- | --- | --- |
| 01-national-real.png | 전국 지도·부산 진입 | 실제 SGIS 경계 |
| 02-busan-real-exposure.png | 부산 인구 노출 지도·데이터 확보율 | 실제 SGIS 통계 |
| 03-haeundae-real.png | 구·군 → 읍면동 탐색 | 실제 SGIS 통계 |
| 04-dong-real-factors.png | 실제 지역 지표·상위지역 비교 | 실제 SGIS 통계 |
| 05-busan-sample-risk.png | 구·군 종합 위험도·Top 5 | **Sample** |
| 06-dong-sample-risk.png | 읍면동 종합 위험도·선택 동기화 | **Sample** |
| 07-sample-factors-comparison.png | Top 3·H/E/V·기여도 | **Sample** |
| 08-sample-rule-actions.png | 규칙 기반 설명·대응 Catalog | **Sample** |
| 09-sample-hazard-layer.png | Hazard 레이어 | **Sample** |
| 10-sample-vulnerability-layer.png | Vulnerability 레이어 | **Sample** |
| 11-data-sources-methodology.png | 출처·연도·모델 한계 공개 | 설명 화면 |
| 12-sinho-real-alignment.png | 신호동 실제 코드 결합 | 실제 SGIS 통계 |
| 13-sample-average-comparison-chart.png | 지역 평균 비교 차트·%p | **Sample** |
| 14-nationwide-boundary-exploration.png | 부산 외 전국 하위 경계 탐색 | 실제 SGIS 경계, 통계 분석 없음 |
| 15-busan-actual-risk.png | 실제 종합 위험도·Top 5 | SGIS + 기상청 관측자료 |
| 16-real-rule-actions.png | 실제 분석 규칙 설명 | SGIS + 기상청 관측자료 |
| 17-real-data-sources.png | 결합 출처·관측 한계 | 실제 자료 설명 |
| 18-real-incomplete-observations.png | 관측 결측에 따른 종합점수 미산출 | 실제 자료 |

파일은 `screenshots/`에 있습니다. Sample 화면에서 ‘시연용 합성 데이터’ 표시를 잘라내지 마세요.

## 최신 화면 (왼쪽 분석 패널)

기존 01~18번은 개편 전 기록이다. 현재 제출용 화면은 다음을 우선 사용한다.

| 파일 | 용도 |
| --- | --- |
| 19-busan-dong-priority-left.png | 부산 전체 읍면동과 우선 검토 순위 |
| 20-left-dong-analysis.png | 왼쪽 동별 상세, 지도 위치 강조 |
| 21-left-dong-factors.png | 왼쪽 원인 분석 |
| 22-left-dong-actions.png | 왼쪽 대응방안 |
| 23-left-missing-data.png | 관측 결측 표시 |
| 24-current-facilities-separate.png | 별도 2026년 시설 지도 |
| 25-current-shelter-detail.png | 쉼터 위치·이용대상·운영정보 |
| 26-current-shade-detail.png | 그늘막 위치·설치일 |

상세 도로지도 전환은 타일 요청을 대체한 자동 테스트로 검증했다. 2026년 시설자료는 별도 현재 시설 화면에 연결했다. 사용자 결정에 따라 2024년 취약도·인구와 수치 비교하지 않는다. 시설 유형·구군 필터와 지도 마커·왼쪽 상세 선택을 검증했다.

## 축척·기온·현장 검토 흐름

| 파일 | 용도 |
| --- | --- |
| 27-zoomed-out-district-boundaries.png | 축소 시 구·군 경계·이름, 유지되는 동별 순위 |
| 28-zoomed-in-dong-boundaries.png | 확대 시 읍·면·동 경계·이름 |
| 29-daily-maximum-minimum-temperature.png | 최고·최저 기온 그래프, 기간 극값·발생일·폭염일수 |
| 36-automatic-regional-report.png | 부산 전체 읍면동 기준 자동 분석보고서 |
| 31-review-to-current-facilities.png | 검토 동의 별도 현재 시설 확인 |

입력 없이 생성한 보고서의 Markdown 저장과 해당 동 현재 시설 화면 왕복을 검증한다. 최고·최저는 표시용 보완자료이며 기존 점수 원본 스냅샷은 변경하지 않는다.


## 현재 기상 및 시설 운영조건

| 화면 | 검증 내용 |
| --- | --- |
| 34-current-weather-recent.png | 2026년 최근 30일, 관측소별 마지막 관측일 |
| 35-current-weather-summer.png | 2026년 6~8월 최고·최저 그래프와 기간 극값 |
| 36-automatic-regional-report.png | 입력 양식을 제거한 자동 지역 분석보고서 |



## 동네 분석의 현재 기상

- `37-neighborhood-current-weather-summary.png`: 위험현황 상단 최신 최고·최저 요약과 2024년 분석 자료의 구분.
- `38-neighborhood-current-weather-detail.png`: 같은 동네 분석 패널에서 최근 30일·올여름 관측기록 확인.
- 지역 변경에 따라 현재 위치 기준 최근접 관측소가 바뀌는지, Sample에 실제 동별 관측값이 섞이지 않는지 확인한다.


`39-current-facilities-without-walking-overlay.png`: 보행 접근성 선·거리 선택을 제거한 현재 시설 화면. 쉼터 유형·이용대상·요일·시간 필터와 시설 선택은 계속 검증한다.
