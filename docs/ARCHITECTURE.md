# 프론트엔드 구조와 유지보수 기준

## 책임 분리

`App.tsx`는 Provider와 공통 레이아웃, 페이지 선택기를 조합하는 진입점입니다. 페이지 JSX, 저장 로직, 기능별 이벤트 처리는 두지 않습니다.

| 경로                                                             | 책임                                                                                  |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `src/app/AppProviders.tsx`                                       | 기능별 상태 Provider 구성                                                             |
| `src/app/navigation.ts` / `PageRouter.tsx`                       | 메뉴 목록과 타입으로 검증되는 페이지 매핑                                             |
| `src/app/WorkspaceProvider.tsx`                                  | 현재 페이지·프로젝트 상세 ID·목록 조건·알림·상세 팝업, 배치 편집 중 이동 차단         |
| `src/layouts/`                                                   | Sidebar, Topbar, AppLayout, PageScaffold: 앱 공통 외형과 공통 화면 도구               |
| `src/pages/`                                                     | HomePage, ProjectsPage, TasksPage, JournalsPage, LibraryPage: 필요한 기능·데이터 조합 |
| `src/features/dashboard/`                                        | 배치 상태·순서 이동·검증·위젯 틀·편집기·등록부                                        |
| `src/features/tasks/`                                            | TaskBoard와 태스크 저장·상태 변경 Provider                                            |
| `src/features/journal/`                                          | 일지 모델·작성 폼·최근 일지·일지 저장 Provider                                        |
| `src/features/projects/`, `links/`, `operations/`, `milestones/` | 프로젝트 현황·빠른 링크·운영 현황·마일스톤 독립 콘텐츠                                |
| `src/components/ui.tsx`                                          | 기능 데이터나 페이지 상태를 모르는 공용 UI                                            |
| `src/hooks/`                                                     | 공통 로컬 저장 어댑터와 미저장 변경 보호                                              |
| `src/types/ui.ts`                                                | 여러 기능에서 공유하는 UI 콜백 계약                                                   |
| `src/data/demo.ts`                                               | 기존 예시 데이터와 데이터 타입. 실제 API 연동은 별도 작업                             |

공용 `PageScaffold`는 앱의 필터·알림·저장 오류를 연결하므로 순수 UI가 아닌 layouts에 둡니다. 기능 콘텐츠는 props로 범위·데이터·콜백을 받으며 페이지·라우터·전체 앱 상태를 직접 참조하지 않습니다.

## 데이터 흐름

프로젝트 CRUD는 ProjectsProvider가 소유합니다. 태스크는 projectId로 연결하고 예전 이름 기반 데이터도 호환합니다. 일지·작업의 프로젝트 이름과 분야는 조회 시 최신 프로젝트에서 해석합니다. TaskManager는 TaskBoard와 편집·휴지통을 연결하는 컨테이너이며, ProjectSelect는 작업·일지에서 재사용합니다.

```text
App → AppProviders → AppLayout → PageRouter → pages
                                           ↓
                                  feature components

기능 Provider → usePersistedState → localStorage
     ↓
페이지와 홈 위젯이 같은 상태를 사용
```

- TasksProvider: 태스크 상태와 변경·저장 실패 결과.
- JournalsProvider: 일지 목록과 생성·정렬·저장 결과.
- DashboardProvider: 저장 배치와 편집 초안, 추가·제거·순서 변경·저장·취소·복원.
- 일지 작성 모달이나 위젯 선택 모달처럼 해당 페이지에서만 필요한 상태는 페이지 안에 둡니다.
- 같은 데이터를 페이지마다 별도 localStorage hook으로 읽지 않습니다. Provider는 페이지 전환보다 위에 있으므로 홈과 상세 목록이 같은 변경을 즉시 봅니다.
- 기존 저장 키와 JSON 구조를 유지했습니다. 저장 실패 시 초안 유지와 beforeunload 보호도 유지합니다.
- 서버 연결 시 기능 Provider/저장 hook 내부를 비동기 조회·mutation 계층으로 변경합니다. 현재 동기 boolean 저장 계약을 그대로 HTTP 호출처럼 취급하지 말고 pending/error 처리와 Promise 계약을 함께 전환해야 합니다.

## 위젯과 페이지 재사용

`features/dashboard/registry.tsx`에는 위젯 메타데이터와 기능 컴포넌트를 연결하는 얇은 어댑터만 있습니다. 실제 TaskBoard, ProjectOverview 등의 구현은 각 기능 폴더에 있습니다. 작업 보드 페이지에서 가짜 Widget 객체를 만들어 registry를 통해 렌더링하지 않고 TaskBoard를 직접 재사용합니다.

위젯 추가: 기능 컴포넌트 작성 → model의 WidgetType 추가 → registry 등록 → 필요한 데이터 계약 연결. 기존 6종 위젯과 편집 카탈로그는 유지합니다.

페이지 추가: pages에 조합 화면 작성 → navigation 메뉴 등록 → PageRouter 매핑 추가. 매핑 누락은 TypeScript가 검사합니다. 메뉴 URL은 `app/routes.ts`의 pagePaths에 등록합니다. `useBrowserNavigation`이 History API와 뒤로가기·앞으로가기를 연결하고, WorkspaceProvider는 이동 정책과 화면 조건을 관리합니다.

## CSS 소유권

`styles/global.css`는 스타일 진입점으로 import만 관리합니다.

1. `tokens.css`: 색상·반경 등 공통 디자인 값(main에서 먼저 import).
2. `base.css`: 문서·기본 요소·접근성 유틸리티.
3. `ui.css`: 버튼·모달·필드·배지·진행률 등 공용 UI.
4. `layout.css`: 사이드바·헤더·공통 페이지 레이아웃.
5. `dashboard.css`: 위젯 틀·배치 편집.
6. `features.css`: 기능별 `features/*/styles.css`와 공통 content.css의 import 목록.
7. `responsive.css`: 기존 화면 폭별 재정의를 유지하는 최종 반응형 레이어.

기존 선택자와 디자인 값을 유지하며 역할별로 분리했습니다. 새 기능의 일반 스타일은 해당 기능 폴더에 추가하고, 기존 공용 토큰과 UI를 먼저 재사용합니다. responsive.css에는 화면 크기 관련 재정의만 두고 기본 기능 스타일을 누적하지 않습니다. 반응형 규칙은 마지막에 적용해야 합니다.

## 변경 시 검증

`npm run build`, `npm test`, `npm run test:e2e`, `npm run format:check`를 사용합니다. 특히 페이지 전환 후 데이터 유지, 배치 편집 중 이동 차단, 태스크 드래그, 일지 저장, 저장 실패·초안 보호를 회귀 검증합니다. 새로운 CRUD·라우팅 기능은 안정화 목록의 해당 작업으로 관리합니다.

## 백엔드 API 요구사항

2026-09-10, 안정화 1~10번까지의 구현 기준입니다. 서버는 아직 미구현이며 기본 경로는 `/api/v1`입니다. 상세 계약은 [API 문서](API.md)에 모으고 이 문서는 기능별 연결 책임을 요약합니다.

| 현재 기능 / 소유자                          | 필요한 API                                                                          | 추가·보완 사항                                                                                            |
| ------------------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 홈 배치 / DashboardProvider                 | GET / PUT `/dashboards/home`                                                        | 위젯 전체 원자 저장, revision 충돌, 빈 배열 보존. 기본 복원·검색·이동은 별도 API 불필요                   |
| 프로젝트 / ProjectsProvider                 | GET / POST `/projects`, GET / PATCH `/projects/{id}`                                | 현재/보관 조회, 보관 해제, 저장소 URL·수동 진행률·목표 저장. 이름·분야 변경을 연결 데이터 조회에 반영     |
| 태스크 / TasksProvider                      | GET / POST `/tasks`, GET / PATCH / DELETE `/tasks/{id}`, POST `/tasks/{id}/restore` | 상세 본문 편집, 프로젝트 변경, `deleted=true` 휴지통, 소프트 삭제·복구 계약 보완                          |
| 개발일지 / JournalsProvider                 | GET / POST `/journals`, GET `/journals/{id}`                                        | 제목·본문·projectId, 최신순 목록·최근 3건. 수정·삭제 UI는 아직 없음                                       |
| 통계 / ProjectOverview·Sidebar·PageScaffold | GET `/overview`, GET `/tasks/stats`                                                 | 전체 통계와 검색 건수 분리. 보관 프로젝트의 작업 포함, 삭제 작업 제외, 목록 total은 페이지 전체 일치 개수 |
| 자료실·예시 위젯                            | GET `/links`, GET `/milestones`, GET `/services`, GET `/services/{id}/deployments`  | 현재는 고정 링크·예시 목표·운영 상태. 실제 데이터 전환 시 연결하며 관리 UI는 후속                         |

서버 연결 시 기능별 Provider가 조회·mutation 계층을 사용하고, 페이지는 조합 책임을 유지합니다. 저장 실패 시 입력 보존, 재시도 중복 생성 방지, revision 검증, 프로젝트 변경 후 연결 목록·통계 캐시 갱신이 필요합니다. 현재 구현에 필요한 세부 계약은 API 문서의 공통 계약·업무 리소스·통계와 프론트 연결 절을 참조합니다.

## 향후 기능과 API

우선 일지 수정/삭제·프로젝트별 위젯·독립 마일스톤을 기존 안정화 11~13번과 함께 진행합니다. API 확장 방향과 착수 시 결정 사항은 [후속 기능 제안](API.md#7-후속-기능-제안)을 참조합니다.

- 데이터 보호: 로컬 백업은 추가 API 없이 가능. 서버 가져오기는 프로젝트 id 매핑과 검증 미리보기·확정 API를 함께 설계합니다.
- 작업 기한·활동 기록: tasks의 dueDate 및 필터 확장, GET `/activities`로 변경 이력을 조회합니다.
- 초안 복구: 브라우저 자동 임시 저장부터 도입하고, 여러 기기 초안이 필요할 때만 `/drafts` API를 추가합니다.
- URL 이동 유지·접근성·모바일 개선은 프론트 작업입니다. 별도 CRUD API를 추가하지 않습니다.

## 빠른 링크 관리와 모바일 (9~10번)

- LinksProvider가 `devspace.links.v1` 배열의 조회·추가·편집·삭제·순서 이동을 소유합니다. 배열 순서가 표시 순서이며, 저장 키가 없는 경우 기존 기본 링크를 사용하고 빈 배열은 유지합니다. 자료실과 홈 QuickLinks가 같은 상태를 사용합니다.
- 범위는 `all`(모든 분야에 표시), `unity`, `server`입니다. 검색·분야 필터 중에는 순서 이동을 막고 전체 목록에서 변경합니다. URL은 HTTP(S)만 허용하며 사용자 인증 정보 포함 URL을 거부합니다. LinkEditor가 입력 검증·저장 재시도·미저장 변경 보호를 담당합니다.
- 서버 연결 시 GET/POST `/links`, PATCH/DELETE `/links/{id}`, PUT `/links/order`가 필요합니다. 필드는 id, label, desc, url, scope이며 순서 API는 전체 id 배열과 revision을 원자적으로 검증·저장해야 합니다. 조회는 저장 순서를 보존하고 빈 목록도 반환합니다. 서버도 같은 URL·범위 검증을 적용합니다. API.md의 링크 관리 후속 제안을 이 구현 기준으로 구체화할 수 있습니다.
- 모바일 보드는 최소 240px 열을 내부 가로 스크롤로 탐색하고 상태 선택으로 터치 이동합니다. 가독성·반응형 변경에는 별도 API가 필요하지 않습니다.

## 프로젝트 상세 페이지

- `ProjectOverview`는 프로젝트 ID를 `onOpen`으로 전달합니다. 프로젝트 목록과 홈 위젯에서 `WorkspaceProvider.openProject`를 연결하고 `PageRouter`가 `ProjectDetailPage`를 표시합니다. 상세는 프로젝트 메뉴의 하위 화면이며 App.tsx에 화면 로직을 추가하지 않습니다.
- `ProjectDetailPage`가 기존 Provider의 최신 프로젝트·삭제되지 않은 연결 작업·최근 일지 3건을 조합하고, `ProjectSummary`가 기본 정보를 표시합니다. 작업은 기존 Provider의 이름 기반 호환 해석 후 projectId로 연결합니다. 편집·보관은 기존 ProjectEditor의 저장 실패·미저장 변경 보호를 재사용합니다.
- 목록 복귀는 검색·분야·현재/보관 선택을 유지합니다. 배치 편집 중 상세 이동을 차단합니다. 상세 URL·새로고침 후 화면 복원·브라우저 뒤로가기/앞으로가기를 지원합니다. 안정화 11·12번은 대기 상태를 유지합니다.
- 서버 연결 시 기존 GET `/projects/{id}`, GET `/tasks?projectId={id}`, GET `/journals?projectId={id}`를 재사용합니다. 작업 통계는 삭제 제외·프로젝트 기준, 일지는 최신순 3건 조회가 필요합니다. 프로젝트 조회 실패/404 시 목록 복귀를 제공하며, 상세 전용 신규 저장 API는 필요하지 않습니다.

## URL 라우팅 (14번)

- 경로: 홈 `/`, 프로젝트 `/projects`, 프로젝트 상세 `/projects/{id}`, 작업 `/tasks`, 일지 `/journals`, 자료실 `/library`. id는 URL 인코딩하고 잘못된 주소는 NotFoundPage, 없는 프로젝트는 상세의 빈 상태와 목록 복귀로 처리합니다.
- 메뉴·상세 이동은 pushState, 검색 `q`·분야 `scope`·프로젝트 보관 `archived=true` 변경은 replaceState를 사용합니다. 검색 입력마다 방문 기록을 쌓지 않으며 URL을 직접 열거나 새로고침해도 화면과 조건을 복원합니다. 모달 입력은 URL에 저장하지 않습니다.
- `useBrowserNavigation`이 방문 기록의 세션·인덱스를 관리합니다. 취소한 popstate는 history.go로 기존 기록에 복귀하므로 URL·입력·앞으로가기 기록을 유지합니다. 페이지 이동 시 지역 편집 상태를 재생성하고 상세 팝업과 모바일 메뉴를 닫습니다.
- `useUnsavedChanges`의 dirty 등록을 공통 navigationGuard에서 확인합니다. 미저장 폼은 폐기를 확인하며, 홈 배치 편집은 먼저 저장·취소해야 이동할 수 있습니다. 다른 문서로의 이동·새로고침은 기존 beforeunload 보호를 사용하고 브라우저 표시 정책을 따릅니다.
- Nginx의 기존 `try_files $uri $uri/ /index.html` 설정을 재사용합니다. 다른 배포 서버도 앱 경로에 index.html fallback이 필요합니다. 라우팅은 프론트 작업으로 신규 API나 저장 데이터 마이그레이션은 필요하지 않습니다.
