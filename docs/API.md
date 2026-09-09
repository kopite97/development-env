# 서버 연동 API 목록

현재 구현은 React 프론트엔드 프로토타입입니다. 배치와 작업 상태는 localStorage에 저장하고 프로젝트, 일지, 마일스톤, 운영 상태는 예시 데이터를 사용합니다. 아래 API는 **구현 예정 계약**이며 현재 호출하거나 구현하지 않습니다. Java/Spring Boot 또는 C#/ASP.NET Core 어느 쪽에도 적용할 수 있습니다.

## 1. 현재 화면을 실제 데이터로 전환하는 API

기본 경로: `/api/v1`. `scope`는 `all | unity | server`입니다. 현재 위젯 편집기는 이 세 범위만 지원합니다. 특정 프로젝트 선택은 후속 UI 기능이며 API에서는 선택적 `projectId`로 대비합니다. 둘을 함께 지정하면 교집합으로 조회하고, 프로젝트가 지정 분야와 맞지 않으면 400 `SCOPE_PROJECT_MISMATCH`를 반환합니다.

| 기능           | 메서드 · 경로                                                    | 요청 / 응답 핵심                                                        | 우선순위     |
| -------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------ |
| 홈 배치 조회   | GET `/dashboards/home`                                           | id, revision, schemaVersion, widgets                                    | 필수         |
| 홈 배치 저장   | PUT `/dashboards/home`                                           | 위젯 배열 전체와 revision 저장. 위치·크기·제목·범위 포함                | 필수         |
| 프로젝트 목록  | GET `/projects?scope=&query=&cursor=&limit=`                     | 이름, 설명, 기술 스택, 진행률, 상태, 분야                               | 필수         |
| 프로젝트 상세  | GET `/projects/{id}`                                             | 저장소 URL, 개발 환경, 목표, 최근 작업                                  | 필수         |
| 요약 통계      | GET `/overview?scope=&projectId=`                                | 진행 프로젝트 수, 분야별 프로젝트 수, 상태별 작업 수. 상세 계약은 6.2절 | 필수         |
| 작업 목록      | GET `/tasks?scope=&projectId=&status=&query=&cursor=&limit=`     | id, title, projectId, status, priority, tags                            | 필수         |
| 작업 상태 변경 | PATCH `/tasks/{id}`                                              | status 및 revision. 변경된 작업 반환                                    | 필수         |
| 개발 일지 목록 | GET `/journals?scope=&projectId=&query=&cursor=&limit=`          | 제목, 프로젝트, 작성일, 요약                                            | 필수         |
| 개발 일지 상세 | GET `/journals/{id}`                                             | 본문, 첨부 자료, 작성·수정 시각                                         | 필수         |
| 빠른 링크 목록 | GET `/links?scope=&projectId=&query=`                            | 제목, URL, 설명, 정렬 순서                                              | 필수         |
| 마일스톤 목록  | GET `/milestones?scope=&projectId=&status=&sort=&cursor=&limit=` | 목표, 완료 조건, 목표일, 진행률. 기본 dueDate 오름차순                  | 필수         |
| 서비스 현황    | GET `/services?scope=&projectId=&environment=&cursor=&limit=`    | 서비스, 환경, 상태, checkedAt, 최신 배포 요약, 필터 전체 집계           | 운영 연동 시 |
| 배포 기록      | GET `/services/{id}/deployments?cursor=&limit=`                  | 버전, 커밋, 결과, 배포 시각, 로그 링크                                  | 운영 연동 시 |

위젯 추가·제거·교체·이동·크기 변경은 편집 초안에서 처리하고 **배치 저장 시 PUT 한 번**으로 원자적으로 반영합니다. 취소는 요청을 보내지 않습니다. 위젯 제거가 프로젝트나 작업 삭제로 이어져서는 안 됩니다. 같은 종류의 위젯을 여러 개 배치하므로 인스턴스 id와 type을 구분합니다.

### 배치 저장 예시

```json
{
  "schemaVersion": 1,
  "revision": 3,
  "widgets": [
    {
      "id": "widget-uuid-1",
      "type": "overview",
      "title": "Unity 프로젝트 현황",
      "scope": "unity",
      "size": "medium"
    },
    {
      "id": "widget-uuid-2",
      "type": "deploy",
      "title": "운영 · 배포 현황",
      "scope": "server",
      "size": "small"
    }
  ]
}
```

배열 순서가 배치 순서입니다. 현재 크기는 small=1칸, medium=2칸, wide=3칸이며 모바일에서는 1열로 표시합니다. 향후 자유 좌표 배치가 필요하면 schemaVersion을 올려 breakpoint별 x/y/w/h를 추가합니다. 응답은 갱신된 revision과 전체 배치를 반환합니다. 서버는 type/scope/size 허용 값과 id 중복을 검증합니다.

## 2. 실제 개인 관리 도구로 확장할 때의 작성 API

아래 작성·삭제 화면은 아직 구현하지 않았습니다.

| 기능                    | API                                                                                            |
| ----------------------- | ---------------------------------------------------------------------------------------------- |
| 프로젝트 생성·수정·보관 | POST `/projects`, PATCH `/projects/{id}` (status=archived)                                     |
| 작업 생성·삭제          | POST `/tasks`, DELETE `/tasks/{id}`                                                            |
| 일지 작성·수정·삭제     | POST `/journals`, PATCH / DELETE `/journals/{id}`                                              |
| 링크 추가·수정·삭제     | POST `/links`, PATCH / DELETE `/links/{id}`                                                    |
| 마일스톤 작성·수정·삭제 | POST `/milestones`, PATCH / DELETE `/milestones/{id}`                                          |
| 여러 홈 구성 저장       | GET / POST `/dashboards`, GET / PUT / DELETE `/dashboards/{id}`                                |
| 첨부 파일               | POST `/uploads` (업로드 URL 발급), POST `/attachments` (완료 등록), DELETE `/attachments/{id}` |
| 통합 검색               | GET `/search?q=&types=&cursor=&limit=`                                                         |

## 3. Unity 및 에이전트 관련 확장 API

이 항목들은 현재 위젯 목록에 포함하지 않았으며 후속 기능입니다.

| 기능               | API                                                                  | 주요 데이터                                   |
| ------------------ | -------------------------------------------------------------------- | --------------------------------------------- |
| Unity 빌드 관리    | GET / POST `/projects/{id}/builds`                                   | 버전, 플랫폼, Unity 버전, 성공 여부, 아티팩트 |
| 플레이테스트       | GET / POST `/projects/{id}/playtests`, PATCH `/playtests/{id}`       | 빌드, 피드백, 이슈, 처리 상태                 |
| 성능 기록          | GET / POST `/projects/{id}/performance-runs`                         | 기기, FPS, 메모리, 로딩 시간, 빌드            |
| 에셋 관리          | GET / POST `/projects/{id}/assets`, PATCH / DELETE `/assets/{id}`    | 출처, 라이선스, 비용, 사용처                  |
| 기술 문서·의사결정 | GET / POST `/projects/{id}/documents`, GET / PATCH `/documents/{id}` | 종류, 제목, 본문, 참조                        |
| 아이디어           | GET / POST `/ideas`, PATCH / DELETE `/ideas/{id}`                    | 설명, 분야, 우선순위, 프로젝트 전환 여부      |
| 에이전트 작업      | GET / POST `/agent-runs`, GET / PATCH `/agent-runs/{id}`             | 요청, 상태, 브랜치·PR, 결과, 검토·테스트 상태 |
| 에이전트 지침      | GET / PUT `/projects/{id}/agent-instructions`                        | 코딩 규칙, 프롬프트, 지침 버전                |
| 공용 코드·도구     | GET / POST `/snippets`, PATCH / DELETE `/snippets/{id}`              | 언어, 코드, 태그, 사용 예                     |

## 4. 로그인·외부 서비스 연결

- 여러 기기 동기화나 외부 공개 운영 시: POST `/auth/login`, POST `/auth/logout`, GET `/me`. 서버 세션과 HttpOnly 쿠키를 사용하고 모든 리소스에서 소유자를 검증합니다.
- Git 저장소 연결: GET `/integrations`, POST `/integrations/github/connect`, DELETE `/integrations/{id}`. OAuth 비밀키와 접근 토큰은 서버에서 관리합니다.
- CI 배포 반영: POST `/webhooks/github`, POST `/webhooks/deployments`. 서명 검증과 전달 id 중복 방지가 필요합니다.
- 서버 모니터링: 서버가 등록된 서비스의 상태 확인 주소를 주기적으로 검사하고 DB에 저장합니다. 브라우저는 `/services`를 조회합니다. 일정 시간 결과가 없으면 정상 대신 `unknown`을 반환합니다.
- 이 페이지에서 실제 배포를 실행하는 기능은 현재 범위에 없습니다. 필요 시 POST `/services/{id}/deployments`를 별도 작업 큐와 연결합니다.

## 5. 공통 계약과 프론트 연결

- 시각은 UTC ISO 8601, 화면에서 사용자 시간대로 변환합니다. 마일스톤의 날짜만 있는 값은 `YYYY-MM-DD`로 구분합니다.
- 목록은 `{ "items": [], "nextCursor": null }` 형식, 상세는 리소스 객체를 반환합니다.
- 오류는 `{ "code": "REVISION_CONFLICT", "message": "다른 기기에서 변경되었습니다.", "fieldErrors": {} }`. 400 입력 오류, 401 미인증, 403 권한 없음, 404 없음, 409 동시 수정, 429 요청 제한을 구분합니다.
- revision이 오래된 PUT/PATCH는 409를 반환하여 다른 기기 변경을 덮어쓰지 않습니다.
- 동일 범위를 쓰는 위젯은 조회 캐시를 공유합니다. 로딩·실패·빈 상태는 위젯 단위로 처리합니다. 운영 조회 실패를 정상으로 표시하지 않습니다.
- 현재 `src/data/demo.ts`를 API 조회 계층으로 교체하고, `usePersistedState`를 서버 저장 어댑터로 전환합니다. 순수 배치 로직과 공용 UI는 유지합니다.
- 권장 구현 순서: 배치·프로젝트·작업 → 일지·링크·마일스톤 → 운영·배포 연동 → Unity/에이전트 확장.

## 6. 구현 대조 후 추가·보완 사항

최초 검토 기준: `src/App.tsx`, 기존 `src/features/dashboard/widgets.tsx`, `WidgetEditor.tsx`, `model.ts`, `src/data/demo.ts`, `src/hooks/usePersistedState.ts`. 이후 구조 분리로 페이지는 `src/pages/`, 위젯 콘텐츠는 각 `src/features/` 폴더, 위젯 등록은 `src/features/dashboard/registry.tsx`, 저장 로직은 기능별 Provider로 이동했습니다. 경로와 연결 기준은 [구조 문서](ARCHITECTURE.md)를 참고합니다. 아래 내용도 설계 계약이며 서버 구현 완료를 의미하지 않습니다.

### 6.1 추가 API와 필요 시점

| 기능                      | 메서드 · 경로                                    | 필요 이유 및 계약                                                                                                    | 적용 시점                                |
| ------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| 작업 보드 상태별 집계     | GET `/tasks/stats?scope=&projectId=&query=`      | `counts: { todo, doing, done }`, `total`, `asOf`. 페이지에 내려온 카드 개수와 전체 작업 수를 구분                    | 작업 목록을 페이지 단위로 연동할 때 필수 |
| 서비스 상세               | GET `/services/{id}`                             | 프로젝트, 기술 스택, 환경, 현재 상태, 상태 확인 시각, 최신 배포. 운영 카드 클릭 시 사용                              | 목록 요약에 팝업 데이터가 부족할 때      |
| 마일스톤 상세             | GET `/milestones/{id}`                           | `projectId`, `projectName`, 제목, 설명, 완료 조건, 목표일, 진행률, 상태, revision                                    | 상세 팝업을 실제 목표 정보로 확장할 때   |
| 모니터링 서비스 등록      | POST `/services`                                 | `projectId`, `name`, `stack`, `environment`, `healthCheckUrl`, `checkIntervalSeconds`, `enabled`. 생성된 서비스 반환 | 운영 연동 시 설정 경로 필요              |
| 모니터링 서비스 수정·중지 | PATCH `/services/{id}`                           | 등록 필드의 부분 수정과 revision. `enabled=false`로 검사 중지                                                        | 운영 연동 시 설정 경로 필요              |
| 모니터링 서비스 삭제      | DELETE `/services/{id}`                          | 검사 예약을 해제하고 서비스를 삭제. 해당 서비스의 배포 기록도 함께 삭제하는 정책으로 고정                            | 서비스 관리 화면 추가 시                 |
| GitHub OAuth 완료 처리    | GET `/integrations/github/callback?code=&state=` | 기존 connect API가 시작한 인증을 완료하고 연결을 저장한 뒤 프론트로 이동                                             | GitHub OAuth 연결 시                     |

서비스 설정 화면은 아직 없습니다. 초기 운영에서 설정 파일이나 관리 스크립트로 서비스를 등록한다면 등록·수정 API는 뒤로 미룰 수 있지만, 데이터 등록 경로 자체는 반드시 필요합니다. 서비스 삭제는 프로젝트 삭제와 독립적입니다. 기록 보존이 필요하면 삭제 대신 `enabled=false`를 사용합니다.

서비스·마일스톤 팝업은 현재 메모리의 데이터로 표시합니다. 목록 응답에 필요한 필드가 모두 있으면 상세 GET을 추가 호출하지 않아도 됩니다. 상세 API를 추가했다는 이유로 카드마다 개별 조회하는 구조를 만들지 않습니다.

### 6.2 프로젝트 수와 작업 수의 집계 기준

`App.tsx`의 사이드바 숫자 4/2/2와 환영 배너의 4는 현재 상수입니다. 위젯 바깥의 숫자도 실제 데이터로 바꾸기 위해 기존 `/overview` 응답을 다음처럼 확장합니다. 별도의 사이드바 API는 필요하지 않습니다.

```json
{
  "scope": "all",
  "projectId": null,
  "projects": {
    "total": 4,
    "active": 4,
    "byScope": {
      "unity": { "total": 2, "active": 2 },
      "server": { "total": 2, "active": 2 }
    }
  },
  "tasks": { "todo": 3, "doing": 3, "done": 1, "total": 7 },
  "asOf": "2026-09-09T04:00:00Z"
}
```

- `projects.total`은 보관하지 않은 프로젝트 수, `active`는 그중 `status=active`인 프로젝트 수입니다. 사이드바는 total, 환영 배너와 진행 중 위젯은 active를 사용합니다. 프로젝트 상태는 `planned | active | paused | completed | archived`로 정합니다.
- 응답은 요청한 범위 안에서 계산합니다. 사이드바·환영 배너는 `scope=all`, Unity 위젯은 `scope=unity`를 각각 사용합니다. `byScope`에는 두 분야 키를 항상 포함하고 해당하지 않는 분야는 0을 반환합니다.
- 프로젝트 목록에는 `status` 필터도 추가합니다. 요약 위젯에서 진행 중 프로젝트만 표시할 때는 `GET /projects?scope=unity&status=active`를 사용합니다.
- 현재 프로젝트 검색은 프로젝트 행만 좁히고 작업 수에는 적용하지 않습니다. 서버 연동 후 `/overview`는 검색과 독립적인 범위 통계로 유지하고, 검색 결과 건수는 프로젝트 목록의 `total`로 별도 표시합니다. 프론트에서 현재 검색 결과 수를 진행 중 전체 수로 표시하는 부분도 함께 수정해야 합니다.
- `/tasks/stats`는 작업 보드의 검색 조건까지 반영합니다. 보드 카드 목록과 같은 scope/projectId/query를 사용하고, status별 목록은 `GET /tasks?...&status=todo`처럼 각각 조회하여 한 열의 카드가 다른 열의 페이지 제한을 소진하지 않게 합니다. `/tasks/stats` 자체에는 status 필터를 받지 않습니다.
- `/overview`와 `/tasks/stats`는 동일한 작업 집계 로직을 공유합니다. 기본적으로 보관되지 않은 프로젝트의 작업을 대상으로 하며 `done`은 전체 기간 완료 수입니다. '이번 주 완료'로 해석하지 않습니다.
- 현재 화면은 모든 예시 작업을 메모리에 두므로 페이징 UI가 없습니다. 서버에서 일부 카드만 내려줄 때는 열별 더 보기와 전체 건수 표시를 함께 구현해야 합니다.

### 6.3 화면 표시를 위해 필요한 응답 필드

| 리소스   | 보완할 필드                                                                                                                              | 구현과 연결되는 이유                                                                                                               |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 프로젝트 | `id`, `name`, `subtitle`, `scope`, `stack`, `status`, `progress`, `iconKey`, `colorToken`, `currentMilestone`, `revision`                | 카드 설명·기술 스택·아이콘·진행률·상세 목표. progress는 0~100이며 현재는 수동 값. 작업 완료율로 자동 계산하는 것으로 가정하지 않음 |
| 작업     | `id`, `title`, `projectId`, `projectName`, `scope`, `status`, `priority`, `tags`, `revision`, `updatedAt`                                | 현재 project 문자열만으로 연결하는 구조를 id 참조로 전환. 카드마다 프로젝트 상세를 조회하지 않도록 이름 포함                       |
| 일지     | `id`, `title`, `projectId`, `projectName`, `scope`, `summary`, `createdAt`, `updatedAt`; 상세에 `body`, `attachments`, `revision`        | 예시 일지에는 id와 연도가 없음. 제목을 식별자로 쓰지 않고 MM.DD는 전체 날짜에서 화면이 생성                                        |
| 링크     | `id`, `label`, `description`, `url`, `scope`, `projectId`, `iconKey`, `position`, `revision`                                             | 현재 label을 React key로 쓰므로 같은 제목 중복 시 충돌. 안정적인 id와 정렬 필요                                                    |
| 마일스톤 | `id`, `projectId`, `projectName`, `title`, `dueDate`, `progress`, `status`, `revision`; 상세에 `description`, `acceptanceCriteria`       | 현재 프로젝트 두 개와 고정 날짜를 목표처럼 표시하므로 독립 마일스톤 데이터가 필요                                                  |
| 서비스   | `id`, `projectId`, `name`, `stack`, `environment`, `enabled`, `status`, `checkedAt`, `staleAfterSeconds`, `latestDeployment`, `revision` | 현재 이름·버전·정상이 상수. latestDeployment는 배포가 없을 때 null                                                                 |
| 배포     | `id`, `serviceId`, `version`, `commitSha`, `status`, `startedAt`, `finishedAt`, `logUrl`                                                 | 상태는 `queued                                                                                                                     | running | succeeded | failed | canceled`. 최근 배포 실패와 서비스 장애는 별개 |

`iconKey`와 `colorToken`은 프론트 등록부에서 해석하는 허용 키이며 알 수 없는 값은 기본 아이콘·색상으로 표시합니다. 서버가 React 컴포넌트 이름이나 임의 CSS를 내려주는 방식은 사용하지 않습니다. 현재 프로젝트 id별 아이콘 매핑도 일반적인 키 매핑으로 바꿔야 합니다.

작업 status는 현재와 같은 `todo | doing | done`, priority는 API에서 `normal | high`로 고정하고 화면에서 '보통 / 높음'으로 변환합니다. 현재 단일 `tag`는 `tags: string[]`로 매핑합니다. 작업 보드에서는 첫 태그를 표시하고 나머지는 향후 상세 UI에서 사용할 수 있습니다.

### 6.4 범위·검색·정렬 규칙

- 링크의 `scope=all`은 공용 링크를 뜻합니다. `/links?scope=unity`는 unity 링크와 공용 링크를 함께 반환합니다. `projectId`를 추가했을 때도 해당 프로젝트 링크 + 해당 분야의 공용 링크 + 전체 공용 링크를 포함합니다. 프로젝트 전용 링크의 분야는 프로젝트에서 결정합니다.
- 홈의 분야 탭은 **보이는 위젯**을 선택하며 저장된 위젯의 scope를 바꾸지 않습니다. `scope=all` 위젯은 어느 탭에서도 보이고 내용은 전체 범위로 유지됩니다.
- 프로젝트 검색은 이름·기술 스택, 작업·일지 검색은 제목·프로젝트 이름, 링크 검색은 제목·설명을 대상으로 합니다. 기존 개별 목록의 `query`를 사용합니다. 홈 위젯 검색은 로컬 제목·분야 검색이므로 `/search` 호출 대상이 아닙니다.
- 일지 목록에 `sort`를 추가하고 기본은 `createdAt:desc,id:desc`로 정합니다. '최근' 위젯은 `limit=3`으로 요청합니다. 링크는 `position:asc,id:asc`, 프로젝트는 `updatedAt:desc,id:asc`, 배포는 `startedAt:desc,id:desc`로 안정적인 순서를 사용합니다. 지원하는 정렬 필드만 허용합니다.
- 마일스톤 상태는 `planned | in_progress | completed | canceled`입니다. 다가오는 위젯은 `status=planned,in_progress&sort=dueDate:asc,id:asc&limit=2`로 요청합니다. 이 위젯은 기한이 지난 미완료 목표도 포함해 지연 표시를 하고, dueDate=null인 목표는 맨 뒤로 정렬합니다.
- cursor는 필터·정렬 조합에 종속됩니다. 조건을 바꾸면 기존 cursor를 폐기합니다. limit 기본값은 20, 허용 범위는 1~100으로 정하고 최종 페이지는 nextCursor=null을 반환합니다. 프로젝트 목록의 total과 보드 집계는 현재 페이지 크기가 아닌 전체 일치 개수입니다.

### 6.5 운영 상태 집계와 등록 계약

- `/services` 응답은 공통 items/nextCursor 외에 `summary: { total, healthy, degraded, down, unknown, disabled }`와 `asOf`를 포함합니다. summary는 필터에 맞는 **전체 서비스** 기준으로 계산하여 페이지 첫 일부만 정상일 때 '모든 시스템 정상'을 표시하지 않도록 합니다.
- enabled 서비스의 상태는 `healthy | degraded | down | unknown`입니다. 비활성 서비스는 `status=unknown`으로 반환하되 summary에서는 disabled에만 집계합니다. 정상 안내는 활성 서비스가 1개 이상이고 전부 healthy일 때만 표시합니다. 활성 서비스가 없으면 '모니터링 중인 서비스 없음', 미확인 결과가 있으면 이를 드러냅니다.
- checkedAt이 없거나 마지막 검사 이후 staleAfterSeconds를 넘긴 서비스는 서버가 unknown으로 판정합니다. 응답을 받은 뒤에도 오래 갱신되지 않으면 프론트가 오래된 상태임을 표시해야 합니다. 네트워크 실패와 0건 응답을 구분합니다.
- 첫 연결은 클라이언트의 60초 간격 조회로 시작하고 화면이 숨겨졌을 때 중지합니다. `checkIntervalSeconds`는 서버 검사 주기로 브라우저 조회 주기와 별개입니다. SSE/WebSocket이나 수동 재검사 API는 현재 UI에 필요하지 않습니다.
- 등록 요청의 healthCheckUrl은 서버가 접근할 주소이므로 배포 환경에서 허용한 호스트·포트와 프로토콜을 검증합니다. 내부망 서비스는 명시적으로 허용한 대상만 검사합니다. 인증 정보가 필요하면 별도 서버 비밀 저장소를 참조하고 서비스 조회 응답에는 비밀값을 포함하지 않습니다.
- OAuth connect는 authorizationUrl을 반환하고 callback에서 state 검증, 코드 교환, 연결 저장을 수행합니다. callback은 일반 JSON 조회와 달리 완료/실패 화면으로 리다이렉트합니다. 이 단계는 실제 GitHub 연결을 구현할 때 필요하며 지금의 GitHub 외부 링크 클릭에는 필요하지 않습니다.

### 6.6 배치 최초 저장·실패·복원 규칙

- 저장 전 최초 GET `/dashboards/home`은 서버 기록이 없으면 프론트가 적용할 기본 배치와 revision=0을 반환합니다. 읽기 요청은 기록을 생성하지 않습니다. 첫 PUT은 revision=0으로 생성하고 이후 PUT은 저장된 revision과 비교하여 증가시킵니다. 동시 최초 생성 중 하나만 성공하도록 원자적으로 처리합니다.
- widgets=[]는 사용자가 비운 유효한 배치입니다. 기록 없음이나 잘못된 데이터와 구분하여 기본 위젯을 강제로 복구하지 않습니다.
- id는 비어 있지 않은 문자열로 받고 같은 배치 안에서 유일해야 합니다. 현재 기본 id는 overview 같은 문자열이고 추가 위젯은 UUID이므로 UUID만 허용하면 안 됩니다. title은 앞뒤 공백 제거 후 1~48 UTF-16 코드 단위로 제한하여 현재 input maxLength=48과 맞춥니다. 빈 제목에는 프론트가 등록부 기본 제목을 채웁니다.
- schemaVersion=1에서는 현재 6종 type과 세 scope/size만 허용합니다. 지원하지 않는 버전은 400 `UNSUPPORTED_SCHEMA_VERSION`으로 응답하며 기존 배치를 덮어쓰지 않습니다. 향후 특정 프로젝트 선택을 저장할 때는 선택적 projectId와 마이그레이션을 함께 추가합니다.
- 서버 저장 성공 응답을 받은 뒤 편집을 종료하고 성공 메시지를 표시합니다. 저장 실패 시 초안을 보존합니다. 현재 localStorage 어댑터처럼 실패 여부와 무관하게 편집을 닫는 흐름은 API 연동 시 변경해야 합니다.
- 409가 오면 저장된 배치를 다시 조회하고 사용자가 초안과 비교할 수 있게 합니다. 자동으로 최신 revision을 붙여 재전송하지 않습니다. 요청 시간 초과는 실패 확정이 아니므로 재조회해 저장 여부를 확인합니다.
- 기본 배치 복원은 지금처럼 프론트 defaultLayout을 초안에 적용하고 최종 PUT으로 저장합니다. 별도 reset API는 필요하지 않습니다. 서버에서 템플릿을 관리하게 될 때만 GET `/dashboard-templates/default`를 선택적으로 추가합니다.
- 위젯 카탈로그도 현재 registry가 기준이므로 조회 API가 필요 없습니다. 향후 서버별 활성 기능을 달리할 때만 GET `/widget-types`를 도입할 수 있으며, 서버에 type이 추가되어도 렌더러는 프론트에 별도로 구현해야 합니다.

### 6.7 작업 변경·동기화와 로컬 데이터 전환

작업 상태 변경은 기존 PATCH로 충분합니다. 예시 요청은 `{"status":"done","revision":3}`이고 응답은 revision이 증가한 작업 전체입니다. title, priority, tags 편집을 추가할 때도 같은 PATCH를 확장합니다. 작업 상세 편집 화면이 생기면 GET `/tasks/{id}`를 추가할 수 있으나 현재 상태 선택에는 필요하지 않습니다.

- 작업 저장은 홈 배치 초안과 독립적입니다. 배치 편집 중 작업 상태를 바꾼 뒤 배치를 취소해도 작업 변경은 취소하지 않습니다.
- 낙관적 갱신 시 실패하면 해당 작업만 이전 상태로 복구하고 안내합니다. 저장 중인 동일 작업의 상태 입력은 잠가 응답 순서 역전을 막습니다. 성공 후 해당 작업 목록, `/tasks/stats`, `/overview` 캐시를 갱신합니다.
- 서버 최초 연결 시 기존 `devspace.layout.v1`은 사용자가 가져오기를 선택하면 검증 후 기존 PUT으로 저장할 수 있습니다. 서버 배치가 이미 있으면 자동 덮어쓰지 않습니다. 별도 가져오기 API는 필요 없습니다.
- `devspace.tasks.v1`의 작업 id 1~7은 예시 데이터이므로 실제 서버 작업에 자동 매칭하거나 일괄 업로드하지 않습니다. 배치의 기본 id와 예시 프로젝트 참조도 실제 리소스 id와 구분합니다.
- 계정 연결 시 로컬 캐시를 사용자 id로 구분하고 로그아웃 시 이전 사용자의 메모리·조회 캐시를 비웁니다. 기본 배치 외의 서버 오류를 예시 데이터로 대체해 정상 저장된 것처럼 보이지 않게 합니다.

### 6.8 별도 API가 필요 없는 현재 동작

위젯 드래그·화살표 이동, 너비 변경, 교체, 제거는 배치 PUT에 포함합니다. 편집 취소, 모바일 메뉴 열기·닫기, 모달 닫기, 화면 이동, 반응형 배치는 프론트 상태로 처리합니다. 외부 문서 링크는 저장된 URL로 직접 이동합니다. 현재 프로필 버튼은 고정 안내 모달이므로 프로필 수정 API를 요구하지 않습니다.

후속 기능인 링크 순서 편집은 기존 PATCH `/links/{id}`의 position을 사용하고 동일 position은 id로 정렬할 수 있습니다. 여러 행의 순서를 원자적으로 옮기는 요구가 생길 때만 일괄 정렬 API를 추가합니다. 배치·자료 백업이나 실행 중인 에이전트 중지처럼 현재 구현하지 않은 기능도 이번 필수 API 범위에 포함하지 않습니다.
