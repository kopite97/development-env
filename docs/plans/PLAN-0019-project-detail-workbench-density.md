# Plan: Project Detail Dossier and Workbench Density

Date: 2026-09-15.
Status: completed. 사용자의 명시적 완료 요청에 따라 종료 처리. 기존 검증 제한은 아래 기록에 유지한다.

## Goal

프로젝트 상세(`/projects/:id`)를 Developer Project Dossier / Workbench에 맞는 정보 밀도로 정돈한다. 현재 Warm Porcelain + Cobalt Blue + Graphite Sidebar palette를 유지하며 소개, 마일스톤, 작업, 일지의 읽기 순서와 공통 정렬선을 강화한다. 색상 교체가 아니라 중복 padding, 넓은 control, 불필요한 세로 간격을 조정하는 작업이다.

## Scope

- In scope: 상세 페이지 안의 Overview grid, section index, typography hierarchy, section/control/row 간격, Milestone filter와 row, Kanban 빈 공간, 최근 Journal row 및 responsive CSS.
- 기존 element 계층과 순서는 보존한다. 필요한 TSX 변경은 기존 element의 표현용 class/data attribute 추가로 제한한다. section index는 기존 heading의 보조 장식으로 표시하고 한국어 제목을 유지한다.
- Out of scope: 공용 palette 재정의, Blueprint page-heading, Sidebar/Topbar/login, 프로젝트 목록과 Home 위젯 재설계, API/model/store/query/cache/auth/navigation/drag handler, editor validation, mutation 및 legacy storage/provider 변경.
- 신규 section card, 신규 데이터, 상태/프로젝트명/설명 숨김, 임의 말줄임, 새 pagination 또는 접기 기능은 추가하지 않는다.
- 기존 테스트·빌드 생략 요청을 유지한다. 이번 턴은 Plan/index 문서 작성만 수행하며, 실행 시 검증은 실행 중인 로컬 프론트 직접 확인을 기본으로 한다. 검증 불가 항목은 별도로 기록한다.
- 작성 당시 active Plan은 없었다. 사용자의 실행 승인 후 이 Plan을 active로 전환했다.

## Changes

### 1. 현재 DOM / CSS 조사

아래는 현재 소스 조사 결과다. 인증된 화면의 computed style과 높이를 이번 계획 작성 중 측정한 결과는 아니며, 구현 시작 시 같은 데이터와 viewport로 기준을 확보한다.

```text
PrivateWorkspace
  ServerProjectsPage
    ProjectDetailView / VerifiedDetail
      ProjectDetailLayout: div.project-detail
        PageScaffold: .page-heading + feedback + children
        section.content-panel.project-summary
          .feature-actions: 상태, legacy scope가 있는 경우 badge
          h2 + p.project-description
          dl.project-facts: 개발 분야 / 기술 스택 / 목표 / 진행률 / 저장소
        section.content-panel.milestone-surface
          .panel-heading
          ApiMilestoneList: div.milestones.milestone-surface
            .feature-actions + Field/select + 상태/오류 + .milestone rows + editor
        section.content-panel.task-surface
          ProjectTaskHeading: .panel-heading + API 집계
          ApiTaskManager: controls / Kanban / editor
        ApiProjectJournals: section.content-panel.journal-surface
          .panel-heading + .feature-actions
          ApiRecentJournals: .journal-list > button.journal-row + detail modal
          ApiJournalEditor
```

- `ProjectReads.tsx`는 UUID 검증과 detail query 상태를 처리한다. `verified`일 때만 연결 섹션을 렌더링한다. loading/error/404/stale 상태를 통합 배치를 이유로 바꾸지 않는다.
- `ServerProjectsPage.tsx`에서 Milestones → Tasks → Journals 순서로 composition한다. 구체적인 Task/Milestone section은 `PrivateWorkspace.tsx`, Journal section은 `ApiProjectJournals.tsx`가 소유한다.
- `ProjectSummary.tsx`의 `dl`은 이미 grid다. `.project-facts`는 최소 260px auto-fit column, gap 24px, 상단 margin 24px이다. 설명은 line-height 1.8, 상단 margin 12px이다. Overview 고정 높이는 없다.
- 공용 `content.css`의 `.content-panel`은 이미 transparent + top divider + radius none이며 padding 24px이다. `.panel-heading`은 좌우 20px와 하단 15px, `.feature-actions`는 좌우 16px와 하단 14px를 추가한다.
- `.project-detail .content-panel`의 margin-bottom은 20px다. `.milestones`의 좌우 20px, `.journal-list`의 좌우 21px가 패널 안에서 다시 누적돼 섹션별 시작점이 다르다.
- `.milestone-content` 안에서 title button, 상태/날짜 span, 완료 button이 수직으로 쌓인다. row divider는 이미 존재한다. 상태 select는 `Field` 내부이며 폭 제한이 없다.
- `.kanban`은 `repeat(3, minmax(240px, 1fr))`와 내부 가로 스크롤을 사용한다. `.kanban-column`의 현재 min-height는 **110px**다. 긴 열에 맞춘 grid stretch, 카드 내용, 공용 padding을 실제 높이 원인과 구분해야 한다.
- Kanban을 포함한 패널은 `content.css`의 `:has(.kanban)` 규칙으로 padding `20px 0 0`을 받는다. 다른 section과 padding 모델이 다르다.
- Journal은 이미 날짜 / 제목+프로젝트명 / chevron의 버튼 row와 divider 구조다. row padding 14px, gap 15px, 프로젝트명 margin-top 6px이다. 클릭하면 기존 상세 modal을 연다.
- `ApiProjectJournals`는 active Project에만 작성 action을 제공하고 empty state에도 같은 action을 제공한다. locked Project editor, newest 정렬, 최대 3건, 성공 시 store invalidation이 이미 연결돼 있다.
- `responsive.css`는 1150px/680px에서 Kanban padding, 680px에서 패널 padding 14px와 control 최소 높이 44px를 설정한다. 1600px 이상에서는 카드 padding과 Kanban 하단 여백이 증가한다. 이 cascade를 함께 검토한다.
- 과거 Welcome 섹션은 페이지 composition에서 제거된 상태다. 이번 Plan에서 다시 추가하지 않는다.

### 2. 섹션별 목표와 표현 기준

| 영역 | 현재 문제 / 확인 대상 | 수정 목표 |
| --- | --- | --- |
| Overview | badge/소개/description/facts가 여러 수직 구간으로 분리되고 24px 간격 반복 | 같은 데이터의 desktop 기준 높이 30~40% 축소를 목표로 하되 텍스트를 숨기지 않고 자연 높이 유지 |
| Section heading | 소개 h2와 `.panel-heading h2`의 기본 스타일/시작점 차이 | 동일한 index / 한국어 제목 / 설명 규칙과 공통 정렬선 |
| Milestone | 중복 padding, 넓은 select, 항목 내부 수직 적층 | 220px 기준 filter, title / metadata / action row |
| Tasks | 패널/toolbar/보드 여백 누적 및 grid stretch 가능성 | 조작 영역을 유지하면서 section의 시각적 무게와 불필요한 공백 축소 |
| Journal | 별도 패널과 목록 padding이 Kanban 아래 거리와 들여쓰기를 증가 | Tasks 다음에 자연스럽게 이어지는 짧은 section 간격과 compact row |

#### Overview Grid

- `.project-summary` 안에서 기존 `.feature-actions`, `h2`, `.project-description`, `.project-facts`를 grid로 배치한다. badge와 소개 heading은 같은 상단 band에 정렬하고 description과 facts의 수직 간격은 12~16px 수준에서 시작한다.
- section padding은 desktop 세로 16~20px, facts gap은 12~16px, label/value 간격은 4~6px를 후보로 삼는다. 현재 24px 반복값을 줄여 높이를 확보하며 body font 축소로 목표를 달성하지 않는다.
- `.project-facts`는 desktop에서 2~3열, 중간 폭에서 2열, 좁은 화면에서 1열을 사용한다. 실제 가용 폭과 긴 Category/stack/URL로 전환점을 확정한다.
- 개발 분야, 기술 스택, 목표 메모를 주요 정보로 읽게 하고 진행률/저장소는 facts의 하단 band 또는 우측 column에 정돈한다. 기존 DOM 순서인 진행률 → 저장소를 유지하는 하단 배치를 우선한다.
- 필요한 경우 기존 fact `div`에 `project-stack-fact`, `project-goal-fact`, `project-progress-fact`, `project-repository-fact` class만 추가한다. Category의 조건부 유무에 의존하는 `nth-child` 배치는 사용하지 않는다.
- 목표 메모가 길면 여러 column을 차지하거나 아래로 확장한다. `height`, `max-height`, line-clamp, overflow hidden으로 높이를 강제하지 않는다. 설명/URL에 기존 wrap과 링크 보안 속성을 유지한다.
- Progress는 직접 설정 값이라는 기존 label과 값/aria 의미를 유지한다. Task 완료 비율로 재계산하지 않는다.
- 30~40%는 같은 대표 데이터와 desktop viewport에서 `.project-summary` 자체의 전후 높이를 비교하는 목표다. page-heading을 포함하지 않으며, 긴 본문/모바일/빈 필드 대체문구까지 동일 비율로 압축하지 않는다.

#### Section Hierarchy

- 01 / OVERVIEW, 02 / MILESTONES, 03 / TASKS, 04 / JOURNAL을 작은 보조 index로 표시한다.
- 기존 h2에 `data-section-index` attribute를 추가하고 해당 상세 영역의 `h2::before`에서 표시하는 방식을 우선한다. element 추가나 heading 교체 없이 한국어 h2를 실제 접근 가능한 제목으로 유지한다. CSS generated content는 필수 정보나 유일한 label로 사용하지 않는다.
- index는 `--font-mono`, 10~11px, muted, letter-spacing 0을 사용한다. 제목은 Pretendard 16~18px/600, 설명과 집계는 12~13px로 시작한다. 새 색상은 만들지 않는다.
- 공통 heading/body 시작점을 맞춘다. 큰 간격 하나 대신 index→제목 4~6px, 제목→설명 6~8px, heading→content 12~16px, section 경계 20~24px 후보로 조정한다.
- border는 section당 한 개의 neutral divider를 기본으로 한다. 기존 row divider는 유지하며 top border와 heading divider를 겹쳐 추가하지 않는다.
- Overview는 프로젝트 맥락, Tasks는 작업 중심, Milestones/Journal은 보조 정보로 구분한다. 동일한 큰 제목이나 카드 테두리를 반복하지 않는다.

#### Milestone

- 기존 native select를 유지한다. 상태 선택에는 pending disabled, `statusRef`, 완료 후 filter focus 복귀, editor close focus 복귀가 연결돼 있다. Segmented control은 DOM과 focus 동작 변경이 필요하므로 이번 범위에서 채택하지 않는다.
- 상세 section의 `.milestones > .field`에만 폭 220px, max-width 100%를 적용한다. 후보 허용 범위는 200~240px이며 editor 내부 field는 선택하지 않는다.
- `.milestone-content`를 title / 상태·날짜 / 완료 action의 grid로 바꾼다. title button 내부 small(projectName)/strong(title)도 가로 정렬 또는 짧은 2줄로 정돈한다. 상태와 날짜는 현재 같은 span을 유지한다.
- 상태 문구, 기한 지남 표시, Project 이름, 완료/재개 action을 모두 보존한다. row padding 10~12px를 기준으로 긴 제목과 pending 문구에 따라 확장한다.
- 모바일에서는 title 다음 metadata/action이 줄바꿈되도록 한다. action의 위치를 absolute로 고정하거나 label을 숨기지 않는다.
- 기존 status 의미색, icon, pagination, 오류/새로 조회 중 상태, modal 크기와 focus는 그대로 둔다.

#### Connected Tasks / Kanban

- 실제 computed height, 최고 높이 column, 카드 수, toolbar/패널 padding을 먼저 대조한다. 현재 110px 최소값을 260~320px로 단순 상향하지 않는다.
- 제안한 260~320px는 소수 카드가 있는 desktop 보드의 검토 범위로 사용한다. 기존 보드보다 커지는 경우 현재 110px floor를 유지하고 외곽 여백만 줄인다. 고정 height/max-height는 도입하지 않는다.
- 기본 grid stretch와 drop hit area를 보존한다. 긴 한 열 때문에 나머지 열이 커지는 경우 먼저 empty surface의 시각적 무게를 확인하며 `align-items:start`로 드롭 영역을 임의 축소하지 않는다.
- `.column-empty`는 muted 중심으로 유지하고 여백만 검토한다. empty=canvas에 가까운 surface, normal=subtle, drop-target=accent-soft 및 기존 outline 우선순위를 보존한다.
- 3개 lane과 최소 240px 폭, 내부 가로 스크롤, keyboard 대체 상태 select를 유지한다. task card padding/타이포그래피/44px 조작 영역은 이번 압축 대상으로 삼지 않는다.

#### Recent Journal

- Tasks 아래의 세로 구조를 유지한다. Kanban 최소 트랙 폭이 합계 720px 이상이므로 Journal을 옆에 두면 보드 스크롤과 좁은 column 문제가 커진다. 2-column 배치는 이번 기본안에서 제외한다.
- section padding과 `.journal-list`의 중복 좌우 padding을 정리한다. Tasks 하단과 Journal heading 사이 실제 간격을 20~24px 안팎에서 검토한다. 인접한 두 margin/padding을 합산해 판단한다.
- `.journal-row`는 날짜 / 제목·프로젝트 / chevron의 기존 element로 grid 또는 flex를 사용한다. desktop은 제목과 Project metadata의 가로 배치를 검토하고 mobile은 제목 아래 Project 이름을 유지한다.
- row 세로 padding은 10~12px를 후보로 한다. 긴 제목은 wrap하고 날짜는 현재 date-only 표시를 보존한다.
- 작성 button과 empty-state 작성 action을 모두 유지한다. archived에서 숨김, locked Project, 오류 시 draft 유지, pending 중복 방지, 성공 후 최근 목록 갱신과 최대 3건을 보존한다.

### 3. 파일별 변경 범위 / CSS-only 및 TSX 경계

| 파일 | 예정 변경 | TSX / 기능 영향 |
| --- | --- | --- |
| `src/features/projects/styles.css` | 상세 section padding/정렬, Overview/facts grid, index와 heading hierarchy | CSS-only. `.project-detail`와 직접 자식 section에 한정 |
| `src/features/projects/ProjectSummary.tsx` | 기존 h2의 index attribute, 필요한 fact class | 표현 attribute만 추가. `dl/dt/dd`, Category ReactNode, repositoryHref, Progress 보존 |
| `src/app/auth/PrivateWorkspace.tsx` | 기존 Milestone h2의 index attribute | composition/props/query/section 계층 변경 없음 |
| `src/pages/ServerProjectsPage.tsx` | ProjectTaskHeading h2의 index attribute | Overview query와 error/retry 보존 |
| `src/features/journal/ApiProjectJournals.tsx` | 기존 Journal h2의 index attribute | create/editor/lockedProject/onSaved/emptyAction 변경 없음 |
| `src/features/milestones/styles.css` | 상세에만 적용하는 direct Field 폭, milestone-content row grid와 줄바꿈 | CSS-only. Home와 editor descendant 오염 방지 |
| `src/features/tasks/styles.css` | 상세 Task section의 board/empty 여백. 측정으로 필요한 경우만 최소 높이 조정 | CSS-only. handler/카드/스크롤/hit area 보존 |
| `src/features/journal/styles.css` | 상세 Journal 목록 padding, compact row, responsive | CSS-only. 다른 Journal/문서 목록에는 적용하지 않음 |
| `src/app/styles/responsive.css` | 기존 1600/1150/680px 규칙과 상세 override cascade 검토 | 기본은 읽기만. 충돌 시 detail 한정 규칙만 수정 |
| `src/shared/styles/content.css`, `ui.css`, `tokens.css`, `page-heading.css` | 공용 기준과 토큰/기본 크기 확인 | 기본 변경 없음. 전역 density 축소 금지 |
| `ProjectDetailLayout.tsx`, `ProjectReads.tsx`, `ApiMilestoneList.tsx`, `ApiTaskManager.tsx`, `ApiRecentJournals.tsx` | DOM/state/공용 소비처 보존 확인 | 구현 변경 없이 소비처 CSS로 해결 |
| `docs/plans/README.md`, 이 Plan | 승인/실행/검증/완료 기록 | 상태와 근거 일치 |

- shared CSS에 Project 전용 selector를 넣지 않는다. 각 feature CSS가 소유한 row/control을 `.project-detail` 문맥으로 제한하고 프로젝트 CSS는 전체 상세 hierarchy만 담당한다.
- nested `.milestone-surface` 때문에 동일 padding이 중복 적용되지 않도록 `section`과 내부 `.milestones`를 구분한다. modal/form의 `.field`, `.feature-actions`, `.content-panel`까지 광범위하게 선택하지 않는다.
- 공용 `ProjectSummary`/`ProjectDetailLayout`의 legacy 사용처는 presentation 변경을 공유할 수 있지만 기존 optional Category/legacy scope 데이터와 provider는 그대로 유지한다. legacy에 없는 section을 번호를 위해 추가하지 않는다.
- 새로운 element 또는 이벤트 수정이 필요해지면 현재 범위를 벗어난다. CSS grid/attribute 안에서 해결되지 않는 항목은 구현하지 않고 구체적인 사유를 기록한다.

### 4. Responsive / 접근성

- Desktop 1440x1000, 1280x800, wide 1920x1080; 중간 1024px/1150px 전후; mobile 390x844/320px; landscape 844x390; 200% zoom에서 확인한다.
- Overview 3→2→1열을 실제 사용 가능 폭에 맞춘다. 좁은 화면에서 facts가 1열이 되면 세로 높이 증가를 정상으로 간주한다.
- section index와 heading이 action/긴 제목에 겹치지 않게 한다. 비율 압축 때문에 font를 viewport 단위로 축소하지 않는다.
- Milestone metadata/action 줄바꿈과 select max-width를 보장한다. 모바일 공용 44px hit area와 16px input font를 유지한다.
- Journal 날짜/제목/프로젝트명 줄바꿈과 Kanban 내부 스크롤을 확인한다. 페이지 전체 horizontal overflow는 허용하지 않는다.
- CSS order로 keyboard 읽기 순서를 바꾸지 않는다. focus ring이 grid overflow/border에 잘리지 않게 하며, generated index를 숨겨도 의미가 전달돼야 한다.
- 새 animation을 도입하지 않는다. 기존 Blueprint와 reduced-motion 동작을 그대로 유지한다.

### 5. 구현 순서

1. 승인 후 active/index 변경. 실행 시점 dirty worktree 기준과 변경할 selector를 기록하고 실제 인증 상세 페이지에서 높이/좌표/스크롤 기준을 확보한다.
2. 상세 section 공통 정렬과 heading/index를 적용한다. 기존 element에 attribute만 추가하고 다른 페이지의 heading에는 영향이 없는지 확인한다.
3. Overview grid와 label/value/description 간격을 압축한다. 동일 데이터 전후 높이와 긴 값/빈 값/Category 누락 상태를 비교한다.
4. Milestone select 폭과 row grid를 조정한다. 모바일 줄바꿈과 pending/focus 복귀 구조를 확인한다.
5. Tasks 여백과 실제 lane 높이를 검토한 후 Journal section/row 간격을 맞춘다. 세로 section 순서와 drop surface 우선순위를 확인한다.
6. 전체 responsive/cascade/접근성/기능 보존을 확인한다. 문제 발견 시 관련 selector 범위만 복구하고 재확인한다.
7. 실제 파일/측정값/허용된 검증/미확인 상태를 기록하고 index를 갱신한다. 미확인 항목을 성공한 것으로 기록하지 않는다.

### 6. 위험과 Rollback

| 위험 | 예방 / rollback 단위 |
| --- | --- |
| 공용 row/select 변경이 Home·독립 페이지·editor로 확산 | 상세 root + section + direct child selector 사용. feature별 추가 override를 제거하여 복구 |
| 30~40% 강제 압축으로 내용 잘림 | 동일 데이터 기준으로만 비교, 자연 높이 유지. Overview grid/gap만 복구 |
| 260~320px 적용이 빈 보드를 확대 | 현재 110px와 실측 비교 후 필요한 조정만 수행. height 변경 독립 복구 |
| CSS grid가 focus 순서와 달라지거나 action을 가림 | DOM 순서 유지, 좁은 화면 1열 fallback. 해당 row grid만 복구 |
| 조건부 Category/legacy 필드 때문에 셀 배치 이동 | 의미별 class 사용, nth-child 의존 금지. fact 배치만 복구 |
| 모바일/1600px cascade가 여백을 다시 덮음 | 기존 media rules와 computed style 대조. 전역 규칙을 지우지 않고 상세 scope에서 수정 |
| nested section selector가 modal/form에 적용 | 직접 자식 범위 확인. modal 상태에서 영향 받은 selector만 축소 |
| section index가 heading 의미/읽기를 방해 | 한국어 h2 보존, 보조 index만 제거해 독립 rollback 가능 |

작업 시작 시 보관한 diff를 기준으로 이 Plan의 CSS/attribute 변경만 역패치한다. 기존 사용자 수정이나 이전 theme 작업 전체를 되돌리지 않는다. 데이터 migration이나 storage 복구는 필요하지 않다.

## Validation

### Static

- 계획 단계: 실제 경로/DOM/현재 CSS 값, 다음 Plan 번호, index 링크와 proposed 상태를 읽기 기반으로 확인한다. runtime source는 수정하지 않는다.
- 구현 단계: diff에서 CSS와 표현용 attribute 외 변경이 없는지 확인한다. API/props/query key/handler/ref/editor/identity/guard 변경이 없어야 한다.
- 공용 palette/Blueprint/page-heading/sidebar, legacy authority, 최대 Journal 3건과 Project UUID query 범위가 보존됐는지 확인한다.
- 동일 section index selector 중복, condition-dependent nth-child, broad descendant field override, fixed height/clipping, Cobalt 배경 추가가 없는지 검토한다.
- 이전 사용자 요청대로 테스트·빌드 및 screenshot runner를 실행하지 않는다. 기능 변경 필요가 확인되면 이 UI 범위에서 멈추고 변경 범위를 보고한다.

### Runtime

- 실행 중인 로컬 프론트에서 동일 Project/viewport/데이터로 전후 비교한다. Overview 높이, section 시작 좌표, 주요 정렬선, Task→Journal 간격을 기록한다. 실제 측정 전에는 감소 비율을 달성했다고 보고하지 않는다.
- active/archived, 설명/Category 없음, 긴 URL/목표/stack, 0/100% progress, 소수/다수 작업, 마일스톤 없음/있음, Journal 0/1/3건을 접근 가능한 데이터로 확인한다. 미존재 상태는 소스 검토와 runtime 미확인을 구분한다.
- 페이지 직접 진입/refresh/목록 복귀, Project edit 열기/닫기, 긴 제목의 heading action 정렬, Category 표시, Repository 링크를 확인한다.
- Milestone filter와 목록, 완료/재개 pending 표시, editor focus 복귀, 오류/더 보기가 레이아웃에 가려지지 않는지 확인한다.
- Kanban 3열 가로 스크롤, empty/normal/drop-target, drag 진입/이탈/cancel, Task editor와 키보드 select 접근을 확인한다. 실제 상태를 바꾸는 drop/save/complete는 별도로 허용된 검증 데이터가 있을 때만 수행한다.
- Journal row click→기존 detail modal, 작성 modal의 현재 Project lock, archived 작성 불가, empty 작성 action, keyboard/focus를 확인한다. 생성/실패/재조회 검증은 허용된 검증 데이터가 없으면 기존 로직 무변경 소스 검토로 제한하고 runtime 성공으로 기록하지 않는다.
- Home/Projects 목록/Tasks/Journals/Library를 대조해 공용 row·폼·heading 스타일 누출이 없는지 확인한다.
- 기존 관련 검증 자산은 `tests/shell/projects.spec.ts`, `tests/shell/layout.spec.ts`, `tests/projects/`, `tests/tasks/`, `tests/milestones/integration.spec.ts`, `tests/milestones/recovery.spec.ts`, `tests/journals/project-create.spec.ts`다. 자동 검증이 나중에 요청되면 이 체계를 재사용하고 새로운 runner를 만들지 않는다.
- 인증 브라우저에 접근할 수 없으면 전체 UI 검증 완료를 주장하지 않는다. 미확인 화면/상태를 기록하고 사용자 시각 검토를 완료 조건에 포함한다.

## Completion Criteria

- [ ] 상세 section에만 density 변경이 적용되고 현재 palette/Blueprint/Sidebar가 유지됨.
- [ ] Overview 전후 측정과 압축 결과가 기록됨. 긴 내용/모바일에서 정보가 잘리지 않음.
- [ ] 4개 section index와 한국어 제목, divider, content 정렬선이 일관됨.
- [ ] Milestone filter가 compact하고 row/action/날짜가 desktop/mobile에서 읽힘.
- [ ] Kanban 높이 결정에 실제 110px baseline이 반영되고 hit area/scroll/drop 상태가 보존됨.
- [ ] Journal이 Tasks와 자연스럽게 연결되고 작성/empty/archived 표시가 보존됨.
- [ ] DOM 계층과 API/data/auth/drag/editor 동작 변경 없음이 확인됨.
- [ ] 허용된 responsive/접근성/화면 검증 결과가 기록되고 미확인 제한은 사용자가 명시적으로 수락함.
- [ ] Plan/index가 실제 결과를 반영함.

## Execution Record

- 2026-09-15: 현재 소스와 CSS를 조사해 proposed Plan을 작성했다. 구현, 테스트, 빌드, 브라우저 검증은 수행하지 않았다.

### Approved implementation

- 사용자 실행 승인에 따라 active로 전환했다. 기존 작업 중 변경은 보존했다.
- 상세 직접 자식 section의 중복 좌우 padding을 제거하고 세로 padding 18px / section margin 24px로 통일했다. 모바일은 16px / 20px다. index 10px monospace, 한국어 section 제목 17px를 상세 문맥에만 적용했다.
- 기존 4개 h2에 data-section-index와 Overview fact div에 class만 추가했다. element 추가/이동, query/handler/ref/editor 변경은 없다.
- Overview는 heading/status band와 description, 3열 facts grid로 구성했다. facts gap 14px/24px, 상단 margin 0, label 간격 4px이며 1150px 이하 2열, 680px 이하 1열이다. 진행률/저장소는 하단에 놓이며 전체 내용은 자연 높이를 유지한다.
- Milestone direct Field를 220px/max-width 100%로 제한했다. 내부 row는 title/metadata/action grid이고 1150px 이하에서 metadata가 다음 줄로 이동한다. 기존 filter ref, pending/완료/재개/편집 로직은 보존했다.
- Task toolbar와 Kanban 외곽 여백만 축소했다. 현행 110px lane 최소 높이, grid stretch, 240px 최소 lane 폭, card/hit area, empty/normal/drop-target 스타일은 그대로 유지했다. 실측 없이 260~320px로 늘리지 않았다.
- Journal 목록 중복 padding을 제거하고 row padding 11px, 날짜/본문/chevron grid를 적용했다. desktop 제목/프로젝트 정보는 가능한 경우 가로 배치하고 모바일은 2줄로 표시한다. 생성/조회/상세 modal 로직은 그대로다.
- Milestone/Journal empty-state padding만 상세 section에서 24px로 줄였다. 작성 action과 상태 문구는 유지했다.

### Verification and limitations

- 소스에서 PageScaffold의 fragment와 직접 자식 section 구조, Task manager toolbar, nested Milestone surface, modal/form selector 범위를 확인했다. 추가 CSS는 상세 root 아래에 한정하며 전역 palette/heading/Sidebar 스타일을 수정하지 않았다.
- 실행 중인 `http://127.0.0.1:5173/projects`에 직접 브라우저 접속했다. 확인용 브라우저에는 인증 세션이 없어 로그인 화면이 표시됐으며 `.project-detail`은 존재하지 않았다. 1440x1000 / 390x844 / 844x390에서 로그인 화면의 가로 overflow 및 pageerror는 없었다.
- 인증 상세 Overview의 30~40% 감소율, section 실측, 실제 내용의 desktop/mobile/landscape 배치, drag/focus/editor/오류 상태 검증은 미완료다. 공개 로그인 확인은 상세 화면 검증을 대체하지 않는다.
- 사용자 요청대로 테스트·빌드·스크린샷 runner는 실행하지 않았다. 인증된 화면 검토와 위 제한의 수락이 남아 있어 completed로 전환하지 않았다.

### Closeout

- 사용자가 위 구현 결과와 검증 제한 안내 후 완료 처리를 명시적으로 요청했다. 이에 따라 Plan과 index를 completed로 변경했다.
- 추가 테스트/빌드 또는 인증 화면 검증을 수행한 것으로 간주하지 않는다. 미측정 높이와 runtime 검증 제한은 위 기록을 유지한다.
