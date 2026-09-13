import { ArrowUpRight, Box, Code2, Github, Globe } from 'lucide-react';
import { type Scope } from '../projects/scope';
import { Button, EmptyState } from '../../shared/ui/controls';
import { useLinks } from './LinksProvider';
import type { QuickLink } from './model';
const linkIcons = { github: Github, unity: Box, spring: Code2, react: Globe };
function LinkIcon({ id }: { id: string }) {
  const Icon = linkIcons[id as keyof typeof linkIcons] ?? Globe;
  return <Icon size={18} />;
}
export type LinkRowsProps = {
  links: QuickLink[];
  filtered: boolean;
  onEdit?: (link: QuickLink) => void;
  onMove?: (id: string, direction: -1 | 1) => void;
  onRemove?: (link: QuickLink) => void;
  disabled?: boolean;
  iconKey?: (link: QuickLink) => string;
};
export function LinkRows({
  links,
  filtered,
  onEdit,
  onMove,
  onRemove,
  disabled,
  iconKey,
}: LinkRowsProps) {
  return (
    <div className="quick-links">
      {links.map((l, index) => (
        <div className="quick-link-row" key={l.id}>
          <a href={l.url} target="_blank" rel="noopener noreferrer">
            <span className="link-icon">
              <LinkIcon id={iconKey ? iconKey(l) : l.id} />
            </span>
            <span className="link-copy">
              <strong>{l.label}</strong>
              <small>{l.desc}</small>
            </span>
            <ArrowUpRight size={15} />
          </a>
          {onEdit && (
            <div className="link-actions">
              <span className="muted">
                {l.scope === 'all' ? '공통' : l.scope === 'unity' ? 'Unity 개발' : '서버 · 웹 개발'}
              </span>
              <Button disabled={disabled} onClick={() => onEdit(l)} aria-label={`${l.label} 편집`}>
                편집
              </Button>
              <Button
                disabled={disabled || filtered || index === 0}
                onClick={() => onMove?.(l.id, -1)}
                aria-label={`${l.label} 위로`}
              >
                위로
              </Button>
              <Button
                disabled={disabled || filtered || index === links.length - 1}
                onClick={() => onMove?.(l.id, 1)}
                aria-label={`${l.label} 아래로`}
              >
                아래로
              </Button>
              <Button
                disabled={disabled}
                variant="danger"
                onClick={() => onRemove?.(l)}
                aria-label={`${l.label} 삭제`}
              >
                삭제
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
export function QuickLinks({
  scope,
  search = '',
  onReset,
  onAdd,
  onEdit,
}: {
  scope: Scope;
  search?: string;
  onReset?: () => void;
  onAdd?: () => void;
  onEdit?: (link: QuickLink) => void;
}) {
  const { links, error, remove, move } = useLinks();
  const visible = links.filter(
    (l) =>
      (scope === 'all' || l.scope === scope || l.scope === 'all') &&
      (l.label + l.desc + l.url).toLowerCase().includes(search.toLowerCase()),
  );
  const filtered = scope !== 'all' || !!search;
  return (
    <>
      {search && <p role="status">검색 결과 {visible.length}개</p>}
      {onEdit && (
        <p className="muted">
          공통 링크는 모든 분야에 표시됩니다. 순서 변경은 검색·분야를 초기화한 전체 목록에서 할 수
          있어요.
        </p>
      )}
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      {!visible.length && (
        <EmptyState
          title={links.length ? '검색 조건에 맞는 링크가 없어요' : '등록된 링크가 없어요'}
          onReset={onReset}
        >
          {onAdd && <Button onClick={onAdd}>링크 추가</Button>}
        </EmptyState>
      )}
      <LinkRows
        links={visible}
        filtered={filtered}
        onEdit={onEdit}
        onMove={move}
        onRemove={(l) => {
          if (window.confirm(`“${l.label}” 링크를 삭제할까요?`)) remove(l.id);
        }}
      />
    </>
  );
}
