import { ArrowUpRight, Box, Code2, Github, Globe } from 'lucide-react';
import { type Scope } from '../../data/demo';
import { EmptyState } from '../../components/ui';
const links = [
  { label: 'GitHub', desc: '코드와 저장소', url: 'https://github.com', icon: Github, scope: 'all' },
  {
    label: 'Unity Documentation',
    desc: '게임 개발 레퍼런스',
    url: 'https://docs.unity3d.com',
    icon: Box,
    scope: 'unity',
  },
  {
    label: 'Spring Documentation',
    desc: '서버 개발 레퍼런스',
    url: 'https://docs.spring.io',
    icon: Code2,
    scope: 'server',
  },
  {
    label: 'React Documentation',
    desc: '프론트엔드 레퍼런스',
    url: 'https://react.dev',
    icon: Globe,
    scope: 'server',
  },
];
export function QuickLinks({
  scope,
  search = '',
  onReset,
}: {
  scope: Scope;
  search?: string;
  onReset?: () => void;
}) {
  const visible = links.filter(
    (l) =>
      (scope === 'all' || l.scope === scope || l.scope === 'all') &&
      (l.label + l.desc).toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      {search && <p role="status">검색 결과 {visible.length}개</p>}
      {!visible.length && <EmptyState title="검색 조건에 맞는 링크가 없어요" onReset={onReset} />}
      <div className="quick-links">
        {visible.map((l) => (
          <a href={l.url} key={l.label} target="_blank" rel="noreferrer">
            <span className="link-icon">
              <l.icon size={18} />
            </span>
            <span>
              <strong>{l.label}</strong>
              <small>{l.desc}</small>
            </span>
            <ArrowUpRight size={15} />
          </a>
        ))}
      </div>
    </>
  );
}
