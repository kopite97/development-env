# Plan: 프로젝트 목록·상세 캐시 재사용

Status: `completed`
Date: 2026-09-16
Source: [TODO 02](TODO/02-project-cache.md)
Baseline: [PLAN-0021 결과](../reviews/plan0021-query-baseline/readme.md)
Reviewed: 2026-09-17 · [PLAN-0023](PLAN-0023-widget-dashboard-api-refactoring.md)·[PLAN-0024](PLAN-0024-dashboard-widget-interactions.md) 완료 구현 반영

## Goal

변경 없는 프로젝트 목록↔상세 이동에서 API 재조회를 줄이고 누적 페이지와 스크롤을 복원한다. 기존 API·세션별 메모리 저장소를 사용하며 데이터 변경과 오류 복구에 필요한 재검증은 유지한다.

## Scope

- In scope:
  - 프로젝트 목록·상세의 선택적 캐시 정책, 화면 이탈 시 처리, 조회 조건별 페이지·스크롤 상태.
  - 공통 Query의 최소 확장과 프로젝트 저장소 적용, 정합성 회귀 검증·실제 API 재측정.
  - 신규 기능이 재사용할 세션별 공통 조회 생성 경로, 정책 필수 선언, 우회 검사와 개발 지침 연결.
  - 같은 ProjectStore를 사용하는 개요 위젯의 목록·상세 재사용, 공유 소비자 수명 및 기존 위젯 상호작용 회귀 검증.
- Out of scope:
  - 카테고리 refresh·선택 데이터 adapter 통합(TODO 03), TaskStore·DashboardStore의 캐시 정책 변경. Home 안의 ProjectStore 조회에는 이번 프로젝트 정책을 적용한다.
  - 백엔드/API/Redis 변경, TanStack Query 전환, 새 의존성, 영구 브라우저 저장, UI 재설계.
  - 인증 확인 생략, 저장·생성 replay·충돌 복구의 강제 재조회 생략.

## Changes

### 위젯 리팩토링 이후의 적용 경계

- [WidgetDataContent](../../src/pages/home/WidgetDataContent.tsx)의 개요 통계는 Widget v1 data 응답이며 프로젝트 행은 별도 ProjectStore 조회다. 두 응답은 단일 snapshot이 아니다. 프로젝트 캐시 적중을 Widget 통계 검증 완료로 취급하지 않고 각 영역의 로딩·오류·빈 상태를 유지한다.
- 개요의 all/category/uncategorized 선택은 `list({ category, status: 'active', query: '' })`, 특정 project 선택은 `detail(id)`를 공유한다. 실제 목록 조회 limit은 20이고 Widget limit은 표시 개수(기본 3)다. 표시 limit이 다른 위젯에 별도 프로젝트 캐시를 만들지 않으며 active/all, Category, query, ID가 다른 조회는 합치지 않는다. Home URL 필터는 저장된 Widget selection을 덮어쓰지 않는다.
- Task 위젯은 TaskSnapshot revision으로 Task PATCH를 수행하고 [PrivateWorkspace](../../src/app/auth/PrivateWorkspace.tsx)의 기존 연결로 Task·overview·Widget data를 갱신한다. 프로젝트 변경의 기존 연관 무효화도 유지한다. 캐시 재사용을 이유로 필요한 재검증을 생략하거나 무효화 범위를 최적화하지 않는다.
- Dashboard v3의 `layoutRevision`, Widget v1의 `revision`/data `configRevision`, Project·Task revision은 각각 유지한다. Project 캐시 수명·포커스·회수는 Widget 설정 PUT이나 Dashboard 배치 PUT을 발생시키지 않는다. DashboardStore를 신규 프로젝트 조회 관리자에 함께 이관하지 않는다.

### 장기 적용 구조

- 상세 기준은 [서버 조회 정책 지침](../guides/query-policy.md)을 따른다. 현재 모듈이 구현된 것으로 간주하지 않으며 이 PLAN 완료 시 실제 공개 API·검사 명령을 지침에 반영한다.
- `shared/http`에 기능 비의존적인 조회 관리/생성 모듈을 두고 `PrivateWorkspace`가 세션·작업실 세대당 하나를 생성해 저장소에 주입한다. 기존 transport·freshness를 재사용하고 글로벌 singleton이나 HTTP 전체 응답 캐시는 만들지 않는다.
- 공통 모듈은 재사용/강제 조회·취소·회수·세션 정리를 보장한다. 기능은 키·파서·정책 프로필·변경 영향 대상을 선언한다. 같은 키의 상충 정의는 거부하고 무효화의 업무상 정확성은 기능 테스트로 검증한다.
- 신규 관리 조회는 정책 선택을 타입으로 강제한다. 프로젝트에만 30초/5분 프로필을 적용하며 다른 기능의 시간은 별도 선언한다. 인증·mutation은 읽기 캐시 대상에서 제외한다.
- 기존 미전환 호출은 구체적인 위치·이유·후속 TODO를 기록한 예외 목록으로 유지한다. 새 기능의 우회는 자동 검사로 막고 기존 기능은 후속 PLAN에서 순차 전환한다.
- 공통 기반은 프로젝트 시범과 필수 정책·검사에 필요한 범위로 제한한다. 다른 저장소의 일괄 전환이나 범용 의존성 그래프는 추가하지 않는다. `dashboardProjectOptions` 등 adapter의 직접 `load()`는 강제 조회 의미를 보존하고 TODO 03 예외로 추적한다.

### 적용 정책

아래 시간은 이번 시범의 제안값이며 운영 측정으로 도출한 값은 아니다. 구현 중 변경이 필요하면 이유와 검증 결과를 이 PLAN에 기록한다.

| 항목        | 정책                                                                                                                                    |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 재사용 기한 | 검증된 성공 응답부터 30초. 프로젝트 목록·상세에만 적용하며 다른 Query의 기본 동작 유지                                                  |
| 재검증 시점 | 재진입·조회 요청 시 만료 확인, 표시 중인 프로젝트는 창 포커스 복귀 시 만료 확인. 주기 polling은 추가하지 않음                           |
| 강제 조회   | 명시적 새로고침·invalidate·변경/충돌 복구는 30초를 무시. 기존 직접 load()와 추가 페이지 조회의 강제 실행 의미 유지                      |
| 캐시 키     | 세션/작업실 경계 안에서 category·status·query·limit별 목록, ID별 상세. active/all과 다른 필터를 혼합하지 않음                           |
| 페이지      | 누적 항목·cursor·total을 함께 보존. 추가 페이지 성공으로 오래된 첫 페이지의 유효 시간을 연장하지 않음                                   |
| 만료·변경   | 목록은 첫 페이지부터 재검증하고 이전 cursor와 새 결과를 합치지 않음. 오류 시 재시도 제공, 오래된 상세를 검증 완료로 취급하지 않음       |
| 미사용 정리 | 마지막 실제 사용 이후 5분간 미사용인 프로젝트 데이터·스크롤을 회수. 관찰/진행 중/편집에 필요한 데이터는 보호하고 세션 종료 시 즉시 정리 |
| 외부 변경   | 기존 revision 감지·늦은 응답 차단 유지. 새 응답이나 재검증 전 외부 변경의 즉시 감지는 보장하지 않음                                     |

### Session 0 — 현재 버전 기준 재측정

- [x] [측정 도구](../../tools/query-baseline.mjs)와 [환경 실행 도구](../../tools/query-baseline-environment.mjs)를 현재 Widget v1·Dashboard v3 계약에 맞춰 확인했다. disposable 데이터에서 Home 초기화와 selection·limit·배치를 고정했고 초기화 mutation은 이동 측정에서 제외했다. 미초기화/빈 Home의 GET이 기본 위젯을 생성하지 않는 회귀는 [Dashboard v3 회귀](../../tests/dashboard/v3.spec.ts)에서 확인했다.
- [x] `homeReady`를 현재 표시 항목·Widget 준비 상태에 맞추고 프로젝트 행 locator를 목록 화면/개요 위젯별로 한정했다. 예전 기본 위젯 데이터나 전역 행 개수에 의존하지 않도록 현재 준비 조건을 사용했다.
- [x] production build·실제 API에서 주요 시나리오를 warmup 1회 후 10회 측정했다. 구현 전 표본을 별도로 확보하지 못했으므로 PLAN-0021은 역사적 참고값으로만 보존하고, 현재 표본과 한계는 [PLAN-0022 측정 기록](../reviews/plan0022-project-query-cache/readme.md)에 명시했다.
- [x] 요청을 Project 목록/상세, Category adapter, Widget data, Dashboard layout, 인증/기타로 분류하고 동일 조건 재방문·다른 selection·만료·mutation 이후 방문을 원자료에서 분리했다.

### Session 1 — 조회 수명·재사용 경계

- [x] 세션별 공통 조회 생성 경로와 필수 정책 타입을 구현하고 프로젝트에 연결했다. 포커스 이벤트·종료 정리는 [PrivateWorkspace](../../src/app/auth/PrivateWorkspace.tsx)에서 한 번 관리하며, ProjectStore는 주입받은 공통 인터페이스를 사용한다.
- [x] [Query](../../src/shared/http/query.ts)와 [ProjectStore](../../src/features/projects/apiStore.ts)에 재사용 조회와 강제 조회를 구분하는 최소 설계를 적용했다. 진행 중 동일 요청의 중복 방지도 유지했다.
- [x] 타임스탬프·만료·invalidate·취소·seed 상태 전이를 단위 테스트로 검증했다. seed와 mutation 결과는 stale 상태로 남겨 상세 GET 검증 완료와 구분한다.
- [x] 미사용 정리는 adapter가 보유한 Query 참조를 유지한 채 5분 이후 데이터·entities·스크롤을 회수하도록 구현했다. 동일 키 Query를 중복 생성하지 않는 경로와 idle 회수를 단위 테스트로 확인했다.
- [x] 같은 조건의 여러 소비자가 Query를 공유하고 한 소비자 이탈이 다른 소비자의 데이터·요청을 폐기하지 않는지 단위 테스트와 Dashboard v3 회귀에서 확인했다. 마지막 사용 시점·포커스 재검증·활성 소비자 수를 QueryManager가 관리한다.

### Session 2 — 목록·상세 왕복과 복원

- [x] [ProjectReads](../../src/features/projects/ProjectReads.tsx)의 화면 이탈 시 무조건 invalidate를 제거했다. 마지막 소비자의 진행 중 요청 취소와 완료 데이터 폐기를 분리했다.
- [x] 같은 조건의 유효한 목록을 추가 페이지까지 재사용하고, 페이지 응답은 첫 페이지 freshness를 연장하지 않도록 했다. cursor·epoch·abort 검사로 늦은 응답이 새 목록에 합쳐지지 않는다.
- [x] 상세의 목록 버튼과 브라우저 이동에서 같은 목록 Query를 복원한다. [상세 레이아웃](../../src/features/projects/ProjectDetailLayout.tsx)과 라우팅의 현재 동작을 목록↔상세 Playwright 회귀로 확인했다.
- [x] 목록 DOM 복원 후 스크롤을 한 번 복원한다. 필터 키별 저장·삭제와 StrictMode 이중 마운트 처리를 구현했고, 저장 위치가 없으면 기본 위치를 사용한다.
- [x] 개요 위젯→프로젝트 상세→복귀와 목록→상세→목록을 별도 경로로 처리한다. Home 조회는 목록 스크롤을 저장하지 않으며, 공유 ProjectStore Query의 누적 페이지와 소비자 수명을 유지한다.
- [x] 기존 목록의 명시적 새로고침 버튼과 오류 재시도 경로를 유지하고, 정상 조회·로딩·오류 UI를 구분했다.

### Session 3 — 변경·오류·격리 회귀 검증

- [x] 직접 Query 생성·공통 transport 밖의 네트워크 접근·저수준 모듈 우회를 검사하는 `check:queries`와 기존 예외 목록을 구현했다. `prebuild`에 연결해 `npm run build`에서 실행한다.
- [x] 최소 Query 정의로 정책 누락, 같은 키 공유, 소비자 격리, invalidate·회수·포커스 재검증을 검증했다. 실제 새 업무 기능은 추가하지 않았다.
- [x] 생성/수정/분류 변경 후 기존 무효화와 집계·연결 데이터 반영을 ProjectStore 테스트·실제 저장 시나리오에서 보존했다.
- [x] replay·revision 충돌·INVALID_CURSOR·404·네트워크 오류의 기존 최신 데이터 확인·명시적 재시도 경로를 유지했고, ProjectStore 회귀와 전체 단위 테스트로 확인했다.
- [x] 미검증·만료·오류 상세는 `verified`가 아니면 편집 결과 영역을 확정 상태로 승격하지 않도록 기존 UI 계약을 유지했다.
- [x] 계정/작업실/세션 세대 전환·로그아웃 경계에서 ProjectStore·QueryManager·타이머·스크롤을 정리하고 늦은 응답의 epoch/generation 차단을 유지했다.
- [x] 개요의 selection·표시 limit·특정 프로젝트 조회를 ProjectStore list/detail 키로 분리했다. Dashboard v3의 직접 행 표시·상세 이동과 실제 API 측정에서 공유 Query 경계를 확인했다.
- [x] Task 위젯 드래그·상태 select PATCH, Project 저장 후 개요 갱신, Widget/Dashboard revision 독립성을 Dashboard v3 회귀와 실제 API 검증에서 확인했다.

### Session 4 — 기준 비교·완료 기록

- [x] Session 0의 측정 도구로 현재 구현 결과를 수집했다. 목록 행·누적 페이지·스크롤 보존을 기대값으로 명시했고 원자료를 덮어쓰지 않았다.
- [x] 같은 fixture·production build·실제 API 환경에서 warmup 1회 후 주요 시나리오를 10회 측정했다. 유효 기간 재방문과 mutation 이후 재방문, Category adapter 강제 조회를 분리했다.
- [x] API 수·응답량·표시 시간의 중앙값/범위를 [측정 기록](../reviews/plan0022-project-query-cache/readme.md)에 기록하고 PLAN·정식 목록·TODO 상태를 갱신한다. TODO 03 구현은 시작하지 않았다.
- [x] 개발 지침에 실제 모듈·정책 정의·검증 명령·예외 목록을 연결했다. 미전환 기능은 명시적 예외와 후속 TODO로 구분했다.

## Validation

### Static

- 구현·문서·측정 산출물의 링크·포맷·diff를 함께 검증한다. 구현 전 표본을 확보하지 못한 한계는 측정 기록에 남긴다.
- `npm run build`, `npm test`, `npm run check:boundaries`, `npm run check:docs`, `git diff --check`.
- `npm run check:queries` 및 위반 fixture 검사. `npm run build`가 검사 실패 시 중단되는지 확인한다.
- 변경 파일의 포맷 및 측정 도구 구문 검사. 기존 전체 포맷 문제는 관련 없는 수정 없이 구분해 기록한다.
- 시간 제어 단위 테스트로 30초 경계·5분 회수·seed/force/invalidate·소비자 공유·늦은 페이지 응답을 검증한다. 다른 기능의 Query 기본 동작도 회귀 확인한다.

### Runtime

| 비교 시나리오                 | 기준 → 완료 목표                                                                                                                               |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 유효 기간 내 상세→동일 목록   | 현재 기준 재측정 → 프로젝트 목록 GET 0, 누적 25개 보존, 복귀 스크롤 오차 5px 이내(같은 viewport)                                               |
| 검증된 상세 재방문            | 현재 기준 재측정 → 프로젝트 상세 GET 0. 카테고리·adapter 강제 조회는 별도 집계·이유 기록                                                       |
| 홈에서 첫 프로젝트 목록       | 개요에서 동일 조건의 조회가 성공했고 유효한 경우 Project 목록 추가 GET 0. 빈 Home·다른 selection·만료는 별도 시나리오                          |
| 홈·작업 보드 재방문           | Session 0 대비 비대상 조회의 불필요한 증가 없음. Widget/Dashboard와 Project 요청을 구분하고 필요한 만료·mutation·adapter 강제 조회는 별도 기록 |
| 같은 조건의 여러 개요 위젯    | 진행 중 Project 조회 공유, 표시 limit별 행 수 유지, 한 위젯 이탈로 다른 소비자의 데이터/요청 폐기 없음                                         |
| 개요 표시 중 만료·포커스 복귀 | 해당 Project Query 재검증, 공유 요청 중복 없음. Widget 통계와 Project 행의 상태를 독립적으로 처리                                              |
| 기한 만료·명시적 새로고침     | 서버 재조회, 목록 첫 페이지부터 재구성, 이후 추가 페이지 정상 작동                                                                             |
| 저장·분류/보관 변경 후 방문   | 최신 내용·집계·선택 데이터 반영; 필요한 재조회 수는 별도 기록                                                                                  |

- 프로젝트·인증·카테고리·freshness 관련 브라우저 회귀와 위 왕복/필터/스크롤/실패 경로를 실행한다. 렌더링 위치 검증은 데스크톱과 좁은 viewport에서 확인한다.
- [Dashboard v3 회귀](../../tests/dashboard/v3.spec.ts)와 기존 [실제 Dashboard 검증](../../tests/real/dashboard.mjs)을 재사용·확장한다. `node tests/real/run.mjs --dashboard=all` 및 `--nginx`에서 실제 Task PATCH·개요 행·설정/배치 revision 보존을 확인한다. 성능 표본은 production build의 before/after 측정으로 따로 수집한다. 사용자 실행 중 업무 데이터에는 검증용 mutation을 보내지 않는다.
- 다른 브라우저의 합성 데이터 변경 후 만료/포커스 재검증, 세션 교체와 지연 응답을 검증한다. mock은 결정적인 오류·시간 제어용이며 실제 서버 성능 결과와 분리한다.
- 시간은 같은 조건에서 비교하며 유의미한 악화가 있으면 원인을 해소하거나 제한을 명시한다. Render 성능·운영 p95는 로컬 결과로 주장하지 않는다.

## Completion Criteria

- [x] 기한 내 목록·상세 재조회 감소와 누적 페이지·스크롤 복원 목표를 달성했다. 유효한 상세 재진입의 Project 상세 GET은 0건이며 별도 Category adapter GET은 원자료에 분리했다.
- [x] Widget 리팩토링 이후 현재 기준을 확보하고, 개요의 공유 Project 조회·Task 상태 변경·Dashboard 초기화 및 revision 회귀를 통과했다. 구현 전 표본 부재와 PLAN-0021의 역사적 성격은 측정 기록에 명시했다.
- [x] 만료·회수·명시적 재조회·변경·충돌·세션 격리와 관련 회귀 검증을 통과했다.
- [x] 정적 검증과 실제 API 반복 측정을 통과하고 결과·한계를 [측정 기록](../reviews/plan0022-project-query-cache/readme.md)에 기록했다.
- [x] PLAN·정식 목록·TODO에 결과 링크와 상태를 반영했다.
- [x] 신규 조회가 사용하는 공통 생성 API·정책 타입·빌드 검사·개발 지침을 연결했고 미전환 기능의 명시적 예외와 후속 작업을 추적했다.

## Execution Record

- 2026-09-16: 이동된 `docs/plans/TODO/02-project-cache.md`와 PLAN-0021 측정 결과를 기준으로 `proposed` 등록. 계획 작성만 완료했으며 구현·런타임 검증은 미착수다.
- 2026-09-16: 장기 적용 검토를 반영해 세션별 공통 생성 모듈·필수 정책·빌드 검사·개발 지침을 범위에 추가했다. 전체 기능 일괄 전환은 제외하며 상태는 `proposed`를 유지한다.
- 2026-09-17: PLAN-0023·0024 완료 구현을 검토해 개요의 공유 ProjectStore 적용 경계, 구현 전 현재 기준 재측정, 다중 소비자·선택/표시 limit·Task mutation·독립 revision 검증을 보완했다. 문서 수정만 수행했으며 구현·재측정은 미착수, 상태는 `proposed`다.
- 2026-09-17: 사용자가 보완된 계획의 실행을 승인해 `active`로 전환했다. 현재 버전 기준 측정과 프로젝트 캐시 구현을 시작한다.
- 2026-09-17: `QueryManager`·ProjectStore list/detail 정책·PrivateWorkspace 수명/포커스 연결·목록 스크롤 복원을 구현하고, 직접 Query 검사와 예외 문서를 연결했다.
- 2026-09-17: Widget v1·Dashboard v3 계약의 disposable 실제 API를 warmup 1회 후 10회 측정했다. 목록 복귀는 API 0건·25행·1771px 스크롤 복원을 기록했고, 상세 재진입의 1건은 Project 상세가 아닌 Category adapter GET으로 분류했다. [측정 및 검증 기록](../reviews/plan0022-project-query-cache/readme.md)
- 2026-09-17: 단위 37개 파일 216개 테스트, Dashboard v3 9개 브라우저 회귀, 프로젝트 목록↔상세 5개 회귀, build/boundaries/docs/query 정적 검사를 통과했다. 프로젝트 전체 E2E는 29/32로, 나머지 3건은 PLAN-0023 Dashboard v3 fixture와 기존 session fixture 호환성 문제로 별도 기록했다.
