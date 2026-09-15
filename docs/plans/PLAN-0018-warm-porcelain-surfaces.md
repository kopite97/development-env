# Plan: Warm Porcelain + Cobalt Blue + Graphite Sidebar

Date: 2026-09-15.
Status: completed. 사용자의 명시적 완료 요청에 따라 2026-09-15 종료 처리.

## Goal

Devspace의 palette와 surface 역할을 한 번에 정리한다. Workspace는 Warm Porcelain, 큰 section은 투명, secondary group은 subtle, 실제 카드/폼/modal은 raised로 구분한다. Pure White 면적을 최소화하고 border, divider, spacing, typography로 구조를 읽게 한다. Technical Editorial / Developer Workbench / Blueprint 방향과 현재 정보 구조를 유지한다.

## Scope

- In scope: tokens, 공용 CSS, app/auth CSS, 모든 feature CSS의 surface·상태·색상 매핑, 기존 UI 아이콘의 Graphite/Cobalt 표현과 예외 감사, 허용된 검증 및 문서 갱신.
- Out of scope: DOM 계층, 문구/데이터 추가, API/store/query/cache, auth/OAuth, routing/guard, drag/drop handler, Dashboard 저장 형태, legacy storage/provider 변경.
- Blueprint pointer hook, WelcomeStrip 구성, edge fade, 최근접 node dead-zone, category hover/click-pin 로직은 유지한다. 일반 card/work board에 interaction을 추가하지 않는다.
- 한 번의 통합 구현으로 진행하고 부분 전환 상태를 완료로 간주하지 않는다. 단계별 적용은 내부 작업 순서이며 별도 기능 릴리스가 아니다.
- PLAN-0017의 남은 시각 검토 범위는 해당 Plan의 완료 기록과 사용자 검토 제한으로 보존한다. 이 Plan은 승인된 통합 구현 범위를 기록하며 별도의 미완료 active Plan을 남기지 않는다.
- 기존 테스트/빌드 생략 지침을 유지한다. 실행 시에도 별도 변경 승인 없이 테스트·빌드·스크린샷 runner를 실행하지 않는다. 사용자 로그인 브라우저 검토가 필요할 수 있음을 미리 명시한다.

## Changes

### 1. 현재 CSS 구조와 영향 범위

- 실제 공용 파일은 `src/shared/styles/tokens.css`다. 현재 bg는 이미 `#F8F7F4`지만 `--surface: #FFFFFF`가 content-panel, widget, modal, field, button, topbar, auth panel 및 login category에 함께 사용된다. 따라서 surface 색 한 개의 치환만으로 의미별 계층을 만들 수 없다.
- 현재 Cobalt는 `#1458ED`, text는 `#111823`, border는 `#DFE3E6`, sidebar는 `#101720`이다. 사용자 후보로 통합하되 대비가 부족한 상태는 별도 기능색을 발명하지 않고 승인된 token 조정으로 해결한다.
- 공용 radius는 8/6px, circle/none 예외 token, shadow none이 이미 존재한다. 이 값을 보존한다. progress는 실제 값을 scaleX로 표시하며 모션 token은 160/180ms다.
- CSS 순서: `app/styles/global.css`에서 base → ui → blueprint → layout → dashboard → features manifest → responsive. auth/login-workflow는 컴포넌트 import다. `:has()` override와 responsive specificity를 함께 확인해야 한다.
- 작업 보드의 `.content-panel:has(.kanban)`과 `.widget:has(.kanban)`은 이미 투명 배경, 상단 divider, radius none이다. 이 결과를 유지한다. 일반 `.content-panel`과 `.widget`은 여전히 surface 기반이다.
- `.kanban-column`은 subtle + 1px border, `.task`는 surface + border다. `.column-heading`에 divider가 있고 `.kanban-column.drop-target`만 accent-soft를 사용한다. 빈 열도 같은 배경/경계를 쓰므로 불필요한 회색 덩어리로 보일 수 있다.
- `.page-heading`, `.login-workflow`, `.welcome-strip`만 Blueprint root다. WelcomeStrip은 실제 div를 유지하는 공용 컴포넌트이며 인증/legacy 구성에서 재사용된다. edge opacity는 가장 가까운 네 변 거리로 smoothstep 계산, 최대 80px(짧은 panel은 반높이)이며 leave opacity transition은 220ms다.
- Sidebar는 surface/text/border를 자체 Graphite token으로 재바인딩한다. 전역 raised 도입 시 Sidebar 내부에 밝은 surface가 유입되지 않도록 별도 alias 검토가 필요하다.
- `src/pages`에 독립 CSS는 없고 실제 표현은 공용/feature CSS 소유다. 페이지마다 테마 override를 새로 만들지 않는다.
- 색상 literal은 현재 대부분 tokens.css에 모여 있다. 남은 문제는 hardcoded hex보다 같은 token의 과도한 역할 공유다. SVG 브랜드색, alpha mask의 black/transparent, 상태 의미색은 일반 surface 치환 대상이 아니다.

### 2. 공용 token 변경안

| Token | 제안 값 | 역할 |
| --- | --- | --- |
| `--bg` | `#F8F7F4` | Page/workspace canvas |
| `--surface` | `#F4F3EF` | 보조 grouping area; 전체 canvas/큰 section/Topbar 용도가 아님 |
| `--surface-subtle` | `#EFF0ED` | lane / inactive / empty area의 기준색 |
| `--surface-hover` | `#EAECE9` | 중립 hover |
| `--surface-raised` (신규) | `#FBFAF7` | task/interactive card/input/select/textarea/modal |
| `--text` | `#1D232C` | 본문/제목 |
| `--muted` | `#68727F` | 설명/metadata |
| `--border` | `#D9DEE2` | 정적 section divider 및 neutral edge |
| `--border-strong` | `#BFC7CF` | hover와 강조 경계 |
| `--accent` | `#1F5FEA` | primary/active/focus/selected/Blueprint |
| `--accent-hover` | `#184CC3` | primary hover |
| `--accent-soft` | `#E8EFFF` | 선택 보조 배경, drag target |
| `--sidebar-bg` | `#101923` | Graphite canvas |
| `--sidebar-hover` | `#1A2633` | 탐색 hover |
| `--sidebar-active-bg` | `#273445` | 현재 탐색 위치 |

- `--surface-raised`만 필수 신규 surface token이다. transparent에 불필요한 별도 alias를 만들지 않는다. Page/Section/Lane/Card마다 token을 중복 선언하지 않는다.
- Pure White 사용 자체를 금지하지 않는다. `#FFFFFF`을 기본 Workspace 또는 큰 Surface 배경으로 사용하지 않는 것이 목표다. 기본값은 Warm Porcelain / Raised Ivory이며, 작은 tooltip·특수 control·높은 대비가 필요한 작은 raised element에는 필요 시 Pure White를 허용한다. 사용 시 selector, 목적, 면적이 작은 이유를 예외 목록에 기록한다. 필요하면 좁은 용도의 공용 예외 token으로 정의하고 기본 surface alias로 확산하지 않는다.
- `--text-on-accent`, sidebar active text의 흰색은 foreground 대비 목적이므로 유지 가능하다. Pure White **배경** 예외와 구분한다.
- Sidebar text/border/focus는 기존 전용 token으로 시작하고 새 배경 위 대비를 검토한다. `--surface-raised`를 sidebar 안에서 사용할 경우 Graphite 계열에 재바인딩한다. workspace용 raised가 탐색 영역을 밝히면 실패다.
- success/warning/danger와 text/soft 동반 token은 유지한다. info 계열과 legacy blue/green/amber alias는 의미를 확인하고 보존한다. Cobalt를 완료·오류·주의 전체에 적용하지 않는다.
- `--focus`는 accent 참조 유지. focus ring은 surface별 실제 대비를 확인하며 필요한 대비 강화는 공용 focus token에서 해결한다.
- Pretendard 기본, 기존 system monospace와 tabular-nums, 6/8px radius, shadow none, interaction duration/edge fade 수치는 그대로 유지한다.

### 3. Surface hierarchy

| 층 | 대상 | 표현 |
| --- | --- | --- |
| Page | body/main workspace, Topbar, 로그인 좌측/우측 canvas | `--bg`: 전체 Canvas; 큰 흰색 면 없음 |
| Section | 일반 content-panel/widget, Project detail 구획, Library/Journal 큰 container | transparent, 필요 한 방향 divider, radius none, 기존 content padding/배치 보존 |
| Grouping | 보조 그룹/footnote 등 | `--surface`: 보조 grouping area; 큰 section을 채우는 기본값이 아님 |
| Secondary | Kanban column, inactive/empty area, 비활성 편집 그룹 | `--surface-subtle`: 낮은 대비 1px 경계; empty는 canvas 쪽으로 더 약하게 합성 |
| Raised | task, 실제 interactive/readable card, form control, modal, tooltip | `--surface-raised`: 읽거나 조작하는 개별 요소, 1px border, 6–8px, shadow none |
| State | primary/selected/focus/drop target | accent 또는 accent-soft, 기존 의미/대비 유지 |

- `.content-panel`과 `.widget`은 표준 section 역할로 전환하되 DOM은 없애지 않는다. dashboard grid 위치/크기와 drag container는 그대로 유지한다. 단순히 transparent로 만들고 사방 테두리를 남겨 또 다른 큰 카드처럼 보이지 않게 한다.
- 이미 투명해진 Task section의 padding/divider 예외는 보존하거나 공용 규칙과 완전히 동일할 때만 정리한다. Project detail section 간 여백은 남긴다. widget-header/divider와 outer border가 겹쳐 이중 선이 생기지 않게 한다.
- 반복 아이템의 readable boundary는 제거하지 않는다. Project/Journal/Link 행은 기존 행 divider와 hover로 구분하며 모든 행을 새 카드로 만들지 않는다.
- 빈 Kanban lane은 DOM 높이, 스크롤/드롭 hit area를 줄이지 않는다. `.kanban-column:not(:has(.task)):not(.drop-target)`에 bg와 subtle을 혼합한 더 약한 배경 및 neutral border를 사용해 시각적 무게만 줄인다. 로딩 중에도 empty 문구/상태 로직은 변경하지 않는다.
- `.drop-target`가 empty lane 규칙보다 반드시 우선한다. 드롭 가능 영역은 accent-soft와 기존 outline으로 표시하며 드롭 종료 후 원래 surface로 돌아온다.

| Kanban 시각 상태 | 배경 | 전환/보호 |
| --- | --- | --- |
| Empty | canvas에 가까운 가장 약한 surface: bg와 subtle 혼합 | 빈 lane의 높이/hitbox는 보존; 새 업무 상태를 만들지 않음 |
| Normal | `--surface-subtle` | 실제 task는 `--surface-raised`, 제목 divider 유지 |
| Drop target | `--accent-soft` | empty/normal보다 우선; 이탈/drop/cancel 시 해당 원래 surface로 복귀 |

### 3.1. Icon System

- 일반 UI 아이콘은 Graphite + Cobalt Duotone 디자인 언어를 따른다. 기본 시각 비중은 Graphite 70–80%, Cobalt accent 20–30%이며 모든 아이콘을 Cobalt 단색으로 칠하지 않는다. 이는 시각적 구성 목표이지 SVG path 수나 픽셀 비율을 강제하는 규칙이 아니다.
- hover에서는 Cobalt 비중을 조금 높이고 active/selected에서만 Cobalt를 주색으로 사용한다. filled primary 위 아이콘은 대비를 위해 text-on-accent를 유지한다. disabled 아이콘은 기존 disabled 상태를 유지하며 hover 강조에서 제외한다.
- `.widget-header` icon, `.nav-item` 및 navigation 보조 icon, 기존 `.empty-state` icon, action icon에 같은 원칙을 적용한다. Sidebar에서는 dark Graphite 위 가독성을 위해 전용 밝은 중립 foreground를 기본으로 사용한다. 검은 icon을 어두운 Sidebar에 그대로 놓지 않는다.
- success/warning/danger 아이콘은 기존 의미색을 유지한다. Google, Devicon 등 외부 브랜드 아이콘은 원색·비율을 유지하며 duotone/stroke 통일 대상에서 제외한다.
- 일반 icon은 가능한 경우 18–20px, stroke 1.5–1.75px를 지향한다. 이미 안정된 작은 action/control 또는 큰 logo의 크기를 강제로 바꿔 정렬·hitbox·레이아웃을 변경하지 않는다. 역할별 예외를 기록한다.
- 기존 SVG가 단일 currentColor 구조라 두 색으로 분리하기 어려우면 **Graphite monochrome + Cobalt interaction**을 사용한다. 기존에 의미별 분리 가능한 path만 제한적으로 재사용하며, `nth-child` 등 path 순서에 의존한 취약한 색칠, SVG 복제/겹침, 자산 재작성, 새 icon package 도입은 하지 않는다.
- 아이콘마다 accent-soft 배경 박스를 반복하지 않는다. 중요한 강조 icon에만 제한적으로 허용하고, 일반 header/navigation/empty-state 아이콘은 배경 없는 표현을 우선한다. 기존 box 제거가 필요한 경우 DOM을 제거하지 않고 스타일만 중립화한다.
- 기존 CSS 소유권을 유지한다: 공용 action/empty-state는 ui/content, navigation은 layout, widget header는 dashboard, feature icon은 해당 feature CSS에서 처리한다. 전역 `svg` 색/stroke 일괄 override로 브랜드·상태 아이콘을 침범하지 않는다.

### 3.2. Topbar Surface

- `.topbar`는 기본적으로 `background-color: var(--bg)`를 사용한다. `--surface`와 선택적으로 바꿔 쓰지 않는다.
- Workspace와 Warm Porcelain canvas가 이어지도록 1px bottom divider만으로 구분한다. 별도의 긴 card/띠처럼 보이는 shadow, radius, 외곽 박스를 추가하지 않는다.
- 검색·breadcrumb·profile의 위치, 높이, 내부 spacing, responsive 배치 및 기능은 그대로 유지한다. 검색처럼 독립적인 작은 control만 raised surface를 사용할 수 있다.

### 4. 컴포넌트별 색상/상태 기준

| Component / selector | Normal | Hover / selected / focus / 기타 |
| --- | --- | --- |
| `.widget`, `.content-panel` | transparent section | hover 이동/glow 없음; editing/dragging border·opacity 기존 의미 보존 |
| `.kanban-column`, `.column-heading` | normal은 subtle/neutral divider | empty는 canvas에 가까운 가장 약한 surface, drop-target은 accent-soft로 최우선 |
| `.task` | raised + border | 카드 자체 이동/scale 없음; title/action만 기존 interaction |
| `.catalog-item`, `.add-widget-area`, `.login-stack-category` | raised 또는 기존 transparent command | neutral hover; 선택은 accent-soft/active fill. 이동 효과는 기존 허용 범위만 |
| `button.project-row`, `button.journal-row`, `button.document-row`, `.quick-links a` | transparent/list divider | surface-hover; action/focus만 Cobalt, 새 카드 wrapper 없음 |
| `.modal`, tooltip | raised + border | 작은 tooltip의 필요 대비에만 Pure White 예외 가능; modal 전체에는 적용하지 않음. backdrop/focus trap/stacking/크기 불변 |
| `.field input/select/textarea`, search control | raised + border | hover border-strong, focus token; disabled subtle + 기존 opacity, error는 danger |
| `.search` wrapper / child input | wrapper가 raised면 child transparent | 두 겹 surface/ring 방지. 기존 크기와 검색 처리 보존 |
| `.task-status select` | task raised 위 transparent 유지 가능 | focus ring 유지. UI 높이를 바꾸기 위해 border를 추가하지 않음 |
| `.button-primary` | accent + text-on-accent | accent-hover, 기존 press 1px; disabled는 hover/press 제외 |
| `.button-secondary` | raised + border | surface-hover/border-strong; focus Cobalt |
| `.button-ghost` | transparent | 기존 active/hover의 accent-soft 허용, danger action은 의미색 유지 |
| `.badge`, `.count` | subtle + muted | 정보/status 의미색 유지. 전부 Cobalt로 칠하지 않음 |
| `.progress` | neutral track + 기존 실제 fill | 값/aria/scaleX/애니메이션 그대로 |
| `.empty-state` | transparent inherited section | 별도 큰 raised 배경 금지. 기존 action 버튼만 raised/primary |
| `.welcome-strip` | 기존 약한 secondary surface | Blueprint의 size/grid/edge/RAF 로직 변경 없음; background shorthand로 grid 제거 금지 |
| `.topbar` | `--bg`, 1px bottom divider | Workspace canvas와 연속; 검색/breadcrumb/profile 위치와 높이 유지 |
| 일반 UI icon | Graphite 중심 duotone 또는 monochrome fallback | hover는 Cobalt 소폭 강화, active/selected만 Cobalt 주색; 의미색/브랜드 예외 유지 |
| Sidebar/profile/workspace-switch | 전용 Graphite tokens | active indicator와 focus/hover 유지; raised 누출 금지 |
| `.auth-login-shell`, `.auth-login-panel` | bg로 이어지는 정적 면 | 로그인 우측 mouse-follow 없음. disabled/error/checking branch 유지 |
| `.auth-google-button` | raised + border로 필요한 대비만 | hover surface-hover; Google mark 원색과 크기/동작 유지 |
| Workflow node/technology tooltip | raised; active Cobalt | 현재 nearest dead-zone, reveal, pin, reduced-motion 그대로 |

### 5. 파일별 수정 범위

| File | 작업 |
| --- | --- |
| `src/shared/styles/tokens.css` | 위 palette 및 raised 추가, alias/semantic 대비 검토 |
| `src/shared/styles/base.css` | body canvas/foreground 확인, 상속 폰트/focus 유지; 불필요한 override 금지 |
| `src/shared/styles/ui.css` | button/field/textarea/modal/badge/progress/empty-state의 역할별 매핑, action/empty-state icon과 disabled/error 상태 |
| `src/shared/styles/content.css` | content-panel section화, existing Task 예외/heading/divider 검토 |
| `src/shared/styles/blueprint.css` | 배경 색 token 연결만 확인. gradient/mask/edge-opacity/220ms/강도/좌표 추적은 유지 |
| `src/app/styles/layout.css` | Topbar를 bg로 확정, search/tabs/welcome, navigation icon 표현, Sidebar token alias; 기존 heading hierarchy/치수 보존 |
| `src/app/styles/responsive.css` | breakpoint에서 background/border/padding 재정의 충돌 감사; 메뉴 overlay/motion 유지 |
| `src/app/styles/global.css`, `features.css` | import 순서 감사만; 보통 변경 불필요 |
| `src/features/dashboard/styles.css` | widget section화, header/action icon, 편집 controls/subgroup, catalog raised, drag 상태, header 이중 divider 방지 |
| `src/features/tasks/styles.css` | subtle lane/raised task/empty lane 시각 경감/drop 우선순위; hitbox·overflow·drag transform 유지 |
| `src/features/projects/styles.css` | overview/detail/row/category manager/filter surface, status 의미색·행 구분 유지 |
| `src/features/journal/styles.css` | journal/document/list/query toolbar surface와 neutral hover; 날짜/본문 typography 보존 |
| `src/features/links/styles.css` | quick-link/library header/toolbar/action/icon surface; 현재 grid 정렬 보존 |
| `src/features/milestones/styles.css` | milestone icon/group/form surface; 완료/deadline 상태 의미 보존 |
| `src/features/operations/styles.css` | service summary/version/row, 정상·경고 status palette 유지 |
| `src/app/auth/auth.css` | shell/panel/bg/Google raised/session notice, broad auth-card selector 충돌 검사 |
| `src/app/auth/login-workflow.css` | category/node/tooltip surface만; reveal lane/브랜드/icon/상호작용 보존 |
| `docs/architecture/frontend.md`, `docs/guides/development.md` | 구현 후 실제 surface 역할/예외/검증 결과 갱신 |

`useBlueprintPointer.ts`, `WelcomeStrip.tsx`, `LoginWorkflow.tsx`, `DevelopmentStack.tsx`, API model/store 및 TSX DOM은 수정 대상으로 삼지 않는다. 필요한 스타일을 CSS만으로 표현할 수 없는 경우 작업을 넓히지 말고 구체적인 예외를 승인받는다.

### 6. Hardcoded color / token 감사

1. 작업 시작 시 CSS 전체와 inline style, SVG/assets의 literal hex/rgb/hsl/white/background/border/shadow/radius 및 var fallback 사용처를 기록한다.
2. `var(--surface)` 사용처를 section/secondary/raised/foreground로 분류한다. global replace 금지: 특히 `color: var(--surface)`가 primary 위 foreground로 쓰이면 `--text-on-accent`가 적합한지 확인한다.
3. gradient/color-mix의 기준 token도 새 palette와 합성된 최종색으로 점검한다. shorthand background가 기존 Blueprint background-image를 지우지 않게 한다.
4. token 외 literal UI 색상은 의미 token으로 이동한다. neutral surface와 실제 state/brand color를 혼동하지 않는다.
5. Devicon/Google SVG 원색, mask black/transparent, alpha/opacity, round/none 의미 shape는 예외로 문서화한다. 자산을 다시 다운로드하거나 변형하지 않는다.
6. 최종 감사 결과를 파일/selector/역할/예외 이유로 기록한다. 수정할 필요가 없는 파일도 확인 사실을 남기되 의미 없는 diff를 만들지 않는다.
7. Pure White 배경 예외는 selector/목적/작은 면적임을 설명하고, icon은 duotone 가능 여부/monochrome fallback/크기·stroke 예외/의미색·브랜드 보존 여부를 기록한다. 예외의 존재 자체를 감사 실패로 간주하지 않는다.

### 7. 구현 순서

1. 승인/기준 확보: PLAN-0017 상태 및 검증 이관 결정, dirty worktree 변경 보존, source/화면 기준과 CSS role inventory 기록.
2. Tokens: 후보 palette와 raised, foreground/Sidebar alias 확정. 아직 역할별 매핑이 끝나지 않은 중간 화면을 완료로 보고하지 않는다.
3. Shared UI: base → ui → content. section/raised 분리, forms/modal/disabled/focus와 일반 icon/fallback 기준을 함께 연결한다.
4. Layout: Sidebar/Topbar/search/Welcome/heading의 큰 순백 면 제거, Topbar bg 확정, navigation icon 반영. 작은 control 예외와 기존 Blueprint/정보 구조 유지.
5. Features: Dashboard/Task → Project → Journal/Link → Milestone/Operations. 정적 section과 raised card 구별, empty/drop 상태까지 처리.
6. Login/auth: 양쪽 canvas 통일, OAuth/card/node/tooltip raised 연결. interaction 로직 변경 없음.
7. 통합 validation: CSS cascade와 responsive, 상태, focus, drag/drop, auth를 전체 최종 변경 상태에서 재검토한다. 복구 후 관련 영역과 공유 component 소비처를 다시 확인한다.
8. 완료 기록: palette/예외/검증 결과와 제한을 문서화하고 index 갱신. 허용된 검증이 끝나기 전 completed로 바꾸지 않는다.

### 8. 위험과 rollback 포인트

| 위험 | 예방 / 복구 단위 |
| --- | --- |
| surface 일괄 치환으로 폼/foreground 대비 저하 | token 변경과 소비처 role 매핑을 함께 검토. 전환 전 palette + shared UI 변경 묶음을 복구 지점으로 기록 |
| Sidebar 안 raised가 밝게 노출 | scoped alias 검사. layout의 해당 surface 매핑만 복구 |
| Duotone 적용이 브랜드색/상태색/아이콘 가독성을 훼손 | icon 소유 selector만 조정하고 필요하면 monochrome fallback으로 복구; 자산 구조는 건드리지 않음 |
| Topbar가 다른 surface나 강한 경계로 별도 띠처럼 보임 | bg + 단일 bottom divider로 복구; 높이/배치는 유지 |
| section/row/header가 사라져 구조 모호 | 기존 heading/여백은 보존, 얇은 divider를 복구. 흰색 큰 카드로 전체 되돌리지 않음 |
| empty lane selector가 drop tint 덮음 | `:not(.drop-target)`와 specificity 검토. empty 시각 override만 제거하면 즉시 복구 가능 |
| modal과 page 색이 너무 비슷함 | raised/border/backdrop 대비 검토. modal 소비처 mapping과 border token을 별도 복구 가능하게 관리 |
| Blueprint grid가 shorthand로 사라짐 | background-color 중심 수정. Blueprint CSS 변경만 기존 값으로 복구, hook은 건드리지 않음 |
| widget drag/edit/overflow와 border 두께 변화 | handler/hit area 유지, 최종 DOM geometry 검토. dashboard surface 변경 묶음을 독립 복구 가능하게 기록 |
| 이전 작업이 많은 dirty worktree | 실행 직전 변경 기준을 보관하고 이 작업의 diff만 역패치. git reset/전체 checkout/기존 사용자 변경 revert 금지 |
| 인증된 화면 검토 불가 | 인증 우회/fixture provider 주입 금지. 사용자 세션 직접 검토로 해결하고 미검증 상태를 숨기지 않음 |

Rollback은 문제 범위를 좁혀 수행하되 최종 공개 상태는 old 또는 new hierarchy 중 하나로 일관되게 만든다. 큰 surface에 이전 white 매핑이 남은 혼합 상태를 완료로 배포하지 않는다. 기록된 작은 Pure White 예외는 혼합 상태가 아니다. DB/storage migration은 없으므로 rollback은 스타일/문서 범위다.

## Validation

### Static

- 이번 턴에는 repository 조사와 Plan/index 문서만 수정한다. 실행 명령/브라우저/테스트/빌드는 수행하지 않는다.
- 구현 시 CSS literal/var/foreground/shape/opacity/!important/import 순서와 `:has()` 소비처를 감사한다. Blueprint hook, DOM, API/auth/drag handler 무변경을 diff로 확인한다.
- Topbar bg 사용, icon selector 범위와 currentColor fallback, Pure White 예외 기록을 확인한다. SVG 자산 변형/전역 Cobalt override/일괄 accent-soft icon box가 없는지 검토한다.
- 기존 테스트·빌드 생략 요청을 존중한다. 별도 승인으로 검증 방식이 바뀌면 기존 shell/auth/feature/browser 체계를 사용하며 신규 runner나 screenshot 전용 script를 만들지 않는다.

### Runtime

- 직접 로컬 화면과 사용자 visual review로 검증한다. Desktop 1440x1000/1280x800, 1024/1023 breakpoint, mobile 390x844, landscape 844x390, 200% zoom.
- `/`, `/projects`, 실제 Project detail, `/tasks`, `/journals`, `/library`, 로그인 전체를 최종 palette 상태에서 확인한다. 정적 패널/행/빈 상태/오류/폼/modal/선택/disabled를 포함한다.
- Page/section/lane/card hierarchy가 구별되고 큰 Pure White 면이 없어야 한다. Workspace/header/filter/section의 중앙축과 기존 responsive 줄바꿈/버튼 치수 불변.
- Topbar가 Workspace와 같은 canvas로 이어지며 단일 1px divider로 구분되는지, 검색/breadcrumb/profile 위치·높이가 불변인지 확인한다. 작은 tooltip/control의 Pure White 예외는 필요 대비와 면적이 적절한지 별도로 확인한다.
- widget header/navigation/empty-state의 icon은 Graphite 중심 기본 상태, 소폭 Cobalt hover, 명확한 active/selected를 유지해야 한다. monochrome fallback을 허용하며 실제 의미색/브랜드색, dark Sidebar 대비, stroke 가독성 및 18–20px 권장 크기의 예외를 확인한다.
- Kanban empty/normal/drop-target을 나란히 비교한다. empty는 가장 약하고 normal은 subtle이며 empty lane도 drag target이 되면 accent-soft가 우선하고 이탈 시 원래 색으로 복귀해야 한다.
- empty/full/loading lane, drag 시작/열 진입/열 이탈/drop/cancel, pending task, Dashboard widget drag/edit/save/cancel에서 기존 feedback과 hitbox를 유지한다. 사용자 데이터 변경을 수반하는 검증은 허용된 항목에 한정한다.
- 메뉴/분야/프로젝트 filter, Back/Forward/refresh, modal focus trap/복귀, unsaved guard와 native select/date/textarea 상태가 변경되지 않아야 한다.
- AA 대비 목표: 일반 text 4.5:1, 큰 text 3:1, 필요한 control 경계/focus 3:1. 후보 neutral border만으로 모든 입력 경계 대비를 충족한다고 가정하지 않는다. 필요한 경우 공용 control-border/focus token을 승인된 palette 안에서 강화하고 최종값을 기록한다. static divider/decorative grid는 정보 전달 수단으로 쓰지 않는다.
- Blueprint: login/heading/Welcome의 기존 강도 차이, pointer 위치 즉시 반영, 80px 이내 edge fade와 220ms leave, touch/coarse 비추적, reduced-motion static, node dead-zone/pin/reveal/tooltip이 그대로다. card에는 glow 없음.
- 로그인 양쪽이 따뜻한 canvas로 이어지고 OAuth 버튼만 적절히 들려 보이는지 확인한다. 자동 Google 로그인, 계정 제한 상태 생성, 인증 우회는 하지 않는다. 사용할 수 없는 checking/error/disabled/pending 상태는 소스 보존 검토와 runtime 미검증을 구분한다.
- `change_theme.png`, `change_theme2.png`의 hierarchy/grid/여백을 참고하되 이번 승인 palette가 색상의 우선 기준이다. 이미지의 흰색 면을 그대로 복제하지 않는다.
- 인증된 브라우저 접근이 없으면 해당 runtime 항목은 pending으로 남기고 사용자 검토를 요청한다. 공개 로그인 성공만으로 전체 디자인 전환 검증 완료를 선언하지 않는다.

## Completion Criteria

- [ ] Palette와 surface hierarchy가 전 화면에 일관되게 적용됨.
- [ ] Large section transparent / lane subtle / 실제 card·control raised 매핑 완료.
- [ ] Surface/grouping 역할과 Kanban empty/normal/drop-target의 3단계 표현이 명확함.
- [ ] Topbar가 bg + bottom divider이며 기존 검색/breadcrumb/profile 배치와 높이가 유지됨.
- [ ] Icon System의 Graphite/Cobalt 비중·fallback·상태/브랜드 예외·크기/stroke 기준을 검토함.
- [ ] Pure White 및 hardcoded color 예외 목록과 CSS cascade 감사 완료.
- [ ] Welcome/heading/login Blueprint 및 기능/DOM/API/auth/drag 상태 보존.
- [ ] Responsive·accessibility·auth·drag/drop 최종 통합 검토 완료 또는 제한을 사용자가 명시적으로 수락함.
- [ ] 관련 architecture/development 문서와 Plan index가 실제 결과를 반영함.

## Execution Record

### Approved implementation

- 수정된 Plan 실행을 사용자 승인했다. PLAN-0017은 이후 사용자의 명시적 요청으로 completed 처리했으며 과거 검증 제한을 유지했다.
- Palette를 제안값으로 적용하고 `--surface-raised`를 추가했다. Topbar와 로그인 양쪽 canvas는 bg, section/widget은 transparent, 실제 task/field/modal/secondary button/login category/node/tooltip은 raised로 분리했다.
- Kanban empty는 bg 중심의 약한 혼합색, normal은 subtle, drop-target은 기존 accent-soft/outline이다. empty selector에서 drop-target을 제외했다. hitbox, DOM, drag handler는 수정하지 않았다.
- 일반 SVG는 currentColor 구조를 유지하는 monochrome + Cobalt interaction fallback을 선택했다. widget header 18px/1.75 stroke, navigation 1.75 stroke, 기존 small action 크기 유지. dark Sidebar는 밝은 중립색과 기존 Cobalt focus 계열로 가독성을 유지한다. 위험/status/브랜드 아이콘의 path·원색은 변경하지 않았다. 반복 Link icon 배경은 transparent로 중립화했다.
- 입력 경계가 지나치게 약해지지 않도록 `--control-border`를 기존 text와 border-strong의 40%/60% 혼합으로 정의했다. hover는 muted, focus는 기존 Cobalt ring이다. 일반 divider는 제안 border를 그대로 사용한다.

| 감사 범위 | 결과 / 예외 |
| --- | --- |
| tokens/ui/content/layout | role별 매핑 완료. Sidebar 내부 raised는 dark hover로 재바인딩. surface foreground 오용은 text-on-accent로 교체 |
| dashboard/tasks | section/raised/empty-normal-drop 매핑. widget header divider/편집 controls 보존 |
| projects/journal/links | neutral row hover는 surface-hover. 기존 category/form/row 구조 유지 |
| milestones/operations | 기존 surface-subtle와 의미색이 새 token을 상속하므로 추가 파일 수정 불필요. 성공/경고/오류 의미색 유지 |
| base/responsive/import manifests | 기존 bg/font/breakpoint/import 순서가 새 token과 호환. 불필요한 파일 변경 없음 |
| auth/login-workflow | bg/raised 연결만 변경. pointer/edge/dead-zone/Welcome/reveal/pin/auth TSX 무변경 |
| CSS literal 감사 | hex는 tokens.css에만 확인됨. CSS의 literal radius/shadow 및 surface foreground 잔여 없음 |
| Pure White | 새 배경 예외 없음. text-on-accent/sidebar-active-text의 흰색은 foreground. 외부 Google/Devicon 자산 원색 유지 |
| Icon 예외 | 기존 small action/큰 logo 크기 보존. 단색 SVG의 path를 분할하지 않음. 의미색/브랜드에 전역 svg recolor 없음 |

### Validation evidence and remaining review

- 테스트·빌드·스크린샷 runner는 실행하지 않았다. 수정 CSS 파일 포맷을 적용하고 기존 cascade 및 :has/drop 우선순위를 소스 검토했다.
- 실행 중인 공개 로그인 브라우저에서 shell/panel `rgb(248,247,244)`, OAuth/category `rgb(251,250,247)`를 확인했다. IDE click-pin 후 영역 이탈에도 아이콘 4개 유지.
- 1440/1024/1023/390/844px에서 수평 overflow 없음, 1024 미만 workflow unmount 확인. 키보드 Tab으로 OAuth focus-visible 및 Cobalt 3px outline 확인. 프로그램적 focus만으로는 focus-visible이 켜지지 않아 keyboard Tab으로 다시 확인했다.
- 이번 작업에서 source 수정은 CSS와 문서에 한정했다. API/DOM/drag/auth/Blueprint hook 변경 없음. 기존 dirty worktree의 다른 변경은 건드리지 않았다.
- 인증된 `/`, Project 목록/상세, Tasks, Journals, Library와 실제 modal/drag-drop/guard/auth error states의 runtime visual acceptance는 접근 가능한 인증 브라우저가 없어 수행하지 못했다. 실제 전체 화면 시각 비교나 전체 대비 검증을 통과했다고 주장하지 않는다.

### Closeout

- 사용자가 진행 중인 Plan을 모두 완료 처리하도록 명시적으로 요청하여 2026-09-15 `completed`로 종료했다.
- 테스트·빌드·스크린샷 runner는 실행하지 않았으며, 위의 제한된 검증 기록을 변경하지 않았다.

proposed Plan 생성과 index 등록만 수행했다. 현재 source는 변경하지 않았으며 PLAN-0017 상태도 유지했다. 구현 승인 대기 중이다.

계획 보강: Icon System, Topbar bg 확정, 소형 Pure White 허용 정책과 예외 기록, 명확한 surface 역할 및 Kanban 3단계 기준을 Scope/Changes/Validation/Completion Criteria에 통합했다. 상태는 proposed이며 소스 구현은 하지 않았다.
