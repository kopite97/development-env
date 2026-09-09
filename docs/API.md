# 백엔드 API 구현 계약

## 1. 범위와 사용 원칙

안정화 1~8번까지의 프론트엔드 구현을 기준으로 한 서버 설계 계약입니다. 서버는 아직 구현되지 않았습니다. 구조는 [ARCHITECTURE.md](ARCHITECTURE.md), 진행 상태는 [FRONTEND-STABILIZATION.md](FRONTEND-STABILIZATION.md)를 따릅니다.

- **현재 필수**: 홈 배치, 프로젝트 CRUD·보관, 태스크 CRUD·휴지통, 일지 작성·조회, 검색·통계. 2~5절을 적용합니다.
- **조건부**: 고정 링크·예시 마일스톤·운영 상태의 실제 데이터 전환 시 6절을 적용합니다.
- **후속 제안**: 7절은 별도 요청 시 구체화합니다. 초기 구현에 자동 포함하지 않습니다.
- 공통 규칙은 2절에서 관리합니다. 계약 변경 시 해당 절과 프론트 매핑·테스트를 함께 변경합니다. 구현 순서는 공통 저장·소유권 기반 → 프로젝트 → 태스크·일지 → 배치·통계입니다.

## 2. 공통 계약

### 요청과 응답

- 기본 경로는 `/api/v1`이며 아래 경로는 이를 생략합니다. JSON을 사용합니다.
- 리소스 id와 생성·수정 시각은 서버가 발급합니다. 시각은 UTC ISO 8601, 날짜만 있는 값은 `YYYY-MM-DD`입니다. 위젯 인스턴스 id는 클라이언트가 지정합니다.
- 생성은 201, 조회·수정·소프트 삭제·복구는 200입니다. 상세 및 변경 성공은 리소스 전체를 반환합니다. 후속 물리 삭제의 응답은 기능 착수 시 정합니다.
- 목록은 `{ "items": [], "total": 0, "nextCursor": null }`입니다. total은 모든 필터에 맞는 전체 건수이며 페이지 길이가 아닙니다. 0건도 200입니다. 오류를 빈 목록으로 대체하지 않습니다.
- PATCH는 전달한 필드만 변경합니다. id·시각·파생 필드는 클라이언트가 변경할 수 없습니다. revision은 비교용 입력입니다.
- 오류는 `{ "code": "REVISION_CONFLICT", "message": "다른 기기에서 변경되었습니다.", "fieldErrors": {} }`입니다. 입력 오류 400, 미인증 401, 권한 없음 403, 없음 404, 충돌 409, 요청 제한 429, 서버 실패 5xx를 구분합니다. fieldErrors는 요청 필드명을 키로 사용합니다.
- 모든 조회·변경과 projectId 참조는 같은 소유자 범위에서 검증합니다. 단일 사용자 로컬 서버인지 로그인 서버인지 배포 범위를 먼저 정하고 클라이언트가 보낸 소유자 id를 신뢰하지 않습니다.

### 동시 수정과 재시도

- 저장 리소스는 정수 revision을 가집니다. 생성 시 1, 변경 시 원자적으로 비교 후 1 증가합니다. 배치 최초 저장만 3절의 revision=0 규칙을 사용합니다.
- PUT/PATCH/복구는 본문 revision, 태스크 DELETE는 query의 revision을 요구합니다. 누락은 400, 불일치는 409 `REVISION_CONFLICT`입니다. 충돌 시 최신 revision으로 자동 덮어쓰지 않습니다.
- 프로젝트·태스크·일지 생성에는 `Idempotency-Key`를 사용합니다. 사용자·메서드·경로·키와 본문 해시, 결과를 24시간 보존합니다. 같은 요청은 기존 결과를 반환하고 다른 본문은 409 `IDEMPOTENCY_KEY_REUSED`입니다. 동시 재요청도 한 번만 생성하도록 처리합니다.
- 시간 초과는 저장 실패 확정이 아닙니다. 생성은 같은 키로 재시도하고 변경은 재조회해 결과를 확인합니다. 키 보존 기간 이후에는 성공 여부를 확인하지 않은 자동 재생성을 하지 않습니다.

### 조회와 검증

- scope 기본값은 all이며 all/unity/server를 허용합니다. 리소스 분야는 unity/server, 공용 링크만 all을 저장할 수 있습니다.
- 선택적 projectId와 scope는 교집합입니다. 특정 분야와 프로젝트 분야가 다르면 400 `SCOPE_PROJECT_MISMATCH`입니다. 링크의 공용 항목 포함은 6절 예외를 따릅니다.
- query는 대소문자를 구분하지 않는 포함 검색이며 빈 문자열은 검색 제한 없음입니다. 대상 필드는 리소스별로 명시합니다.
- 페이지 조회는 cursor와 limit을 사용합니다. limit 기본 20, 범위 1~100, 마지막 nextCursor는 null입니다. cursor는 필터·정렬에 종속되며 조건 변경 시 폐기합니다. id를 마지막 정렬 기준으로 사용하고 명시된 정렬만 허용합니다.
- 문자열 길이는 HTML maxLength와 같은 UTF-16 코드 단위입니다. 필수값은 trim 후 공백만 있으면 거절하고 선택 문자열은 빈 문자열을 허용합니다. 서버도 입력 제한과 참조 유효성을 검사합니다.

## 3. 홈 배치

| API                    | 계약                                                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------ |
| GET `/dashboards/home` | `{ id, schemaVersion, revision, widgets }`. 기록이 없으면 기본 배치와 revision=0 반환. 조회로 기록을 생성하지 않음 |
| PUT `/dashboards/home` | `{ schemaVersion, revision, widgets }` 전체 원자 저장 후 전체 배치 반환. 첫 revision=0 요청은 생성, 이후 비교·증가 |

위젯 필드는 `{ id, type, title, scope, size }`이며 배열 순서가 배치 순서입니다.

- schemaVersion=1. type은 overview/board/deploy/links/journal/milestone, size는 small/medium/wide(현재 1/2/3칸)입니다.
- id는 비어 있지 않은 문자열로 배치 내 유일해야 합니다. 기본 문자열 id와 UUID, 같은 type의 여러 인스턴스를 허용합니다.
- title은 trim 후 1~48입니다. 빈 입력의 기본 제목은 프론트 registry에서 채웁니다. 알 수 없는 type/scope/size는 400, 미지원 버전은 400 `UNSUPPORTED_SCHEMA_VERSION`입니다.
- widgets=[]는 유효합니다. 동시 최초 저장은 하나만 성공하며 잘못된 요청은 기존 배치를 덮어쓰지 않습니다.
- 추가·제거·교체·이동·크기 변경·기본 복원은 초안에서 처리하고 최종 PUT 한 번으로 저장합니다. 위젯 제거는 업무 데이터를 삭제하지 않습니다. 취소·카탈로그·기본 복원 전용 API는 없습니다.

## 4. 업무 리소스

응답의 공통 필드는 id, revision, createdAt, updatedAt입니다. 아래 필드와 합쳐 리소스를 구성합니다. 상세 전용 필드는 목록에서 생략할 수 있으나 편집 전에 상세 조회로 확보해야 합니다.

### 프로젝트

| API                    | 입력 / 동작                                                                                               |
| ---------------------- | --------------------------------------------------------------------------------------------------------- |
| GET `/projects`        | scope, query, status(기본 active), cursor, limit. 검색: name·stack. 정렬: updatedAt 내림차순, id 오름차순 |
| GET `/projects/{id}`   | 보관 여부와 무관하게 소유자 범위의 상세 반환                                                              |
| POST `/projects`       | name, subtitle, scope, stack, progress, currentMilestone, repositoryUrl. status 기본 active               |
| PATCH `/projects/{id}` | 생성 필드 및 status, revision. archived로 보관, active로 해제                                             |

응답은 입력 필드와 status, iconKey, colorToken을 포함합니다. status는 active/archived만 지원합니다. progress는 수동 값이며 작업 완료율로 자동 계산하지 않습니다. iconKey·colorToken은 프론트 허용 키로 매핑하고 알 수 없는 키는 기본 표시를 사용합니다. 임의 CSS나 React 컴포넌트를 응답하지 않습니다.

검증: name 필수 100, stack 필수 200, subtitle 4000, currentMilestone 200, repositoryUrl 2000. URL은 빈 값 또는 http/https, progress는 0~100입니다. 로컬 archived는 status, milestone은 currentMilestone 문자열, color는 colorToken으로 매핑합니다.

보관은 작업·일지를 삭제하지 않습니다. 영구 삭제는 현재 범위에 없습니다. 프로젝트 선택 목록은 화면 검색과 독립적으로 조회하며 기존 선택이 보관되었거나 첫 페이지 밖이면 상세 조회로 보충합니다.

### 태스크

| API                            | 입력 / 동작                                                                                                                         |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| GET `/tasks`                   | scope, projectId, query, status, deleted(기본 false), cursor, limit. 검색: title·projectName. 정렬: updatedAt 내림차순, id 오름차순 |
| GET `/tasks/{id}`              | 편집에 필요한 description과 revision 포함                                                                                           |
| POST `/tasks`                  | title, projectId, description, status, priority, tags                                                                               |
| PATCH `/tasks/{id}`            | 생성 필드의 부분 변경과 revision. 상태 이동도 동일 API 사용                                                                         |
| DELETE `/tasks/{id}?revision=` | deletedAt을 설정하는 소프트 삭제                                                                                                    |
| POST `/tasks/{id}/restore`     | revision을 받아 deletedAt=null로 복구. 원래 상태·프로젝트·본문 보존                                                                 |

응답은 입력 필드와 projectName, scope, deletedAt(null 또는 시각)을 포함합니다. description은 상세 전용일 수 있습니다. deletedAt은 전용 API만 변경하며 일반 PATCH로 복구하지 않습니다. 휴지통은 deleted=true로 조회하고 현재 UI에서는 scope만 전달하며 화면 query는 전달하지 않습니다.

검증: title 필수 160, description 10000, projectId 필수. status는 todo/doing/done, priority는 normal/high입니다. 로컬 '보통/높음'을 priority로, 단일 tag를 tags 배열로 매핑합니다. 태그 하나당 최대 40이며 빈 입력은 빈 배열입니다. 다중 태그를 받은 프론트는 첫 태그 편집 시 나머지를 보존합니다.

### 개발일지

| API                  | 입력 / 동작                                                                                                       |
| -------------------- | ----------------------------------------------------------------------------------------------------------------- |
| GET `/journals`      | scope, projectId, query, cursor, limit. 검색: title·projectName. 정렬: createdAt·id 내림차순. 최근 위젯은 limit=3 |
| GET `/journals/{id}` | body 포함 전체 일지                                                                                               |
| POST `/journals`     | title, projectId, body                                                                                            |

응답은 title, projectId, projectName, scope, summary와 상세 body를 포함합니다. 검증은 title 필수 120, body 필수 20000, projectId 필수입니다. 수정·삭제·첨부는 7절 후속 기능입니다.

### 연결 관계

- 작업·일지의 projectName과 scope는 프로젝트 참조에서 결정합니다. 클라이언트 복사본을 권위 있는 값으로 저장하지 않습니다. 프로젝트 이름·분야 변경은 연결 항목의 조회·검색·통계에 반영합니다.
- 새 작업·일지 또는 작업의 프로젝트 변경은 미보관 프로젝트만 대상으로 합니다. 저장 중 대상이 보관되면 409 `PROJECT_ARCHIVED`입니다.
- 기존 작업은 보관된 연결을 유지한 편집·상태 변경·복구가 가능합니다. 위 제한을 보관 프로젝트의 기존 작업 전체에 적용하지 않습니다.

## 5. 통계와 프론트 연결

### 통계

| API                | 필터와 응답                                                                                                                                                                              |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET `/overview`    | scope, projectId. `{ scope, projectId, projects: { total, archived, byScope: { unity: { total, archived }, server: { total, archived } } }, tasks: { todo, doing, done, total }, asOf }` |
| GET `/tasks/stats` | scope, projectId, query. `{ counts: { todo, doing, done }, total, asOf }`. status·deleted 필터 없음                                                                                      |

- overview의 projects.total은 **미보관 수**, archived는 보관 수입니다. 사이드바·환영 배너는 scope=all의 total, 프로젝트 위젯은 자신의 scope, 보관 탭은 archived를 사용합니다. byScope는 두 키를 항상 포함하고 범위 밖 분야는 0입니다.
- overview는 query·프로젝트 보관 탭과 독립적입니다. 검색 결과 건수는 목록 total로 표시합니다.
- 두 API의 작업 집계는 같은 로직을 사용하며 보관 프로젝트의 작업도 포함하고 삭제 작업은 제외합니다. done은 전체 기간 완료 수입니다.
- 보드 각 열은 같은 scope/projectId/query와 해당 status로 따로 페이지 조회합니다. stats 합계는 status 제한 없는 미삭제 작업 목록 total과 같아야 합니다. 한 열이 다른 열의 페이지 한도를 소진하지 않게 합니다.

### 프론트 연동과 데이터 이전

- 기능 Provider에 비동기 조회·mutation 계층을 연결합니다. 동기 boolean 저장 계약은 Promise와 pending/error로 전환하고 성공 응답 후에만 편집 종료·성공 표시를 합니다. 실패·충돌 시 입력을 보존합니다.
- 같은 범위의 위젯은 캐시를 공유합니다. 변경 성공 후 관련 목록·상세·통계를 갱신합니다. 프로젝트 변경 시 선택 목록·작업·휴지통·일지도 갱신합니다. 동일 리소스 저장 중 중복 입력을 막고 낙관적 갱신 실패는 해당 변경만 복구합니다.
- 작업 저장과 배치 초안은 독립적입니다. 배치를 취소해도 작업 변경은 유지합니다. 페이징 연결 시 목록·보드 열별 더 보기와 전체 건수 표시를 함께 구현합니다.
- 검색 초기화는 query를 비우고 scope=all로 재조회하되 프로젝트 보관 탭은 유지합니다. 홈 탭·검색은 보이는 위젯만 선택하고 위젯 자체 scope를 바꾸지 않습니다.
- 로컬 키는 devspace.layout.v1, devspace.projects.v1, devspace.tasks.v1, devspace.journals.v1입니다. 자동 업로드·폐기하지 않습니다. 예시 id에도 사용자 편집이 있을 수 있어 id만으로 예시 여부를 판단하지 않습니다.
- 배치만 가져오면 검증 후 기존 PUT을 사용합니다. 업무 데이터 이전은 사용자 선택과 서버 projectId 매핑이 필요하며 모호한 구형 이름 참조는 매핑을 확인합니다. 일괄 가져오기는 7절 범위입니다.
- 로그인 연동 시 사용자별 캐시를 분리하고 로그아웃 시 메모리·조회 캐시를 비웁니다. 기본 배치 외 서버 오류를 데모 데이터로 대체하지 않습니다.

## 6. 예시 데이터의 실제 연동

해당 위젯의 실제 데이터 연동 요청 시 적용합니다. 팝업 필드가 목록에 있으면 추가 상세 요청을 하지 않습니다.

| 리소스   | 조회 API                                  | 응답 필드와 조회 규칙                                                                                                                                                                 |
| -------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 링크     | GET `/links`                              | id, label, description, url, scope, projectId, iconKey, position, revision. scope/projectId/query 필터, 검색 label·description. position·id 오름차순. 현재 전체 반환, nextCursor=null |
| 마일스톤 | GET `/milestones`, GET `/milestones/{id}` | id, projectId, projectName, title, dueDate, progress, status, revision. 상세 description·acceptanceCriteria. scope/projectId/status/sort/cursor/limit 필터                            |
| 서비스   | GET `/services`, GET `/services/{id}`     | id, projectId, name, stack, environment, enabled, status, checkedAt, staleAfterSeconds, latestDeployment, revision. scope/projectId/environment/cursor/limit 필터                     |
| 배포     | GET `/services/{id}/deployments`          | id, serviceId, version, commitSha, status, startedAt, finishedAt, logUrl. cursor/limit, startedAt·id 내림차순                                                                         |

- 링크의 분야 조회는 해당 분야와 scope=all 공용 링크를 포함합니다. projectId 조회는 해당 프로젝트 전용 링크와 해당 분야·전체 공용 링크를 포함합니다. 전용 링크의 분야는 프로젝트에서 결정합니다.
- 마일스톤 status는 planned/in_progress/completed/canceled입니다. 기본 정렬은 dueDate·id 오름차순, dueDate=null은 마지막입니다. 다가오는 위젯은 status=planned,in_progress와 limit=2로 지연 목표도 포함합니다.
- 배포 status는 queued/running/succeeded/failed/canceled입니다. 배포 실패와 서비스 장애는 별개이며 배포가 없으면 latestDeployment=null입니다.

### 운영 계약

- 서비스 목록은 공통 응답에 `summary: { total, healthy, degraded, down, unknown, disabled }`와 asOf를 추가합니다. 집계는 필터 전체 기준입니다.
- 활성 상태는 healthy/degraded/down/unknown입니다. 비활성은 status=unknown이지만 summary에서는 disabled에만 집계합니다. 활성 서비스가 1개 이상이고 모두 healthy일 때만 전체 정상입니다.
- checkedAt이 없거나 staleAfterSeconds가 지나면 unknown입니다. 서버가 주기적으로 검사하고 브라우저는 60초 간격 조회부터 시작합니다. 숨겨진 화면에서는 조회를 멈추며 응답 이후 오래된 상태도 표시합니다.
- 설정 화면 구현 시 POST `/services`, PATCH `/services/{id}`에 projectId, name, stack, environment, healthCheckUrl, checkIntervalSeconds, enabled를 사용합니다. PATCH에 revision을 포함합니다. 설정 화면 전에는 관리 설정으로 등록할 수 있습니다.
- healthCheckUrl의 호스트·포트·프로토콜은 배포 환경의 허용 대상을 검증합니다. 비밀값은 서버에서 관리하고 조회 응답에 포함하지 않습니다.
- 서비스 삭제 요청 시 DELETE `/services/{id}`로 검사 예약과 배포 기록을 함께 삭제합니다. 기록 보존은 enabled=false를 사용합니다. 실제 배포 실행은 후속 기능입니다.

## 7. 후속 기능 제안

다음은 구현 순서 제안이며 확정된 초기 API가 아닙니다. 기능 착수 시 요청 스키마·제한·권한·삭제 정책을 확정하고 해당 리소스 계약에 편입합니다.

| 순서 | 기능                     | API 방향과 결정 사항                                                                                                                                                                                    |
| ---- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | 링크 관리 (안정화 10)    | POST `/links`, PATCH/DELETE `/links/{id}`. URL 검증·position 정렬. 원자 재정렬이 필요할 때만 PUT `/links/order`에 범위·전체 id 순서·목록 revision 추가                                                  |
| 1    | 일지 후속 관리 (11)      | PATCH/DELETE `/journals/{id}`, 목록 from/to/sort. from 포함·to 제외 UTC. 소프트 삭제·복구 채택 시 deleted 필터와 POST `/journals/{id}/restore` 추가                                                     |
| 2    | 프로젝트별 위젯 (12)     | 배치에 projectId·limit 추가, schemaVersion·마이그레이션 정의. 기존 상세·목록 재사용, 보관 프로젝트 참조 유지                                                                                            |
| 2    | 독립 마일스톤 관리 (13)  | POST `/milestones`, PATCH/DELETE `/milestones/{id}`. 현재 목표 문자열을 자동 변환하지 않고 사용자가 독립 목표와 연결                                                                                    |
| 3    | 백업·가져오기            | 로컬 JSON 내보내기는 API 불필요. POST `/imports/preview`, POST `/imports/{id}/commit`, GET `/imports/{id}`. 미리보기는 업무 데이터 생성 없이 검증·중복·id 매핑 제공, 확정은 멱등·원자 적용              |
| 3    | 초안 복구                | 로컬 임시 저장부터 시작. 여러 기기용은 GET `/drafts`, PUT/DELETE `/drafts/{id}`에 type, resourceId, baseRevision, payload, revision. 정식 저장 성공 후 초안 삭제                                        |
| 4    | 기한·변경 이력           | tasks에 dueDate(날짜)·dueBefore/dueAfter 필터. GET `/activities`에 projectId/resourceType/cursor/limit. 서버 변경과 함께 actor·action·시각·변경 필드 기록                                               |
| 5    | 여러 배치·첨부·통합 검색 | `/dashboards` CRUD, POST `/uploads`·`/attachments` 및 DELETE `/attachments/{id}`, GET `/search`. 현재 단일 홈·목록 검색에 선행 구현하지 않음                                                            |
| 5    | 로그인·외부 연결         | POST `/auth/login`, POST `/auth/logout`, GET `/me`. 서버 세션·HttpOnly 쿠키. GET `/integrations`, POST `/integrations/github/connect`, GET `/integrations/github/callback`, DELETE `/integrations/{id}` |
| 6    | Unity·개발 자료 확장     | 프로젝트별 builds/playtests/performance-runs/assets/documents, ideas, snippets. 빌드·성능·라이선스·기술 기록 요구 확정 후 개별 CRUD 설계                                                                |
| 6    | 에이전트·배포 실행       | `/agent-runs`, `/projects/{id}/agent-instructions`, POST `/services/{id}/deployments`. 작업 큐·실행 권한·취소·결과 계약을 먼저 정의                                                                     |

OAuth는 authorizationUrl 반환 후 callback에서 state 검증·코드 교환·서버 토큰 저장·결과 화면 리다이렉트를 수행합니다. CI 연동 시 POST `/webhooks/github`, POST `/webhooks/deployments`에 서명 검증과 전달 id 중복 방지를 적용합니다. 외부 GitHub 링크 클릭 자체에는 OAuth가 필요 없습니다.

모바일·접근성·URL 이동 유지·위젯 터치 편집은 별도 업무 API가 필요 없습니다. URL 라우팅의 SPA 호스팅 설정은 별도입니다. 프로필 안내·검색 초기화·편집 취소도 프론트 책임입니다.

## 8. 백엔드 완료 검증 기준

- 소유자 범위·프로젝트 참조, 입력 제한, 공통 오류·응답 형태를 테스트합니다.
- 첫 배치 동시 생성·빈 배치 보존, revision 충돌·원자 저장, 생성 중복 재시도를 테스트합니다.
- 프로젝트 이름·분야 변경 반영, 보관 후 연결 데이터 유지, 태스크 삭제·복구와 통계 제외/복원을 테스트합니다.
- 검색 total과 페이지 길이 분리, 보드 상태별 집계, 보관 프로젝트 작업 포함, 조건 변경 후 cursor 처리를 테스트합니다.
- 프론트 연동 후 저장 실패 초안 보호, 홈·목록 동기화, 배치 취소와 작업 저장 독립성을 회귀 검증합니다.
