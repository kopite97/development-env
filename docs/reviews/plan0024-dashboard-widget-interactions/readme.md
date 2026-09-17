# PLAN-0024 Dashboard Widget 상호작용 검증 증거

2026-09-17 · [실행 계획](../../plans/PLAN-0024-dashboard-widget-interactions.md)

Task Widget을 작업보드와 같은 상태 변경 경로로 연결했다. 카드별 `TaskSnapshot.revision`을 보존해 `PATCH /api/v2/tasks/{id}`를 호출하며, Widget 설정 PUT이나 Dashboard 배치 PUT은 호출하지 않는다. 프로젝트 개요는 저장된 Widget selection으로 기존 ProjectStore list/detail Query를 선택해 프로젝트 행을 표시하고 상세 경로로 이동한다.

## 검증 결과

| 검증                                                          | 결과                                                                                         |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `npm test -- --run`                                           | 36 files / 208 tests passed                                                                  |
| `npm run build`                                               | passed                                                                                       |
| `npm run check:boundaries`                                    | 211 files / 774 local imports passed                                                         |
| `npm run check:docs`                                          | 61 documents passed                                                                          |
| `npm run test:e2e -- --config=playwright.dashboard.config.ts` | 9 Dashboard v3 tests passed; Task dropdown/drag, Project rows, desktop/mobile/landscape 포함 |
| `npm run test:e2e`                                            | 35 retained application regression tests passed                                              |
| `node tests/real/run.mjs --dashboard=all`                     | passed: disposable Vite/backend acceptance                                                   |
| `node tests/real/run.mjs --dashboard=all --nginx`             | passed: fresh Nginx/backend acceptance                                                       |
| `git diff --check`                                            | passed; CRLF normalization warnings only                                                     |

실제 acceptance 결과는 ignored runtime output인 `.auth-validation/vite/dashboard-result.json`과 `.auth-validation/nginx/dashboard-result.json`에 기록했다. 두 결과 모두 `taskWidgetStatusPersisted: true`, `overviewProjectRows: true`, `layoutRevision: 2`, `persistedEmptyLayout: true`를 포함한다. disposable backend에서만 Project와 Task를 생성한 뒤 SQL로 정리했으며, 실행 중인 port 8080 작업실에는 mutation을 보내지 않았다.

## 동작 확인

- Task 카드를 `할 일 → 진행 중 → 완료`로 드래그할 수 있다.
- 카드 상태 select도 같은 Task PATCH와 revision 계약을 사용한다.
- pending Task는 중복 상태 변경을 막고, 실패·CSRF·충돌 시 최신 상태 확인과 재시도 안내를 유지한다.
- Task 상태 변경은 Dashboard layoutRevision과 Widget revision을 증가시키지 않는다.
- 프로젝트 개요는 기본 3개까지 이름·기술 스택·진행률을 표시하고, 행 클릭으로 `/projects/{id}`로 이동한다.
- `all`, category, uncategorized, 특정 project selection에서 ProjectStore Query를 사용하며, 목록 오류를 빈 목록으로 표시하지 않는다.

## 제한 사항

- `npm run format:check`는 저장소 기존 전체 포맷 baseline 때문에 164개 파일에서 실패한다. 이번 변경 파일과 신규 fixture·증거 파일은 개별 `prettier --check`로 통과를 확인했다.
- 실제 acceptance의 사업 데이터는 disposable workspace fixture이며 사용자 로컬 backend와 분리되어 있다.
