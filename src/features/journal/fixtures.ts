import type { JournalEntry } from './model';
import { projects } from '../projects/fixtures';
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
export const initialJournals: JournalEntry[] = journal.map((entry, index) => ({
  ...entry,
  id: `demo-journal-${index}`,
  projectId: projects.find((p) => p.name === entry.project)!.id,
  scope: entry.scope as JournalEntry['scope'],
  createdAt: `2026-${entry.date.replace('.', '-')}T00:00:00Z`,
}));
