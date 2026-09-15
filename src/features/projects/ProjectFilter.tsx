import { useQuery } from '../../shared/http/query';
import { Button } from '../../shared/ui/controls';
import type { Query } from '../../shared/http/query';
type ProjectOption = { id: string; name: string; archived: boolean };
type ProjectOptions<T extends ProjectOption> = {
  list: Query<{ items: T[]; nextCursor: string | null }>;
  detail: (id: string) => Query<T>;
  more: () => Promise<void>;
};

function SelectedProject<T extends ProjectOption>({
  id,
  options,
}: {
  id: string;
  options: ProjectOptions<T>;
}) {
  const state = useQuery(options.detail(id));
  return (
    <option value={id}>
      {state.data?.name ??
        (state.status === 'error' ? '선택한 프로젝트 확인 불가' : '선택한 프로젝트 확인 중…')}
    </option>
  );
}

export function ProjectFilter<T extends ProjectOption>({
  options,
  value,
  invalid = false,
  disabled = false,
  label = '프로젝트 필터',
  onChange,
}: {
  options: ProjectOptions<T>;
  value: string;
  invalid?: boolean;
  disabled?: boolean;
  label?: string;
  onChange: (id: string) => void;
}) {
  const state = useQuery(options.list);
  const items = state.data?.items ?? [];
  return (
    <div className="home-project-filter">
      <label className="field">
        프로젝트
        <select
          aria-label={label}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">전체 프로젝트</option>
          {invalid ? (
            <option value={value}>올바르지 않은 프로젝트</option>
          ) : value && !items.some((item) => item.id === value) ? (
            <SelectedProject key={value} id={value} options={options} />
          ) : null}
          {items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
              {item.archived ? ' (보관됨)' : ''}
            </option>
          ))}
        </select>
      </label>
      {state.status === 'error' && (
        <Button disabled={disabled} onClick={() => options.list.invalidate()}>
          프로젝트 다시 불러오기
        </Button>
      )}
      {!state.data && state.status !== 'error' && (
        <span role="status">프로젝트를 불러오는 중…</span>
      )}
      {state.data?.nextCursor && (
        <Button
          disabled={disabled || state.status === 'loading'}
          onClick={() => void options.more()}
        >
          프로젝트 더 불러오기
        </Button>
      )}
    </div>
  );
}
