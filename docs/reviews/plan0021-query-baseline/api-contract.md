# API 계약·요청 원인

2026-09-16 격리 백엔드의 `/v3/api-docs`와 실제 HTTP 응답을 확인했다.
[OpenAPI 원본](openapi-contract.json), [실제 응답 검증 요약](checks.json).
업무 API는 `/api/v2`, 인증·카테고리는 `/api/v1`이다.

## 조회 계약

| 대상                          | 조회 조건·기본값                                                                                   | 정렬·주의점                                                           |
| ----------------------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| 프로젝트 목록                 | category=all, status=active, query="", limit=20(최대 100), cursor                                  | createdAt DESC, id DESC; total은 전체 조건 일치 수                    |
| 프로젝트 상세                 | `/projects/{id}`                                                                                   | 목록에서 얻은 항목과 상세 검증 상태는 별개                            |
| 카테고리 목록·category-counts | 파라미터 없음                                                                                      | 전체 카테고리와 미분류 집계; active/archived 구분                     |
| Overview                      | category=all, 선택적 projectId                                                                     | 단일 읽기 스냅샷 집계; 목록 페이지와 무관; query/limit/status 등 불허 |
| 할 일 목록                    | category=all, projectStatus=all, query="", deleted=false, limit=20, 선택적 projectId/status/cursor | createdAt DESC, id DESC; 휴지통은 deleted=true                        |
| 할 일 통계                    | category/projectId/projectStatus/query                                                             | 미삭제 상태별 집계; status/deleted 불허                               |
| 일지                          | category=all, projectStatus=all, query="", sort=newest, limit=20, 선택적 projectId/from/to/cursor  | newest는 entryDate/createdAt/id DESC; oldest는 역순                   |
| 마일스톤                      | category=all, projectStatus=all, status=open, limit=20, 선택적 projectId/cursor                    | completed/dueDate/id 순, 기한 없음은 마지막                           |
| 링크                          | category=all, projectStatus=all, query="", 선택적 projectId                                        | position/id 순 전체 컬렉션; cursor/limit 없음                         |
| 홈 설정                       | 파라미터 없음                                                                                      | 미저장 설정은 revision=0 기본 위젯; 조회로 저장하지 않음              |

커서는 작업실·조회 조건·limit에 결합된다. 다른 조건에 재사용하지 않는다. 페이지 사이에 동일 DB 스냅샷을 보장하지 않으므로 변경 후 이전 커서를 무조건 이어붙이면 안 된다.

## 갱신·오류 계약

- `X-Workspace-Data-Revision`은 작업실 관측 번호인 **십진 문자열**이다. 리소스 수정용 본문 `revision`과 다르며 JavaScript Number로 변환하지 않는다.
- 읽기·신규 변경 응답에 관측 번호가 있지만, 생성 replay는 원본 스냅샷을 반환하며 해당 헤더가 없다. 실제 링크 생성 재전송으로 201·동일 본문·헤더 생략을 확인했다.
- 생성은 같은 endpoint·Idempotency-Key·본문으로 24시간 내 재전송한다. 다른 본문에 키를 재사용하면 409; 이 오류는 Swagger 확인이며 이번 실행의 실응답 검증 대상은 아니다.
- 실제 프로젝트 수정 200, 오래된 revision 재수정 409 `REVISION_CONFLICT`, 잘못된 커서 400 `INVALID_CURSOR`, 비인증 401, CSRF 누락 403을 확인했다. 의도적 오류 검증은 성능 표본에서 제외했다.
- 프로젝트 목록 응답의 `Cache-Control: no-store`를 확인했다. 브라우저 HTTP 캐시와 앱의 세션별 메모리 Query 캐시는 별개다.
- 실제 커서 페이지는 20+5개, Overview는 프로젝트 25개·할 일 30개였다. 선택 데이터 전용 API는 없으며 기존 프로젝트 목록/상세를 사용한다.

## 요청 발생 경로

| 분류           | 코드 근거                                                                                                                                        | 해석                                                                                                             |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| 최초 조회      | [Query/useQuery](../../../src/shared/http/query.ts)                                                                                              | idle 상태를 조회하고 진행 중 동일 Query만 합친다. 완료 후 직접 load()는 다시 요청한다.                           |
| 화면 이탈      | [ProjectReads](../../../src/features/projects/ProjectReads.tsx)                                                                                  | 목록 unmount는 invalidate(true)로 누적 페이지 삭제, 상세 unmount는 invalidate()로 재검증 예약                    |
| 직접 조회      | [CategorySelection](../../../src/features/projects/CategorySelection.tsx), [CategoryDisplay](../../../src/features/projects/CategoryDisplay.tsx) | 마운트마다 refresh(); 편집창·상세에서 카테고리 재조회                                                            |
| 선택 데이터    | [taskProjectOptions](../../../src/app/auth/taskProjectOptions.ts), [journalProjectOptions](../../../src/app/auth/journalProjectOptions.ts)       | adapter 첫 조회가 원본 Query.load() 호출. active/all은 다른 조건이며 각 adapter 재열기는 자체 캐시 사용          |
| 저장 후 갱신   | [ProjectStore](../../../src/features/projects/apiStore.ts), [PrivateWorkspace](../../../src/app/auth/PrivateWorkspace.tsx)                       | 저장 시 프로젝트와 연관 저장소를 무효화. 성공 본문 seed도 상세 재검증을 유발                                     |
| 변경 번호 감지 | [Freshness](../../../src/shared/http/freshness.ts), [freshTransport](../../../src/shared/http/freshTransport.ts)                                 | 높은 관측 번호를 받으면 이전 관측 Query 갱신, 늦은 응답 차단. 새 응답 없이 외부 변경을 알아내는 push 기능은 아님 |
| 인증·실패 복구 | [HTTP client](../../../src/shared/http/client.ts), [프로젝트 편집](../../../src/features/projects/ApiProjectEditor.tsx)                          | 세션 세대별 분리, 명시적 오류 복구·최신 상태 확인. 이번 정상 표본에는 실패 재시도 없음                           |

홈의 전체 할 일 목록과 보드의 상태별 목록, 홈 일지 limit=3과 일지 화면 limit=20은 동일 요청이 아니다. 저장 후 재확인도 정상적인 정합성 경로이므로 요청 수만 보고 제거하지 않는다.
