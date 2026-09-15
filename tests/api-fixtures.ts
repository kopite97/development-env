import { serverDefaultWidgets } from '../src/features/dashboard/apiModel';

const titles = {
  overview: '프로젝트 한눈에 보기',
  board: '작업 보드',
  deploy: '운영 · 배포 현황',
  links: '빠른 링크',
  journal: '최근 개발 일지',
  milestone: '다가오는 마일스톤',
};
// Saved presentation fixture, not the virtual server defaults or scope migration.
export const savedHomeFixture = serverDefaultWidgets().map((widget) => ({
  ...widget,
  id: widget.type,
  title: titles[widget.type],
  size: widget.type === 'overview' || widget.type === 'board' ? ('medium' as const) : widget.size,
  selectionState: 'valid' as const,
}));
