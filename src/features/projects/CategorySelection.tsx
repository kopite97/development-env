import { useEffect } from 'react';
import { useQuery } from '../../shared/http/query';
import { Button, Field } from '../../shared/ui/controls';
import { categoryId, type CategoryId } from './categoryModel';
import type { CategoryStore } from './categoryStore';

export function useCategories(store: CategoryStore) {
  const state = useQuery(store.list);
  useEffect(() => {
    void store.refresh();
    const focus = () => {
      if (document.visibilityState === 'visible') void store.refresh();
    };
    window.addEventListener('focus', focus);
    return () => window.removeEventListener('focus', focus);
  }, [store]);
  return state;
}
export function CategorySelection({
  store,
  value,
  onChange,
  error,
}: {
  store: CategoryStore;
  value: CategoryId | null;
  onChange: (id: CategoryId | null) => void;
  error?: string;
}) {
  const state = useCategories(store);
  const items = state.data?.items ?? [];
  const missing = value !== null && !items.some((item) => item.id === value);
  return (
    <div className="project-category-field">
      <Field label="개발 분야">
        <select
          aria-label="개발 분야"
          value={value ?? ''}
          aria-invalid={!!error || missing}
          onChange={(event) => onChange(event.target.value ? categoryId(event.target.value) : null)}
        >
          <option value="">미분류</option>
          {missing && (
            <option value={value} disabled>
              선택한 카테고리를 확인할 수 없어요
            </option>
          )}
          {items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        {error && <span role="alert">{error}</span>}
      </Field>
      {state.status === 'loading' && <p role="status">카테고리를 불러오는 중...</p>}
      {state.status === 'ready' && !items.length && <p>등록된 카테고리가 없어요.</p>}
      {missing && state.status === 'ready' && (
        <p role="alert">
          선택한 카테고리를 사용할 수 없어요. 다시 선택하거나 미분류로 변경해 주세요.
        </p>
      )}
      {state.status === 'error' && (
        <p role="alert">
          카테고리를 새로 불러오지 못했습니다.{' '}
          <Button type="button" onClick={() => void store.refresh()}>
            다시 시도
          </Button>
        </p>
      )}
    </div>
  );
}
