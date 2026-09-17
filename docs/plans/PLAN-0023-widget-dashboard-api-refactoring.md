# Plan: Widget v1·Dashboard v3 프론트엔드 전환

Status: `completed`
Date: 2026-09-17
Baseline: 현재 프론트 소스와 로컬 백엔드의 생성 OpenAPI 비교

## Goal

폐기된 Dashboard v2 의존을 제거하고, 독립 Widget 설정·데이터 API와 Dashboard v3 배치 API에 인증된 Home을 연결한다. 배치와 설정의 독립 수명·revision, 명시적 초기화, 부분 성공·재시도, 데이터 상태를 정확하게 표현하면서 기존 디자인과 업무 편집 기능을 가능한 범위에서 보존한다.

사용자가 2026-09-17 실행을 승인해 구현했다. [실행 목록](README.md)의 PLAN-0022 다음 순서를 유지하며, 계약·UX 제안은 아래 구현과 검증 결과를 기준으로 확정한다. 기존 v2 모킹 시나리오는 `tests/dashboard/legacy-v2/`에 보존하고 활성 회귀는 Widget v1/Dashboard v3 계약을 검증한다.

## Scope

- In scope:
  - Dashboard v3 모델·배치 저장·초기화, Widget v1 카탈로그·목록·설정 CRUD·데이터 조회.
  - 인증된 Home의 위젯 렌더러·편집기·미배치 위젯 재사용, 서버 상태·커서·충돌·생성 replay 처리.
  - 세션별 조회 및 업무 변경 후 무효화, 기존 transport의 인증·CSRF·workspace revision 보호 연결.
  - 홈 임시 필터·overview·deploy·기본 배치 기능의 계약에 맞는 변경과 관련 회귀 검증.
  - 기존 테스트/실제 백엔드 harness 갱신, 현재 아키텍처·개발 문서 갱신.
- Out of scope:
  - 백엔드 구현·DB 마이그레이션·API 확장, 운영 배포, 실제 배포 제공자 연동.
  - Project/Task/Journal/Milestone/Link 독립 페이지 재설계, 전역 테마 변경, 새로운 위젯 유형.
  - PLAN-0022의 Project 캐시 최적화 구현, 일괄 TTL 적용, 새 캐시 라이브러리·영구 브라우저 저장.
  - legacy Dashboard/localStorage 변경, 옛 위젯 ID·미저장 초안의 자동 서버 마이그레이션.

## Changes

### 1. 확인한 계약과 재확인 항목

2026-09-17 [실행 중 OpenAPI](http://127.0.0.1:8080/v3/api-docs)와 [Swagger UI](http://127.0.0.1:8080/swagger-ui/index.html)의 생성 명세를 기준으로 한다. 비교 기준은 [현재 Dashboard 모델](../../src/features/dashboard/apiModel.ts), [Store](../../src/features/dashboard/apiStore.ts), [Home 조합](../../src/pages/ServerDashboardHome.tsx), [이전 OpenAPI](../reviews/plan0021-query-baseline/openapi-contract.json)다. 이번 확인은 명세 읽기이며 인증된 업무 응답 검증과 구분한다.

| 항목        | 기존 프론트                                     | 전환 계약                                                                                    |
| ----------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Dashboard   | GET/PUT `/api/v2/dashboards/home`, schema 2     | 기존 API는 410 `API_VERSION_RETIRED`; GET/PUT `/api/v3/dashboards/home`, schema 3            |
| 응답        | `revision`, 설정·크기 포함 `widgets[]`          | `initialized`, `layoutRevision`, `placements[]`, 설정 일괄 응답 `widgets[]`                  |
| 배치        | Widget 배열 순서·size                           | 순서 있는 `{id, widgetId, size}`; 저장은 `{widgetId, size}`만 전송                           |
| 설정        | Widget에 `selection`, `limit`, `selectionState` | `config.selection`, `config.limit`, 응답 전용 `referenceState`                               |
| Widget 수명 | Dashboard 안의 클라이언트 ID                    | 서버 UUID, 개별 `revision`, `configVersion`, `createdAt`, `updatedAt`; type 불변             |
| 초기 상태   | revision 0의 가상 기본 6개                      | `initialized=false`, layoutRevision 0, 빈 배열; GET은 생성하지 않음                          |
| 초기화      | 클라이언트 기본값 복사                          | POST `/api/v3/dashboards/home/initializations`, schema 3/layoutRevision 0 및 Idempotency-Key |
| 배치 저장   | 설정까지 원자적 전체 교체                       | 배치만 교체; 같은 내용도 layoutRevision 증가; Widget revision 불변                           |
| 설정 저장   | 배치 저장에 포함                                | PUT `/api/v1/widgets/{id}`, revision/title/configVersion/config; layoutRevision 불변         |
| 삭제        | 배열에서 제거                                   | 배치 제거는 Widget 보존; DELETE `?revision=`은 배치 중이면 409 `WIDGET_IN_USE`               |
| 목록·생성   | 별도 API 없음                                   | GET/POST `/api/v1/widgets`; 목록은 limit/unplaced/cursor, 생성은 미배치·Idempotency-Key 필수 |
| 카탈로그    | 정적 widgetCatalog                              | GET `/api/v1/widget-types`: configSchema/configVersion/supportedSizes/dataKind/availability  |
| 내용        | 개별 업무 조회 조합                             | GET `/api/v1/widgets/{id}/data`; 저장된 설정만 사용, 필터 override 없음                      |

- 데이터 envelope는 `widgetId/type/configRevision/configVersion/payloadVersion`, `availability/freshness`, 관측 시각 3개, `data/page/problem`을 가진다. 종류별 `data.kind`와 식별자·버전 일치를 검증한다.
- 정상 빈 결과는 타입별 빈 값·0 집계다. unavailable은 data/page가 null이며 missing Category는 `REFERENCE_MISSING`, deploy는 `NOT_CONFIGURED`다. 예상하지 못한 실패는 5xx이며 빈 결과로 위장하지 않는다.
- board/journal/milestone만 cursor를 받으며 설정 변경으로 cursor가 무효화된다. 상세 정렬·기본 limit·board 전체/열별 limit 의미·total 의미는 실행 시작 시 실제 계약과 백엔드 소스/테스트로 확정한다. 기존 프론트 기본값 20/3/2를 새 서버 기본값으로 단정하지 않는다.
- `X-Workspace-Data-Revision`은 10진 문자열로 유지하며 리소스 revision과 혼합하지 않는다. 카탈로그와 생성 replay에 이 헤더가 없는 것은 정상이다. Widget 생성 replay는 24시간 동안 원래 201/body/Location을 보존하므로 현재 GET을 거친 뒤 채택한다. 초기화 replay도 원래 결과와 현재 배치를 구분한다.
- 생성 OpenAPI의 `WidgetConfig_*` 내부 `selection.kind`가 object로 출력되는 반면 공통 `WidgetSelection`은 문자열 enum이다. 자동 타입 생성으로 오류를 전파하지 않고 실제 요청·공통 스키마·백엔드 구현을 대조한다. 지원 크기/중복 배치/미지원 버전/초기화 replay 기간 등 명세만으로 불충분한 항목도 확인 기록을 남긴다. 백엔드 수정이 필요하면 별도 이슈로 보고하며 이 계획에서 변경하지 않는다.

### 2. 화면 및 저장 정책 제안

| 상황                         | 제안 동작                                                                                                                                 |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 최초 진입                    | 미초기화 안내와 명시적인 “기본 위젯으로 시작”, “빈 배치로 시작” 제공. 조회만으로 생성하지 않음                                            |
| 저장된 빈 배치               | 정상 초기화 상태로 표시하고 초기화 API를 다시 호출하지 않음                                                                               |
| 기본 배치 복원               | 기존 저장된 배치를 6개로 자동 교체하는 기능은 제거. 초기화 동작과 구분하고 미배치 재사용/추가로 구성                                      |
| 배치 편집                    | 순서·크기·배치 제거만 draft로 유지. “배치 저장/취소”는 이 변경만 대상으로 함                                                              |
| 설정 편집                    | 제목·selection·limit은 별도 “위젯 설정 저장”으로 즉시 서버 반영. 배치 취소가 이를 되돌린다고 안내하지 않음                                |
| 종류 변경                    | 기존 위젯의 type 편집 금지. 새 종류 생성 후 배치 교체, 이전 위젯은 미배치로 유지                                                          |
| 추가                         | 신규 생성 또는 미배치 목록에서 재사용. 생성 후 배치 취소/실패 시 미배치로 보존하고 안내                                                   |
| 제거/삭제                    | “홈에서 제거”와 “위젯 영구 삭제” 구분. 영구 삭제는 미배치 관리에서 명시적으로 확인 후 수행                                                |
| 홈 Project/Category override | 저장 설정을 덮어쓰는 홈 전역 필터 제거. 기존 해당 URL은 설명과 필터 해제 동작 제공; 조용히 저장하거나 전체 결과로 오인시키지 않음         |
| 홈 검색                      | 위젯 제목의 로컬 검색 유지; 데이터 필터로 전송하지 않음                                                                                   |
| overview                     | 새 응답의 Category별 active/archived 및 작업 통계 중심으로 표시. 기존 프로젝트 상세 카드 조회는 홈에서 제거하고 프로젝트 페이지 이동 제공 |
| deploy                       | 인증된 Home의 정상 상태 예시를 제거하고 `NOT_CONFIGURED`에 맞는 미연동 안내 표시                                                          |

위 제안은 API를 그대로 사용할 수 있게 하는 명시적 제품 변경이다. 승인된 변경 외에는 기존 WidgetFrame·그리드·크기·드래그/키보드 정렬·테마·반응형 구조를 보존한다. 위젯 데이터가 읽기 API로 바뀌어도 현재 제공하는 Task 편집 및 Link 동작은 기존 업무 mutation을 재사용해 유지한다. Journal/Milestone의 기존 읽기 전용 여부도 보존한다. 업무 mutation 성공 후 위젯 데이터를 다시 읽으며 위젯 데이터 API에 업무 쓰기를 추가하지 않는다.

### 3. 모델·조합·조회 경계

- `features/dashboard`의 모델/Store에서 Layout, Placement, Widget 설정, 카탈로그, 타입별 payload, 버전 구분 draft/creation intent를 분리한다. 필요하면 같은 기능 내부에 작은 모듈로 나누고 app/pages에 업무 로직을 올리지 않는다.
- `ServerDashboardHome`은 조합을 담당한다. 설정과 placement는 widgetId로 연결하고 표시 순서는 placements를 따른다. 없는 참조·중복/불일치 응답은 계약 오류로 표시하며 임의 기본값으로 수리하지 않는다. 실제 중복 배치 허용 여부에 따라 키/구독 공유를 확정한다.
- 카탈로그가 지원하는 버전·크기·설정을 검증한다. 프론트 표시 이름/아이콘은 기존 정적 레지스트리를 재사용할 수 있지만 서버 제약을 무시하지 않는다. 알 수 없는 type/configVersion/payloadVersion은 안전한 미지원 표시와 편집 제한으로 처리하고 저장 시 누락시키지 않는다. 범용 JSON Schema 폼 엔진은 도입하지 않는다.
- Dashboard 응답의 일괄 설정으로 초기 N건 설정 GET을 피한다. 데이터 GET은 배치된 위젯마다 공유하며 전체 관리 목록은 편집/재사용 시에만 조회한다. 실제 요청 수와 중복 여부를 증거로 남긴다.
- [조회 정책](../guides/query-policy.md)을 따른다. PLAN-0022가 구현됐다면 실제 공통 생성 API·필수 정책·정적 검사에 연결한다. 먼저 실행하도록 승인됐다면 현재 Query/transport를 재사용하고 미구현 API나 `check:queries`를 가정하지 않는다. 별도 전역 캐시를 만들지 않는다.
- 조회 키는 세션/작업실 경계 안에서 layout(home), catalog, widget ID, 목록(limit/unplaced), 데이터(widgetId/configRevision/configVersion/payloadVersion 및 페이지 cursor)를 구분한다. 첫 데이터 응답 전 payloadVersion 미확정 상태는 구독 내부에서 검증 후 확정하며 버전이 다른 페이지를 병합하지 않는다.
- freshness 필드는 서버 데이터 상태이며 클라이언트 TTL의 근거가 아니다. 이번 전환은 기존 강제 재검증 보호를 유지하고 새로운 시간 기반 재사용 최적화를 추가하지 않는다. 갱신·충돌 복구 시 이전 페이지를 버리고 첫 페이지부터 재구성한다.
- 설정 저장과 늦은 데이터 응답의 configRevision 불일치를 차단한다. 한 위젯 실패가 전체 Home을 막지 않으며 동일 위젯의 소비자 중 하나가 이탈해도 다른 소비자의 요청을 취소하지 않는다.

### 4. 변경 영향·실패 복구

| 변경                             | 재확인/무효화 대상                                                           |
| -------------------------------- | ---------------------------------------------------------------------------- |
| Layout 저장/초기화               | Home layout, 배치 여부를 포함한 Widget 목록; 초기화 결과의 설정·데이터       |
| Widget 생성                      | Widget 목록; replay이면 현재 개별 설정 확인, 이후 별도 배치 저장             |
| Widget 설정 수정                 | 개별 설정, Home의 일괄 설정, Widget 목록, 해당 데이터 전체 페이지            |
| Widget 삭제                      | 개별 설정·데이터·목록·Home 재확인; WIDGET_IN_USE이면 배치 검토               |
| Task 변경                        | 기존 업무 조회/Overview와 관련 board·overview Widget 데이터                  |
| Journal/Milestone/Link 변경      | 기존 업무 조회와 해당 종류 Widget 데이터; Link order/collectionRevision 포함 |
| Project 생성/수정/보관/분류 변경 | 기존 조회와 영향받는 Widget 설정 참조·overview·관련 데이터                   |
| Category 변경/삭제               | 카테고리 표시·선택 데이터, Home 설정/referenceState, 관련 Widget 데이터      |

- 업무상 의존성은 기능이 선언하고 `PrivateWorkspace` 조합에서 연결한다. 범위 판정이 불확실하면 관련 종류를 넓게 무효화하며 URL 문자열만으로 관계를 추론하지 않는다.
- revision 충돌은 layout과 Widget 별도로 기준/초안/최신 서버 값을 보존하고 명시적 재검토 후 제출한다. 네트워크 실패 뒤 무조건 재저장하지 않는다. GET 확인으로 결과를 판단하되 현재 값 일치만으로 특정 요청의 성공 이력을 단정하지 않는다.
- 생성/초기화 intent는 endpoint·불변 body·Idempotency-Key·시작 시각을 세션 메모리에 보존한다. 동일 intent 재시도만 같은 키를 사용하고 replay 응답을 최신 조회로 승격하지 않는다. 만료/삭제 후 replay/다른 탭 초기화 충돌도 중복 생성 없이 복구한다.
- 여러 설정 PUT과 배치 PUT을 하나의 원자적 작업처럼 표시하지 않는다. 단계별 성공과 실패, 생성했으나 배치되지 않은 리소스를 보여준다. 자동 보상 삭제·자동 롤백은 하지 않는다.
- 401/403/CSRF/404/409/410/INVALID_CURSOR/5xx/시간 초과를 기존 인증·오류 경로와 연결한다. v2 410은 v2 fallback을 유발하지 않는다. 세션 종료·계정 변경 시 Store/타이머/요청/초안을 정리하고 늦은 응답을 차단한다.
- 옛 schema-2 draft는 자동 전송하지 않고 검토/명시적 폐기 경로를 제공한다. 기존 서버 데이터의 변환은 백엔드 책임이며 클라이언트가 옛 임의 ID로 Widget을 재생성하지 않는다. legacy localStorage는 읽거나 삭제하지 않는다.

### 5. 실행 단계

1. **계약·기준 확정:** 최신 OpenAPI와 백엔드 소스/테스트 재대조, 승인된 UX 범위·선행 계획 상태 기록. 인증된 기존 화면과 새 응답 fixture, API 호출 기준을 수집한다. 현 백엔드의 v2 폐기로 기존 화면을 열 수 없으면 기존 테스트 fixture로 시각 기준을 확보하고 실제 연동 기준과 구분한다.
2. **모델·Store:** v3 Layout·Widget v1·카탈로그·envelope 파서, CRUD/초기화/페이지 조회, metadata/replay/revision 보호 및 단위 테스트를 구현한다.
3. **표시 전환:** Home 일괄 설정과 위젯별 데이터 조회 연결, 종류별 렌더링과 상태 처리. overview/deploy/홈 필터의 승인된 변경 및 기존 업무 편집 기능을 반영한다.
4. **편집 전환:** 배치와 설정 저장 분리, 미배치 재사용/삭제, 초기화, 생성 후 배치, 취소/부분 성공/충돌/구형 draft 복구를 구현한다.
5. **정합성·회귀:** 업무 mutation 무효화, 다른 탭 변경·커서·세션 교체·늦은 응답·freshness를 검증한다. 기존 테스트를 실제 새 계약에 맞게 갱신하고 legacy 전용 테스트는 격리한다.
6. **실제 통합·완료:** 기존 real harness로 Vite/Nginx를 검증하고 시각·접근성·문서·최종 증거를 기록한 후 완료 기준에 따라 상태를 갱신한다.

## Validation

### Static

- 구현 시 `npm run check:boundaries`, `npm run check:docs`, `npm run build`, `npm test`, `npm run format:check`, `git diff --check`를 실행한다. 기존 전체 포맷 실패는 새 변경과 분리해 기록하고 변경 파일은 통과시킨다.
- PLAN-0022 적용 후에는 `npm run check:queries` 및 빌드 연동 검증도 실행한다. 존재하지 않는 명령을 통과한 것으로 기록하지 않는다.
- 단위 테스트: 요청의 응답 전용 필드 제거, UUID/버전/nullable 상태, 카탈로그 제약, 설정·배치 revision 분리, configRevision 불일치, 페이지 병합/INVALID_CURSOR, duplicate 참조, unknown type/version, 생성 intent/replay, 세션 격리.
- 테스트 fixture와 기존 `tests/dashboard/`, `tests/real/dashboard.mjs`의 v2 가정을 새 계약으로 교체한다. 기존 계약 테스트 삭제로 통과시키지 않고 새 동작의 대응 검증을 둔다.
- 계획 실행 완료 시에는 구현·문서·실제 acceptance 결과를 실행 기록과 [검증 증거](../reviews/plan0023-widget-dashboard-api/readme.md)에 함께 남긴다.

### Runtime

| 시나리오            | 합격 기준                                                                                          |
| ------------------- | -------------------------------------------------------------------------------------------------- |
| 미초기화 읽기       | 빈 배열·initialized=false 표시, GET만으로 생성/자동 POST 없음                                      |
| 명시적 초기화       | 6개 Widget/placement와 layoutRevision 1; 중복 클릭·응답 유실·replay·동시 초기화에서 중복 생성 없음 |
| 빈 배치 저장        | 초기 0→1, 새로고침 후 initialized=true·빈 배치 유지, 초기화 재실행 차단                            |
| 순서·크기·배치 제거 | placement ID 유지 계약 확인, layoutRevision만 증가, 제거된 Widget 재사용 가능                      |
| 설정 수정           | Widget revision만 증가, 새 데이터 configRevision 일치, 이전 cursor/늦은 응답 미채택                |
| 생성·부분 성공      | 서버 UUID와 생성 intent 유지, 배치 실패/취소 시 미배치 목록에서 회수 가능                          |
| 삭제                | 배치 중 409 처리, 해제 후 명시적 삭제, 반복 삭제/삭제 후 creation replay 복구                      |
| 데이터 종류         | 5종 payload와 deploy unavailable 검증, 정상 empty와 장애/미지원 상태 구분                          |
| 페이지·필터         | 허용된 3종만 cursor 사용, 설정 변경/INVALID_CURSOR 시 재시작, 홈 override 요청 없음                |
| 업무 편집           | Task/Link 기존 동작 유지, 저장·삭제·정렬 후 관련 Widget와 독립 페이지 최신 값 일치                 |
| 참조 변경           | Category 삭제는 missingCategory/REFERENCE_MISSING, Project 404는 명시적 오류; 자동 all 전환 없음   |
| 충돌·다른 탭        | layout/Widget 독립 충돌·불확실한 저장 결과를 초안 손실/자동 덮어쓰기 없이 복구                     |
| 인증·격리           | CSRF 복구·로그아웃·계정/작업실 세대 전환·지연 응답에서 정보 혼합/누출 없음                         |
| 요청 경로           | 인증된 정상 Home은 Dashboard v2 요청 0건, 초기 N개 설정 중복 GET 없음, 필요한 데이터 요청만 실행   |
| UI                  | desktop/mobile/landscape, 키보드 정렬·포커스, loading/error/empty/pending/unavailable 확인         |

- [검증 지침](../guides/TESTING.md)에 따라 기존 Playwright 설정/fixture를 재사용한다. Dashboard·auth·Category·Task·Journal·Milestone·Link 및 영향을 받은 Project 회귀를 실행한다. 새 기능별 설정/harness를 별도로 만들지 않는다.
- `tests/real/`의 기존 진입점과 API allowlist를 Widget v1/Dashboard v3 및 필요한 업무 경로로 좁게 갱신한다. 구형 runner flag가 최신 백엔드에서 거부될 수 있으므로 실행 시작 시 사용 가능한 옵션을 확인하고 정확한 최종 명령을 기록한다.
- disposable DB/OIDC/backend에서 실제 Vite와 fresh Nginx 모두 검증한다. 사용자의 port-8080 데이터에는 mutation하지 않는다. 정상/오류 응답·헤더·revision·영속 결과를 확인하고 harness 소유 리소스만 정리한다.
- 결과는 `docs/reviews/plan0023-widget-dashboard-api/`에 명세 비교·명령/통과 수·응답 예시·요청 수·화면·제한사항으로 기록한다. 인증 정보·쿠키·토큰은 저장하지 않는다. mock 성공을 실제 연동 또는 시각 검증 성공으로 대체하지 않는다.

## Completion Criteria

- [x] 승인된 UX 변경과 Widget v1/Dashboard v3 전환이 구현되고 정상 Home의 v2 의존이 제거됐다.
- [x] 배치·설정 독립 저장, 초기화, 미배치 재사용/삭제, 부분 성공·충돌·생성 replay가 검증됐다.
- [x] 6개 위젯의 새 데이터/상태 표현 및 기존 업무 편집·업무 변경 무효화가 검증됐다.
- [x] 버전·참조·페이지·세션·workspace revision 보호와 legacy 격리가 유지된다.
- [x] 필수 정적·브라우저·실제 Vite/Nginx·시각 검증을 통과하고 증거 및 제한을 기록했다.
- [x] 현재 아키텍처·개발/조회 지침·관련 TODO·계획과 실행 목록을 실제 구현 상태로 갱신했다.

## Execution Record

- 2026-09-17: 현재 코드와 로컬 생성 OpenAPI를 읽어 계약을 재확인하고 런타임 템플릿으로 계획을 작성했다. `proposed` 등록만 수행했으며 구현·업무 API mutation·런타임 검증은 미착수다. PLAN-0022 및 기존 계획 상태/순서는 유지한다.
- 2026-09-17: 사용자가 PLAN-0023 실행을 승인해 `active`로 전환했다. Dashboard v3/Widget v1 모델·Store·Home 데이터 렌더링과 업무 mutation 후 Widget 데이터 무효화 연결을 구현했다. 정적 검증과 실제 브라우저 검증은 계속 진행한다.
- 2026-09-17: v3 모킹 회귀 7개, 기존 Project/Task/Journal/Milestone/Link/routing 회귀 35개, 단위 208개, build, boundary/docs 검사와 disposable Vite/backend/OIDC acceptance를 통과했다. fresh Nginx acceptance에서 내부 upstream Host redirect를 발견해 `nginx.conf`의 public Host/`$scheme` 전달을 수정한 뒤 Nginx acceptance도 통과했다. 미배치 Widget 재사용·명시적 삭제, API 전용 type 불변 편집 제약, legacy v2 fixture 격리까지 반영했다. 전체 저장소 `format:check`는 변경 전부터 존재한 162개 포맷 baseline으로 실패했으며 이번 구현·신규 fixture의 개별 포맷 검증과 제한을 증거에 기록했다. PLAN-0023을 `completed`로 전환한다.
