# Plan: Journal management and project widgets

## Goal

안정화 이력 11번과 12번을 구현하고 브라우저 로컬 저장 및 기존 편집 보호를 유지한다.

## Scope

- In scope: 일지 수정·삭제 확인, 작성일 편집, 프로젝트/날짜 필터, 최신/과거순 정렬. 프로젝트 개요·작업 보드·일지·마일스톤 위젯의 특정 프로젝트와 표시 개수, 프로젝트 상세 이동.
- Out of scope: 서버, 독립 마일스톤 CRUD, 프로젝트 연결 데이터가 없는 운영/빠른 링크 위젯의 프로젝트 필터, 기타 안정화 항목.

## Changes

1. 기존 저장 키를 유지하고 일지 수정/삭제와 지역 날짜 기준 조회를 추가한다.
2. 위젯에 선택적 projectId/limit 설정을 추가하고 구형 배치를 그대로 읽는다. 개수는 목록 전체 기준이며 작업 보드는 전체 카드 기준이다. 기존 기본 개수는 유지한다.
3. 선택 프로젝트가 없으면 빈 상태를 표시한다. 프로젝트 이름/분야 변경과 보관 후에도 특정 프로젝트 선택을 유지하고 상세로 이동한다.
4. 단위·브라우저 회귀 테스트를 추가하고 실행 결과를 기록한다.

## Validation

### Static

- Build, unit tests, boundary checks, changed-file formatting, documentation links.

### Runtime

- 일지 수정/삭제/날짜 필터/정렬, 새로고침 및 홈 반영.
- 저장 실패 후 기존 데이터 및 초안 유지, 재시도, 취소 보호.
- 위젯 프로젝트/개수 저장과 재로드, 상세 이동, 구형 배치 호환, 모바일 표시.
- 기존 브라우저 회귀 전체 실행.

## Completion Criteria

- [x] Planned changes are implemented.
- [x] Required static validation passes.
- [x] Runtime validation passes when applicable.
- [x] Related documentation is updated if required.

## Authorization

2026-09-10 proposed 등록. 사용자의 PLAN 작성 및 즉시 실행 요청에 따라 등록 후 active로 전환한다.

## Results

- 2026-09-10 구현 및 검증 완료. 빌드 통과(캐시 쓰기 권한 오류 후 승인된 명령으로 재실행).
- 단위 테스트 16개, Chromium 브라우저 테스트 30개 통과.
- 소스 경계 검사와 문서 링크 검사 통과. 변경 파일 Prettier 검사 적용.
- 일지 수정/삭제 실패·재시도, 취소 보호, 지역 날짜와 프로젝트 필터, 정렬, 새로고침·홈 반영 검증.
- 위젯 4종의 개수 제한, 프로젝트 선택 저장 실패·재시도, 보관/이름 변경/없는 프로젝트, 모바일 상세 이동 검증.
- 기존 브라우저 회귀에서 실제 태스크 드래그, 낮은 화면, 배치 취소, 라우팅 보호 확인. 120자 일지 제목과 긴 본문의 모바일 흐름 확인.
- 프로젝트/날짜/정렬 필터는 페이지 내 상태이며 페이지를 떠나면 초기화된다. 일지 삭제는 확인 후 영구 삭제한다.
- 기존 계획 파일 이름 변경을 보존하고 해당 문서 링크를 수정했다. 과거 이력의 당시 상태표는 보존했다.
