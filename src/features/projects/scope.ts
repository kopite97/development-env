export type Scope = 'all' | 'unity' | 'server';
export const scopes: Record<Scope, string> = {
  all: '전체 프로젝트',
  unity: 'Unity 개발',
  server: '서버 · 웹 개발',
};
