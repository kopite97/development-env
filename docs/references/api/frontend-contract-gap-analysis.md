# 현재 프론트엔드와 기존 API 계약 대조

기준일: 2026-09-10. [기존 계약](backend-api-contract.md)은 서버 구현 증거가 아닌 설계 문서다. 아래 현재 상태는 작업 트리의 모델·Provider·화면 코드를 읽어 확인했다. 새 목표 계약은 [백엔드 구현 명세](backend-implementation-spec.md)에 모았다.

## 기능별 차이

| 기능               | 현재 구현 / 코드 근거                                                                                                                                                                                | 기존 계약과 차이 및 조치                                                                                                                            |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 사용자·로그인      | [AppProviders](../../../src/app/AppProviders.tsx), [Sidebar](../../../src/app/layouts/Sidebar.tsx): 로컬 Provider와 고정 개인 프로필, 인증 없음                                                      | 로그인은 후속에서 필수로 승격. 사용자·개인 작업실·세션 모델 및 모든 API 소유권 검사 필요                                                            |
| 저장               | [usePersistedState](../../../src/shared/hooks/usePersistedState.ts): 전역 localStorage 키, 동기 boolean, 저장 성공 후 상태 반영                                                                      | HTTP·revision·pending·401/409 처리 없음. 사용자별 비동기 저장과 캐시 격리 필요                                                                      |
| 프로젝트           | [model](../../../src/features/projects/model.ts), [ProjectEditor](../../../src/features/projects/ProjectEditor.tsx): 추가/수정/보관, 수동 progress, 목표 메모                                        | 기본 CRUD는 일치. `milestone` 문자열은 이제 목표 메모이며 독립 마일스톤과 동기화하지 않음. 기존 `currentMilestone` API 이름은 메모 의미로 유지      |
| 태스크             | [TasksProvider](../../../src/features/tasks/TasksProvider.tsx), [TaskEditor](../../../src/features/tasks/TaskEditor.tsx): 추가/수정/소프트 삭제/복구/상태 이동, 단일 tag                             | 기존 tags 배열은 UI에 없음. 새 계약은 단일 `tag`로 맞춤. 보관 프로젝트 작업과 휴지통 유지 필요                                                      |
| 링크(10)           | [LinkEditor](../../../src/features/links/LinkEditor.tsx), [QuickLinks](../../../src/features/links/QuickLinks.tsx): 추가/편집/영구 삭제/전체 목록 재정렬                                             | 조회 전용·후속 제안에서 필수 CRUD와 원자 재정렬로 승격. 검색은 label·desc뿐 아니라 url 포함. projectId 연결 없음. URL 내 username/password도 거절   |
| 일지(11)           | [JournalWorkspace](../../../src/features/journal/JournalWorkspace.tsx): 수정/영구 삭제, 프로젝트·기간·최신/과거순, 본문 검색                                                                         | PATCH/DELETE 필수. 휴지통 없음. 기존 검색 title·projectName에 body 추가                                                                             |
| 일지 날짜          | [JournalEditor](../../../src/features/journal/JournalEditor.tsx), [model](../../../src/features/journal/model.ts): createdAt을 편집 가능한 날짜로도 사용; 변경 시 브라우저 지역 정오; 기간 양끝 포함 | 기존 createdAt 불변/UTC to 제외와 충돌. 서버는 불변 createdAt과 `entryDate`를 분리하고 날짜 양끝 포함. 프론트 DTO/표시/필터 변경 필요               |
| 위젯(12)           | [WidgetEditor](../../../src/features/dashboard/WidgetEditor.tsx), [model](../../../src/features/dashboard/model.ts): 선택적 projectId, limit 1~20, 구형 배치 수용                                    | 5필드 배치 계약에 선택 필드 추가. 새 서버 schemaVersion=1에 포함 가능(기존 서버 미배포). 구형 로컬 키는 유지                                        |
| 위젯 조건          | [widgetRenderers](../../../src/pages/home/widgetRenderers.tsx): overview/board/journal/milestone만 프로젝트·개수 지원; 특정 프로젝트는 scope보다 우선                                                | 기존 scope/projectId 불일치 오류를 위젯 요청에 그대로 적용하면 안 됨. 위젯은 scope=all로 요청. 링크/운영에는 projectId·limit 설정 없음              |
| 보드 표시 개수     | [TaskManager](../../../src/features/tasks/TaskManager.tsx): 상태별 분리 전 전체 배열 slice                                                                                                           | 기존 열별 페이징만으로 홈 limit 구현 불가. 홈은 전체 limit, 작업 페이지는 상태별 페이징으로 구분                                                    |
| 마일스톤(13)       | [model](../../../src/features/milestones/model.ts), [MilestoneList](../../../src/features/milestones/MilestoneList.tsx): 독립 id/projectId/title/dueDate/completed, 생성/수정/완료/재개; 삭제 없음   | 기존 planned/in_progress/completed/canceled·progress·설명/완료 기준은 UI에 없음. boolean 완료 및 선택 날짜 계약으로 단순화; DELETE는 초기 범위 제외 |
| 목표 가져오기      | [MilestonesProvider](../../../src/features/milestones/MilestonesProvider.tsx): 유효 저장값 없으면 프로젝트 목표로 기본 목록 생성, 첫 변경 성공 때 전체 저장; 저장된 []는 유지                        | 기존 “자동 변환 안 함”과 다름. 서버 GET/신규 계정 생성에서 변환하지 않고 사용자 승인 로컬 가져오기에서만 필요 시 재현                               |
| 보관 프로젝트      | [ProjectSelect](../../../src/features/projects/ProjectSelect.tsx): 보관은 기존 선택이면 허용. 마일스톤은 프로젝트 상세/특정 위젯에서 프로젝트가 사전 선택됨                                          | 현재 마일스톤은 보관 프로젝트에도 생성 가능. 새 계약은 이를 허용. 작업/일지는 신규 대상 미보관, 동일 보관 연결 편집은 허용                          |
| 접근성·경로(14·15) | [routes](../../../src/app/routes.ts), [메뉴 초점](../../../src/app/layouts/useMobileNavigation.ts), [공용 UI](../../../src/shared/ui/controls.tsx)                                                   | 별도 업무 API 없음. 인증 후 원래 경로 복귀, 세션 오류 안내, SPA fallback과 모달 초점 보호 필요                                                      |
| 통계               | [ProjectOverview](../../../src/features/projects/ProjectOverview.tsx), [ProjectsWorkspace](../../../src/features/projects/ProjectsWorkspace.tsx): 검색과 전체 통계 분리, 보관 작업 포함              | 페이징된 items로 집계 금지. 사용자 범위 전체 집계 및 projectId 범위 필요                                                                            |
| 운영·배포          | [DeploymentStatus](../../../src/features/operations/DeploymentStatus.tsx): 고정 예시, 실제 검사/배포 없음                                                                                            | 기존 서비스 API는 조건부 미래 설계. 초기 서버의 실시간 기능으로 간주하지 않음                                                                       |

## 로컬 저장 범위와 계정 전환 위험

현재 데이터 키는 `devspace.projects.v1`, `devspace.tasks.v1`, `devspace.journals.v1`, `devspace.links.v1`, `devspace.milestones.v1`, `devspace.layout.v1`이다. `devspace.navigation.v1`은 history.state 식별값이며 업무 데이터가 아니다.

어떤 키에도 사용자 식별자가 없다. 따라서 단순히 로그인 화면과 API 주소만 추가하면 같은 브라우저에서 A가 로그아웃하고 B가 로그인했을 때 A의 데이터·초안·늦게 도착한 응답이 노출될 수 있다. 프론트 인증 경계, 서버 인증 세션, 사용자/작업실별 캐시 키를 함께 도입해야 한다. 서버 모드에서는 인증 전에 업무 Provider를 초기화하지 않고 fixture fallback을 실행하지 않는다.

## 서버 연동 때 의도적으로 바꿀 동작

- 감사 시각 `createdAt`은 서버 불변 값, 일지 표시 날짜는 `entryDate`로 분리한다. 날짜가 같은 일지는 서버 생성 시각과 id로 정렬하므로 로컬의 편집된 시각과 세부 순서가 달라질 수 있다.
- 로컬 배열 순서에 의존하던 프로젝트/태스크는 생성 시각·id의 안정 정렬을 사용한다. 상태 이동/본문 편집만으로 카드 순서가 계속 바뀌지 않게 한다. 수동 카드 순서 저장은 범위 밖이다.
- 존재하지만 분야가 다른 projectId와 scope를 함께 조회하면 일반 목록은 교집합인 빈 목록을 반환한다(현재 프론트 동작). 접근 불가능한 projectId는 소유권 검증 후 404다. 위젯은 특정 프로젝트 선택 시 scope=all을 사용한다.
- 서버 저장 실패나 미인증을 로컬 저장 성공/데모 데이터로 대체하지 않는다. 신규 계정의 링크도 기본적으로 빈 목록이다. 기본 링크를 원하면 사용자가 선택하는 템플릿 복사 기능으로 별도 추가한다.
- 현재 전체 배열을 모두 읽는 화면에 페이지 조회/더 보기를 추가해야 한다. 위젯 개수 제한은 제품 표시 제한이며 API 기본 페이지 크기와 같지 않다.

이 변경들은 이 문서 작성으로 실행된 것이 아니다. 프론트 연동 단계에서 DTO·상태·화면·테스트를 함께 수정해야 한다.
