# Plan: Task 위젯 상태 변경과 프로젝트 개요 목록 표시

Status: `completed`
Date: 2026-09-17

## Goal

Home의 Task 위젯에서 작업보드 페이지와 동일하게 카드를 할 일·진행 중·완료 열로 드래그하거나 상태 드롭다운으로 이동할 수 있게 한다. 프로젝트 개요 위젯에는 프로젝트 이름과 정보를 즉시 표시하고 각 프로젝트의 상세 페이지로 이동할 수 있게 한다.

## Scope

- In scope:
  - 인증된 Home의 Task 드래그·상태 드롭다운, 서버 저장·실패 복구·연관 화면 갱신.
  - 프로젝트 개요의 실제 프로젝트 목록, 저장된 선택 조건·표시 개수 적용, 로딩·오류·빈 상태.
  - 기존 공통 컴포넌트·Store 재사용과 해당 기능의 회귀·실제 API 검증.
- Out of scope:
  - 백엔드 API 변경, Dashboard 배치·Widget 설정 저장 방식 변경.
  - 새로운 Task 생성/삭제 메뉴, Task 카드 제목 클릭 동작 변경, 프로젝트 편집 기능 추가.
  - PLAN-0022 캐시 최적화와 다른 종류 위젯 개편.

## Changes

### 1. 현재 구현과 변경 근거

| 대상          | 현재 구현                                                                                                                                                                          | 변경 방향                                                                      |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Task 위젯     | [WidgetDataContent](../../src/pages/home/WidgetDataContent.tsx)의 `BoardData`가 `TaskBoard`에 `readOnly`와 빈 `onTaskChange`를 전달                                                | 공통 보드의 드래그·상태 select를 실제 Task mutation에 연결                     |
| 작업보드      | [TaskBoard](../../src/features/tasks/TaskBoard.tsx)는 두 조작을 동일한 콜백으로 전달. [ApiTaskManager](../../src/features/tasks/ApiTaskManager.tsx)는 revision·pending·실패를 처리 | 상태 변경 로직을 Task 기능 내부에서 재사용하도록 정리하고 페이지와 위젯에 적용 |
| 프로젝트 개요 | Widget overview의 `data.projects`는 분야별 active/archived 집계이며 프로젝트 엔터티 목록이 아님. 현재 통계와 ‘프로젝트 확인’ 버튼만 표시                                           | 통계를 유지하고 기존 Project API로 목록을 보충                                 |
| 조합          | [ServerDashboardHome](../../src/pages/ServerDashboardHome.tsx)에 TaskStore·ProjectStore가 이미 전달됨                                                                              | pages에서 각 기능을 조합하고 feature 간 새로운 직접 의존을 만들지 않음         |

여기서 ‘드롭다운’은 작업 카드 하단의 기존 상태 선택 메뉴를 뜻한다. 현재 소스와 로컬 백엔드 `LocalWidgetDataHandlers`를 기준으로 작성했다. 구현 시작 시 실행 중인 OpenAPI 및 Task snapshot의 revision 계약을 재확인한다. [PLAN-0023](PLAN-0023-widget-dashboard-api-refactoring.md)의 읽기 전용 Task와 버튼 중심 overview를 이 계획 범위에서 개선하며, 완료된 과거 계획의 상태는 변경하지 않는다.

### 2. Task 상태 변경

1. Widget board 응답의 Task를 타입 검증해 표시 모델과 mutation용 ID/revision을 보존한다. 표시 모델에 revision이 없다는 이유로 임의 값을 만들거나, 작업보드 방문 전에는 비어 있을 수 있는 `TaskStore.entities`에만 의존하지 않는다. 필요 시 사용자 조작 시점의 detail GET으로 확인하며 카드마다 선행 GET을 추가하지 않는다.
2. `TaskStore.mutate('patch', { id, body: { revision, status } })`를 사용한다. Widget revision과 Task revision을 구분하고 상태 변경으로 Widget PUT이나 Dashboard PUT을 호출하지 않는다.
3. 공통 상태 변경 컨트롤러/훅을 Task 기능 안에 두어 작업보드의 동일 상태 무시, Task별 중복 요청 차단, 오류 표시, CSRF 복구와 세션 종료 처리를 재사용한다. 각 카드의 pending 중에는 드래그와 select를 비활성화한다. 여러 위젯에 같은 Task가 있을 때에도 Store의 중복 mutation 방어를 유지한다.
4. 저장 성공 후 기존 `tasks.onInvalidate` 연결로 작업보드·board 위젯·overview 통계를 다시 읽는다. 서버 응답 확인 전에 영구 이동으로 표시하지 않고, 실패하면 기존 위치/선택값과 재시도 안내를 유지한다. 409나 결과가 불확실한 네트워크 실패는 최신 상태를 확인하고 자동 덮어쓰기 재시도를 하지 않는다.
5. Widget limit·서버 정렬을 유지한다. 갱신 결과에 따라 제한된 목록에서 카드가 빠지거나 다른 카드가 나타날 수 있으며, 전체 열 통계와 표시된 카드 수를 혼동하지 않는다.
6. Task drag MIME과 이벤트 전파 차단을 유지해 위젯 자체 정렬과 충돌하지 않게 한다. Dashboard 배치 편집 중에는 Task 조작을 잠그고, 일반 모드에서는 빈 열에도 드롭할 수 있게 한다. 모바일·키보드에서는 동일한 상태 select로 조작한다.

### 3. 프로젝트 개요 목록

1. ‘프로젝트 확인’ 단독 버튼을 프로젝트 행 목록으로 대체한다. 이름·기술 스택·진행률을 기존 [ProjectOverview](../../src/features/projects/ProjectOverview.tsx) 표현과 [projectPresentation](../../src/features/projects/apiModel.ts) 변환으로 재사용한다. 통계가 중복되지 않도록 필요한 경우 프로젝트 행 표시만 작은 컴포넌트로 분리한다. 행 클릭은 `/projects/{id}`로 이동한다.
2. 저장된 Widget selection만 조회 범위로 사용한다. `all/category/uncategorized`는 [ProjectStore](../../src/features/projects/apiStore.ts)의 `list({ category, status: 'active', query: '' })`를 사용한다. 특정 project는 `detail(id)`를 사용하며 보관된 프로젝트도 선택되어 있다면 표시하고 보관 상태를 안내한다. 사라진 Category/Project를 전체 목록으로 대체하지 않는다.
3. 목록은 저장된 `widget.limit`까지 표시하고 미설정이면 UI 기본 3개를 사용한다. 이는 프론트 표시 정책이며 서버 overview 집계 limit로 간주하지 않는다. 현재 ProjectStore 첫 페이지는 최대 20개여서 Widget 허용 limit 1–20을 충족한다. 서버 정렬을 그대로 사용하고 추가 프로젝트는 위젯 헤더의 목록 이동으로 확인한다.
4. 통계는 기존 Widget data를 유지한다. 목록은 ‘진행 중인 프로젝트’로 범위를 명확히 하고 보관 집계와 구분한다. overview 통계와 별도 Project 요청이 단일 서버 snapshot이 아님을 고려하여 각 영역의 로딩·갱신 실패를 처리한다. 목록 요청 실패를 ‘프로젝트 없음’으로 표시하지 않는다.
5. overview envelope가 `empty`일 때도 종류별 빈 상태를 표시하고, 보관 프로젝트만 있는 경우에는 통계와 ‘진행 중인 프로젝트가 없어요’를 함께 보여준다. unavailable/reference 오류 시 관련 목록 요청과 조작을 막는다.
6. 기존 세션별 Query/transport와 ProjectStore 목록·detail을 공유한다. 조회 키는 category/status/query 또는 project ID이고, 같은 조건의 위젯마다 중복 Store나 로컬 캐시를 만들지 않는다. 표시 limit은 기존 20개 조회 결과에서 적용한다. 프로젝트 생성·수정·보관·분류 변경 시 기존 무효화 연결로 목록과 통계를 갱신하고, 로그아웃·계정 전환 이후 늦은 응답을 차단한다. [조회 정책](../guides/query-policy.md)을 준수하며 임의 TTL을 추가하지 않는다.

### 4. 실행 순서

1. Task snapshot·Project 목록 API와 현재 회귀 fixture를 확인하고, 두 UI 문제를 기존 Dashboard 테스트에서 재현한다.
2. Task 상태 변경 로직을 재사용 가능한 형태로 정리하고 Widget board에 연결한다.
3. overview에 ProjectStore 조회와 프로젝트 행 표시를 연결한다.
4. 무효화·충돌·세션·배치 드래그 간섭 및 반응형 동작을 검증한다.
5. 검증 증거와 현재 아키텍처 문서를 갱신하고 완료 기준 충족 후 실행 목록 상태를 변경한다.

PLAN-0022가 아직 제안 상태여도 현재 Query/Store로 구현할 수 있다. 앞선 계획을 자동 실행하거나 상태를 변경하지 않으며, 이 계획은 별도 승인 후 활성화한다.

## Validation

### Static

- 계획 작성 단계: `npm run check:docs`, 신규 계획 Prettier 검사, `git diff --check`.
- 구현 단계: `npm test -- --run`, `npm run build`, `npm run check:boundaries`, `npm run check:docs`, `npm run format:check`, `git diff --check`.
- Task snapshot revision 전달, 동일 상태 무요청, pending 중복 방지, 409/네트워크 실패 복구, 선택 조건별 Project 조회 및 limit 처리를 기존 관련 단위 테스트에 추가한다.
- 전체 포맷 baseline 실패가 남으면 기존 문제와 변경 파일을 구분해 기록하고 변경 파일은 개별 검증한다.

### Runtime

- 기존 `tests/dashboard/v3.spec.ts`와 fixture를 확장하고 기존 Dashboard 설정으로 실행한다. 작업보드 관련 기존 회귀도 실행하며 새로운 테스트 설정/runner를 만들지 않는다.
- 실제 drag event로 할 일 → 진행 중 → 완료 및 역방향·빈 열 이동을 확인하고, 상태 select에서도 동일 API와 결과를 확인한다. 새로고침 후 상태가 유지되고 Widget 설정/배치 revision은 바뀌지 않아야 한다.
- pending 중 재조작, 실패·409 복구, 같은 Task를 표시하는 여러 위젯, Task 이동 후 overview 통계 갱신, Task 이동과 위젯 배치 이동의 분리를 확인한다.
- Home 첫 표시에서 프로젝트 이름이 나타나고 행 클릭으로 상세 이동하는지 확인한다. 전체/분야/미분류/특정 프로젝트, limit, 보관 상태, 빈 결과, 목록 오류·재시도, 삭제된 참조와 프로젝트 변경 후 갱신을 확인한다.
- desktop/mobile/landscape에서 카드·프로젝트 행의 넘침, 드롭 대상 표시, 드롭다운 키보드 조작과 포커스를 직접 확인한다. DOM 테스트만으로 시각 검증 완료를 선언하지 않는다.
- [검증 지침](../guides/TESTING.md)에 따라 기존 `tests/real/dashboard.mjs`를 확장해 disposable backend에서 실제 Task PATCH·영속화·Project 조회를 검증한다. `node tests/real/run.mjs --dashboard=all` 및 `--nginx`로 Vite/Nginx 경로를 확인한다. 사용자의 실행 중 업무 데이터에는 검증용 변경을 하지 않는다.

## Completion Criteria

- [x] Task 위젯에서 세 상태 간 드래그와 상태 드롭다운이 동작하고 서버에 저장된다.
- [x] 중복 요청·실패·충돌·세션 종료 처리가 유지되며 작업보드와 관련 위젯이 최신 상태를 표시한다.
- [x] 프로젝트 개요에 저장된 선택 조건과 표시 개수에 맞는 실제 프로젝트 목록이 바로 나타나고 상세 이동이 가능하다.
- [x] 빈 상태·오류·pending·보관/사라진 참조 및 반응형·키보드 동작을 검증했다.
- [x] 단위·브라우저·실제 API 및 관련 정적 검증을 통과하고 제한 사항과 증거를 기록했다.
- [x] 관련 현재 문서와 계획 실행 목록을 갱신했다.

## Execution Record

- 2026-09-17: 현재 프론트 구현과 로컬 백엔드 소스를 확인해 계획을 작성했다. 사용자가 실행을 승인해 `active`로 전환하고 구현을 시작한다.
- 2026-09-17: TaskSnapshot revision을 유지하는 공통 상태 변경 훅과 TaskBoard 연동, overview ProjectStore list/detail 조회와 프로젝트 행 표시, Dashboard fixture 및 disposable real acceptance를 구현했다. Dashboard v3 9건, 기존 브라우저 35건, 단위 208건, Vite/Nginx real acceptance가 통과했고 검증 증거를 기록해 `completed`로 전환했다.
