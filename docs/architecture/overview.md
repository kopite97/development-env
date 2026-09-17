# System overview

Devspace is a React 19 and TypeScript SPA built with Vite. Its default entry authenticates through the existing backend session and displays backend User/PersonalWorkspace data. Projects, Tasks, Journals, Milestones, Links and Home Widgets use server-owned data and mutations through their feature stores. Home layout uses Dashboard v3 placements; Widget configuration and typed Widget data use the independent Widget v1 APIs. Uninitialized Home state is explicit and GET never seeds defaults.

```mermaid
flowchart LR
  Browser[Browser: auth gate, Home Widgets and feature pages] --> Proxy[Same-origin Vite or Nginx]
  Proxy --> Backend[Backend auth, layout, Widget and business APIs]
  Backend --> Database[User, Workspace, layout, Widget and business data]
  Backend --> OIDC[Google OIDC]
  Legacy[Test-only legacy entry] --> Storage[Preserved local prototype records]
```

Identity, CSRF and request lifecycle state are memory-only. The backend owns HttpOnly session cookies and authorization. Browser resumption, session loss, logout and account changes retire private state and revalidate as appropriate. Legacy localStorage remains untouched and has no authenticated authority.

See [frontend architecture](frontend.md), [development and deployment inputs](../../README.md), [PLAN-0006](../plans/PLAN-0006-frontend-auth-http-integration.md) and [PLAN-0007](../plans/PLAN-0007-project-overview-integration.md). The historical [API proposal](../references/api/backend-api-contract.md) is not the current contract authority. Required local acceptance uses a disposable frontend-owned OIDC fixture against the unchanged real backend security chain and PostgreSQL; production Google/TLS deployment remains outside this work.
