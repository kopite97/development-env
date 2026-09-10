# Devspace

개인 개발 프로젝트를 모아 보는 React + TypeScript 작업실입니다. 차분한 라벤더·회색·세이지 색상과 반응형 카드 레이아웃을 사용합니다.

## 실행

Node.js 22.12 이상에서:

```sh
npm install
npm run dev
```

터미널에 표시되는 로컬 주소로 접속합니다. 프로덕션 산출물은 `npm run build`, 미리보기는 `npm run preview`입니다.

## 구현된 기능

- 프로젝트 요약, 작업 보드, 운영·배포, 빠른 링크, 개발 일지, 마일스톤 위젯.
- 배치 편집에서 추가·제거·교체, 제목·분야·너비 설정, 드래그 또는 키보드로 조작 가능한 이동 버튼.
- 저장·취소·기본 배치 복원, 같은 위젯 여러 개 등록, 모바일 1열 배치.
- 분야별 필터, 현재 화면 검색, 태스크 드래그·상태 선택으로 작업 상태 변경, 자료 링크 열기.
- 개발일지 작성·목록·홈 반영 및 브라우저 저장.
- 낮은 화면에서도 접근 가능한 사이드바 스크롤, 배치·일지 저장 실패 시 초안 유지·재시도, 미저장 변경 이탈 확인.

초기 데이터는 예시이며 프로젝트·태스크·일지·링크를 직접 추가할 수 있습니다. 프로젝트는 편집·보관/해제, 태스크는 편집·삭제/휴지통 복구를 지원합니다. 서비스 상태는 실제 모니터링 결과가 아닙니다. 서버·로그인·여러 기기 동기화는 아직 지원하지 않습니다. 자유 높이 조절은 후속 기능입니다.

작업 실행 순서와 상태는 [계획 목록](docs/plans/README.md), 남은 기능은 [프론트엔드 안정화 계획](docs/plans/PLAN-0003-frontend-stabilization.md), 이전 결과는 [과거 기록](docs/references/history/frontend-stabilization-history.md)에서 확인할 수 있습니다.

## 유지보수 구조

| 경로                                                | 역할                                            |
| --------------------------------------------------- | ----------------------------------------------- |
| `src/shared/ui/`                                    | 공용 컨트롤과 기능 중립적인 PageScaffold        |
| `src/shared/styles/tokens.css`                      | 공통 디자인 토큰                                |
| `src/app/`                                          | 앱 조합, Provider 구성, 라우팅과 공통 화면 상태 |
| `src/app/layouts/` / `src/pages/`                   | 앱 레이아웃과 경로별 기능 조합                  |
| `src/app/styles/global.css`                         | 역할별 CSS import 진입점                        |
| `src/features/*/styles.css`                         | 기능별 스타일                                   |
| `src/features/dashboard/model.ts`                   | 배치 타입·기본값·검증·순서 이동                 |
| `src/features/dashboard/widgetCatalog.ts`           | 위젯 제목·설명·아이콘                           |
| `src/pages/home/widgetRenderers.tsx`                | 위젯과 각 기능의 화면 연결                      |
| `src/features/*/*Provider.tsx`                      | 배치·태스크·일지의 공유 상태와 저장             |
| `src/features/dashboard/WidgetEditor.tsx`           | 추가·설정 공통 편집기                           |
| `src/shared/hooks/usePersistedState.ts`             | 검증 가능한 브라우저 저장 어댑터                |
| `src/features/{projects,tasks,journal}/fixtures.ts` | 기능별 예시 데이터                              |
| `docs/references/api/backend-api-contract.md`       | 미구현 서버 API 설계 계약과 후속 제안           |

위젯 확장 시 `widgetTypes`, `widgetCatalog`, `widgetRenderers`를 함께 갱신합니다. 저장 형식 변경에는 별도 호환·마이그레이션 검토가 필요합니다. 상세 절차는 아래 개발 가이드에 정리했습니다.

파일별 책임, 데이터 흐름과 CSS 소유권은 [프론트엔드 아키텍처](docs/architecture/frontend.md), 실행·검증 절차는 [개발 가이드](docs/guides/development.md)를 참고하세요.

## 검증

```sh
npm run check:boundaries
npm run check:docs
npm run build
npm test
npm run format:check
npm run test:e2e
```

E2E 최초 실행 시 `npx playwright install chromium`이 필요합니다. E2E는 별도 로컬 개발 서버를 자동 실행합니다.
