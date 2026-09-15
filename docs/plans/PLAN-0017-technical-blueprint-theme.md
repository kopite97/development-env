# Plan: Technical Editorial + Developer Workbench + Blueprint UI

Date: 2026-09-15.
Status: completed. PLAN-0018 진행 중 사용자가 PLAN-0017 완료 처리를 명시적으로 요청했다. 기존 검증 제한 기록은 유지하며 새 surface 전환 검증은 PLAN-0018에서 진행한다.

## Goal

현재 페이지 구성과 API 동작을 유지하면서 Porcelain workspace, Ink/Graphite sidebar, Cobalt interaction으로 시각 시스템을 전환한다. Blueprint는 페이지 제목과 로그인 좌측에 한정된 장식이며 업무 데이터나 실제 상태를 표현하지 않는다.

## Scope

- In scope: 공용 토큰, 전체 CSS 감사, 지정 DOM의 국소 pointer 효과, 로그인 workflow 표현, 버튼/폼/탐색 상태, 접근성 및 성능 검토.
- Out of scope: 라우팅, 인증/OAuth, API/store/cache, Category 관계/필터, Dashboard 저장 스키마, 데이터 권한, legacy provider/storage, 화면 섹션 재배치, 새로운 업무 기능.
- HTML 계층은 유지한다. 허용하는 TSX 변경은 기존 요소의 ref/event/data 속성 연결 및 진행률 표시용 style 변경이다. 추가 wrapper, canvas, 장식용 DOM, 번호를 위한 콘텐츠 변경은 기본 범위가 아니다.
- 이전 테스트/빌드 생략 요청을 유지한다. 이번 턴에는 문서만 생성하며 실행 시에도 별도 승인 없이 테스트·빌드·스크린샷 스크립트를 실행하지 않는다.
- PLAN-0016은 현재 active이며 최종 시각 승인 대기 상태다. 이 Plan은 proposed로 등록하고, 실행 전 사용자의 PLAN-0016 종료 또는 상태 정리 지시를 받아 active Plan이 둘이 되지 않게 한다.

## Changes

### 1. 실제 저장소 조사 결과

- 실제 파일명은 `src/shared/styles/tokens.css`다. `token.css`를 새로 만들거나 이름을 바꾸지 않는다. 현재 Indigo `--accent: #655cc9`, bg `#f7f8fc`, radius 10/12px, shadow none 구조다.
- `src/shared/ui/PageScaffold.tsx`의 `.page-heading`은 제목/eyebrow/설명 div와 선택적 `.page-heading-actions`를 가진다. Home Dashboard, Project 목록/상세, Task, Journal, Library와 일부 legacy/NotFound 조합이 공유한다. 라우트별 복사본을 만들지 않는다.
- `src/app/styles/layout.css`가 heading flex, action 정렬, sidebar/topbar, search/filter 레이아웃을 소유한다. `dashboard/styles.css`에는 `.dashboard-surface > .page-heading` 예외가 있고 `projects/styles.css`에는 상세 제목 예외가 있다. 기존 치수와 breakpoint는 유지한다.
- `LoginWorkflow.tsx`는 desktop 1024px 이상에서만 workflow를 mount한다. 현재 단계 선택은 개별 `.login-workflow-node` hover/focus/click이며 최초 선택은 없다. `.login-workflow-track::before`는 하나의 전체 연결선이다.
- `DevelopmentStack.tsx`에는 hover preview와 click selected가 분리되어 있다. preview가 우선이고 영역 밖에서는 pinned selection으로 돌아온다. 기술명, tooltip, 고정 `.login-stack-lane`, Jenkins/Kubernetes 강조도와 로컬 Devicon 자산이 존재한다.
- Sidebar 실제 selector는 `.sidebar .nav-item`, `.nav-item.active`이며 `aria-current='page'`도 있다. `.workspace-switch`는 탐색 버튼이 아닌 표시용 div다.
- Project 목록은 별도 ProjectCard가 아니라 `ProjectOverview.tsx`의 `button.project-row`다. `.content-panel`, `.widget`, `.task` 전체를 클릭 가능한 카드로 간주하면 안 된다. `WidgetFrame.tsx`는 drag/drop과 내부 편집 버튼을 가진 section이다.
- `controls.tsx`의 Progress는 `.progress > span`에 실제 값으로 inline width를 전달한다. 허위 진행률이나 hover에 따른 값 변경은 금지한다.
- `src` CSS 조사에서 literal hex 색상은 tokens.css에 집중되어 있다. 남은 radius 50%는 avatar/status-dot의 원형 의미, auth의 radius 0은 카드 제거 의미다. 이를 무조건 8px로 바꾸지 않는다. 기존 duration/transform과 앞으로 발견되는 inline 색상도 감사한다.
- 전역 import 순서는 base → ui → layout → dashboard → features manifest → responsive다. auth와 login-workflow는 컴포넌트에서 별도 import한다. 이 순서를 뒤집거나 전역 override 파일을 끝에 덧붙여 해결하지 않는다.

### 2. 토큰과 타이포그래피

아래 값은 구현 승인에 포함할 초기 디자인 후보이며, 대비/실화면 확인으로 조정한 최종값을 기록한다.

| 축 | 초기 후보 / 적용 |
| --- | --- |
| Workspace | `--bg: #F7F7F4`, `--surface: #FFFFFF`, `--surface-subtle: #F0F1EF`, `--surface-hover: #EAEDEB` |
| Text / border | `--text: #20242A`, `--muted: #68717C`, `--border: #DFE3E6`, `--border-strong: #B9C1CA` |
| Cobalt | `--accent: #2855D9`, `--accent-hover: #2047B8`, `--accent-soft: #EDF2FF`, white text-on-accent |
| Sidebar | `--sidebar-bg: #191D23`, hover `#242A33`, active `#2C3440`; existing text/border aliases도 새 배경 대비로 확인 |
| Shape | `--radius`/`--radius-card: 8px`, small/badge `6px`; circle/none를 명시적 `--radius-round`/`--radius-none`로 분리; progress는 track 높이에 맞게 유지 |
| Motion | `--motion-fast: 160ms`, `--motion-standard: 180ms`, 공용 easing; shadow none 유지 |
| Blueprint | 크기 320px(직경, 허용 280–360), glow alpha 약 0.04–0.06, grid/guide alpha 기본 약 0.02 / 국소 약 0.07; 모두 토큰으로 조정 |
| Type | 기존 Pretendard stack/크기 유지. `--font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace` 추가 |

- success/warning/danger는 의미와 구별을 보존하며 Cobalt로 일괄 대체하지 않는다. 로고 브랜드 원색은 자산의 의도된 예외다.
- monospace는 `.nav-count`, `.count`, `.journal-date`, `.service-version`, `.project-progress > span`, widget 편집 순번과 실제 숫자에 제한한다. 한국어 본문/제목/프로젝트명 또는 모든 `small`에 일괄 적용하지 않는다. 숫자는 tabular-nums 사용, 긴 값과 대체 글꼴 폭 검토.
- 장식용 가짜 UUID/revision/카운터를 추가하지 않는다. 기존 eyebrow/metadata 계층과 얇은 divider로 editorial 느낌을 만든다. 음수 letter-spacing을 새로 만들지 않고 지정 디스플레이 텍스트는 0으로 정리한다.

### 3. 공용 pointer primitive

신규 후보: `src/shared/hooks/useBlueprintPointer.ts`, `src/shared/styles/blueprint.css`.

- hook은 feature/store를 import하지 않고 기존 root ref와 좁은 presentation callback만 제공한다. `.page-heading`와 `.login-workflow`만 opt-in 한다.
- `(hover: hover) and (pointer: fine)` 및 실제 `pointerType === 'mouse'` 조건에서만 추적한다. coarse/touch는 gradient 이동, hover translate를 비활성화하며 기존 click/focus는 유지한다.
- root의 pointerenter/pointermove/pointerleave/pointercancel만 처리한다. document/window pointermove, React state에 좌표 저장, request/network 호출을 하지 않는다.
- 마지막 client 좌표를 ref에 저장하고 root당 한 개의 requestAnimationFrame에서 rect 읽기 후 `--mouse-x`, `--mouse-y` px 값을 inline CSS property로 기록한다. layout 읽기와 style 쓰기를 묶고 추가 RAF가 쌓이지 않게 한다.
- 좌표는 `clientX/Y - root.getBoundingClientRect().left/top`. enter 및 필요 frame에서 현재 rect를 읽어 scroll/resize 이후 옛 좌표를 쓰지 않는다. leave/cancel/unmount/media 변경 시 pending RAF 취소, pointer-active 해제. 외부 이동 listener를 붙이지 않는다.
- `data-blueprint-active` 또는 `--blueprint-opacity`로 장식 layer만 180ms fade-out. 좌표 자체에 transition을 걸어 pointer가 지연 추적되지 않게 한다.
- reduced-motion에서는 RAF 추적 자체를 끄고 중앙의 매우 약한 정적 gradient/grid만 표시한다. 텍스트/노드 위치는 변하지 않는다. mobile에서는 정적 장식도 필요 최소로 축소한다.
- root를 `position: relative; isolation: isolate`로 만들고 pseudo layer에 `pointer-events: none` 적용. 텍스트와 기존 controls는 그 위에 둔다. focus ring을 자르지 않도록 root 전체 overflow hidden을 무조건 적용하지 않고 장식 pseudo만 inset/clip한다.

### 4. DOM별 interaction 명세

| 실제 DOM / selector | 적용할 효과 | 제외 / 보호 |
| --- | --- | --- |
| `PageScaffold .page-heading` | 공용 hook 연결. `::before`에 고정된 낮은 opacity technical grid, `::after`에 pointer 중심 Cobalt wash + 강화 grid/guide/crosshair를 radial mask로 제한. mask 반경 160px 기준 가장자리 부드럽게 소멸 | `.page-heading-actions` 클릭/tooltip/focus 그대로. heading 자식에 transform/filter/opacity 적용 금지. margin/padding/높이 확대 금지 |
| Heading pseudo layers | repeating-linear-gradient로 선을 만들고 작은 교차점/노드 패턴을 같은 mask 안에 배치. 전체 화면 guide나 떠다니는 원형 장식이 아닌 평면 도면 패턴 | 장식은 accessible name/live region 없음. mask 미지원이면 정적 faint grid만 표시. 큰 움직이는 orb/강한 gradient 금지 |
| `.login-workflow` | 같은 local glow/grid. 우측 `.auth-login-panel`에는 hook/pseudo를 붙이지 않음 | 기존 58/42, 모바일 숨김, 브랜드/OAuth/error/status 그대로 |
| `.login-workflow-track` / `.login-workflow-node` | track 내부 pointer에 한해 실제 4개 node 중심과 거리 비교. 동률은 현재 단계 우선, 단계가 달라질 때만 React state 갱신. focus/click 대안 유지 | 이전 직접 hover 정책을 이 Plan 승인 시 의도적으로 대체. 전체 좌측 배경이나 하단 Category에서 최근접 node를 바꾸지 않음. 아이콘/tooltip 검사 중 그룹을 유지 |
| `.login-workflow-track::before/::after` | 기존 전체 기본선을 유지하고 추가 pseudo의 다중 gradient로 active node에 바로 붙은 좌우 segment만 Cobalt 전환. `data-active-stage`로 4개 정적 패턴 선택 | 첫/끝은 한 segment, 중간은 두 segment. 전체 라인을 진행 완료로 오인하게 채우지 않음. glow와 선 pseudo는 서로 다른 DOM 소유 |
| `.login-stack-category` / `.login-stack-lane` | 현재 hover preview/click pin 우선순위 유지. pin은 명확한 Cobalt fill, preview는 soft. 고정 reveal에서 기존 180ms fade/scale(.97→1)/translateY(5→0) 재사용 | 기술명/tooltip/로컬 자산/Jenkins planned/Kubernetes secondary 유지. 기술 정체성이나 클릭 API 없음 |
| `.sidebar .nav-item` | 160ms background/color. `.active::before`로 좌측 3px Cobalt indicator; position absolute로 레이아웃 보존 | translate/scale 없음. 모바일 sidebar 자체 열기/닫기 transform과 혼동하지 않음. aria-current/guard/focus trap 그대로 |
| `.content-panel`, `.widget`, `.task`, `.kanban-column`, `.workspace-switch`, `.service-summary` | 정적 surface/border/radius 토큰만 | 전체 카드 hover 이동 금지. 내부 액션이 있다는 이유로 컨테이너를 clickable 처리하지 않음. Dashboard drag transform/opacity 방해 금지 |
| `button.catalog-item`, `button.add-widget-area`, `.login-stack-category` | 실제 클릭 가능한 카드만 border 강화 + translateY(-1px). 로그인 카테고리 기존 -2px는 전체 카드 규칙으로 -1px 통일 | disabled/dragging/touch/reduced-motion에서는 이동 제거. 고정 border 두께로 치수 변화 금지 |
| `button.project-row`, `button.journal-row`, `button.document-row`, `.quick-links a` | 리스트 행은 기존 divider 유지, hover 색/border 대비만. 필요 시 실제 카드로 구성된 것만 -1px opt-in | 모든 행을 카드로 감싸지 않음. Link copy/edit 같은 별도 sibling action은 그대로 |
| `.task-title`, `.feature-actions .button`, `.link-actions .button`, `.widget-edit-controls .button` | 비활성 아닌 일반 action hover icon을 Cobalt로 | danger action은 danger, filled primary 위 icon은 white 유지. title click과 카드 drag 역할 유지 |
| `.button-primary` | 160–180ms accent-hover, press translateY(1px) | disabled/pending 제외. sidebar/card 규칙과 이중 transform 금지 |
| `.button-secondary`, `.button-ghost`, `.auth-google-button` | border/background/color만 자연스럽게 전환 | Google 브랜드 icon 원색/버튼 크기/로그인 disabled 상태 유지. 모든 button에 primary press 효과 전역 적용 금지 |
| `.field input/select/textarea`, `.task-status select`, category/journal filter controls | hover border-strong, focus Cobalt ring. wrapper `.search:focus-within`과 input focus 중복 ring 방지 | 기존 width/min-height/padding 그대로. textarea 누락된 base focus-visible 포함. disabled/read-only 상태 별도 |
| `.progress > span` | 실제 value만 표현. 필요한 경우 기존 span을 width 100% + transform-origin:left + scaleX(value/100)로 바꾸고 180ms transition; role/aria-valuenow 그대로 | hover는 fill 색만 전환, 진행량은 변경하지 않음. 초기 mount마다 0부터 재생하거나 반복 animation 금지 |
| `.status-dot`, `.badge-*`, `.milestone-icon`, `.service-row` | 실제 상태 변화에 색상 transition만. 진행/활성은 Cobalt, 완료/오류/주의 의미색 유지 | 서버 상태를 시각 효과용으로 변경하거나 서비스 정상 상태를 파란색으로 덮지 않음 |

최근접 node 범위를 **track 안**으로 제한하는 것은 이전 과도한 hover 영역 문제를 재발시키지 않기 위한 제안이다. 좌측 전체는 glow만 반응한다. 전체 좌측에서 node까지 전환하는 요구라면 구현 전에 이 경계만 재확인한다.

### 5. 파일별 수정 범위

| 파일 | 범위 |
| --- | --- |
| `src/shared/styles/tokens.css` | palette, border/radius/mono/motion/blueprint 토큰; 미사용 login shadow/gradient 토큰 참조 확인 후 정리 |
| `src/shared/styles/base.css` | Pretendard 보존, focus-visible textarea 포함, disabled/touch/reduced-motion 기본 원칙; 무분별한 transition:all 금지 |
| `src/shared/styles/ui.css` | button/badge/modal/field/progress 상태와 새 토큰 연결 |
| `src/shared/styles/content.css` | `.content-panel` 정적 1px border/8px shape; 기존 form/content spacing 유지 |
| `src/shared/styles/blueprint.css` (신규) | 두 opt-in root가 재사용할 masked pseudo 장식/정적 fallback; feature 이름 없는 공용 class |
| `src/shared/hooks/useBlueprintPointer.ts` (신규) | 국소 pointer lifecycle, RAF, media/reduced-motion cleanup |
| `src/shared/ui/PageScaffold.tsx` | 기존 heading에 class/ref/이벤트 연결만; children 순서 그대로 |
| `src/shared/ui/controls.tsx` | 필요한 경우 Progress 표시만 transform 기반으로 변경, Button/Modal 동작은 수정하지 않음 |
| `src/app/styles/global.css` | 공용 blueprint CSS import를 layout 앞에 등록, responsive 최종 순서 유지 |
| `src/app/styles/layout.css` | heading stacking, sidebar indicator, toolbar/search focus, 지정 metadata font. topbar/heading actions 치수 유지 |
| `src/app/styles/responsive.css` | 기존 breakpoints, mobile sidebar, final reduced-motion과 hover media 충돌 검토 |
| `src/app/styles/features.css` | manifest만 감사; 필요 없는 import 변경 없음 |
| `src/app/auth/LoginWorkflow.tsx` | shared pointer 연결, track 경계의 최근접 stage 계산, active-stage 속성. session 독립 |
| `src/app/auth/loginWorkflowModel.ts` | 제거된 nearest-stage helper를 새 명세로 복원할 경우 순수 좌표 함수만 추가 |
| `src/app/auth/DevelopmentStack.tsx` | preview/pin 상태 보존. 필요 속성만 추가하고 새 state authority 만들지 않음 |
| `src/app/auth/login-workflow.css` | 국소 blueprint 배경, active segment, Cobalt 상태, 모션 token, 기존 reveal lane/tooltip bounds 유지 |
| `src/app/auth/auth.css` | 정적 우측 surface/focus/OAuth 색 연결, broad auth selector 충돌 검토 |
| `src/features/projects/styles.css` | `.project-row`, `.stats`, `.project-progress`, category editor/filter, detail presentation의 색/shape/지정 mono |
| `src/features/tasks/styles.css` | task static card, `.task-title` action, status select/dot, restore row; drag/drop transform 보존 |
| `src/features/journal/styles.css` | journal/document 행, 날짜 metadata, query toolbar, action 상태 |
| `src/features/milestones/styles.css` | milestone icon/상태/폼. 실제 deadline/완료 의미 유지 |
| `src/features/links/styles.css` | quick-links action, library header/toolbar/search의 색/shape만; 기존 정렬 유지 |
| `src/features/dashboard/styles.css` | widget 정적, catalog/add-widget clickable, edit controls, 기존 heading 예외/dragging 보존 |
| `src/features/operations/styles.css` | service summary/row/version token/mono, static status 의미 보존 |
| `docs/architecture/frontend.md`, `docs/guides/development.md` | 승인 후 구현 완료 시 실제 token/interaction 경계와 검증 결과만 갱신 |

각 파일 수정 전 더 깊은 AGENTS/소유권 문서를 다시 읽는다. `src/pages`에는 현재 개별 CSS가 없으며 페이지마다 새 stylesheet를 만들지 않는다. `src`의 CSS, inline style, SVG 색상도 최종 감사하되 Devicon/Google 같은 브랜드 자산과 데이터 기반 숫자/치수는 예외로 기록한다.

### 6. 구현 순서 / Execution Sessions

1. 승인 및 기준 확보: PLAN-0016 상태 정리, dirty worktree 보존, 모든 대상 DOM의 interactive/static 구분 확인, 현재 화면 크기/heading action 위치 기록. 토큰 후보와 nearest-node track 범위 확정.
2. 정적 디자인 시스템: tokens → base/ui/content → layout/sidebar → 모든 feature CSS 순으로 색/radius/shadow를 통일. 아직 pointer 효과 없이 대비/폼 치수/metadata 줄바꿈 확인.
3. 공용 Blueprint: hook/CSS 구현, PageScaffold opt-in, masked grid/crosshair와 leave fade, RAF cleanup, touch/reduced-motion 처리. heading 버튼/focus clipping 확인.
4. 로그인: 좌측에 primitive 연결, track 근접 단계/인접 선 효과, 현재 category preview/pin/reveal 보존, 우측 정적·auth branch 검토.
5. 미세 interaction: clickable 카드 allowlist, 버튼/폼/실제 progress/status transition, drag 예외. 각 화면 전체 CSS 하드코딩 및 cascade 재감사.
6. 직접 화면 검증/회복: 아래 매트릭스 점검, 문제 해결 후 재확인, 미검증 항목 기록. 문서/index 업데이트. 통과 또는 사용자 검토 완료 전 completed 처리 금지.

## Validation

### Static

- 이번 계획은 소스 읽기와 문서 작성만 수행. 테스트/빌드/린트/스크린샷 실행 없음.
- 구현 시 diff로 API/session/store/router/storage/DTO 계약 무변경을 검토. 새 dependency와 외부 이미지 로딩 없음.
- CSS literal color/radius/shadow 및 TSX inline 스타일 검색, 토큰 별 사용처와 semantic 예외 기록. circle/none, brand SVG 원색을 단순 치환하지 않았는지 확인.
- pointer listener/RAF cleanup, callback stale closure, media 전환, pointercancel, unmount를 소스 검토. state는 stage/category만 갱신하고 mouse 좌표는 React 렌더에 올리지 않음.
- 기존 no-test/no-build 지침을 존중한다. 검증 범위 변경 승인이 있을 때만 기존 unit/auth/shell/feature 테스트 체계를 이용하고 새 전용 runner를 만들지 않는다.

### Runtime

- 승인된 로컬 브라우저 직접 확인과 사용자 시각 피드백을 사용. 자동 Google 로그인/인증 우회/실데이터 삭제 금지. 로그인된 세션 접근이 불가능하면 해당 검토는 사용자에게 넘기고 공백을 명시한다.
- 화면: `/`, `/projects`, 실제 `/projects/:id`, `/tasks`, `/journals`, `/library`, 로그인. Desktop 1440x1000/1280x800, breakpoint 1023/1024, mobile 390x844, landscape 844x390, 200% zoom.
- heading: 처음/경계/버튼 위/밖 이동, 빠른 재진입, scroll/resize, route 이동, 여러 root 공존. 320px wash만 국소 강조되며 텍스트와 action 좌표 불변. 드롭다운/modal/focus ring 위에 장식이 겹치지 않음.
- 로그인: node 동률/첫끝/중간 segment, track 밖과 category hover의 node 독립성, pin 유지와 preview 복귀, 기술명/tooltip 여백, 우측 pointer 무영향. 사용할 수 있는 auth checking/error/pending 상태 유지 확인, 위험한 계정 상태를 만들지 않음.
- Sidebar: active indicator, hover 무이동, keyboard focus, mobile open/close/scroll lock. 상단 heading 및 sidebar navigation 가드 그대로.
- 업무 UI: static widget/panel/task 무이동, 실제 clickable만 hover, Dashboard 편집/drag/save, Project/Journal/Task/Milestone modal draft와 disabled 상태, Library search/filter/action 정렬 유지.
- 접근성: WCAG AA 기준 normal text 4.5:1, 큰 텍스트 3:1, 중요한 control/focus 3:1 목표로 후보색 평가. decorative 선은 대비 대상 내용으로 쓰지 않음. 색만으로 active/status를 전달하지 않음.
- 성능: 브라우저에서 좌표 변경 시 React 전체 재렌더/네트워크 요청 없음 확인. gradient/mask는 paint를 일으킬 수 있으므로 compositor-only라고 주장하지 않는다. root bounds만 repaint하고 CPU 비용이 높으면 장식 밀도/영역을 먼저 줄인다. layout shift/반복 animation 없음.
- reduced-motion 및 coarse/touch: 추적 RAF 없음, static gradient, translate/scale 전환 없음. keyboard/touch 선택은 동작. 공개 화면 외 미확인 상태와 시각 검토 부족은 완료 증거로 대체하지 않는다.

## Completion Criteria

- [ ] 승인된 토큰/shape와 모든 소유 CSS의 감사가 완료됨.
- [ ] 명시한 두 DOM 경계에서만 Blueprint interaction이 동작함.
- [ ] static/clickable 구분, login preview/pin, workflow 인접 line이 명세를 충족함.
- [ ] layout/업무 API/인증/가드/legacy authority가 보존됨.
- [ ] 허용된 static/direct-runtime 검토가 완료되고 미검증 항목이 해결되거나 사용자에게 명시적으로 수락됨.
- [ ] 실제 결과로 architecture/development 문서와 Plan index를 갱신함.

## Execution Record

### Visual reference refinement

사용자가 `docs/references/example/change_theme.png`와 `change_theme2.png`를 Visual Source of Truth로 지정했다. 두 이미지를 직접 열어 큰 제목/작은 metadata, off-white 배경, Ink sidebar, 선명한 blue, 기본 grid와 선 중심 구성을 비교했다. 기존 기능/DOM은 그대로 두고 heading을 넉넉한 제목 band로 만들고 desktop 40px 제목/10px mono eyebrow, widget header divider, 밝은 Cobalt와 기본 grid를 적용했다. pointer 강조는 heading 14%/12%, login 22%/18%이며 기본 grid는 각각 3%/4%다. 이는 앞선 초기 수치보다 레퍼런스에 가깝게 조정한 값이다. gradient만 leave fade-out하고 기본 grid는 유지한다.

공개 로컬 로그인 DOM/computed-style 확인에서 기본 grid 존재, hover opacity 0→1, 1024/390/844px 가로 overflow 없음을 확인했다. 테스트·빌드·스크린샷은 실행하지 않았다. 인증된 업무 화면의 실제 이미지 비교/시각 수락은 여전히 대기이며, 레퍼런스와 전체 화면을 시각적으로 검증 완료했다고 주장하지 않는다.

계획 작성만 수행했다. 소스/스타일/인증 기능은 변경하지 않았고 테스트·빌드·브라우저 실행도 하지 않았다. PLAN-0016 상태는 변경하지 않았다. 승인 대기 중이다.

### Approved execution / 2026-09-15

- 사용자가 전체 전환을 하나의 작업으로 승인했다. 적용 순서는 tokens → shared UI → layout → blueprint → login → features → validation으로 통합한다. 기존 PLAN-0016 구현은 유지하고 남은 검토를 이 Plan으로 이관하여 superseded 처리했다.
- 공용 heading glow/grid 3%/5%, 로그인 6%/9%로 차등 적용했다. 320px 국소 radial mask, pointermove/RAF, leave/cancel/unmount cleanup, coarse pointer 차단과 reduced-motion 정적 표현을 구현했다.
- Workflow track 내 최근접 node 전환에 경계 양쪽 16px dead-zone을 적용했다. 실제 브라우저에서 +5/+15px 기존 Commit 유지, +17px Build, -5px Build 유지, -17px Commit 복귀를 확인했다.
- 전체 공용/feature CSS가 Porcelain/Cobalt/6–8px token을 사용한다. circle/none는 의미별 token으로 분리했다. CSS literal hex는 tokens.css에만 남았고, inline style 검색에서는 실제 Progress transform만 확인했다. 마스크의 black/transparent는 알파 마스크 문법이며 브랜드 SVG 원색은 예외다.
- Sidebar indicator, 지정 metadata monospace, 실제 clickable catalog/card만 이동, static panel/task/widget 유지, progress 실제 값 scaleX, 공용 control focus/disabled 상태를 적용했다. 기존 drag/drop handler/API/session/store는 수정하지 않았다.
- 직접 로컬 공개 로그인 확인: 1440/1024/1023/390/844px에서 수평 overflow 없음, 1024 미만 workflow unmount, click-pin 유지, reduced-motion 정적 opacity 0.5/transition 0s, 공개 로그인 정상 렌더. runtime pageerror 출력 없음.
- 테스트/빌드/스크린샷은 사용자 지침에 따라 실행하지 않았다. 수정 파일의 코드 포맷은 적용했다. CSS cascade/responsive 및 API/auth 미변경은 소스에서 검토했다.
- 제한: 자동화 브라우저는 인증 세션이 없어 `/projects`에서 로그인 화면을 반환한다. 인증된 전체 route의 시각 비교, 실제 Dashboard/Task drag/drop, modal focus/unsaved guard, auth disabled/error/pending 상태는 런타임 검증하지 못했다. 사용자 로그인 브라우저 검토 없이는 완료로 표시하지 않는다. 승인된 최종 통합 검증의 이 항목들은 남아 있다.
