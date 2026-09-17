# PLAN-0022 측정 및 검증 기록

측정 시각: 2026-09-17 07:22 UTC  
실행: warmup 1회 후 10회 측정  
환경: production Vite preview + disposable PostgreSQL 16.4 백엔드/Testcontainers  
계약: Widget v1 + Dashboard v3  
fixture: 사용자 1명, 카테고리 3개, 프로젝트 25개, 작업 30개, 저널 3개, 링크 1개

## 범위와 한계

`node tools/query-baseline.mjs --plan0022`로 현재 구현과 실제 API를 연결한 시나리오를 반복 측정했다. 요청 원자료와 표본은 [`requests.json`](requests.json), [`samples.json`](samples.json), [`summary.json`](summary.json), 실행 조건은 [`metadata.json`](metadata.json)에 저장했다. 테스트 계정과 저장 상태는 파일에 기록하지 않았다.

이번 실행은 PLAN-0022 구현 착수 후 현재 코드에서 수행한 기준 측정이다. 구현 전 별도 표본을 확보하지 못했으므로 PLAN-0021의 역사적 결과를 이번 실행의 엄밀한 before 값으로 간주하지 않는다. 따라서 아래 결과는 캐시 정책의 현재 동작과 회귀 목표를 검증하는 자료이며, 절대적인 성능 개선율을 주장하는 자료가 아니다.

## 주요 결과

| 시나리오                  | API 요청 중앙값 | 표시 시간 중앙값 | 관찰                                                                            |
| ------------------------- | --------------: | ---------------: | ------------------------------------------------------------------------------- |
| Home 최초 진입            |              12 |          427.5ms | Widget v1·Dashboard v3 요청 포함                                                |
| 프로젝트 목록 최초 진입   |               1 |            106ms | 첫 목록 조회                                                                    |
| 프로젝트 목록 추가 페이지 |               1 |          192.5ms | 누적 페이지 조회                                                                |
| 프로젝트 상세 최초 진입   |              10 |          182.5ms | 상세 GET 1건과 상세 화면의 기존 관련 조회                                       |
| 목록 복귀                 |               0 |             92ms | 25행 유지, 스크롤 1771→1771px                                                   |
| 프로젝트 상세 재진입      |               1 |          149.5ms | 유효한 상세 GET은 0건이며 `project-categories` adapter GET 1건은 별도 강제 조회 |
| 프로젝트 저장             |              12 |          420.5ms | PATCH 후 기존 연관 무효화·재검증 유지                                           |

모든 10회 측정 시나리오에서 실패 0건, HTTP 오류 0건이었다. 목록 복귀 표본 10회 모두 25행과 동일 스크롤 위치를 복원했다. 요청 분류는 원자료의 경로를 기준으로 Project 목록/상세, Category adapter, Widget data, Dashboard layout, 인증·기타로 구분할 수 있다.

## 검증 명령

- `npm run check:queries`
- `npm run check:boundaries`
- `npm run check:docs`
- `npm test -- --run --configLoader runner`
- `npm run build`
- `npm run test:e2e -- --config=playwright.projects.config.ts`의 신규 목록↔상세 복귀 시나리오

프로젝트 전체 E2E에는 PLAN-0023에서 교체된 Dashboard v3 계약을 아직 반영하지 않은 기존 overview fixture와 세션 fixture 실패가 3건 남아 있다. 신규 `tests/projects/reads.spec.ts`의 캐시 공유·스크롤 복귀 시나리오는 통과했으며, Dashboard v3 전용 회귀는 [`tests/dashboard/v3.spec.ts`](../../../tests/dashboard/v3.spec.ts)로 별도 검증한다.
