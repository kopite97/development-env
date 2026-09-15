import { useEffect } from 'react';
import { Query, useQuery } from '../../shared/http/query';
import { Button, Field } from '../../shared/ui/controls';
export type LinkProjectOption = {
  id: string;
  name: string;
  archived: boolean;
  categoryId: string | null;
};
export type LinkProjectOptions = {
  list: Query<{ items: LinkProjectOption[]; nextCursor: string | null }>;
  more: () => Promise<void>;
  detail: (id: string) => Query<LinkProjectOption>;
};
export function ProjectPicker({
  options,
  value,
  onChange,
}: {
  options: LinkProjectOptions;
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const state = useQuery(options.list);
  const rows = state.data?.items ?? [];
  return (
    <Field label="연결 프로젝트">
      <select
        aria-label="연결 프로젝트"
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value || null)}
      >
        <option value="">연결 없음</option>
        {value && !rows.some((row) => row.id === value) && (
          <option value={value}>선택한 프로젝트</option>
        )}
        {rows.map((row) => (
          <option key={row.id} value={row.id}>
            {row.name}
            {row.archived ? ' (보관)' : ''}
          </option>
        ))}
      </select>
      {value && <SelectedProject key={value} options={options} id={value} />}
      {state.status === 'loading' && <span role="status">프로젝트를 불러오는 중…</span>}
      {state.status === 'error' && (
        <span role="alert">
          프로젝트를 불러오지 못했습니다.{' '}
          <Button type="button" onClick={() => options.list.invalidate()}>
            다시 시도
          </Button>
        </span>
      )}
      {state.data?.nextCursor && (
        <Button
          type="button"
          disabled={state.status === 'loading'}
          onClick={() => void options.more()}
        >
          프로젝트 더 불러오기
        </Button>
      )}
    </Field>
  );
}
function SelectedProject({ options, id }: { options: LinkProjectOptions; id: string }) {
  const query = options.detail(id),
    state = useQuery(query);
  useEffect(() => () => query.invalidate(), [query]);
  return state.status === 'error' ? (
    <span role="alert">
      선택한 프로젝트를 확인할 수 없습니다. 선택은 유지됩니다.{' '}
      <Button type="button" onClick={() => query.invalidate()}>
        다시 확인
      </Button>
    </span>
  ) : (
    <span>{state.data?.name ?? '선택한 프로젝트 확인 중…'}</span>
  );
}
