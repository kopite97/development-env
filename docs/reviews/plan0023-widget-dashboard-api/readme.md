# PLAN-0023 Widget v1·Dashboard v3 검증 증거

2026-09-17 · [실행 계획](../../plans/PLAN-0023-widget-dashboard-api-refactoring.md)

로컬 백엔드의 생성 OpenAPI와 `../backend`의 Widget/Dashboard 구현을 대조한 뒤, 프론트의 독립 Widget 설정·데이터 조회와 Dashboard v3 배치를 구현했다. 실제 백엔드 검증은 `tests/real/run.mjs --dashboard=all`로 실행했고, 백엔드 소스와 disposable PostgreSQL만 사용했다. 실행 중인 포트 8080 작업실에는 mutation을 보내지 않았다.

## 계약 확인

- Home: `GET/PUT /api/v3/dashboards/home`, `POST /api/v3/dashboards/home/initializations`; response `initialized`, `layoutRevision`, `placements`, placed Widget snapshots.
- Widget: `GET/POST /api/v1/widgets`, `PUT/DELETE /api/v1/widgets/{id}`; response-owned UUID, `revision`, `configVersion`, audit timestamps and `referenceState`.
- Catalog/data: `GET /api/v1/widget-types`, `GET /api/v1/widgets/{id}/data`; typed `kind`, `availability`, `freshness`, payload/page/problem and three observation timestamps.
- The six server catalog types are `overview`, `board`, `deploy`, `links`, `journal`, `milestone`. Deploy is unavailable with `NOT_CONFIGURED`; the other five use typed read-only Home renderers.

프론트 파서는 위 필드 외 응답 키, 비 UUID 배치 참조, 중복 placement, 양의 revision/config/payload version 위반을 거부한다. Widget PUT에는 response-only `referenceState`를 보내지 않으며, Dashboard PUT에는 Widget 설정을 섞지 않는다.

## 실행 결과

| 검증                                                                                                            | 결과                                                                               |
| --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `npm test -- --run src/features/dashboard src/features/tasks/TaskBoard.test.tsx src/shared/http/client.test.ts` | 5 files / 54 tests passed                                                          |
| `npm test -- --run`                                                                                             | 36 files / 208 tests passed                                                        |
| `npm run build`                                                                                                 | passed                                                                             |
| `npm run check:boundaries`                                                                                      | 210 files / 764 local imports passed                                               |
| `npm run check:docs`                                                                                            | 59 documents passed                                                                |
| `npm run test:e2e -- --config=playwright.dashboard.config.ts`                                                   | 7 current Widget v3 tests passed; desktop/mobile/landscape included                |
| `npm run test:e2e`                                                                                              | 35 retained Project/Task/Journal/Milestone/Link/routing/stabilization tests passed |
| `node tests/real/run.mjs --dashboard=all`                                                                       | passed: Vite auth/proxy/session smoke and disposable backend Dashboard acceptance  |
| `node tests/real/run.mjs --dashboard=all --nginx`                                                               | passed: fresh Nginx auth/proxy/session smoke and Dashboard acceptance              |
| `git diff --check`                                                                                              | passed; CRLF normalization warnings are repository line-ending behavior            |

실제 Dashboard acceptance의 무토큰 요약은 ignored runtime output인 `.auth-validation/vite/dashboard-result.json`과 `.auth-validation/nginx/dashboard-result.json`에 남았다. 핵심 값은 `initializedRevision: 1`, independent Widget revision `2`, layout revision `2`, unplaced create/placed delete conflict, persisted empty layout, desktop/mobile/landscape 검증이다. 테스트는 v2 요청 0건, explicit initialization, independent Widget revision, placement reorder/resize, unplaced create/reuse/delete conflict, empty layout persistence를 확인한다. Nginx 검증 중 발견한 내부 upstream Host redirect도 `nginx.conf`에서 public Host와 `$scheme`을 전달하도록 수정한 뒤 통과했다.

## 제한 사항

- `npm run format:check`는 기존 전체 저장소 포맷 baseline 때문에 실패했다. 실패 목록에는 이번 변경과 무관한 기존 문서·소스 파일이 포함됐고, 이번 구현·신규 증거 파일과 Dashboard v3 fixture는 개별 `prettier --check`로 확인했다.
- 기존 v2 URL 필터·가상 기본 배치 요구를 검증하던 50개 모킹 시나리오는 현재 제품 계약과 충돌하므로 `tests/dashboard/legacy-v2/`로 보존·격리했다. 활성 `playwright.dashboard.config.ts`는 새 `v3.spec.ts`만 실행한다. 이는 오래된 기대를 삭제해 통과시키는 것이 아니라, 승인된 v3 초기화·Widget 데이터·독립 저장·반응형 동작으로 대응 검증을 교체한 것이다.
- `tests/dashboard/legacy-v2/visual-parity.mjs`는 schema-2 historical baseline으로 보존했다. 현재 UI의 실제 viewport 캡처는 real Dashboard runner가 생성한다.
