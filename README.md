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

초기 데이터는 예시이며 프로젝트·태스크·일지를 직접 추가할 수 있습니다. 프로젝트는 편집·보관/해제, 태스크는 편집·삭제/휴지통 복구를 지원합니다. 서비스 상태는 실제 모니터링 결과가 아닙니다. 서버·로그인·여러 기기 동기화는 아직 지원하지 않습니다. 개인 링크 작성과 자유 높이 조절은 후속 기능입니다.

안정화 작업의 우선순위와 완료·대기 상태는 [프론트엔드 안정화 목록](docs/FRONTEND-STABILIZATION.md)에서 확인할 수 있습니다.

## 유지보수 구조

| 경로                                      | 역할                                                      |
| ----------------------------------------- | --------------------------------------------------------- |
| `src/components/ui.tsx`                   | Button, Badge, Modal, Field, Progress, EmptyState 공용 UI |
| `src/styles/tokens.css`                   | 색상·반경·그림자 등 공통 디자인 토큰                      |
| `src/App.tsx` / `src/app/`                | 앱 조합, Provider 구성, 페이지 선택과 공통 화면 상태      |
| `src/layouts/` / `src/pages/`             | 공통 레이아웃과 페이지 5종                                |
| `src/styles/global.css`                   | 역할별 CSS import 진입점                                  |
| `src/features/*/styles.css`               | 기능별 스타일                                             |
| `src/features/dashboard/model.ts`         | 배치 타입·기본값·검증·순서 이동                           |
| `src/features/dashboard/registry.tsx`     | 위젯 메타데이터와 기능 컴포넌트 연결                      |
| `src/features/*/*Provider.tsx`            | 배치·태스크·일지의 공유 상태와 저장                       |
| `src/features/dashboard/WidgetEditor.tsx` | 추가·설정 공통 편집기                                     |
| `src/hooks/usePersistedState.ts`          | 검증 가능한 브라우저 저장 어댑터                          |
| `src/data/demo.ts`                        | 화면과 분리한 예시 데이터                                 |
| `docs/API.md`                             | 서버 API 목록, 계약 예시, 연결 및 확장 순서               |

위젯 확장 시 `widgetTypes`에 타입을 추가하고 `registry`에 제목·설명·아이콘·컴포넌트를 등록합니다. 편집 카탈로그는 자동으로 새 항목을 표시합니다. 저장 스키마 변경 시 저장 키/스키마 버전과 마이그레이션을 함께 변경하세요. 신규 UI는 기존 공용 컴포넌트와 토큰을 먼저 사용하고 반복 패턴은 공용 컴포넌트로 추출합니다.

파일별 책임, 데이터 흐름, CSS 소유권, 신규 페이지·위젯 추가 절차는 [구조와 유지보수 기준](docs/ARCHITECTURE.md)을 참고하세요.

## 검증

```sh
npm run build
npm test
npm run format:check
npm run test:e2e
```

E2E 최초 실행 시 `npx playwright install chromium`이 필요합니다. E2E는 별도 로컬 개발 서버를 자동 실행합니다.
