# Document Editor — Frontend Requirements

## 1. 문서 목적

본 문서는 공용 Document Editor의 Frontend 구현 PLAN을 수립하기 위한 요구사항 및 설계 지침이다.

본 문서 자체는 구현 PLAN이 아니다.

API·ID·Pagination 예시는 [공통 계약](DOCUMENT_EDITOR_COMMON_CONTRACT.md)의 Backend PLAN `proposed` 기준을 따른 Mock 검증용 제안이며, 최종 승인되거나 구현된 API를 뜻하지 않는다. JournalId·DocumentId·AttachmentId·documentSpaceId·authorId는 UUID 문자열을 기준으로 하고 Frontend에서는 숫자로 변환하지 않는 opaque string으로 다룬다.

Frontend 작업자는 현재 코드베이스의 Router, API Client, 상태관리, 인증, UI Component 및 `journals` 화면을 먼저 분석한 뒤 본 지침을 만족하는 PLAN을 작성해야 한다.

---

# 2. 핵심 구조

Document 시스템은 다음 구조를 전제로 한다.

```text
Journal
   ↓
DocumentSpace
   ↓
Document
   ↓
Attachment
```

Cardinality:

```text
Journal 1 : 1 DocumentSpace

DocumentSpace 1 : N Document

Document 1 : N Attachment
```

`DocumentSpace`는 향후 다른 도메인이나 페이지에서도 Document 기능을 연결할 수 있도록 유지하는 범용 Document Collection이다.

현재 1차 실제 연동 대상은 `journals`뿐이다.

---

# 3. 현재 적용 범위

1차 구현에서 Document Editor를 실제 서비스 화면에 연결할 대상:

* `journals`

현재 다음 기능에는 연결하지 않는다.

* Project
* Milestone
* Resource

향후 필요해지는 시점에 각 도메인이 자신의 `DocumentSpace`를 소유하도록 별도 구현한다.

---

# 4. 사용자 UX 목표

일반적인 textarea 기반 게시글이 아니라 Notion 스타일의 Block 기반 Document Editor를 제공한다.

1차 사용자 흐름:

```text
Journals
   ↓
Journal 선택
   ↓
Document 목록
   ↓
새 글 작성
   ↓
Block Editor
   ↓
자동 저장
   ↓
DRAFT
   ↓
게시
   ↓
PUBLISHED
```

---

# 5. 기준 기술

* React
* BlockNote
* 기존 Router
* 기존 API Client
* 기존 인증/인가 구조
* 기존 디자인 시스템

Document 기능만을 위해 새로운 전역 상태관리 체계를 임의로 도입하지 않는다.

---

# 6. Editor 기능

## 기본 Block

다음을 지원한다.

* Paragraph
* Heading
* Bullet List
* Numbered List
* Checklist
* Toggle Heading
* Toggle List
* Quote
* Code Block
* Table
* Image
* File

사용하는 BlockNote 버전에서 제공하는 기본 기능을 우선 활용한다.

## Inline Formatting

* Bold
* Italic
* Underline
* Strike
* Link
* Text Color
* Background Color

가능하면 BlockNote 기본 Formatting Toolbar를 사용한다.

## Emoji

현재 BlockNote 버전에서 기본 Emoji 기능이 제공되고 기존 UI와 자연스럽게 통합 가능하다면 사용한다.

별도 Emoji 시스템은 구현하지 않는다.

---

# 7. Slash Command

사용자는 `/` 입력으로 Block을 추가할 수 있어야 한다.

예:

```text
/
├─ Text
├─ Heading
├─ Toggle
├─ Bullet List
├─ Numbered List
├─ Checklist
├─ Quote
├─ Code
├─ Table
├─ Image
└─ File
```

현재 Custom Slash Command는 구현하지 않는다.

향후 다음과 같은 서비스 기능을 추가할 수 있도록 BlockNote 구조를 불필요하게 제한하지 않는다.

```text
/server
/project
/github-issue
/api
```

Custom Block 기능 자체는 이번 범위에서 구현하지 않는다.

---

# 8. Block 조작

다음을 지원한다.

* Block 추가
* Block 삭제
* Drag & Drop
* Block 순서 변경
* 들여쓰기
* 내어쓰기
* 지원 가능한 Block Type 변경

BlockNote의 기본 Side Menu 및 Drag Handle을 우선 사용한다.

---

# 9. Document 제목

제목은 BlockNote Content와 분리한다.

```text
DocumentEditor
├─ TitleInput
└─ BlockNoteEditor
```

Backend 저장 구조도 다음과 같이 분리한다.

```text
title
content
```

제목은 본문과 함께 자동 저장 대상이다.

---

# 10. Document Content

Document 본문의 Source of Truth는 BlockNote Document JSON이다.

```ts
editor.document
```

Frontend는 저장 전 이를 Markdown, HTML 또는 별도의 자체 Document 구조로 변환하지 않는다.

Backend에서 조회한 `content`는 BlockNote 초기 Content로 복원한다.

---

# 11. Journal과 Document

Frontend는 Journal Context에서 Document를 생성하고 목록을 조회한다.

개념:

```text
Journal {journalId}
   ↓
DocumentSpace
   ↓
Documents
```

Frontend가 직접 `documentSpaceId`를 선택하거나 변경하지 않는다.

Journal 관련 Backend API가 해당 Journal의 DocumentSpace를 Resolve한다.

---

# 12. Document 생성

Document 생성은 Journal Context에서 수행한다.

예:

```text
Journal 상세
   ↓
새 글 작성
   ↓
POST Journal Document API
   ↓
DRAFT Document 생성
   ↓
documentId 반환
   ↓
공용 Editor 진입
```

생성된 이후 Editor는 Journal 내부 구조나 DocumentSpace를 직접 다룰 필요가 없다.

---

# 13. Document 목록

1차 구현에서는 모든 Document를 전역적으로 조회하지 않는다.

Journal 단위로 Document 목록을 조회한다.

예:

```text
Journal {journalId}
→ 해당 Journal의 Document 목록
```

Frontend는 전역 `GET /api/v2/documents` 목록에 의존하지 않는다.

Journal별 Document 목록 API 기준은 `GET /api/v2/journals/{journalId}/documents?limit=20`이며 다음 페이지는 서버가 반환한 opaque `nextCursor`를 `cursor`로 전달한다. 응답은 `{items, total, nextCursor}`를 사용하고 첫 요청에서는 cursor를 생략한다.

---

# 14. DocumentSpace

`DocumentSpace`는 Frontend 사용자가 직접 관리하는 기능이 아니다.

Frontend에서는 다음 기능을 제공하지 않는다.

* DocumentSpace 생성
* DocumentSpace 삭제
* DocumentSpace 선택
* DocumentSpace 이름 변경
* DocumentSpace 목록

DocumentSpace는 Backend 및 상위 Domain이 관리하는 내부 Collection 개념으로 취급한다.

---

# 15. Attachment 관계

Frontend는 다음 두 데이터를 분리해 관리한다.

```text
content
→ 문서의 실제 Block 구조

attachmentIds
→ 현재 Document에서 사용 중인 Attachment ID 목록
```

저장 예:

```json
{
  "title": "오늘의 개발 기록",
  "content": [...],
  "attachmentIds": ["550e8400-e29b-41d4-a716-446655440501", "550e8400-e29b-41d4-a716-446655440502"]
}
```

---

# 16. Attachment Registry

Editor는 Upload한 Attachment의 Backend 식별자를 추적해야 한다.

개념적으로 다음 정보를 관리할 수 있다.

```text
attachmentId
contentUrl
originalFilename
contentType
```

Upload 성공 시 Registry에 추가한다.

Document에서 실제 사용 중인 Attachment만 `attachmentIds`에 포함한다.

Image/File Block이 제거되면 해당 Attachment ID를 활성 목록에서 제외한다.

새로고침 후 Registry를 복원하는 metadata 제공 방식은 실제 Integration 전에 Backend와 확정해야 한다. Document Detail metadata, 별도 metadata API 또는 Backend가 승인한 매핑 방식 중 합의된 계약을 사용하고 filename·URL parsing으로 ID·MIME·소유 관계를 추론하지 않는다. Mock 전용 임시 resolver는 사용할 수 있지만 실제 API 계약으로 간주하지 않으며, 실제 연동 전환 시 이 기능에 추가한 Mock과 함께 제거한다.

---

# 17. Image / File Upload

이미지는 다음 방식을 지원한다.

* Image Block
* Drag & Drop
* Clipboard Paste

일반 파일은 File Block을 사용한다.

흐름:

```text
BlockNote
   ↓
Upload Adapter
   ↓
POST Attachment API
   ↓
attachmentId + contentUrl
   ↓
Block 삽입
```

Frontend는 MinIO를 직접 호출하지 않는다.

---

# 18. Attachment URL

Document JSON에는 Backend의 안정적인 Application URL을 저장한다.

예:

```text
/api/v2/attachments/550e8400-e29b-41d4-a716-446655440501/content
```

다음 값은 저장하지 않는다.

* MinIO 내부 URL
* Bucket URL
* Object Key
* 만료되는 Presigned URL

---

# 19. 자동 저장

Title 또는 Content 변경 시 자동 저장한다.

```text
변경
 ↓
DIRTY
 ↓
Debounce
 ↓
PUT /api/v2/documents/{documentId}
 ↓
SAVED
```

초기 Debounce는 약 1~2초를 기준으로 검토한다.

---

# 20. Autosave 동시성

동일 Document에 여러 Save Request를 동시에 실행하지 않는다.

```text
Save 진행 중
   ↓
추가 변경 발생
   ↓
DIRTY 유지
   ↓
현재 Save 완료
   ↓
최신 상태 다시 Save
```

오래된 Response가 최신 사용자 입력을 덮어쓰지 않도록 한다.

---

# 21. 저장 상태

최소 다음 상태를 사용자에게 표시한다.

```text
저장 중...
저장됨
저장 실패
```

내부 상태는 필요에 따라 다음과 같이 구성할 수 있다.

```text
IDLE
DIRTY
SAVING
SAVED
ERROR
```

저장 실패 시 Editor의 현재 입력 상태를 제거하지 않는다.

---

# 22. Publish

Document 상태:

```text
DRAFT
PUBLISHED
```

Publish 전에 최신 Editor 상태를 저장한다.

```text
Dirty 확인
 ↓
최종 Save
 ↓
Save 성공
 ↓
Publish
```

저장이 실패한 상태에서 이전 서버 데이터만 게시해서는 안 된다.

---

# 23. Route

실제 프로젝트 Router Convention을 우선한다.

개념적으로 필요한 화면:

```text
Journal 상세
→ 해당 Journal의 Document 목록

/documents/:documentId
→ Read-only Viewer

/documents/:documentId/edit
→ Editor
```

Editor 및 Viewer는 공용 컴포넌트로 구현한다.

---

# 24. Journals 적용

현재 1차 통합 대상은 `journals`이다.

각 Journal은 자신의 DocumentSpace를 통해 여러 Document를 가질 수 있다.

예:

```text
Journal {journalId}
├─ Document A
├─ Document B
└─ Document C
```

Journal 화면의 실제 UI 구조와 기존 Route는 현재 코드베이스를 분석한 뒤 최대한 기존 UX를 유지한다.

---

# 25. 오류 처리

최소 다음 오류를 처리한다.

* Journal Document 생성 실패
* Document 목록 조회 실패
* Document 조회 실패
* Document 저장 실패
* Document 삭제 실패
* Publish 실패
* Attachment Upload 실패
* Attachment 조회 실패
* 권한 없음
* 존재하지 않는 Document

Attachment 하나의 Upload 실패가 Editor 전체 장애로 이어지지 않아야 한다.

---

# 26. 제외 범위

1차 구현에는 다음을 포함하지 않는다.

* Project Document 연동
* Milestone Document 연동
* Resource Document 연동
* 실시간 공동 편집
* Comment
* Mention
* Relation
* Database View
* Kanban
* Calendar
* Share Link
* Page Tree
* Template
* History / Revision
* AI
* Custom Block
* 외부 API Block
* GitHub Block
* Server Block
* Kubernetes Block

향후 필요하다는 이유로 미리 관련 구조를 구현하지 않는다.

---

# 27. 향후 다른 Domain 연동

향후 다른 기능에 Document를 추가할 때는 동일한 DocumentSpace 구조를 사용한다.

예:

```text
Project
   ↓
DocumentSpace
   ↓
Document
```

또는:

```text
Milestone
   ↓
DocumentSpace
   ↓
Document
```

현재 Frontend 구현을 `journals` 전용 Editor로 만들지 않는다.

Editor 자체는 공용으로 유지하고, Journal은 생성/목록 진입 Context만 담당한다.

---

# 28. PLAN 작성 전 확인사항

Frontend PLAN 작성 전에 다음을 실제 코드에서 확인한다.

* React 버전
* BlockNote 설치 여부 및 버전
* Router 구조
* API Client 구조
* 인증 방식
* 상태관리 방식
* Error Handling
* 기존 디자인 시스템
* `journals` Page / Component 구조
* Journal 상세 또는 목록 구조
* Journal 관련 기존 API
* Upload 관련 기존 코드
* Backend API Proxy/Base URL

---

# 29. Frontend 완료 기준

다음 흐름이 정상 동작해야 한다.

1. Journal에서 Document 목록 조회
2. Journal에서 새 DRAFT Document 생성
3. 공용 Document Editor 진입
4. 제목 작성
5. Block Content 작성
6. Slash Command 사용
7. Formatting 사용
8. Toggle 사용
9. Block Drag & Drop
10. Image Upload
11. Drag & Drop / Clipboard Image Paste
12. File Upload
13. Autosave
14. 저장 상태 표시
15. 새로고침 후 내용 복원
16. Attachment 관계 복원
17. 최신 상태 저장 후 Publish
18. Journal Document 목록에서 게시글 조회
19. Read-only Viewer 표시
20. 저장 실패 시 현재 사용자 입력 유지

이 요구사항을 기준으로 Frontend 구현 PLAN을 작성한다.
