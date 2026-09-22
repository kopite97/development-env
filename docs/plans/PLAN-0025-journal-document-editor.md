# Plan: Journal에서 연결하는 공용 Document Editor 1차 UI/UX

Status: `proposed`
Date: 2026-09-22

## Goal

Journals 목록에서 Journal Viewer Page로 이동하고, Journal별 Document 목록·생성에서 공용 BlockNote Editor와 Read-only Viewer로 이어지는 사용자 흐름을 검증한다. 제목·본문 자동 저장, 최신 저장 후 게시, 이미지·파일 첨부와 실패 복구를 임시 Mock API Adapter로 완성하는 하나의 변경이다.

이번 단계의 완료는 **Mock 기반 Frontend UI/UX 검증 완료**를 뜻한다. 병렬 개발 중인 Backend API의 가용성, 실제 인증·스토리지 통합 또는 Production 출시 완료를 뜻하지 않는다. 이 문서는 구현 승인이 아닌 계획 제안이며, 명시적 승인 전에는 `active`로 전환하거나 코드·패키지·Mock을 구현하지 않는다.

## Scope

- In scope:
  - `/journals`의 새 글 작성 진입점, Journal Context 선택·확인, Journal 상세 Modal의 Page 전환.
  - Mock Journal Detail과 Journal별 Document 목록·DRAFT 생성.
  - `documentId` 기반 공용 Document Editor/Viewer, 기본 BlockNote 기능, 분리된 제목, Autosave·Publish·삭제 오류 처리.
  - Image/File Upload·Attachment Registry·현재 본문의 `attachmentIds`·첨부 조회 실패 UX.
  - 기존 Router·인증 경계·QueryManager·HTTP·공용 UI를 이용한 구성, 접근성·반응형·관련 회귀 검증.
  - API/Service Layer 뒤의 개발·검증 전용 Mock과 실제 연결 시 **이 작업에서 추가한 모든 Mock을 제거하는 전환 절차**.
- Out of scope:
  - Backend 구현·변경, 실제 Backend API Integration 완료, MinIO 직접 접근, Production 배포.
  - Project/Milestone/Resource Document 연동, DocumentSpace 관리 UI/API, 전역 Document 생성·목록.
  - Custom Block/Slash Command, GitHub/Server/Kubernetes/외부 API Block, Realtime Collaboration, WebSocket Sync.
  - Comment/Discussion, Mention, Template, History/Revision 기능, Share Link, Relation, Page Tree, Database View, Kanban, Calendar, AI.
  - 기존 Journal body를 BlockNote로 변환하거나 Document로 자동 이관하는 작업, 다른 기능의 캐시 일괄 전환, 전역 디자인 개편.
  - 미래 도메인을 위한 owner registry, plugin framework, 범용 관계 Store/API의 선행 구현.
  - 새로운 lint 도구·설정·규칙·script·관련 ADR 도입. 필요하면 별도의 Repository Tooling 개선 작업으로 다룬다.

## Changes

### 1. 기준 문서와 선례

요구사항의 기준은 [Frontend Requirements](../requirements/DOCUMENT_EDITOR_FRONTEND_REQUIREMENTS.md)와 [Common Domain & API Contract](../requirements/DOCUMENT_EDITOR_COMMON_CONTRACT.md)다. 이번 사용자 요청의 Mock 우선·Journal Page 전환·명확한 작성 진입점·실제 연동 제외 조건을 함께 적용한다. 개념 API 예시를 현재 Backend에 존재하는 Endpoint로 간주하지 않는다.

- 지침: [루트 AGENTS](../../AGENTS.md), [문서 AGENTS](../AGENTS.md), [소스 AGENTS](../../src/AGENTS.md), [APP](../../src/app/APP.md), [PAGES](../../src/pages/PAGES.md), [FEATURES](../../src/features/FEATURES.md), [SHARED](../../src/shared/SHARED.md), [PLANS](PLANS.md), [Runtime Template](PLAN-TEMPLATE-RUNTIME.md).
- 개발 기준: [CONVENTIONS](../guides/CONVENTIONS.md), [ENVIRONMENT](../guides/ENVIRONMENT.md), [TESTING](../guides/TESTING.md), [development](../guides/development.md), [query-policy](../guides/query-policy.md), [query-exceptions](../guides/query-exceptions.md).
- 구조·ADR: [Frontend Architecture](../architecture/frontend.md), [System Overview](../architecture/overview.md), [Feature dependencies](../decisions/feature-dependencies.md), [Category boundary](../decisions/project-category-boundary.md), [Category-only](../decisions/project-category-only-classification.md), [결정 기록 규칙](../decisions/DECISIONS.md).
- 유사 완료 계획: [PLAN-0009](PLAN-0009-journal-integration.md)의 Journal DTO/초안/오류·세션·모달, [PLAN-0019](PLAN-0019-project-detail-workbench-density.md)의 상세 Page·Journal 재사용 영향, [PLAN-0022](PLAN-0022-project-query-cache.md)의 QueryManager, [PLAN-0023](PLAN-0023-widget-dashboard-api-refactoring.md)의 API 계약·Mock/real 검증 분리, [PLAN-0024](PLAN-0024-dashboard-widget-interactions.md)의 기존 Store 조합·실제 조작 검증을 참고한다. 파일 업로드·Rich Text Editor의 완료 선례는 현재 소스·패키지·Plan 조사에서 확인되지 않았다.
- 과거 Plan의 v1/scope API나 당시 UI 보존 조건은 역사적 기록이다. 이번에 명시적으로 요청된 상세 Page 전환을 막는 조건으로 해석하지 않고 현재 코드의 v2/category를 기준으로 한다. 완료 계획의 상태와 과거 기록은 변경하지 않는다.
- Backend 대조 근거: 인접 checkout의 `../backend/docs/plans/PLAN-0015-document-editor-phase-one.md`를 읽기 전용으로 확인했다. 상태는 `proposed`이며 UUID 문자열·v2 API·cursor 응답을 제안한다. 이번 Mock 기준에 그 방향을 반영하되 Backend Plan 승인·실제 API 가용성을 전제하지 않는다. Backend 문서는 수정하지 않는다.

### 2. 현재 코드베이스 분석

2026-09-22 소스·설정·lockfile을 읽어 확인한 사실이다. 신규 Backend API에 대한 실행 검증 결과가 아니다.

| 항목               | 현재 구현 및 계획에 미치는 영향                                                                                                                                                                                                                                                                                                                          |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 기술·패키지        | [package.json](../../package.json)은 React/React DOM `^19.0.0`, lock 실제 19.2.8. TypeScript 5.7.3, Vite 6.4.3, Vitest 4.1.11, Playwright 1.63.0. BlockNote 및 다른 Rich Text/Markdown Editor 패키지는 없다.                                                                                                                                             |
| Type 규칙          | [tsconfig.json](../../tsconfig.json)의 strict/noEmit, TS/TSX, named export, component PascalCase·나머지 camelCase, `unknown`을 검증해 좁히는 규칙. DTO·draft·presentation을 구분하고 `any`로 API 경계를 통과시키지 않는다.                                                                                                                               |
| 구조               | `src/app`은 인증·수명·조합, `pages`는 Route 조합, `features`는 도메인, `shared`는 기능 독립 코드. 별도 Router/전역 상태 라이브러리는 없다.                                                                                                                                                                                                               |
| 실제 Router        | [AuthApp](../../src/app/auth/AuthApp.tsx)의 History API·popstate·navigation guard와 [PrivateWorkspace](../../src/app/auth/PrivateWorkspace.tsx)의 pathname 분기. `/projects/:id` 선례가 있고 `/journals`만 존재한다. Journal/Document 상세 Route는 없다.                                                                                                 |
| 공유 경로 metadata | PageRouter는 별도 prototype용이지만 [routes.ts](../../src/app/routes.ts)의 readLocation/pagePaths는 [AuthenticatedLayout](../../src/app/auth/AuthenticatedLayout.tsx)도 사용한다. PrivateWorkspace와 함께 shell의 경로 metadata를 확장해야 상세에서 홈 선택/Page not found가 표시되지 않는다.                                                            |
| 인증·복귀          | [routeIntent](../../src/app/auth/routeIntent.ts)의 `safeReturnTo`가 허용 경로를 제한한다. AuthSession의 cookie 세션, `/api/v1/me`, CSRF, 동일 신원 재확인과 계정/작업실 세대 분리를 유지해야 한다.                                                                                                                                                       |
| API Client         | [client](../../src/shared/http/client.ts), [transport](../../src/shared/http/transport.ts), [freshTransport](../../src/shared/http/freshTransport.ts). same-origin cookie·CSRF·timeout·abort/generation·typed error·response parser를 제공한다. 현재 versioned API만 허용하며 JSON body와 JSON/204 응답만 지원한다.                                      |
| Server State       | [Query/useQuery](../../src/shared/http/query.ts)와 [QueryManager](../../src/shared/http/queryManager.ts). PrivateWorkspace가 manager 하나를 주입한다. Project는 관리 조회, JournalStore는 기존 직접 Query 예외다. 신규 조회는 이 예외를 복제하지 않는다.                                                                                                 |
| Local/Global State | 기능별 React state/ref와 draft memory, app의 인증·Store 조합. [JournalMemory](../../src/features/journal/draftMemory.ts)와 [journalHandoff](../../src/app/auth/journalHandoff.ts)는 동일 신원 재확인 시 메모리 초안을 보존한다. 인증 앱은 legacy localStorage를 데이터 권위로 사용하지 않는다.                                                           |
| 오류·상태          | HttpError/CancelledError, field errors·404·403·CSRF/인증·불확실 mutation을 구분한다. Query는 loading/ready/error/stale을 제공하며 실패한 추가 페이지는 기존 행을 유지한다. 실패를 빈 데이터로 바꾸지 않는다.                                                                                                                                             |
| 공용 UI·디자인     | [PageScaffold](../../src/shared/ui/PageScaffold.tsx)의 actions/feedback/filters, [controls](../../src/shared/ui/controls.tsx)의 Button/Field/Badge/EmptyState/Modal, [tokens](../../src/shared/styles/tokens.css)의 Warm Porcelain·Cobalt·Pretendard를 재사용한다.                                                                                       |
| Journal 목록       | [ServerJournalsPage](../../src/pages/ServerJournalsPage.tsx) → [ApiJournalWorkspace](../../src/features/journal/ApiJournalWorkspace.tsx). category/projectId/q/from/to/sort URL 필터, cursor 더 보기, 별도 생성·수정·삭제가 있다. `.document-row`는 이미 Journal 목록 클래스이므로 새 Document UI 이름과 구분해야 한다.                                  |
| Journal 상세 Modal | ApiJournalWorkspace의 `detail` state와 `onDetail=setDetail`이 목록의 `raw.body`를 Modal에 표시한다. 상세 Modal만을 위한 GET은 없다. 수정 진입의 `store.detail` GET은 별도 기능이다.                                                                                                                                                                      |
| 다른 상세 진입     | [ApiRecentJournals](../../src/features/journal/ApiRecentJournals.tsx)는 [ApiProjectJournals](../../src/features/journal/ApiProjectJournals.tsx)에서 사용된다. 현재 Home의 [WidgetDataContent](../../src/pages/home/WidgetDataContent.tsx)에도 JournalData 상세 Modal이 있다. ServerJournalHome은 현재 PrivateWorkspace에서 사용하지 않는다.              |
| 기존 Editor        | [ApiJournalEditor](../../src/features/journal/ApiJournalEditor.tsx)는 제목/Project/작성일/body textarea를 명시 저장한다. Project 상세의 locked Project 작성에서도 재사용한다. 새 Document Editor와 다른 기능이다.                                                                                                                                        |
| Journal DTO/API    | [apiModel](../../src/features/journal/apiModel.ts), [apiStore](../../src/features/journal/apiStore.ts): UUID `id`, `revision`, `title`, `body`, `projectId/projectName`, `categoryId`, `entryDate`, audit timestamps. 현재 `documentSpaceId`는 없다. `/api/v2/journals`의 목록·직접 상세·생성·PATCH·DELETE를 사용하며 목록은 `items/total/nextCursor`다. |
| Journal 검증       | 제목 1–120, body 1–20000, Project 필수, entryDate는 date-only. 이 제한을 별도 Document 제목/본문에 임의 적용하지 않는다. 기존 body는 그대로 표시·보존한다.                                                                                                                                                                                               |
| 파일·이미지 기반   | 소스에 실제 파일 업로드, multipart/FormData, Object URL 기반 미리보기, rich text/contentEditable 구현이 없다. 기존 정적 아이콘·이미지는 업로드 사례가 아니다.                                                                                                                                                                                            |
| 테스트·Mock        | `src/**/*.test.ts`의 Vitest, [Journal fixture](../../tests/journals/fixtures.ts)의 Playwright `page.route`와 Node 메모리 상태, [Journal config](../../playwright.journals.config.ts)의 4180 서버. 기본 [Playwright config](../../playwright.config.ts)는 legacy 진입이며 신규 인증 Journal 테스트를 대신하지 않는다.                                     |
| 명령               | `npm run build`는 prebuild `check:queries` 후 `tsc -b && vite build`. 별도 typecheck/lint script 및 ESLint/Biome 설정은 없다. `npm test`, `check:boundaries`, `check:queries`, `check:docs`, `format:check`가 있다.                                                                                                                                      |
| Base URL/Proxy     | [vite.config](../../vite.config.ts)의 server-only `BACKEND_UPSTREAM`, 기본 `http://127.0.0.1:8080`, 브라우저는 상대 경로. `/api`·`/oauth2` proxy와 [nginx.conf](../../nginx.conf)의 SPA fallback을 사용한다. MinIO 설정·자격정보는 Frontend에 추가하지 않는다.                                                                                           |

### 3. 충돌·미확정 계약과 결정 경계

UUID 문자열·v2 경로·cursor 목록은 이번에 정한 Mock 기준이다. 이를 승인·구현된 실제 Backend 계약으로 표현하지 않는다. S1에서는 나머지 검증용 가정과 integration gate를 기록하고, 실제 API 연결 전 Backend 담당과 공용 계약/OpenAPI를 대조한다. 미확정 사항은 독립적인 Mock UI 검증과 구분해 추적한다.

| 항목                | 이번 제안 및 확인이 필요한 사항                                                                                                                                                                                                                                                                                                                                         |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Journal Detail      | 현재 코드에는 v2 direct GET이 있지만 새 Viewer에 필요한 Backend 준비가 끝났다는 증거는 아니다. 이번 Viewer는 기존 ApiJournal 필드를 사용하는 독립 Mock Detail로 먼저 검증한다. `documentSpaceId`를 기존 Journal parser 필수 필드로 추가하지 않는다.                                                                                                                     |
| 경로/version        | Mock은 현재 Repository의 v2 Convention과 proposed Backend PLAN을 반영해 `/api/v2/journals/{journalId}/documents`, `/api/v2/documents/{documentId}`·`/publish`, `/api/v2/attachments`·content/delete를 기준으로 한다(6절). **Mock 기준 계약이며 최종 승인되거나 사용 가능한 실제 API라는 의미가 아니다.** 실제 연결 전 공용 계약·OpenAPI와 다시 대조한다.                |
| ID 형식             | Journal 및 신규 Document/Attachment/author/DocumentSpace 식별자는 Frontend에서 opaque string으로 다룬다. Mock ID는 UUID 문자열이며 `attachmentIds`는 string 배열이다. UUID를 Number로 바꾸거나 숫자 증가·범위 비교 등 숫자 ID 로직을 만들지 않는다. 실제 Backend ID는 응답에서 받으며 Client가 임의로 지정하지 않는다.                                                  |
| Pagination          | Journal Document Mock 목록은 `limit`·`cursor` query와 `{items, total, nextCursor}` 응답을 사용한다. 기존 Journal과 같은 cursor 방식으로 더 보기·초기화·재시도를 검증한다. cursor는 opaque string/null이며 숫자 offset으로 해석하지 않는다. 세부 정렬·limit 제한은 실제 연결 전 Backend 제안·구현과 대조한다.                                                            |
| 성공 응답·오류·제한 | PUT/Publish/Delete의 정확한 status/body, 제목·content·파일 길이/크기/MIME 제한, DRAFT 열람 권한, 생성 idempotency와 publish 재시도 의미가 미정이다. Mock 시나리오의 임시 성공값·오류 코드를 서비스의 검증용 가정으로 기록한다. 실제 계약에 가짜 필드·revision·author 정보 등을 추가하지 않는다.                                                                         |
| 게시 후 수정        | PUBLISHED 재편집·재저장, publishedAt 갱신, 빈 제목의 게시 가능 여부가 미정이다. 공용 계약 39절의 게시 이후 첨부 제거·Save 시나리오도 이 결정과 연결된다. S1에서 Mock 검증 정책을 명시하고 해당 순서를 검증하거나 실제 정책 미정에 따른 제한을 기록한다. DRAFT에서의 제거만으로 게시 후 수정까지 검증했다고 주장하지 않는다. Unpublish나 임의 상태 전이를 만들지 않는다. |
| 동시 수정           | Document PUT에는 revision/ETag가 정의되지 않았다. 한 세션의 동일 Document 저장 직렬화는 구현하지만 다른 탭/클라이언트의 lost update 방지까지 보장하지 않는다. 서버 동시성 계약은 실제 전환 전 확인한다. History/Revision 제품 기능은 제외한다.                                                                                                                          |
| Registry 복원       | Detail의 attachmentIds만으로는 attachmentId/originalFilename/contentType/contentUrl을 모두 복원할 수 없다. Mock은 임시 metadata resolver를 사용한다. 실제 연결 전 **Document Detail의 metadata 제공, 별도 metadata 조회 API, 또는 Backend에서 승인한 다른 방식**을 확정해야 한다. Filename·확장자·URL parsing으로 metadata나 소유권을 추론하지 않는다.                  |
| 첨부 전송           | 현재 client는 JSON 전용이다. Mock HTTP 업로드 검증에 필요한 FormData 지원은 공유 transport의 좁은 확장으로 제안한다. content streaming/redirect와 인증 오류 전달은 별도 확인 사항이며 `redirect:'error'`를 전역 해제하지 않는다.                                                                                                                                        |
| 지침 시점           | src/AGENTS·query-policy 서두의 PLAN-0022 미구현 설명과 실제 QueryManager/check:queries 구현이 다르다. 현재 코드를 따른다. 실제 check:queries는 직접 `new Query` allowlist 검사이며 모든 fetch/alias 우회를 자동 검출한다고 가정하지 않는다.                                                                                                                             |

기존 app/pages 조합으로 feature 간 직접 의존을 피할 수 있으므로 새 cross-feature import 예외나 전역 상태 구조 ADR은 기본안에 필요하지 않다. BlockNote UI binding처럼 장기 유지에 영향을 주는 선택은 [결정 기록 규칙](../decisions/DECISIONS.md)에 따라 근거와 영향을 기록하고 계획 실행 승인 범위에서 진행한다. transport redirect 전역 정책 변경은 기본안에 없으며 필요하면 계약과 범위를 먼저 재검토한다. 기존 승인 ADR을 고쳐 새 결정을 기정사실화하지 않는다.

### 4. 목표 화면과 Navigation

`Journals Home`은 전역 Dashboard가 아니라 현재 `/journals` 목록 화면을 뜻한다. 기존 PageScaffold의 Header Action에 **새 글 작성**을 두는 것을 우선안으로 한다. 이미 있는 작성 action·모바일 폭을 검토해 기존 **일지 작성**과 역할을 구분하고, 별도 FAB나 새로운 전역 메뉴는 도입하지 않는다.

```text
/journals → Journal 항목 클릭 → /journals/:journalId
  Journal 기본 정보 + 기존 body + Documents 목록
  → Document 클릭 → /documents/:documentId (Read-only)

/journals의 새 글 작성 → Journal 선택/확인
  또는 /journals/:journalId의 새 글 작성 → 해당 Journal 확인
  → Journal Context에서 DRAFT 생성 → 반환 id → /documents/:documentId/edit
  → 제목/본문/첨부 작성 → Autosave → 최신 저장 성공 → Publish → Viewer
```

- 목록에서는 첫 Journal을 자동 선택하지 않는다. 기존 목록·검색·pagination 패턴을 이용해 context를 명시적으로 선택한다. 현재 Project/Category 필터나 Widget selection은 Journal ID를 대신할 수 없다.
- Journal이 없으면 선택기를 빈 상태로 표시하고 기존 **일지 작성**으로 연결한다. 빈 Journal을 자동 생성하거나 필요한 기존 필드를 임의 채우지 않는다. 현재 ApiJournalEditor의 onSaved는 ID를 반환하지 않으므로 기본안은 생성 후 갱신된 선택기에서 Journal을 명시적으로 다시 선택하는 흐름이다. 생성 성공만으로 Document를 자동 생성하지 않는다.
- Journal Viewer에서는 기본정보와 Document 목록을 독립 영역으로 표시한다. 상세 실패/접근 불가 상태에서 임의 Journal로 생성하지 않는다. 목록 실패는 Journal 기본정보를 지우지 않으며 retry를 제공한다.
- 기본정보는 기존 title, entryDate, projectName, body를 중심으로 하고 필요한 경우 audit timestamp를 표시한다. 가상의 cover/owner/permission 같은 API 필드를 만들지 않는다.
- Create pending 중 중복 클릭을 막고 실패 시 선택 context를 유지한다. 결과가 불확실하면 목록 재조회·확인 경로를 제공하고 idempotency 미확정 상태에서 자동 POST 재시도를 하지 않는다.
- 새 Route는 PrivateWorkspace 및 safeReturnTo에 추가하고 공유 routes.ts/readLocation 또는 인증 shell의 경로 metadata를 확장해 AuthenticatedLayout의 선택 메뉴·페이지 제목·focus/scroll을 맞춘다. 공유 변경의 legacy 회귀도 검증한다. 대소문자·malformed encoding·추가 segment·직접 URL·새로고침·로그인 복귀를 기존 경로 보안 규칙으로 검증한다.
- 목록 복귀는 기존 query/filter를 보존한 안전한 내부 navigation context를 사용한다. Document DTO에 journalId/ownerType/ownerId를 추가하지 않는다. context 없는 Document deep link도 직접 조회할 수 있고, 복귀 fallback은 `/journals`다.
- dirty/saving/error·pending upload는 기존 [useUnsavedChanges](../../src/shared/hooks/useUnsavedChanges.ts), [navigationGuard](../../src/shared/lib/navigationGuard.ts)와 AuthApp의 동기 navigation guard에 연결한다. 이탈 취소 시 입력·요청을 유지하고, 명시적 폐기 후 이탈 시 타이머·구독·업로드를 정리한다. 서버가 이미 받은 요청의 취소를 rollback 성공으로 표시하지 않는다. unload 시 비동기 저장 완료나 beacon 저장을 보장하지 않는다.

### 5. 책임·상태·API 경계

신규 파일명은 구현 시 현재 convention에 맞춰 정하되 책임은 다음으로 제한한다.

| 위치                          | 책임                                                                                                                                                |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/auth`                | 동일 session/workspace의 transport·QueryManager·Document memory 조합, security recovery, navigation callback, lifecycle dispose와 연쇄 invalidation |
| `src/pages`                   | Journal Viewer 및 Document Viewer/Editor Route 조합, journal context → create → document route 연결                                                 |
| `src/features/journal`        | Journal 기본정보·선택·Journal Document collection service와 목록 DTO/표현. 기존 Journal CRUD 보존                                                   |
| 신규 `src/features/documents` | 도메인 독립 Document DTO/service/store, BlockNote Editor/Viewer, title draft, Autosave/Publish, Attachment service/registry/업로드 상태             |
| `src/shared/http`             | 기존 인증·취소·오류 경계를 유지한 필요한 FormData 전송. 도메인별 endpoint/업무 무효화는 넣지 않음                                                   |
| 개발·테스트 전용 Mock 모듈    | context collection, Document, Attachment와 실패/지연 시나리오를 API/Service 뒤에서 제공. 운영 컴포넌트 안에 fixture나 조건 분기를 넣지 않음         |

Document는 공용 **feature**이며 도메인 개념을 shared로 밀어 넣지 않는다. Documents가 JournalStore를 import하거나 journalId를 Editor 필수 prop으로 요구하지 않는다. Journal도 Documents의 내부 Store/Editor를 import하지 않고 pages/app이 callback과 데이터로 연결한다. Journal 목록 summary DTO와 Document detail DTO는 용도가 다르며 full detail 모델을 억지로 공유하지 않는다. 생성 service는 반환 id를 navigation에 전달하고 Editor는 그 id로 상세를 확인한다.

- 서비스 책임: `journalApi.getDetail`, `journalDocumentApi.getDocuments/createDocument`, `documentApi.getDocument/updateDocument/publishDocument/deleteDocument`, `attachmentApi.upload/delete`와 registry 복원용 metadata resolver port. 마지막 port는 Frontend 내부 인터페이스이며 새 Public API가 아니다. content 로딩은 안정 Application URL과 서비스 경계로 처리한다. 이 이름은 책임 설명이며 기존 명명 규칙에 맞춰 조정 가능하다.
- 신규 조회는 작업실의 QueryManager를 주입받아 journal-detail, journal-document-list(journalId/limit/필터·정렬 조건과 cursor chain), document-detail(documentId)의 안정된 키·contract·정책을 선언한다. 개별 페이지 요청에는 해당 cursor를 포함하고 Journal/조회 조건이 바뀌면 cursor chain을 초기화한다. Mock/real별 별도 UI 캐시를 만들지 않는다.
- 초기 신규 조회 정책 제안은 `freshForMs: 0`, 미사용 GC 60초, focus 자동 재검증 off다. 페이지 진입/명시적 새로고침과 mutation invalidation으로 다시 확인한다. 이는 이 기능의 제안이며 Project 30초/5분 TTL을 복사한 값이 아니다.
- Title/content/registry·저장 중 snapshot·dirty generation은 documentId별 controller가 소유한다. 동일 세션에서 하나의 Document에 하나의 save queue만 두고, unmount 후 새 controller가 이전 in-flight 요청과 경쟁하지 않게 이전 요청의 종료/불확실 상태를 관리한다.
- create/delete는 해당 Journal 목록, save/publish는 document detail·열려 있는 Journal Document 목록을 무효화한다. 상위 Journal ID를 Document 모델에 넣지 않고 collection service/app의 구독·invalidation 연결로 처리한다.
- 기존 JournalStore의 상세는 편집을 위한 검증된 snapshot이고 신규 Viewer의 managed detail은 읽기 projection이다. app의 journals.onInvalidate 연결에서 기존 Dashboard 갱신을 유지하면서 Viewer 상세도 무효화한다. 수정 후 Viewer 재조회가 실패하면 stale/error를 표시하고 오래된 값을 최신으로 확정하지 않는다. 같은 Journal을 양쪽에서 별도로 수정 가능한 draft/cache 권위로 만들지 않는다.
- Journal 삭제 시 해당 context 목록·열린 자식 Document의 사용 가능 상태를 다시 확인한다. Frontend가 Attachment/MinIO 삭제를 연쇄 호출하지 않는다. Mock의 cascade는 UI 검증용이며 실제 lifecycle 검증은 Backend 통합 후 수행한다.
- 세션 종료/계정 전환은 Query·draft·registry·timer·요청을 폐기한다. 동일 신원 재확인 시 title/content와 그 본문이 참조하는 성공 업로드 metadata·registry mapping을 기존 handoff 패턴으로 메모리 보존한다. 아직 PUT되지 않은 TEMP 파일은 detail.attachmentIds에 없으므로 detail만으로 복원하지 않는다. cache/queued mutation을 복구하지 않으며 미확정 save/publish/upload를 자동 replay하지 않는다. 관계 복원이 끝나기 전 save를 막고 보존된 Editor를 server snapshot으로 강제 reset하지 않는다.

### 6. DTO와 임시 Mock 개발 구조

공용 계약의 도메인 의미를 유지하며 다음을 현재 Repository Convention과 proposed Backend PLAN에 맞춘 **Mock 기준 계약**으로 사용한다. Backend 구현 완료나 최종 API 승인을 의미하지 않는다.

- `documentId`, `attachmentId`, `authorId`, `documentSpaceId`와 대응하는 DTO `id`는 opaque string이며 Mock fixture는 UUID 문자열이다. multipart documentId도 같은 문자열을 전달한다.
- Journal Document 목록은 `GET /api/v2/journals/{journalId}/documents?limit=...&cursor=...`를 사용하고 첫 조회는 cursor를 생략한다. 빈 목록 예시는 `{ "items": [], "total": 0, "nextCursor": null }`이다.

| 작업                        | Mock 기준 Endpoint                                                                                                        |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Journal Document 생성·목록  | `POST /api/v2/journals/{journalId}/documents`, `GET /api/v2/journals/{journalId}/documents`                               |
| Document 상세·저장·삭제     | `GET /api/v2/documents/{documentId}`, `PUT /api/v2/documents/{documentId}`, `DELETE /api/v2/documents/{documentId}`       |
| 게시                        | `POST /api/v2/documents/{documentId}/publish`                                                                             |
| Attachment 업로드·내용·삭제 | `POST /api/v2/attachments`, `GET /api/v2/attachments/{attachmentId}/content`, `DELETE /api/v2/attachments/{attachmentId}` |

| 작업                  | 필수 의미                                                                                                                                                                                                                                        |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Journal Document 생성 | Journal context + `{title, content}`. Client가 documentSpaceId/authorId/status/audit timestamps를 보내지 않는다. 반환 Document는 DRAFT이며 id로 Editor에 이동한다.                                                                               |
| Document detail       | `id, documentSpaceId, title, content, attachmentIds, status, authorId, createdAt, updatedAt, publishedAt`. documentSpaceId는 읽기 정보이며 UI에서 선택·변경하지 않는다.                                                                          |
| Document update       | PUT full snapshot `{title, content, attachmentIds}`. Journal PATCH/revision 규칙을 임의로 추가하지 않는다. status/author/소유 context/audit 값은 writable 필드가 아니다.                                                                         |
| Document 목록         | Journal context에서 `limit`·`cursor`로 요청하고 `{items, total, nextCursor}`를 받는다. items에는 summary만 있으며 전체 BlockNote content/attachmentIds는 포함하지 않는다. 마지막 cursor는 null이고, 다음 cursor는 Client가 해석·생성하지 않는다. |
| Publish/Delete        | 게시 전 최신 PUT 완료. DELETE는 명시적 확인·pending·성공 확인 후 이동, 실패 시 화면/초안 유지. 정확한 response/status는 S1 Mock 가정과 실제 계약 확정 항목으로 분리한다.                                                                         |
| Attachment upload     | 존재하는 documentId + binary file, multipart/form-data. 응답의 `id/documentId/originalFilename/contentType/size/status/contentUrl/createdAt`를 검증한다.                                                                                         |
| Attachment lifecycle  | upload TEMP → 현재 content에서 사용되는 attachmentIds로 save → ATTACHED. 제외 후 save → TEMP. ATTACHED DELETE의 409/ATTACHMENT_IN_USE를 처리한다. Grace Period cleanup은 Backend 책임이다.                                                       |

Mock은 **임시 가짜 서버 역할**로 한곳에 모은다. 기존 Playwright의 Node 상태 fixture를 기반으로 계약 동작을 모사하는 Adapter를 만들고, 수동 UX 검토에는 기존 Vite config의 development-only middleware로 같은 시나리오/상태 구현을 노출하는 방안을 제안한다. 공유 handler/state는 server tooling 위치에 두고 테스트와 개발 middleware가 사용한다. Docker에서 제외되는 tests 경로를 Vite config가 정적으로 import해 build를 깨뜨리지 않도록 한다. 별도 Mock 제품·새 전역 상태관리·새 테스트 runner/config는 만들지 않는다.

- React UI → feature API/Service → 기존 transport → Temporary Mock API Adapter → Mock data 순서다. 실제 API Adapter로 바꿀 때 UI의 save/upload 인터페이스를 바꾸지 않도록 service가 endpoint·wire 차이를 소유한다.
- Mock preview는 명시적 개발 mode에서만 켠다. 일반 개발/Production 실패를 감지해 Mock으로 자동 fallback하지 않는다. 새 환경변수가 꼭 필요하면 ENVIRONMENT 규칙에 따라 .env/.env.example에 함께 기록하며 backend/MinIO secret은 추가하지 않는다.
- preview에서는 Journal 목록과 Detail의 ID를 같은 fixture dataset으로 제공하고 현재 Journal model의 필드만 사용한다. 실서버 목록 UUID와 무관한 Mock detail을 임의로 섞지 않는다. 필요한 기존 auth/CSRF·주변 조회만 기존 테스트 패턴으로 모사한다.
- /api 및 /oauth2는 Mock preview에서 기본적으로 차단하고 명시 handler만 응답하게 해 handler 누락을 포함한 실제 8080 proxy 유출을 막는다. Browser 검증은 context.route 수준에서 popup/새 탭의 첨부 요청까지 포괄한다. 가짜 인증 성공을 실제 인증 검증으로 보고하지 않는다.
- 확인된 Document snapshot, Attachment bytes/metadata·TEMP/ATTACHED 관계를 browser가 아닌 Mock 서버/테스트 fixture의 메모리에 둔다. 페이지 새로고침 후 같은 저장 상태를 조회할 수 있어야 한다. Mock 프로세스 재시작 시 reset되며 실제 영속성 보장은 아니다.
- 서버가 거부한 save는 Mock 저장 상태를 바꾸지 않는다. 반면 commit 후 응답 유실은 저장 상태를 유지해 reconciliation을 검증한다. 지연, 읽기/쓰기 오류, 403/404, 업로드 실패도 재현한다. fixture 단순 즉시 성공만으로 동시성 검증을 대신하지 않는다.
- Mock 업로드는 안정된 검증용 Application contentUrl을 반환하고 메모리 binary를 streaming한다. Object URL/임시 asset이 필요하면 렌더링 resolver 내부에서만 사용·회수하며 **저장된 editor.document의 URL을 blob/data URL로 바꾸지 않는다**. 이 방식은 새로고침 뒤에도 안정 URL로 재조회할 수 있다.
- Mock 전용 metadata resolver는 app의 개발 조합에서 Frontend의 registry 복원 port에 주입한다. Browser의 resolver → 기존 transport → 개발 전용 `/api/v2/__document-preview/attachment-metadata` → Node metadata map이라는 명시적 전달 경로를 사용한다. documentId/attachmentIds로 소유 관계를 검증해 업로드 응답에서 이미 정의된 metadata만 반환한다. 이 경로는 **Mock 내부 통로이며 실제 Backend Endpoint 후보가 아니다**. 문서 detail에 attachments를 임의 추가하지 않고, port의 실제 구현은 Backend metadata 계약 확정 후 대체한다. 개발 resolver·주입 분기·handler는 production client graph에서 제외하고 전환 시 모두 삭제한다.
- Mock 모듈은 production client dependency graph에 포함하지 않는다. 일반 production build 산출물에 fixture·fake credential·handler·upload asset이 없음을 검사한다. 이 단계 산출물을 실제 API 연결이 완료된 서비스로 배포하지 않는다.

### 7. BlockNote Editor와 Read-only Viewer

승인 후 React 19/TypeScript/Vite 호환 버전을 설치·고정하고 lockfile을 기록한다. 작성 시 공식 release 목록에는 0.54.2가 확인되지만 설치·호환성을 검증한 버전은 아니다. `@blocknote/core`·`@blocknote/react`와 하나의 공식 UI binding만 선택한다. 기존 UI library가 없으므로 Mantine binding을 우선 검토하되 필수 peer dependencies·bundle·CSS/portal 충돌을 확인하고 앱 전체를 Mantine 디자인 시스템으로 전환하지 않는다. [공식 설치 안내](https://www.blocknotejs.org/docs/getting-started), [release 기록](https://github.com/TypeCellOS/BlockNote/releases).

- 공용 Editor는 별도 TitleInput + BlockNote Editor로 구성한다. title과 `editor.document`의 snapshot을 같은 save unit으로 다룬다. 저장 전 Markdown/HTML/자체 schema 변환을 하지 않는다.
- 설치한 버전의 기본 paragraph, heading, bullet/numbered/check list, toggle heading, toggle list, quote, code block, table, image, file을 검증한다. 공식 예시는 toggle heading의 `isToggleable`, toggleListItem을 제공한다. 필수 기능이 없으면 임의 Custom Block으로 우회하지 않고 버전/요구 충돌을 기록한다. [Built-in Blocks](https://www.blocknotejs.org/docs/features/blocks).
- bold/italic/underline/strike/link/text color/background color, slash 삽입, block 추가·삭제·drag/reorder·indent/outdent·지원 type 변경은 기본 toolbar/menu/handle을 사용한다. 한글 IME 입력 중 조합 상태를 깨거나 매 입력마다 Editor를 재생성하지 않는다.
- 기본 Emoji가 선택 버전에 있고 자연스럽게 통합되는 경우만 사용한다. 별도 Emoji/Custom Slash/AI/Comment 시스템은 추가하지 않는다.
- 공통 BlockNote 구성과 content를 Viewer에서 재사용하되 editable=false와 menu/toolbar/handle 비활성화를 명시한다. Slash/Side/Drag/Formatting/편집용 Link toolbar/File panel/Table handle 및 editable caret가 없어야 한다. 일반 텍스트 선택·복사, 링크/첨부 열기와 읽기용 Toggle 펼치기는 유지한다. Viewer에서 checklist 클릭·paste/drop·키보드 입력이 content 변경이나 save를 유발해서는 안 된다. [React props](https://www.blocknotejs.org/docs/react/overview).
- detail 로딩 전 빈 Editor를 먼저 mount해 자동 저장하지 않는다. JSON이 손상되거나 지원하지 않는 content이면 오류로 멈추고 빈 content로 overwrite하지 않는다. 같은 documentId의 배경 응답은 dirty Editor를 reset하지 않으며 다른 documentId 진입은 수명을 분리한다.
- route별 lazy loading을 검토해 일반 Journal 목록에 editor bundle을 불필요하게 싣지 않는다. font/color/spacing/focus/overlay는 기존 토큰에 맞춰 Document 영역에 한정한다.

### 8. Autosave·Publish·실패 복구

초기 debounce 제안은 1.5초다. 단위 테스트는 fake timer로, 브라우저는 실제 입력·느린 응답으로 검증한다. 저장 UI는 `저장 중... / 저장됨 / 저장 실패`를 제공하며 dirty 상태를 저장됨으로 표시하지 않는다.

1. 초기 detail 적용은 clean 상태다. title/content/첨부 활성 집합 변경 시 입력 세대를 증가시키고 DIRTY로 전환한다. selection-only 변화는 save하지 않는다.
2. debounce 후 title/content/attachmentIds와 세대 번호를 불변 snapshot으로 잡아 PUT 하나만 보낸다. request가 진행 중이면 새 PUT 대신 최신 pending snapshot을 유지한다.
3. A 저장 중 입력 B가 발생하면 입력은 유지하고, A 성공은 A 세대만 확인한다. 현재 입력·선택·undo 상태를 A 응답으로 덮지 않는다. B가 남으면 최신 snapshot으로 다음 save를 수행한다. 마지막 요청까지 성공해야 SAVED다.
4. 실패하면 ERROR와 현재 title/content/registry를 유지하고 queue 자동 반복을 멈춘다. validation/403/404/네트워크·timeout/결과 불확실성을 구분하며 명시적 재시도·재조회/확인 경로를 제공한다. 불확실 PUT을 서버 반영 실패로 단정하거나 인증 복구 뒤 자동 replay하지 않는다.
5. background refetch, 오래된 documentId 응답, session generation 변경, unmount 뒤 응답은 입력을 변경하지 못한다. 같은 문서 재진입 시 확인된 상태와 남은 미확정 저장을 먼저 조정한다.
6. Publish는 다른 Publish/Delete와 상호 배제한다. 클릭 시 입력·첨부 조작을 잠시 잠그고 in-flight upload/save가 끝나는 경계를 만든다. 업로드 실패/미완료 상태는 먼저 해결하도록 안내한다. 최신 generation의 title/content/attachmentIds를 flush하고 성공을 확인한 후에만 POST publish한다.
7. flush 실패 시 publish 요청은 **0회**여야 한다. publish 실패 시 저장된 draft와 현재 입력을 유지하고 재시도를 제공한다. 성공 응답이 유실되면 detail을 조회해 상태를 확인하고 무조건 POST를 반복하지 않는다.
8. publish 성공 후 응답 또는 확인된 detail의 PUBLISHED/publishedAt을 표시하고 Viewer로 이동한다. 로컬에서 status를 미리 확정하지 않는다. 제목/본문이 바뀐 채 이전 snapshot을 게시하는 순서 역전을 방지한다.
9. Document 삭제는 진행 중 save/upload/publish와 조정하고 별도 확인 후 수행한다. 삭제 실패·불확실 결과는 draft를 버리지 않는다. 성공 시 context 목록을 갱신하고 안전한 복귀 경로로 이동한다.

### 9. Attachment Registry와 수명

BlockNote의 `uploadFile` hook은 Attachment service를 호출해 검증된 안정 contentUrl을 반환하고, 필요하면 `resolveFileUrl`로 표시 URL만 해석한다. image picker/drop/clipboard paste와 file picker가 같은 adapter·실패 경로를 사용한다. [공식 File Panel 문서](https://www.blocknotejs.org/docs/react/components/image-toolbar).

- Registry는 attachmentId/contentUrl/originalFilename/contentType과 document 소유 확인 정보를 관리한다. 업로드 성공 후 등록하고 성공/실패/pending 상태를 파일 단위로 표시한다. 숫자 progress를 얻을 수 없으면 가짜 백분율 대신 진행 중 표시를 사용한다.
- save snapshot을 만들 때 실제 `editor.document`의 nested children을 포함해 Image/File 참조를 순회하고 Registry와 대조한다. 현재 사용 중인 서비스 Attachment ID를 중복 없는 집합으로 보내며, 일반 외부 링크를 서비스 첨부로 추정하지 않는다.
- 같은 첨부를 두 block이 쓰면 한 block 제거만으로 ID를 빼지 않는다. block 삭제/URL 교체 시 마지막 참조가 사라졌을 때 활성 목록에서 제외한다. undo/redo로 참조가 돌아오면 registry 정보가 남아 있어야 한다.
- 업로드 중 block 제거, 문서 이동, 취소, 여러 파일 중 하나 실패, 늦은 성공 응답을 검증한다. 현재 문서에 없는 파일을 자동 삽입하거나 성공한 다른 파일을 지우지 않는다. 미완료 업로드를 완료된 첨부처럼 save/publish하지 않는다.
- ATTACHED 파일은 block 제거 후 save 성공으로 TEMP가 된 뒤에만 명시 삭제할 수 있다. 자동 hard delete로 undo를 깨지 않으며 기본 정리는 서버 grace cleanup에 맡긴다. 409 ATTACHMENT_IN_USE는 관계 재확인과 안내로 처리한다.
- 다른 Document의 attachment URL을 paste해 현재 Document 소유 ID로 승격하지 않는다. backend가 소유권을 검증하며, mock도 잘못된 관계를 거부한다.
- 새로고침 시 content·attachmentIds와 Mock metadata를 다시 읽어 registry를 복원한 뒤 편집을 허용한다. metadata가 부족하면 기존 IDs를 조용히 비우거나 모든 IDs를 영구 유지하는 임시 우회 대신 저장을 멈추고 복원 오류/재시도를 제공한다. 실제 복원 계약은 3절의 integration gate다.
- MinIO URL/bucket/objectKey/presigned URL은 content에 저장하지 않는다. 실제 same-origin media 요청의 401/403·만료 redirect·content-type·download filename·proxy size 제한은 실제 연결에서 검증할 항목이다. Mock은 stable URL streaming으로 검증한다.
- native image/file 요청은 JSON client의 auth callback을 거치지 않으므로 load error를 파일 단위로 표시하고 기존 세션 재확인·retry 경로를 연결한다. 문서 전체를 빈 Editor로 바꾸지 않는다. resolver가 만든 Object URL은 소비자 수명 종료 시 revoke한다.

### 10. 기존 Modal 제거와 회귀 경계

| 대상                                   | 변경/보존 계획                                                                                                                                                                                          |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ApiJournalWorkspace                    | 상세 `detail` state·setDetail trigger·close handler·detail Modal JSX 제거, row callback을 route 이동으로 변경                                                                                           |
| ApiRecentJournals / ApiProjectJournals | ApiRecentJournals의 상세 state/Modal 제거. ApiProjectJournals는 navigation callback을 전달하고 기존 생성 state/ApiJournalEditor를 유지. 최근 3개·Project context 보존                                   |
| Home WidgetDataContent의 JournalData   | 기존 `onNavigate`를 전달해 Journal Page 이동. 상세 Modal과 미사용 useState/Modal import 제거. Dashboard에 새 Document 작성 버튼이나 Project Document 연동은 추가하지 않음                               |
| ApiJournalEditor·startEdit             | 기존 Journal 생성/수정, direct detail GET, locked Project, revision, handoff를 보존. Document 작성과 구분된 이름/행동 유지                                                                              |
| 삭제 확인/공유 Modal                   | Journal 삭제 확인과 controls의 범용 Modal은 유지. Viewer가 대체하는 읽기 상세 Modal과 역할이 다름                                                                                                       |
| 스타일                                 | 제거된 상세 전용 selector만 사용처 검색 후 삭제. 공유 `.detail-body`, 목록 row/form/Project/mobile CSS는 다른 소비자가 있어 일괄 삭제하지 않음                                                          |
| isolated legacy prototype              | JournalWorkspace/JournalEditor/RecentJournals/저장소는 별도 기존 회귀 진입점에만 남음. 이번 인증 앱에서 읽기 Modal fallback으로 재사용하지 않는다. 전체 prototype 폐기는 범위 밖이라는 유지 이유를 기록 |

전환 후 인증 앱에서는 읽기용 Journal Modal과 Viewer를 병행하지 않는다. 정적 사용처 조사와 Journal 목록·Project 최근 목록·Dashboard 위젯의 실제 클릭 검증으로 잔여 진입을 확인한다.

### 11. 실행 Sessions

Mock 기반이 준비되기 전에 새 Page가 실서버에 의존하지 않도록 API/Mock 경계를 앞에 둔다. Editor/Viewer를 먼저 만들고 Attachment Registry를 정한 뒤 Autosave/Publish를 완성해 첨부와 본문 저장의 일관성을 검증한다. 오류 상태는 마지막에 몰지 않고 각 Session의 수용 기준에 포함한다.

#### Session 1 — 현행 근거·계약·검증 기준 확정

- **Objective:** 이 계획의 코드 근거와 Mock 가정·실제 연동 gate를 확정한다.
- **Implementation:** 기준 지침·Modal 사용처·라우팅을 재확인하고 3절 미확정 항목에 가정/담당/전환 조건을 기록한다. BlockNote 호환 버전/UI binding·필수 peer와 기존 Repository 검증 명령의 적용 범위를 확인한다. Journal/Document 생성 개념과 공용 계약 39절의 게시 후 첨부 제거를 포함한 PUBLISHED 편집 정책을 확인하고, 수용 시나리오·대표 데이터·화면 기준을 먼저 정한다.
- **Validation:** 모든 사용자 요구에 대응되는 Session/검증이 있는지 대조한다. DocumentSpace 관리·다른 도메인·불필요한 store가 포함되지 않았는지 확인한다. 설치와 제품 코드 변경은 계획 실행 승인 이후에만 한다.

#### Session 2 — Service 계약과 임시 Mock 기반

- **Objective:** Backend 없이 정상·실패·지연·새로고침 시나리오를 재현한다.
- **Implementation:** collection/detail/update/publish/delete와 attachment service 경계·검증용 DTO·Mock Adapter를 구성한다. 공유 HTTP에 필요한 FormData만 확장하고 기존 보안 동작을 유지한다. 기존 Journal fixtures와 Vite 개발 preview에서 같은 mock state 로직을 사용하고 real proxy 유출을 막는다.
- **Validation:** UUID 문자열 ID와 숫자 변환 부재, v2 Mock 경로, create readonly 필드 제외, PUT 정확한 필드, `items/total/nextCursor` summary와 `limit/cursor` 요청, multipart documentId/file을 확인한다. 서버 거부 시 무변경과 commit 후 응답 유실, TEMP/ATTACHED·404/403, reload 보존, production mock 제외를 검증한다. 미정 metadata API를 실제 계약으로 추가하지 않았는지 검사한다.

#### Session 3 — Journal Viewer Route와 기존 상세 진입 전환

- **Objective:** 모든 인증 Journal 읽기 진입이 Page로 이동한다.
- **Implementation:** 실제 Router·safeReturnTo·shell navigation에 Journal detail을 추가하고 Mock Journal 기본정보/body를 렌더링한다. 목록·최근 Journal·Home 위젯 callback을 변경한다. 상세 loading/error/not-found·목록 복귀·focus를 구현하고 대체된 Modal은 같은 전환에서 제거한다.
- **Validation:** Journal list/Project/Home click, 직접 URL/reload/back-forward/login returnTo, malformed path, 필터 보존, detail error/retry를 확인한다. 기존 생성·수정·삭제 확인 Modal과 unrelated routes가 유지되어야 한다.

#### Session 4 — Journal Documents 목록과 새 글 작성

- **Objective:** Journal Context에서만 Document 생성·선택이 가능하다.
- **Implementation:** Viewer에 summary 목록·cursor 더 보기·빈 상태·목록 오류를 추가한다. `limit`·`cursor` 요청과 `nextCursor` 종료 조건을 사용한다. /journals Header Action과 Viewer action에서 context 확인 → Mock create → documentId 기반 Editor route를 연결한다. context 선택 UI와 중복/실패 처리를 구성한다.
- **Validation:** Journal A/B 목록 격리, 0건/다음 cursor/마지막 null, 조건 변경 시 cursor 초기화, 추가 조회 실패 시 기존 행 보존·재시도, context 취소·미선택·없는 Journal, create 실패/응답 유실/중복 클릭, UUID 문자열 id route를 확인한다. 빈 선택기 → 기존 일지 작성 → 생성 성공 → 명시 재선택 흐름과 작성 취소/후속 조회 실패 시 Document 자동 생성 0회를 검증한다. 전역 Document 생성/목록 또는 documentSpaceId 선택이 없어야 한다.

#### Session 5 — 공용 BlockNote Editor·Viewer

- **Objective:** Journal 내부 구조를 모르는 동일 content 기반 편집·읽기를 제공한다.
- **Implementation:** 승인된 BlockNote 버전·binding을 도입하고 Document feature의 TitleInput/Editor/Viewer를 조합한다. /documents/:id 및 /edit, loading·403·404·손상 JSON, scoped theme·lazy loading을 구성한다.
- **Validation:** 모든 필수 block/formatting/slash/drag/reorder/indent/type change·한글 IME를 실제 Editor로 조작한다. Viewer의 편집 UI·mutation 0회, direct link에서 Journal context 불필요, title/content 분리, JSON round trip을 확인한다.

#### Session 6 — Attachment UX·Registry

- **Objective:** 업로드부터 본문 참조·저장 관계·복원까지 일치시킨다.
- **Implementation:** image block/drop/clipboard와 file block에 Mock upload service를 연결하고 파일별 pending/success/error·content load retry를 표시한다. active IDs, nested/duplicate/undo, 제거 후 TEMP 전환·명시 삭제를 구현한다.
- **Validation:** 여러 첨부 중 부분 실패, 업로드 중 제거/이동, 다른 문서 첨부, 409, stable URL 보존, 새로고침 후 binary/registry 복원, 미해결 registry에서 save 차단을 확인한다. 이 Session의 save/TEMP 전환은 service·registry 수준에서 검증하고 실제 Autosave 연결은 S7에서 다시 확인한다. MinIO 직접 요청·blob URL 저장이 없어야 한다.

#### Session 7 — Autosave·Publish·세션 수명

- **Objective:** 최신 입력을 잃지 않고 저장·게시 순서를 보장한다.
- **Implementation:** 1.5초 debounce와 document별 직렬 queue, save state/retry/reconciliation, Publish flush barrier, 삭제와의 상호 배제, unsaved guard·handoff·dispose를 연결한다. mutation 후 detail/collection을 무효화한다.
- **Validation:** 느린 A 중 B/C 입력 → 최신 snapshot만 후속 저장, 최대 동시 PUT 1, stale response 무시, save 실패 시 입력 유지, save 실패 후 publish 0회, publish 중 추가 입력 차단, 실패/응답 유실·같은 문서 재진입을 검증한다. click/popstate 취소·허용, beforeunload, 동일 신원 재확인, logout/account/workspace 교체를 구분한다. upload 성공 → PUT 전 재인증 → TEMP metadata 유지·자동 replay 없음과 실제 Autosave의 첨부 관계 전환도 검증한다.

#### Session 8 — 통합 UX·Modal 정리 확인·전환 준비

- **Objective:** 두 전체 사용자 흐름과 모든 실패 상태를 확인하고 Mock 종료 조건을 문서화한다.
- **Implementation:** 남은 사용처/import/style를 점검하고 기존 Journal CRUD·Project/Home 회귀, desktop/mobile·keyboard·시각 확인을 완료한다. Mock 파일/handler/fixture/upload/error/scenario/config/branch의 삭제 목록과 실제 adapter 교체 지점을 기록한다.
- **Validation:** 아래 Static/Runtime 행렬을 모두 수행한다. 실제 Backend 완료로 표현하지 않고 Mock 검증 결과·한계를 기록한다. 미해결 필수 기능이나 기존 검증 실패가 남으면 completed로 변경하지 않는다. 실제 연결 작업은 이 Session에서 시작하지 않는다.

### 12. 실제 Backend 연결 시 Mock 전체 제거 — 후속 작업의 필수 절차

이번 계획의 실행 범위는 이 절차를 **구체적으로 기록하고 제거 가능성을 검증하는 것**이다. Backend 준비와 별도 실행 승인 후 실제 연결을 수행한다. Mock 유지 상태와 실제 서비스 상태를 영구적인 runtime 선택지로 만들지 않는다.

1. 공용 계약·실제 OpenAPI·Backend convention에서 경로/version, ID, wrapper, status/error, 권한, PUBLISHED 수정, idempotency/불확실 결과, registry 복원 metadata, streaming/redirect·용량 제한을 확인한다. 미정 사항을 임의 완성한 DTO로 배포하지 않는다.
2. 동일 feature service interface 뒤에 실제 API Adapter를 연결한다. 임시 endpoint mapping/metadata resolver를 확정 계약으로 교체하고 existing HTTP의 cookie/CSRF/generation/취소를 유지한다.
3. 이 계획에서 추가한 Mock dataset, handler/adapter, upload/binary asset/Object URL용 mock resolver, Mock Metadata Resolver·개발 전용 metadata 경로·metadata DB, 오류 응답·지연 주입, seed/reset, Vite preview mode/config hook, mock 전용 환경설정·분기·의존성·스크립트를 전부 삭제한다. 운영 UI뿐 아니라 이 기능의 테스트 전용 Mock도 남기지 않는다.
4. Mock 전용 browser tests/fixtures는 기존 disposable real harness를 이용한 실제 API acceptance로 바꾸거나 제거한다. 다른 기능의 기존 테스트 fixture는 별도 범위이며, 새 Document Mock을 그 안에 이름만 바꿔 남기지 않는다.
5. 코드/import graph·build artifact·환경 예시·문서·테스트 실행 경로를 검색해 잔여 Mock 및 fallback이 0인지 확인한다. 실제 adapter 연결 후 Mock 제거를 먼 후속 TODO로 미루지 않는다.
6. 실제 Journal/Document 생성·PUT·publish·삭제, 첨부 upload/content/delete·관계 복원, auth/CSRF·접근권한·Nginx/proxy를 Vite 및 기존 real harness로 검증한다. MinIO/cleanup/cascade의 내부 수행은 Backend와 통합 증거로 확인한다. 이 검증 전에는 Production 출시 완료를 선언하지 않는다.

## Validation

### Static

**계획 작성·수정 단계:** 문서 경로·기준 요구사항 대응·template 구조·proposed 상태·README 순서를 검토하고 `npm run check:docs`, 변경 문서의 포맷 검사, `git diff --check`를 수행한다. 코드·패키지를 수정하거나 build/unit/browser 테스트를 실행하는 단계가 아니다.

**승인 후 구현 단계:**

- Build: `npm run build` 성공(prebuild 조회 검사 + `tsc -b` + Vite).
- Type Check: 로컬 TypeScript의 `npx --no-install tsc --noEmit` 성공. 별도 typecheck script가 원래 존재한다고 기록하지 않는다.
- 구조·문서: `npm run check:boundaries`, `npm run check:queries`, `npm run check:docs`, `git diff --check`. query 검사의 한계를 보완해 직접 fetch·컴포넌트 Mock·feature 역의존을 리뷰한다.
- 포맷: `npm run format:check`와 변경 파일 개별 검사. 기존 repository 포맷 실패는 신규 실패와 분리하여 기록하고, 이번 변경 파일은 반드시 통과시킨다.
- Unit: `npm test` 및 Document controller/registry/DTO/route/auth의 가까운 기존 suite. snapshots·fake timer·deferred Promise로 저장 직렬화/세대/실패/flush를 검증하며 단순 구현 복제 테스트를 늘리지 않는다.
- Attachment transport를 확장하면 JSON 회귀, FormData boundary 자동 처리, CSRF·timeout·abort·401·계정 전환을 단위 검증한다.
- `node tools/check-auth-artifact.mjs`와 추가 Mock marker/import 검토로 legacy 데이터·Mock fixture가 production 산출물에 포함되지 않는지 확인한다. 실제 Backend adapter 완성 여부와 bundle에서 Mock 제외 여부는 별개로 기록한다.

### Runtime

기존 `playwright.journals.config.ts`와 `tests/journals`를 확장하여 Document의 인증된 shell 흐름까지 검증한다. 실행은 `npx --no-install playwright test --config playwright.journals.config.ts`를 사용한다. 4180 preview 서버를 재사용할 때는 기존 `JOURNAL_REUSE_SERVER=1` 규칙을 따른다. 새 기능 전용 config/runner를 만들지 않는다. 변경된 Home·auth·Project 진입은 기존 Dashboard/auth/관련 suite를 선택해 추가 실행한다.

| 검증 영역             | 합격 기준                                                                                                                                                                                                                                    |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 전체 읽기 흐름        | Journals → Journal Viewer → 해당 Journal Document 목록 → 공용 Document Viewer가 이어지고 상세 dialog가 열리지 않음                                                                                                                           |
| 전체 작성 흐름        | /journals 및 Journal Viewer의 새 글 action → 명시 context → Mock DRAFT 생성 → Editor → 작성/첨부 → Autosave → 최신 저장 후 Publish → 목록/Viewer 반영                                                                                        |
| Journal 상태          | 목록 loading/empty/error·추가 페이지 실패, Mock Detail loading/정상/error/권한·없는 ID, Document collection empty/error/retry가 서로 구분됨                                                                                                  |
| Route·인증            | 직접 URL/reload/back-forward/로그인 returnTo, 목록 filter 복귀, malformed route, sidebar·title/focus, 동일 신원 검증·계정 교체·401/403 후 늦은 응답 차단                                                                                     |
| Block                 | Paragraph/Heading/Bullet/Numbered/Checklist/Toggle Heading/Toggle List/Quote/Code/Table/Image/File를 삽입·저장·복원하고 nested children 구조 보존                                                                                            |
| Formatting·조작       | Bold/Italic/Underline/Strike/Link/Text/Background Color, Slash, block 추가·삭제·drag/reorder·indent/outdent·지원 type 변경, 한글 IME와 keyboard 동작                                                                                         |
| Autosave              | title/content 양쪽 debounce, save state 전이, 최대 동시 PUT 1, A 진행 중 최신 입력 후 B, 오래된 응답이 현재 입력을 변경하지 않음                                                                                                             |
| Save 실패             | 현재 title/content/registry 유지, 서버 저장값 강제 rollback 없음, 명시적 retry·불확실 결과 확인, 손상 detail이 빈 content PUT으로 이어지지 않음                                                                                              |
| Publish               | pending save/upload를 조정하고 최신 PUT 성공 뒤 POST. 최종 PUT 실패 시 POST 0회, publish 실패 시 draft 유지, 중복/응답 유실·status 재조회 처리                                                                                               |
| Upload                | Image block·drag/drop·clipboard paste·File block, pending/success/error, 여러 파일 중 부분 실패, upload 중 제거·이동·세션 교체가 Editor 전체 장애를 만들지 않음                                                                              |
| Registry              | nested/중복/삭제/URL 변경/undo/redo에 따른 정확한 unique attachmentIds, 타 문서 첨부 거부, 저장 후 TEMP↔ATTACHED·409 처리                                                                                                                    |
| 새로고침·첨부         | 성공 저장한 title/BlockNote JSON/attachmentIds와 bytes/metadata 복원. stable contentUrl 유지, Mock 서버 재시작 reset과 실제 영속성을 구분                                                                                                    |
| 첨부 오류             | 이미지/파일 content load failure·403/404·재시도 표시, metadata 복원 실패 때 ID를 조용히 제거하지 않음                                                                                                                                        |
| Read-only             | 편집 커서/Slash/Side/Drag/Formatting 등 편집 UI 없음, 입력·paste/drop·checklist 조작으로 변경/PUT 발생 0회, 링크·복사·읽기 Toggle 정상                                                                                                       |
| Document 오류·삭제    | loading/not found/access denied/save/publish/delete 오류별 안내와 재시도, 삭제 확인/실패 draft 보존·성공 후 복귀, Journal 삭제 뒤 열린 문서 처리                                                                                             |
| Modal·Journal 회귀    | list/Project/Home 읽기 Modal state/trigger 제거. 기존 Journal 생성·수정·삭제 확인, 수정 성공 후 Viewer title/body 재조회, 공용 Modal focus/Escape와 isolated legacy suite 정상                                                               |
| 시각·접근성           | desktop 1440×1000/1280×800, mobile 390×844/320px, landscape/200% zoom에서 overflow·toolbar portal·파일명·표 가로스크롤 확인. keyboard/focus/상태 aria-live·기존 대비 유지. 스크린샷을 직접 검토하며 DOM 통과만으로 시각 완료를 선언하지 않음 |
| Mock 격리·제거 가능성 | fixture·실패 주입이 UI에 흩어지지 않음, 미처리 API의 실서버 유출 0, 한 service 경계에서 교체 가능, 전환 삭제 목록이 실제 생성 파일/분기 전체를 포함                                                                                          |

Mock 단계에서는 신규 Backend/MinIO/실제 multipart proxy 검증을 완료했다고 주장하지 않는다. 기존 real harness 실행이 필요한 공유 transport/인증 회귀는 준비된 기존 Endpoint에 한정하고, 신규 API가 없다는 이유로 Backend를 고치거나 Mock 응답을 실제 통합 증거로 사용하지 않는다.

## Completion Criteria

- [ ] Journal 목록·Project 최근 목록·Home Journal 클릭이 독립 Viewer Page로 이동하고 인증 앱의 이전 읽기 상세 Modal을 제거했다.
- [ ] Mock Journal Detail의 기존 필드·body와 Journal별 Documents loading/empty/error/목록을 정상 표시한다.
- [ ] Journals Home 및 Viewer에서 Journal Context를 확인하고 DRAFT 생성 → 반환 documentId 기반 공용 Editor로 이동한다.
- [ ] 공용 Editor/Viewer가 같은 BlockNote JSON을 사용하며 모든 필수 block/formatting/조작 및 Read-only 제한을 검증했다.
- [ ] title/content Autosave 직렬화·저장 상태·실패 입력 보존·최신 save 후 publish를 지연/실패/응답 유실까지 검증했다.
- [ ] Image/File 입력·Mock upload·registry·현재 attachmentIds·안정 URL·새로고침 복원·파일별 실패를 검증했다.
- [ ] navigation guard·동일 신원 handoff·계정 종료·오래된 응답 차단 및 기존 Journal CRUD 회귀가 통과했다.
- [ ] Build/Type Check와 기존 Repository의 관련 unit/browser/경계·조회·문서·포맷 검증이 통과하고 UI를 직접 검토했다.
- [ ] Mock은 API 경계 뒤의 개발·검증 전용이며 production artifact에 포함되지 않고, 실제 전환 때 모든 신규 Mock을 제거할 구체 목록을 기록했다.
- [ ] 실제 API 미확정 사항과 Backend Integration 미완료를 명확히 기록하고 요구사항·공용 계약을 임의 변경하지 않았다.
- [ ] 구현 결과에 맞는 문서와 README 상태를 갱신했다. 위 기준 충족 전 완료 처리하지 않으며, **현재는 proposed이고 실행 승인되지 않았다**.

### 제안 자체 재검토

- 기준 두 문서·현재 코드·proposed Backend PLAN의 제안을 대조하여 Mock ID는 UUID/opaque string, API는 v2, 목록은 limit/cursor와 items/total/nextCursor 기준으로 맞췄다. 이를 최종 승인·구현된 실제 API로 표현하지 않는다.
- Journal만 context로 연결하며 공용 Editor에 Journal FK/DocumentSpace 관리/미래 기능 구조를 넣지 않는다.
- 기존 Journal body/CRUD와 신규 Document를 구분하고 상세 Modal 제거의 재사용 영향을 포함했다.
- Mock Journal Detail, 명시 context 작성 action, Document Viewer/Editor, BlockNote 원본 JSON, Attachment Registry, 직렬 저장과 Publish barrier가 각 Session/Validation에 연결돼 있다.
- Mock의 reload/실패 검증과 실제 API/스토리지 완료를 구분하고, 실제 전환 시 테스트용까지 포함한 신규 Mock 전체 제거를 명시했다.
- 새 lint 도구·규칙·script·관련 ADR/필수 완료 조건을 추가하지 않고 기존 검증 수단만 사용한다. 필요 시 별도 Tooling 작업으로 분리한다. 첨부 metadata 복원·PUBLISHED 편집·실제 endpoint/응답의 integration gate는 유지한다.
- 이번 수정은 PLAN과 실제로 충돌하는 관련 문서에만 한정한다. Component/Route/API Client/Mock/package 설치를 수행하지 않으며 기존 proposed 상태와 실행 순서는 유지한다.
