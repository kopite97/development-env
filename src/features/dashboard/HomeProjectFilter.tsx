import { useQuery } from '../../shared/http/query';
import { Button } from '../../shared/ui/controls';
import type { DashboardProjectOptions } from './projectOptions';

function SelectedProject({ id, options }: { id: string; options: DashboardProjectOptions }) {
  const state = useQuery(options.detail(id));
  return (
    <option value={id}>
      {state.data?.name ??
        (state.status === 'error' ? '선택한 프로젝트 확인 불가' : '선택한 프로젝트 확인 중…')}
    </option>
  );
}

export function HomeProjectFilter({
  options,
  value,
  invalid,
  disabled,
  onChange,
}: {
  options: DashboardProjectOptions;
  value: string;
  invalid: boolean;
  disabled: boolean;
  onChange: (id: string) => void;
}) {
  const state = useQuery(options.list);
  const items = state.data?.items ?? [];
  return (
    <div className="home-project-filter">
      <label className="field">
        프로젝트
        <select
          aria-label="Home 프로젝트"
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
