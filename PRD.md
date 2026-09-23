# 기후안심지도 (ClimateGuard AI) — 통합 최종 PRD v2.0

- 프로젝트명: **기후안심지도**
- 부제: **SGIS 기반 AI 기후취약지역 진단·대응 서비스**
- 공모전: 제8회 SGIS 활용 우수사례 공모전
- MVP 재난 유형: **폭염**
- 대표 시연 지역: **부산광역시**
- 주요 데이터 출처: **SGIS OpenAPI 및 SGIS 제공 데이터**
- 제품 핵심 원칙: **위험도 계산은 통계/규칙 기반, 설명과 대응안 문장화는 AI 기반**

---

## 1. 제품 한 줄 정의

**SGIS 공간통계와 자연재해 데이터를 결합해 지역별 폭염 취약도를 지도에서 진단하고, 위험 원인·지역 비교·대응방안까지 AI가 설명하는 지도 기반 기후위험 의사결정 지원 서비스**

---

## 2. 문제 정의

기존 재난·기후 지도는 “어디가 위험한가”를 보여주는 데 집중되어 있다.  
하지만 실제 사용자는 **왜 위험한지, 어떤 특성이 영향을 주었는지, 다른 지역보다 얼마나 취약한지, 어떤 대응을 우선 검토해야 하는지**까지 알고 싶어 한다.

기후안심지도는 다음 흐름을 제공한다.

> **어디가 위험한가 → 왜 위험한가 → 다른 지역과 얼마나 차이가 나는가 → 무엇을 우선 검토할 수 있는가**

---

## 3. 공모전 관점의 목표

- SGIS 데이터가 핵심 분석 로직에 직접 사용될 것
- 행정구역 단위 위험도를 지도 위에 시각화할 것
- 지역 클릭 시 실제 통계 기반 상세분석을 제공할 것
- 위험도 수치뿐 아니라 주요 원인을 설명할 것
- AI는 계산된 데이터만 설명할 것
- 출처와 기준연도를 표시할 것
- 샘플 데이터와 실제 SGIS 데이터를 구분할 것
- 작품 설명서에 바로 넣을 수 있는 화면을 만들 것

---

## 4. 목표 사용자

### 일반 시민
- 내가 사는 지역의 폭염 취약도 확인
- 위험한 이유를 쉽게 이해

### 지방자치단체·공공기관
- 지역별 취약도 비교
- 고령인구·1인가구·노후주택 등 원인 확인
- 무더위쉼터·그늘막·방문관리 등 우선 검토지역 판단 참고

### 연구·교육 사용자
- SGIS 공간통계 기반 기후취약성 분석 사례 확인

---

## 5. MVP 범위

### 반드시 구현
- 대한민국 기본 지도
- 시도 → 시군구 → 읍면동 Drill-down
- 부산광역시 대표 데모
- 폭염 취약지역 분석
- Polygon Choropleth
- Hazard / Exposure / Vulnerability 계산
- Risk Score 0~100
- 위험등급 5단계
- 주요 위험요인 Top 3
- 지역 평균 비교
- 취약지역 Top 5
- 지도 클릭 ↔ 데이터보드 동기화
- AI 위험원인 설명
- AI 대응방안 제안
- 데이터 출처 / 기준연도 표시
- 실제 SGIS 모드 + Sample Mode

### 제외
- 로그인/회원가입
- 모바일 앱
- 실시간 알림
- 복잡한 권한관리
- 침수·산사태·태풍 실제 분석
- 과도한 클라우드 인프라

### 향후 확장
- 침수
- 산사태
- 태풍
- 복합재난
- 정책시설 위치 최적화
- 연도별 위험도 변화

---

## 6. 데이터 전략

MVP는 Sample 데이터보다 실제 SGIS API 연동을 우선한다. 개발 초기부터 부산광역시의 실제 SGIS 데이터를 수집·분석하며, Sample Mode는 API 장애 또는 테스트를 위한 fallback 용도로만 사용한다.

```text
SGIS OpenAPI / SGIS 제공자료
        ↓
Backend 수집
        ↓
행정구역 코드 정합성 검사
        ↓
CSV/JSON/DB 캐시
        ↓
전처리 및 정규화
        ↓
Risk Score 계산
        ↓
지도 시각화
        ↓
AI 설명
```

페이지를 열 때마다 SGIS API를 반복 호출하지 않고, 기준연도 데이터는 캐시 또는 로컬 DB에 저장해 사용한다.

---

## 7. 핵심 데이터

| 구분 | 지표 | 역할 | 기본 출처 |
|---|---|---|---|
| Hazard | 6~8월 평균기온 또는 폭염 강도 지표 | 폭염 자체 강도 | SGIS 자연재해 데이터 우선 |
| Hazard | 폭염특보/영향 이력 | 폭염 발생 이력 | SGIS 자연재해 |
| Exposure | 총인구 | 노출 인구 규모 | SGIS 인구통계 |
| Exposure | 인구밀도 | 공간적 노출 정도 | SGIS 인구통계/주요지표 |
| Vulnerability | 65세 이상 인구 비율 | 폭염 취약계층 | SGIS 인구통계 |
| Vulnerability | 1인가구 비율 | 돌봄·고립 취약성 | SGIS 가구통계 |
| Vulnerability | 노후주택/노후건물 비율 | 주거환경 취약성 | SGIS 주택/자연재해 통계 |

### 보완 원칙
6~8월 평균기온을 원하는 단위로 직접 반환하는 SGIS API가 확인되지 않을 경우:
1. SGIS 내 대체 폭염 강도 지표 사용
2. SGIS 제공자료 활용
3. 불가능할 경우 해당 1개 지표만 외부 공공데이터로 보완

핵심 공간통계와 취약성 분석은 SGIS 중심으로 유지한다.

---

## 8. 2차 확장 지표

필요 시 SGIS 사업체/폭염 관련 데이터에서 다음을 추가한다.

- 건설업 관련 사업체 수
- 택배업 관련 사업체 수
- 배달업 관련 사업체 수
- 관련 종사자 수

단, 야외근로 노출지표로 사용할 때는 명확한 정의와 근거를 문서화한다.

---

## 9. SGIS 인증 및 연동

환경변수:

```text
SGIS_SERVICE_ID=
SGIS_SECURITY_KEY=
SGIS_ACCESS_TOKEN=
```

키는 Frontend에 노출하지 않고 Backend에서만 사용한다.

권장 구조:

```text
backend/app/services/sgis/
  base.py
  auth.py
  client.py
  parser.py
  cache.py
  mock.py
```

- `auth.py`: 인증 및 토큰 관리
- `client.py`: SGIS 요청
- `parser.py`: SGIS 응답 → 내부 표준 모델 변환
- `cache.py`: API 응답 캐싱
- `mock.py`: Sample Mode

분석 모듈은 SGIS 원본 응답 형식에 직접 의존하지 않는다.

---

## 10. 데이터 모델

모든 결합의 기준키는 `region_code`.

### 지역
```text
region_code
region_name
parent_region_code
region_level
geometry
```

### 원천 데이터
```text
region_code
reference_year
avg_summer_temperature
heatwave_history_index
total_population
population_density
elderly_population
elderly_ratio
single_household_count
single_household_ratio
old_house_count
old_house_ratio
source
source_detail
is_sample
```

### 분석 결과
```text
region_code
hazard_score
exposure_score
vulnerability_score
risk_raw
risk_score
risk_level
data_completeness
top_factors
```

---

## 11. 파생지표

```text
elderly_ratio
= 65세 이상 인구 / 총인구 × 100

single_household_ratio
= 1인가구 수 / 전체 가구 수 × 100

old_house_ratio
= 노후주택 또는 노후건물 수 / 전체 주택 또는 건물 수 × 100
```

노후주택/노후건물 용어는 실제 SGIS 제공 단위에 맞춰 하나로 통일한다.

---

## 12. 위험도 모델

```text
Climate Risk = Hazard × Exposure × Vulnerability
```

### Hazard
```text
H =
w1 × normalized(폭염강도)
+
w2 × normalized(폭염특보/영향이력)
```

### Exposure
```text
E =
w3 × normalized(총인구)
+
w4 × normalized(인구밀도)
```

### Vulnerability
```text
V =
w5 × normalized(고령인구비율)
+
w6 × normalized(1인가구비율)
+
w7 × normalized(노후주택비율)
```

### 최종
```text
RiskRaw = H × E × V
RiskScore = MinMax(RiskRaw) × 100
```

Risk Score는 실제 재난 발생확률이 아니라 **선택한 비교지역 안에서의 상대적 폭염 취약성 지수**로 정의한다.

---

## 13. 기본 가중치

`config/risk_weights.yaml`

```yaml
hazard:
  indicators:
    heatwave_intensity: 0.6
    heatwave_history_index: 0.4

exposure:
  indicators:
    total_population: 0.4
    population_density: 0.6

vulnerability:
  indicators:
    elderly_ratio: 0.4
    single_household_ratio: 0.25
    old_house_ratio: 0.35
```

가중치는 초기 MVP 설정값이며 쉽게 변경 가능해야 한다.

---

## 14. 정규화

```text
normalized_x = (x - min) / (max - min)
```

비교 범위별 계산:
- 부산 시군구 비교 → 부산 내부 기준
- 해운대구 읍면동 비교 → 해운대구 내부 기준

---

## 15. 위험등급

| 점수 | 등급 |
|---|---|
| 0~20 | 매우 낮음 |
| 20~40 | 낮음 |
| 40~60 | 보통 |
| 60~80 | 높음 |
| 80~100 | 매우 높음 |

---

## 16. 위험요인 기여도

```text
indicator_contribution
= normalized_value × indicator_weight
```

상세 패널에는 Top 3를 노출한다.

---

## 17. 지역 평균 비교

예:

```text
우동 고령인구 비율       31.2%
부산광역시 평균          20.1%
차이                    +11.1%p
평균 대비                1.55배
```

AI는 이미 계산된 비교값만 사용한다.

---

## 18. 결측치 정책

0으로 일괄 대체하지 않는다.

```text
DROP
PARENT_AVERAGE
REGION_AVERAGE
NOT_AVAILABLE
ZERO_ONLY_IF_VALID
```

`data_completeness`를 계산하고 데이터 부족 지역은 Risk Score를 제공하지 않을 수 있다.

---

# 19. UI/UX 방향

사용자가 제공한 SGIS 업종통계지도 화면의 **정보 구조와 사용 흐름을 참고**한다.  
단, 그대로 복제하지 않고 프로젝트 전용 디자인으로 재구성한다.

핵심 구조:

> **왼쪽 Sidebar + 중앙 대형 지도 + 오른쪽 데이터보드**

디자인 키워드:
- 공공데이터 대시보드
- 지도 중심
- 공간분석
- 설명가능 AI
- 깔끔하고 신뢰감 있는 UI
- Desktop 우선

---

## 20. 전체 레이아웃

```text
┌──────────────────────────────────────────────────────────────┐
│ 기후안심지도     대한민국 > 부산광역시 > 해운대구          │
├──────────────┬───────────────────────────┬───────────────────┤
│ 재난 선택     │                           │ 데이터보드        │
│ 지역 선택     │                           │                   │
│ 레이어 선택   │          지도              │ Risk Score        │
│ 세부지표      │                           │ 위험요인          │
│ 분석하기      │                           │ 지역비교          │
│              │                           │ AI 분석           │
├──────────────┤                           │                   │
│ 취약지역 TOP5 │                           │                   │
└──────────────┴───────────────────────────┴───────────────────┘
```

---

## 21. 왼쪽 Sidebar

### 재난유형
```text
[폭염] 활성
[침수] 준비중
[산사태] 준비중
[태풍] 준비중
```

### 지역선택
```text
시/도       [부산광역시 ▼]
시/군/구    [해운대구 ▼]
읍/면/동    [전체 ▼]
```

### 레이어
```text
종합 위험도
Hazard
Exposure
Vulnerability
```

### 세부지표
```text
Hazard
- 폭염 강도
- 폭염특보/영향 이력

Exposure
- 총인구
- 인구밀도

Vulnerability
- 65세 이상 인구 비율
- 1인가구 비율
- 노후주택 비율
```

### 버튼
```text
[ 분석하기 ]
```

---

## 22. 중앙 지도

필수 기능:
- 대한민국 전체 지도
- 행정구역 Polygon
- 시도 → 시군구 → 읍면동 Drill-down
- Hover Tooltip
- 클릭 선택
- 선택지역 Highlight
- 자동 Zoom
- Choropleth
- Layer Switch
- Breadcrumb
- 범례
- 초기화

---

## 23. 지도 상단

```text
[시·도별 보기 ▼]  대한민국 > 부산광역시 > 해운대구
```

오른쪽:
```text
데이터 출처 SGIS
기준연도 20XX
```

실제 기능이 없는 공유/저장/즐겨찾기 버튼은 만들지 않는다.

---

## 24. 지도 Toolbar

```text
[데이터보드]
[레이어]
[범례]
[초기화]
[+]
[-]
```

모든 버튼은 실제 작동해야 한다.

---

## 25. 지도 범례

```text
폭염 취약도

05 매우 높음
04 높음
03 보통
02 낮음
01 매우 낮음
```

---

## 26. Tooltip

```text
우동

폭염 취약도
87.2 / 100

위험등급
매우 높음

클릭하여 상세분석
```

---

# 27. 데이터보드

탭:

```text
[위험현황] [원인분석] [대응방안]
```

### 위험현황
- 지역명
- Risk Score
- 위험등급
- 부산 평균 대비
- 상위 행정구역 평균 대비

### 원인분석
- 주요 위험요인 Top 3
- H/E/V 점수
- 지역 평균 비교 차트
- 지표 기여도 차트

### 대응방안
- AI 분석 요약
- 위험요인 기반 대응방안

---

## 28. 대응방안 Catalog

```text
고령인구 비율 높음
→ 무더위쉼터 접근성 점검
→ 방문건강관리 우선지역 검토
→ 폭염정보 전달 강화

1인가구 비율 높음
→ 안부확인 체계 검토
→ 연락망 강화

노후주택 비율 높음
→ 주거 열환경 개선 검토
→ 냉방·에너지 지원 검토

인구밀도 높음
→ 그늘막/쉼터/음수시설 배치 우선순위 검토
```

AI는 실제 Top Factor와 연결된 항목만 자연어로 정리한다.

---

## 29. 위험지역 Top 5

```text
1. A동 91.2
2. B동 88.4
3. C동 84.7
4. D동 81.5
5. E동 78.1
```

Ranking 클릭 → 지도 이동 → Polygon Highlight → 데이터보드 갱신.

---

# 30. AI 설계

AI 역할:
1. 위험도 결과 요약
2. 주요 위험 원인 설명
3. 지역 평균 비교 설명
4. 취약계층 설명
5. 대응방안 문장화

AI 금지:
- Risk Score 계산
- 없는 수치 생성
- 위험등급 임의 생성
- 시설 존재 여부 생성
- 정책 시행 여부 단정

---

## 31. AI 입력 예시

```json
{
  "region": "우동",
  "risk_type": "폭염",
  "risk_score": 87.2,
  "risk_level": "매우 높음",
  "comparison_region": "부산광역시",
  "top_factors": [
    {
      "name": "65세 이상 인구 비율",
      "value": 31.2,
      "unit": "%",
      "comparison_average": 20.1,
      "difference_pp": 11.1,
      "contribution": 0.32,
      "source": "SGIS"
    }
  ],
  "recommended_actions": [
    "무더위쉼터 접근성 점검",
    "고령층 방문관리 우선지역 검토"
  ]
}
```

---

## 32. AI 문체 규칙

허용:
- 검토할 수 있습니다.
- 우선순위가 높을 수 있습니다.
- 추가 점검이 필요합니다.

금지:
- 반드시 설치해야 합니다.
- 피해가 발생합니다.
- 무조건 위험합니다.

---

# 33. Backend

권장:
- Python
- FastAPI
- Pandas
- NumPy
- GeoPandas
- Pydantic

구조:

```text
backend/
  app/
    main.py
    api/routes/
    core/
    schemas/
    services/
      sgis/
      ai/
    analytics/
    repositories/
  tests/
```

---

# 34. Frontend

권장:
- Next.js
- TypeScript
- MapLibre GL JS
- Recharts
- Tailwind CSS 또는 CSS Modules

구조:

```text
frontend/
  src/
    app/
    components/
      sidebar/
      map/
      dashboard/
      charts/
      ai/
    services/
    hooks/
    types/
```

---

# 35. 지도 데이터

행정구역 경계는 SGIS에서 확보 가능한 경계 데이터를 우선 사용한다.

Frontend에는 GeoJSON 형태로 전달한다.

좌표계:
```text
EPSG:4326
```

필요 시 Backend/전처리 단계에서 좌표변환.

---

# 36. API 설계

```text
GET /api/regions
GET /api/regions/{region_code}
GET /api/regions/{region_code}/children

GET /api/risk
GET /api/risk/{region_code}
GET /api/risk/{region_code}/factors
GET /api/risk/{region_code}/comparison
GET /api/risk/ranking

GET /api/map/heatwave
GET /api/map/layer/{layer_name}

POST /api/ai/explain
```

---

# 37. 캐싱

```text
SGIS API
↓
수집 Script
↓
Raw Cache
↓
Processed Data
↓
서비스 API
```

초기 MVP는 CSV/JSON Cache로 충분하다. 이후 필요 시 SQLite 또는 PostgreSQL로 확장한다.

---

# 38. Data Mode 및 Sample Fallback

기본 실행모드는 실제 SGIS 연동입니다.

```text
DATA_MODE=sgis

SGIS API 인증 실패, 일시적 장애 또는 테스트가 필요한 경우에만 Sample Mode를 사용합니다.
DATA_MODE=sample 

data/
  sample/
    regions.geojson
    climate.csv
    population.csv
    household.csv
    housing.csv
  raw/
  processed/

Sample Mode는 기본 실행모드가 아니며, 실제 SGIS API를 사용할 수 없는 상황에서만 fallback 용도로 사용합니다.

실제 SGIS 연동이 정상적으로 가능한 경우에는 반드시 DATA_MODE=sgis를 사용합니다.

샘플 데이터를 사용하는 경우 UI에 시연용 데이터 또는 Sample Data 표시를 명확하게 노출하여 실제 SGIS 데이터와 혼동되지 않도록 합니다.

---

# 40. 테스트

- SGIS 인증
- SGIS 응답 Parser
- region_code Join
- Min-Max Scaling
- 동일값 Scaling
- Hazard 계산
- Exposure 계산
- Vulnerability 계산
- Risk Score
- 위험등급
- 결측치 처리
- 지역 평균 비교
- %p 계산
- 기여도
- Top 3 Factor
- Top 5 Ranking
- Sample/Actual 데이터 구분
- AI 입력에 없는 수치가 출력되지 않는지 확인

---

# 41. 공모전 제출용 폴더

```text
submission/
  report_outline.md
  sgis_usage_log.md
  data_sources.md
  evidence_checklist.md
  screenshots/
```

---

# 42. 작품 설명서 구조

```text
1. 추진배경 및 필요성
2. 추진과정
3. 추진내용
4. 추진성과
```

5페이지 이내 보고서를 작성하기 쉽게 개발 중부터 근거를 축적한다.

---

# 43. SGIS 활용 로그

```text
데이터명
SGIS 기능/콘텐츠
API 또는 제공자료
기준연도
사용 필드
전처리 방식
서비스 내 사용 위치
```

---

# 44. 최종 화면 캡처 목록

1. 대한민국 전체 지도
2. 부산광역시 위험도 지도
3. 시군구 위험도 지도
4. 읍면동 위험도 지도
5. 특정 지역 상세화면
6. H/E/V Layer 화면
7. 위험요인 Top 3
8. 지역 평균 비교
9. AI 설명
10. 대응방안
11. 데이터 출처 표시
12. SGIS 실제 데이터 사용 화면

---

# 45. 핵심 사용자 시나리오

```text
기후안심지도 접속
↓
대한민국 지도
↓
부산광역시 선택
↓
부산 시군구별 폭염 취약도 표시
↓
해운대구 선택
↓
읍면동별 취약도 표시
↓
특정 동 클릭
↓
Risk Score / 위험등급
↓
주요 위험요인 Top 3
↓
부산 또는 해운대구 평균 비교
↓
Hazard / Exposure / Vulnerability 확인
↓
AI 위험원인 설명
↓
지역 특성에 맞는 대응방안 확인
```

---

# 46. 개발 순서

1. 프로젝트 구조
2. SGIS 인증 연결
3. 부산광역시 실제 API 응답 확인
4. 행정구역 경계 실제 연결
5. 인구/가구/주택/자연재해 실제 데이터 수집
6. 실제 필드 기준 Parser 및 데이터 모델 확정
7. region_code 결합
8. 7개 핵심지표 생성
9. H/E/V 및 Risk Score 계산
10. Choropleth / Drill-down / Tooltip
11. 데이터보드 / Ranking / 지역비교
12. AI 설명 / 대응방안
13. Sample Mode fallback 구현
14. 공모전 UI 정리
15. 테스트 / 문서화 / 캡처

---

# 47. Definition of Done

- [ ] SGIS 인증키를 환경변수로 관리
- [ ] 실제 SGIS API 또는 실제 제공자료 연결
- [ ] Sample Mode 실행 가능
- [ ] 대한민국 → 부산 → 시군구 → 읍면동 탐색 가능
- [ ] 행정구역 Polygon 정상 렌더링
- [ ] 위험도 Choropleth 동작
- [ ] 7개 핵심지표 데이터 모델 지원
- [ ] H/E/V Python 계산
- [ ] Risk Score Python 계산
- [ ] Top 3 위험요인 계산
- [ ] Top 5 지역 Ranking 계산
- [ ] 지역 평균 비교 동작
- [ ] 지도와 데이터보드 동기화
- [ ] Layer Switch 동작
- [ ] AI가 계산된 데이터만 설명
- [ ] 대응방안이 위험요인과 연결
- [ ] 데이터 출처 표시
- [ ] 기준연도 표시
- [ ] Sample 데이터 명확히 표시
- [ ] README 작성
- [ ] docs 작성
- [ ] submission 폴더 작성
- [ ] 핵심 테스트 통과

---

# 48. Codex 최종 구현 지시

당신은 GIS, 공공데이터, 데이터 분석, AI 서비스 개발 경험이 있는 시니어 풀스택 개발자입니다.

위 PRD를 기준으로 **실제로 실행 가능한 SGIS 활용 우수사례 공모전 제출용 MVP**를 구현해주세요.

## 핵심 개발 원칙

1. 현재 작업 디렉터리를 먼저 분석합니다.
2. 기존 코드가 있다면 삭제하지 말고 재사용 가능한 기능을 유지합니다.
3. 먼저 SGIS 인증과 실제 데이터 접근 가능 여부를 확인합니다.
4. 실제 데이터가 확보되는 지표부터 구현합니다.
5. API에서 확인되지 않는 필드를 임의 생성하지 않습니다.
6. 실제 SGIS 데이터가 아닌 값은 반드시 Sample로 표시합니다.
7. SGIS 요청 코드는 분석 로직과 분리합니다.
8. 모든 데이터 Join은 `region_code` 중심으로 수행합니다.
9. 지도는 서비스의 핵심 인터페이스로 구현합니다.
10. UI는 제공된 SGIS 참고 이미지의 정보 구조를 참고하되 그대로 복제하지 않습니다.
11. 왼쪽 Sidebar + 중앙 지도 + 오른쪽 데이터보드 구조를 우선 구현합니다.
12. 폭염만 완성도 높게 구현합니다.
13. 위험도는 Python이 계산합니다.
14. LLM이 Risk Score 또는 위험등급을 생성하지 않습니다.
15. AI는 계산된 위험원인과 대응방안을 설명합니다.
16. 동작하지 않는 장식용 버튼은 만들지 않습니다.
17. 부산광역시 대표 시나리오를 실제로 시연 가능한 수준까지 완성합니다.
18. 실제 SGIS API 구조가 PRD 가정과 다르면 실제 API를 기준으로 Adapter를 수정하고 차이를 문서화합니다.
19. 구현 완료 후 Backend, Frontend, 지도, Risk 계산, AI Mock을 실제 실행 검증합니다.
20. 공모전 제출에 필요한 화면 캡처 포인트와 SGIS 활용 근거를 `submission/`에 정리합니다.

## 최종 응답에 포함

- 구현된 기능
- SGIS 연동 상태
- 실제 사용한 SGIS API/데이터
- 확보된 핵심 지표
- 확보하지 못한 지표와 처리방법
- 프로젝트 구조
- 실행방법
- Risk Score 계산방식
- 지도 기능
- 데이터보드 기능
- AI 기능
- 테스트 결과
- 공모전 보고서에 사용할 추천 캡처
- 남은 작업
- 다음 우선순위

---

# 최종 제품 정의

> **SGIS 데이터를 지도 위에 단순 표시하는 서비스가 아니라, 지역별 폭염 취약성을 정량화하고 왜 위험한지를 데이터로 설명하며, 어떤 대응을 우선 검토할 수 있는지 AI가 전달하는 지도 기반 기후취약지역 진단·대응 서비스**
