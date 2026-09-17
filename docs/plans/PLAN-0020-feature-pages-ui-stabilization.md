# Plan: Task, Journal and Library Workbench UI Stabilization

Date: 2026-09-15.
Status: completed. 사용자의 명시적 완료 요청에 따라 종료 처리. 기존 검증 제한은 유지한다.

## Goal

작업 보드(`/tasks`), 개발 일지(`/journals`), 자료실(`/library`)의 정보 계층, 정렬과 시각적 밀도를 정리한다. [Project Detail UI 정리](PLAN-0019-project-detail-workbench-density.md)에서 적용한 transparent section, 얇은 divider, compact control/row 원칙을 이어가되 각 페이지의 업무 흐름에 맞게 적용한다.

## Scope

- In scope: 세 페이지의 필터 정렬, section padding, toolbar/action hierarchy, 목록 metadata와 action 정렬, 빈 상태와 오류 상태의 줄바꿈, responsive 표현.
- Warm Porcelain + Cobalt Blue + Graphite Sidebar, Pretendard, 기존 icon 의미색/브랜드색, 6~8px radius와 Blueprint page-heading을 유지한다.
- 기존 DOM 계층과 element 순서, 이벤트, 데이터 흐름은 보존한다. TSX 수정은 기존 element에 명확한 page 전용 class를 추가하는 범위로 제한한다.
- Out of scope: API/store/query/cache, Category/Project 선택 규칙, URL/debounce, pagination, mutation/CSRF/revision/idempotency, auth/session/guard, drag/drop handler, 위젯 배치 설정, legacy provider/storage 변경.
- Home 위젯과 프로젝트 상세는 이번 변경의 적용 대상이 아니라 회귀 확인 대상이다. 공용 기능 컴포넌트를 재사용한다는 이유로 그 화면에 같은 밀도 변경을 자동 적용하지 않는다.
- 페이지 heading의 높이/폰트, Sidebar/Topbar/login과 Project 목록은 변경하지 않는다. 새 카드나 불필요한 section 제목/번호를 만들지 않는다.
- 이번 요청은 Plan 작성만이다. proposed로 등록하고 승인 후 active로 전환한다. 현재 다른 active Plan은 없다.
- 이전 사용자 요청에 따라 실행 시에도 테스트·빌드·스크린샷 runner를 생략하고 실행 중인 로컬 프론트 직접 확인을 기본 검증으로 삼는다. 인증 화면 접근 불가와 미검증 항목은 명시한다.

## Changes

### 1. 현재 구조 조사

소스와 CSS를 기준으로 조사했다. 이번 작성 시점에는 인증 화면의 실제 높이/좌표를 측정하지 않았다. 아래 spacing 수치는 선언값이며 최종 computed style은 구현 시작 시 확인한다.

| 영역 | 실제 구성 | 밀도/정렬 검토 대상 |
| --- | --- | --- |
| 공통 | `PageScaffold` → `.page-heading` → `.section-toolbar.classification-toolbar` → 페이지 content | 필터는 grid를 공유하지만 content 안쪽 들여쓰기와 action 기준선이 다름 |
| Tasks | `ServerTasksPage` → `.content-panel` → `ApiTaskManager` → `TaskReads` → `.feature-actions`와 `TaskBoard` | panel의 `:has(.kanban)` padding, toolbar의 좌우 16px, board의 별도 padding이 누적 |
| Journals | `ServerJournalsPage` → `ApiJournalWorkspace` → PageScaffold + `.content-panel` | 상단 Category/Project/search와 내부 날짜/정렬 control 사이의 거리 및 폭 |
| Journal 목록 | `JournalResults` → `.journal-list-item` → `button.document-row` + `.feature-actions` | 본문 button padding 21px, 별도 edit/delete action, 제목/Project·날짜 metadata 계층 |
| Library | `ServerLinksPage` → PageScaffold → `ApiLinks(memory 있음)` → `.content-panel` | panel padding 24px에 header/toolbar/list 좌우 20px가 중첩 |
| Library toolbar | `.panel-heading.library-header` + `.library-toolbar` | 링크 추가는 이미 header 우측. toolbar는 column이며 새로고침/초기화가 우측 별도 행 |
| Link 목록 | `LinkRows` → `.quick-links` → `.quick-link-row` → 외부 anchor + `.link-actions` | 정보/분류/편집/위로/아래로/삭제가 두 block에 나뉘어 수직 공간 사용 |

- 공용 `.content-panel`은 이미 transparent/top border/radius none이다. 큰 흰색 카드 제거를 위해 추가 DOM 구조를 바꿀 필요는 없다.
- `.classification-toolbar`는 세 페이지뿐 아니라 Home도 사용한다. Home의 search wrapper에만 raised background/border/focus-within 규칙이 있다. 다른 페이지 search의 입력 영역 인지성과 필터 control과의 높이를 확인한다.
- `ServerTasksPage`와 `ServerLinksPage`는 `category/projectId/q`를 URL에서 읽고 250ms search debounce와 navigation guard를 사용한다. 필터 control을 새 상태로 복제하지 않는다.
- Journal은 날짜/정렬 값을 URL로 전달하고 `validRange`로 잘못된 날짜 범위의 결과 렌더링을 제어한다. Project selector는 자체 옵션 조회와 선택 Project 복구를 사용한다. 다른 페이지의 selector와 외관이 비슷하다는 이유로 로직을 교체하지 않는다.
- Journal `.form-grid.journal-query-toolbar`는 3개의 동일 폭 column, 상단 margin 22px, 하단 margin 16px다. 600px 이하에서는 2열 + 마지막 field 전폭이다.
- Task lane 최소 높이는 110px, 3열 최소 폭은 각각 240px다. sparse board의 높이를 260~320px로 일괄 늘리지 않는다. grid stretch와 카드 내용에 따른 실제 높이를 구분한다.
- Task board는 Home/Project detail과 `ApiTaskManager` 및 `TaskBoard`를 공유한다. 프로젝트 상세에는 PLAN-0019의 별도 scope override가 존재한다.
- Journal 페이지는 `ApiJournalWorkspace`의 문서 row를 사용한다. Home/Project detail의 `ApiRecentJournals`와 row 구조가 다르므로 상세용 `.journal-row` 규칙을 그대로 복사하지 않는다.
- `ApiLinks`는 `memory`가 있을 때 관리 header/editor를 렌더링한다. Home은 `memory` 없이 조회 UI를 재사용한다. 이 분기가 Library 전용 스타일의 경계다.
- Library의 refresh와 reset은 역할이 다르다. 순서 변경은 검색/필터/조회 상태에 따라 제한되며, pending/conflict/latest-review와 focus 복귀가 연결돼 있다.
- 1150/900/680/600px 및 wide 1600px 규칙을 포함한 app responsive cascade를 확인해야 한다. 모바일 button/input/select 최소 44px와 input 크기를 유지한다.

### 2. 공통 정보 계층과 스타일 경계

기본 읽기 순서는 page-heading → Category/Project/search → 페이지 보조 toolbar → 결과/업무 목록으로 유지한다.

- 필터 label/control의 기준선과 본문 시작점을 맞춘다. desktop Category/Project는 약 200~240px, search는 남는 공간 안에서 최소 폭을 보장하고 긴 선택 이름은 부모 폭을 밀어내지 않게 한다.
- desktop control은 현재 40px 기준을 우선하고 모바일 44px 규칙을 유지한다. label gap은 6~8px, control 간 gap은 12~16px를 후보로 사용한다.
- search에 필요한 raised surface와 border를 명시한다. input 자체와 wrapper가 이중 border/focus를 만들지 않게 한다. 기존 accessible name과 placeholder, disabled 상태는 유지한다.
- section은 transparent + neutral divider를 유지한다. 본문 좌우 중복 padding은 제거하고 세로 padding은 16~20px, toolbar→목록은 12~16px 수준에서 시작한다.
- primary action의 현재 위치를 보존한다: Tasks는 board toolbar, Journal은 page-heading, Library는 개발 레퍼런스 header. 위치를 억지로 통일하기 위한 callback/ref 이동은 하지 않는다.
- 생성 action은 먼저 보이고 refresh/reset/trash는 보조 계층으로 읽히게 한다. 기능이 다른 retry/refresh/reset을 중복 action으로 간주해 제거하지 않는다.
- 기존 설명/집계/조회 상태를 숨기지 않고 작은 muted metadata로 배치한다. loading/error/empty/pending을 같은 빈 상태로 합치지 않는다.
- 단일 본문 중심 페이지에 Project detail의 01~04 번호를 기계적으로 반복하지 않는다. Library의 기존 h2 계층을 정돈하고 Tasks/Journal에는 불필요한 제목을 추가하지 않는다.

구현 경계:

- 세 기존 filter wrapper에 공통 opt-in class `workbench-filter-toolbar`를 추가한다. 공통 표현만 shared CSS에서 정의하고 기존 `.classification-toolbar` 전체를 재정의하지 않는다.
- 기존 Tasks content div에는 `task-page-content`, Journal content div에는 `journal-page-content`, Library의 memory 전용 content div에는 `library-page-content`를 추가한다. 새 wrapper를 만들지 않는다.
- page 전용 feature CSS는 이 class 아래의 직접 자식과 필요한 row만 선택한다. `.task-surface`, `.journal-surface`, `.quick-links`, `.field`, `.feature-actions` 전체에 전역 밀도 변경을 적용하지 않는다.
- modal/dialog 내부는 page content의 descendant일 수 있으므로 toolbar/field override를 direct child로 제한한다. notice/modal-actions/삭제 검토 영역에 CSS grid auto-placement가 의도치 않게 적용되지 않게 한다.

### 3. 작업 보드

- `task-page-content`의 상단 divider와 toolbar/board 좌우 정렬을 하나로 맞춘다. 중복 padding을 줄이되 가로 scroll과 focus outline을 위한 4px 안팎의 내부 여유는 유지한다.
- 태스크 추가와 휴지통은 같은 toolbar에 유지하고 wrap 시 같은 간격을 적용한다. 휴지통 건수와 loading/error 표시는 숨기지 않는다.
- lane 최소 높이 110px, 240px 최소 track, grid stretch, drop hit area는 유지한다. 새로운 고정 높이나 lane 내부 세로 스크롤을 만들지 않는다.
- empty는 canvas에 가까운 surface/문구, normal은 subtle, drop-target은 accent-soft/outline의 기존 3단계 유지. 빈 열의 여백은 텍스트와 드롭 영역 가독성 범위 안에서만 검토한다.
- task card 크기/상태 select/드래그 이벤트를 바꾸지 않는다. 열별 더 보기, totals, trash restore, pending disable, editor focus 복귀와 guard가 시각 변경의 회귀 점검 대상이다.

### 4. 개발 일지

- 상단 공통 필터와 본문을 같은 정렬선으로 연결한다. 현재 page-heading의 일지 작성 action과 전체 필터 흐름은 유지한다.
- `.journal-page-content > .journal-query-toolbar`는 시작일/종료일 180~220px, 정렬 160~200px를 후보로 하여 desktop에서 불필요한 전폭을 줄인다. 22px 상단 margin은 제거하거나 0~8px로 줄이고 날짜 input의 native UI가 잘리지 않는 최소 폭을 우선한다.
- mobile은 기존 2열 날짜 + 정렬 아래 배치를 우선하며 320px나 확대 상태에서 native date가 맞지 않으면 1열로 전환한다. 날짜/정렬 field와 URL 상태를 이동하거나 재구현하지 않는다.
- reset은 날짜 toolbar 바로 다음의 기존 위치에 유지하되 아래 결과와 12~16px 여유를 둔다. invalid range와 notice는 전폭으로 자연스럽게 줄바꿈한다.
- 문서 row는 제목을 주 정보로, Project/date를 보조 정보로 유지한다. 세로 padding 12~14px부터 검토하고 edit/delete는 우측 또는 좁은 화면의 다음 줄에 정렬한다.
- icon/action hit area, 긴 제목 wrap, disabled/pending 문구를 보존한다. 날짜와 Project가 현재 같은 small 안에 있으므로 강제 분리 없이 metadata block으로 정리한다.
- 하단 total/불러온 건수와 더 불러오기는 목록 끝의 보조 계층으로 정리한다. 서버 total과 현재 items.length의 구분 및 cursor 동작은 유지한다.
- 상세/수정/삭제 modal, 저장 후 필터 reset, draft/실패/충돌/날짜-only 규칙은 변경하지 않는다.

### 5. 자료실

- `.library-page-content`의 header/toolbar/list 중복 좌우 padding을 정리한다. 개발 레퍼런스 제목/설명과 링크 추가의 현재 header 배치를 유지한다.
- desktop toolbar는 설명/결과 정보가 좌측, 새로고침/reset이 우측에 오는 flex/grid를 검토한다. 충분한 폭이 없으면 설명 다음 action row로 내려가며 모든 요소는 동일 content grid에 정렬한다.
- 링크 새로고침은 secondary 상태로 유지한다. reset의 표시 조건, 항상 보이는 추가 action, 생성 action을 복제하지 않는 empty state를 유지한다.
- 링크 row는 anchor 정보와 metadata/action을 기존 순서 그대로 compact하게 구성한다. 큰 화면에서는 기존 두 block을 CSS grid로 나란히 배치할 수 있으나 제목 폭이 부족하면 2줄 구성을 유지한다.
- 편집/위로/아래로/삭제 4개 control을 좁은 폭에 억지로 한 줄 배치하지 않는다. 분류 정보는 줄바꿈하고 controls는 규칙적으로 wrap한다. 기존 버튼 text/aria-label과 순서를 유지한다.
- URL을 여는 anchor 안으로 action을 옮기지 않는다. `target/rel`, 브랜드 icon, filtered reorder disabled, 경계 항목 위/아래 disabled, 삭제 검토 및 focus 복귀를 보존한다.
- Home의 memory 없는 ApiLinks는 `library-page-content`를 받지 않으므로 스타일이 적용되지 않아야 한다.

### 6. 파일별 수정 범위

| 파일 | 계획 |
| --- | --- |
| `src/pages/ServerTasksPage.tsx` | 기존 filter와 content div에 opt-in class 추가. handlers/props 보존 |
| `src/pages/ServerLinksPage.tsx` | 기존 filter div에 공통 opt-in class 추가 |
| `src/features/journal/ApiJournalWorkspace.tsx` | filter/content class만 추가. JournalResults/Items 구조와 상태 보존 |
| `src/features/links/ApiLinks.tsx` | memory가 있는 기존 content div의 class 확장. condition/ref/callback 유지 |
| `src/shared/styles/content.css` | 세 페이지가 opt-in하는 공통 filter grid/간격만 정의 |
| `src/shared/styles/ui.css` | opt-in toolbar의 search surface/focus가 필요한 경우 공통 규칙 추가. 전역 search 변경 금지 |
| `src/features/tasks/styles.css` | task-page-content toolbar/board 여백. Home/detail 규칙과 분리 |
| `src/features/journal/styles.css` | journal-page-content date toolbar/문서 row/actions/footer/상태/모바일 표현 |
| `src/features/links/styles.css` | library-page-content header/toolbar/link row/actions/empty/mobile 표현 |
| `src/app/styles/layout.css`, `responsive.css` | 기존 grid/media cascade 확인. 기본 읽기 전용, 충돌이 있으면 opt-in 범위로만 보완 |
| `PageScaffold.tsx`, `page-heading.css`, `tokens.css` | 기준 확인만. heading 구조/기하/색상 무변경 |
| TaskReads/TaskBoard, LinkRows, 각 editor/store/model | 소비처 확인만. 기능 수정 대상 아님 |
| Plan/index | 승인, 실행 결과와 검증 제한 갱신 |

공용 규칙에는 Project/Task 같은 업무 조건을 넣지 않는다. 화면 정렬을 위해 CSS `order`, absolute positioning, `display:contents`로 기존 읽기/focus 구조를 우회하지 않는다.

### 7. Responsive / 접근성 / 상태

- 1440x1000, 1280x800, 1920x1080, 900px/680px/600px 전후, 390x844, 320px, 844x390 landscape, 200% zoom에서 확인한다.
- Category/Project는 2열 유지 가능 여부를 긴 옵션명으로 확인하고 search는 필요한 폭에서 다음 행으로 보낸다. 좁은 화면에서는 1열 fallback을 허용한다.
- 버튼이나 native date/select가 container를 넓히지 않도록 min-width:0/max-width:100% 및 grid minmax를 사용한다. input/control의 실제 최소 사용 가능 폭과 mobile 44px hit area를 우선한다.
- 기존 tab 순서, label 연결, focus-visible, modal 열기/닫기 후 복귀를 유지한다. 일반 surface에 새 animation/glow를 추가하지 않는다.
- empty/full/loading/stale/error/pending와 긴 제목/설명/분류 이름을 확인한다. 오류 안내가 많아지는 경우에도 버튼과 텍스트가 겹치지 않아야 한다.
- Tasks만 기존 내부 가로 스크롤을 허용한다. 페이지 전체 가로 overflow와 잘린 footer/action은 실패다.

### 8. 구현 순서

1. 실행 승인 후 active/index 갱신. dirty worktree와 기존 공용/PLAN-0019 selector를 확인하고 인증된 세 화면의 전후 비교 기준을 확보한다.
2. 기존 DOM에 opt-in class를 추가하고 공통 filter/control 정렬을 적용한다. Home/detail에 적용되지 않는지 먼저 확인한다.
3. Tasks toolbar/board 외곽 간격 정리. lane/card/drag geometry 보존을 확인한다.
4. Journal 날짜 toolbar와 문서 row/action/footer를 정리하고 조건부 상태의 줄바꿈을 확인한다.
5. Library header/toolbar/list의 시작점과 row/action 밀도를 정리한다. reorder와 삭제 검토 상태를 확인한다.
6. 세 화면을 같은 viewport에서 비교하고 responsive/focus/상태/cascade를 통합 검토한다. 문제 발생 시 해당 opt-in 규칙을 수정하고 관련 소비처를 다시 확인한다.
7. 실제 적용 값, 확인 화면, 미확인 상태를 기록한다. 완료 조건이 충족되거나 제한을 사용자가 명시적으로 수락한 뒤 completed로 정리한다.

### 9. 위험 / Rollback

| 위험 | 예방 / 복구 단위 |
| --- | --- |
| 공용 feature 스타일이 Home/detail로 전파 | opt-in page class를 경계로 사용. 해당 class 아래 CSS만 역패치 |
| Library memory 분기 변경으로 editor/ref 영향 | className 문자열만 확장. 기존 conditional과 함수는 무변경 |
| compact date/filter가 모바일에서 잘림 | native control 최소 폭 확인, 1열 fallback. toolbar grid만 복구 |
| Link action 행이 길어 본문을 압축 | 큰 화면에서만 가로 구성, 나머지는 원래 2줄. row grid만 복구 |
| Task padding 축소로 focus/drop outline 잘림 | board 내부 여유 유지. task-page-content 간격만 복구 |
| 오류/더 보기/reset 제거로 동작 변경 | 의미가 다른 control 모두 유지. CSS-only 범위 초과 시 별도 보고 |
| 후순위 responsive selector와 충돌 | computed style과 source cascade 확인. 전역 !important 추가 금지 |

복구는 실행 직전 기준 대비 이번 CSS/class 변경만 역패치한다. PLAN-0019, 기존 사용자 작업, API/store와 legacy 데이터를 되돌리지 않는다.

## Validation

### Static

- Plan 작성: 실제 파일/컴포넌트 경로, 현재 CSS 선언값, 번호와 index/proposed 상태를 읽기 기반으로 확인한다. source 변경 없음.
- 실행: 변경 diff가 CSS와 표현용 class에 한정되는지 확인한다. URL/debounce/filter/reset/ref/key/handler 및 query 계약이 보존돼야 한다.
- 전역 palette/heading/Blueprint와 PLAN-0019 selectors 보존, opt-in scope, modal 제외, media cascade와 중복 border/focus를 검토한다.
- 테스트·빌드·별도 screenshot runner는 이전 요청대로 생략한다. 이 UI 범위를 넘어 기능 수정이 필요해지면 변경 사유와 범위를 먼저 보고한다.

### Runtime

- 실행 중인 로컬 프론트에서 세 route 직접 진입, refresh, navigation/Back/Forward 후 filter 선택과 control 배치 확인.
- 같은 viewport에서 page-heading 아래 필터 시작점, input 높이, section content 시작점, toolbar/list 간격 비교.
- Tasks: 전체/Project/Category/query, sparse/full/empty lane, 가로 스크롤, drag 진입/이탈/cancel, Task editor와 trash 열기/닫기, keyboard status control 확인.
- Journal: Project/date/sort/query, invalid date range, reset, 긴 row, 상세/작성/수정/삭제 modal 표시와 focus, 더 불러오기/total/조회 실패 안내 확인.
- Library: 긴 label/description/분류, header 추가 action, refresh/reset, filtered reorder disabled, first/last item controls, editor와 삭제 검토/오류 안내 확인.
- 실제 데이터 생성/수정/삭제/정렬/drop 저장은 허용된 검증 데이터가 있을 때만 수행한다. 없으면 해당 동작의 source 보존과 runtime 미검증을 구분한다.
- Home/Project detail에서 Task/Journal/Link 위젯과 PLAN-0019 표현이 바뀌지 않았는지 대조한다.
- 자동 검증이 추후 요청되면 기존 `tests/tasks/`, `tests/journals/`, `tests/links/`, `tests/shell/`, `tests/dashboard/legacy-v2/filter-layout.spec.ts`를 재사용한다. 새 runner/fixture provider나 인증 우회로 화면 검증을 대체하지 않는다.
- 인증 브라우저 접근 불가 시 페이지 시각 검증은 pending으로 기록한다. 공개 로그인 확인을 세 페이지 검증으로 보고하지 않는다.

## Completion Criteria

- [ ] 세 페이지 필터와 content 정렬/간격이 일관됨.
- [ ] Tasks lane/card/drag hit area를 유지하면서 외곽 여백이 정리됨.
- [ ] Journal 날짜 control, 목록 metadata/action/footer가 좁은 화면에서도 읽힘.
- [ ] Library header/toolbar/list가 같은 정렬선을 사용하고 모든 action에 접근 가능함.
- [ ] Warm Porcelain palette, icon system, page-heading/Blueprint와 shell이 유지됨.
- [ ] Home/detail/legacy에 의도하지 않은 스타일 변경이 없음.
- [ ] DOM 계층, API/data/auth/guard/query/mutation 동작 보존을 source로 확인함.
- [ ] 허용된 responsive/접근성/interaction 확인 결과와 미확인 제한을 기록함.
- [ ] 미검증 항목은 검증 완료되거나 사용자가 명시적으로 제한을 수락함.
- [ ] Plan/index가 실제 결과를 반영함.

## Execution Record

- 2026-09-15: 실제 세 페이지 composition과 공용/feature CSS를 조사해 proposed로 등록했다. source 구현, 테스트, 빌드, 브라우저 검증은 수행하지 않았다.

### Approved implementation

- 사용자 승인 후 active로 전환했다. 기존 filter/content element에 opt-in class만 추가했다. DOM 계층, 이벤트, store/API, ref, 조건부 렌더링은 변경하지 않았다.
- 공통 workbench-filter-toolbar는 220px/220px/나머지 search grid, 간격 12px/16px, 하단 20px다. 900px 이하 2열 + search 전폭, 480px 이하 1열이다. search에 raised surface/control-border/focus-visible을 연결하고 모바일 input 44px/16px를 유지했다.
- Tasks content 상단 padding 18px, toolbar 하단 12px, board padding 4px/4px/8px를 적용했다. 110px lane 최소 높이, card, grid stretch, drop 동작은 유지했다.
- Journal content padding 18px/0/0, 날짜 toolbar 200px/200px/180px 후보를 적용하고 상단 margin을 제거했다. 680px 이하 2열, 480px 이하 1열이다. 문서 row padding 13px, 제목 14px, metadata 간격 4px, footer muted monospace로 정리했다.
- Library header/toolbar/list의 중복 좌우 padding을 제거했다. desktop toolbar는 정보/action 2열, row는 link/action 2열이며 1150px 이하에서 세로로 전환한다. 기존 추가/새로고침/reset/reorder/delete action은 유지했다.
- Journal/Library empty-state padding은 28px/12px, 페이지 직속 notice는 wrap과 간격을 적용했다. editor와 Home/detail 컴포넌트에 page class를 추가하지 않았다.

### Source review and recovery

- features.css에서 feature CSS 뒤에 shared content.css가 import되는 것을 확인했다. 후순위 `.content-panel:has(.kanban)`이 Task page padding을 덮을 수 있어 page-scoped `:has(.kanban)` selector로 보완했다.
- ProjectFilter의 추가 조회/오류 control은 별도 행으로 유지하고 공통 search는 첫 control 행에 정렬한다. 상세 페이지 PLAN-0019 selector와 공용 heading/palette는 변경하지 않았다.

### Runtime evidence and remaining review

- 실행 중인 로컬 프론트의 `/tasks`, `/journals`, `/library`에 접속했다. 확인용 브라우저에 인증 세션이 없어 모두 로그인 화면이 표시되고 page content는 없었다.
- 각 경로에서 1440x1000 / 390x844 / 844x390의 공개 로그인 화면에 가로 overflow와 pageerror가 없었다. 이 결과는 업무 페이지 레이아웃 확인을 의미하지 않는다.
- 실제 세 페이지의 긴 데이터, modal/focus, filter/Back/Forward, drag, pending/error, Home/detail 회귀의 runtime 검토는 남아 있다. source 보존 확인을 기능 테스트 성공으로 기록하지 않는다.
- 사용자 요청대로 테스트·빌드·스크린샷 runner를 실행하지 않았다. 인증된 화면 검토 또는 제한의 명시적 수락 전까지 active를 유지한다.

### Closeout

- 사용자가 인증 화면 검증 제한을 유지한 완료 처리에 명시적으로 동의했다. Plan과 index를 completed로 변경했다.
- CSS/표현 class 구현과 source 검토 결과를 기준으로 종료했다. 인증된 세 페이지의 시각/interaction 검증과 테스트·빌드를 추가로 수행한 것으로 기록하지 않는다.
