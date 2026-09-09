export type Scope = 'all' | 'unity' | 'server';
export const scopes: Record<Scope, string> = {
  all: '전체 프로젝트',
  unity: 'Unity 개발',
  server: '서버 · 웹 개발',
};
export const projects = [
  {
    id: 'forest',
    name: 'Forest of Echoes',
    subtitle: '탐험과 발견이 있는 작은 숲',
    scope: 'unity',
    stack: 'Unity · C#',
    progress: 68,
    color: 'forest',
    milestone: '플레이 가능한 데모',
    tasks: 12,
  },
  {
    id: 'orbit',
    name: 'Orbit Runner',
    subtitle: '궤도를 달리는 아케이드 게임',
    scope: 'unity',
    stack: 'Unity · C#',
    progress: 32,
    color: 'orbit',
    milestone: '코어 게임플레이 완성',
    tasks: 8,
  },
  {
    id: 'api',
    name: 'Devspace API',
    subtitle: '프로젝트를 연결하는 백엔드',
    scope: 'server',
    stack: 'Java · Spring Boot',
    progress: 84,
    color: 'api',
    milestone: 'v1.2 배포',
    tasks: 5,
  },
  {
    id: 'web',
    name: 'Devspace Web',
    subtitle: '나만의 개발 작업실',
    scope: 'server',
    stack: 'React · TypeScript',
    progress: 56,
    color: 'web',
    milestone: '대시보드 UI',
    tasks: 7,
  },
] as const;
export type Task = {
  id: string;
  title: string;
  project: string;
  scope: Exclude<Scope, 'all'>;
  status: 'todo' | 'doing' | 'done';
  priority: '높음' | '보통';
  tag: string;
};
export const initialTasks: Task[] = [
  {
    id: '1',
    title: '인벤토리 UI 구현',
    project: 'Forest of Echoes',
    scope: 'unity',
    status: 'todo',
    priority: '높음',
    tag: '기능',
  },
  {
    id: '2',
    title: '환경 사운드 에셋 정리',
    project: 'Forest of Echoes',
    scope: 'unity',
    status: 'todo',
    priority: '보통',
    tag: '에셋',
  },
  {
    id: '3',
    title: '캐릭터 이동 로직 개선',
    project: 'Forest of Echoes',
    scope: 'unity',
    status: 'doing',
    priority: '높음',
    tag: '개선',
  },
  {
    id: '4',
    title: '레벨 생성 시스템 설계',
    project: 'Orbit Runner',
    scope: 'unity',
    status: 'doing',
    priority: '보통',
    tag: '기능',
  },
  {
    id: '5',
    title: '카메라 추적 버그 수정',
    project: 'Forest of Echoes',
    scope: 'unity',
    status: 'done',
    priority: '보통',
    tag: '버그',
  },
  {
    id: '6',
    title: '인증 API 테스트',
    project: 'Devspace API',
    scope: 'server',
    status: 'doing',
    priority: '높음',
    tag: '테스트',
  },
  {
    id: '7',
    title: '배포 파이프라인 구성',
    project: 'Devspace API',
    scope: 'server',
    status: 'todo',
    priority: '보통',
    tag: '운영',
  },
];
export const journal = [
  {
    title: '캐릭터 이동에 자연스러움 더하기',
    project: 'Forest of Echoes',
    scope: 'unity',
    date: '09.09',
    body: '가속과 감속 곡선을 조정했습니다. 다음 플레이테스트에서 이동 감각을 확인할 예정입니다.',
  },
  {
    title: 'JWT 인증 흐름 정리',
    project: 'Devspace API',
    scope: 'server',
    date: '09.08',
    body: '토큰 갱신과 만료 시나리오를 정리했습니다. 예외 응답 규격을 맞추는 작업이 남아 있습니다.',
  },
  {
    title: '첫 번째 프로토타입 플레이테스트',
    project: 'Orbit Runner',
    scope: 'unity',
    date: '09.07',
    body: '첫 플레이 루프를 테스트했습니다. 초반 난이도와 조작 안내를 개선할 계획입니다.',
  },
];
