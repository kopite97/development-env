# 프론트엔드 구조와 유지보수 기준

## 책임 분리

`App.tsx`는 Provider와 공통 레이아웃, 페이지 선택기를 조합하는 진입점입니다. 페이지 JSX, 저장 로직, 기능별 이벤트 처리는 두지 않습니다.

| 경로                                                             | 책임                                                                                  |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `src/app/AppProviders.tsx`                                       | 기능별 상태 Provider 구성                                                             |
| `src/app/navigation.ts` / `PageRouter.tsx`                       | 메뉴 목록과 타입으로 검증되는 페이지 매핑                                             |
| `src/app/WorkspaceProvider.tsx`                                  | 현재 페이지·분야·검색·알림·상세 팝업, 배치 편집 중 이동 차단                          |
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

페이지 추가: pages에 조합 화면 작성 → navigation 메뉴 등록 → PageRouter 매핑 추가. 매핑 누락은 TypeScript가 검사합니다. URL 기반 라우팅은 안정화 목록 14번의 별도 작업이며 현재는 기존과 같이 내부 상태로 전환합니다.

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
