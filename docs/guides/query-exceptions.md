# 조회 정책 예외 목록

PLAN-0022가 프로젝트 목록·상세를 `QueryManager`로 전환한 뒤에도 아래 조회는 현재 계획의 범위 밖이거나 adapter 수명 전환이 별도 작업으로 남아 있어 직접 `Query`를 사용한다. 새 예외는 이 문서와 [정적 검사](../../tools/check-queries.mjs)에 함께 등록해야 한다.

| 파일                                     | 이유                                                                                                        | 후속 범위               |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------- |
| `src/app/auth/*ProjectOptions.ts`        | ProjectStore 조회를 감싸는 기존 feature adapter. adapter 소비자 수명과 강제 조회 의미를 함께 전환해야 한다. | TODO 03 및 각 기능 전환 |
| `src/features/dashboard/apiStore.ts`     | Dashboard v3 배치와 Widget v1 설정·data 조회                                                                | 별도 Dashboard 계획     |
| `src/features/journal/apiStore.ts`       | Journal 목록·상세·mutation 조회                                                                             | 별도 Journal 계획       |
| `src/features/links/apiStore.ts`         | Link 목록·상세 조회                                                                                         | 별도 Link 계획          |
| `src/features/milestones/apiStore.ts`    | Milestone 목록·상세 조회                                                                                    | 별도 Milestone 계획     |
| `src/features/overview/apiStore.ts`      | Overview 집계 조회                                                                                          | 별도 집계 계획          |
| `src/features/projects/apiStore.ts`      | `category-counts`만 직접 조회. 프로젝트 목록·상세는 QueryManager 적용                                       | Category/집계 후속 계획 |
| `src/features/projects/categoryStore.ts` | Category 목록·mutation 조회                                                                                 | TODO 03                 |
| `src/features/tasks/apiStore.ts`         | Task 목록·상세·통계 조회                                                                                    | TODO 04                 |

`src/shared/http`의 Query 구현·QueryManager와 테스트 코드는 정책 기반 자체를 검증하므로 예외 목록에 포함하지 않는다. 직접 네트워크 호출은 `PrivateTransport` 밖에 추가하지 않는다.
