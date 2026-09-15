import { type Scope } from '../projects/scope';
import { Button, EmptyState } from '../../shared/ui/controls';
import { useLinks } from './LinksProvider';
import type { QuickLink } from './model';
import { LinkRows } from './LinkRows';
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
