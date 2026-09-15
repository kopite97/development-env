import type { CategoryId } from './categoryModel';
import type { CategoryStore } from './categoryStore';
import { useCategories } from './CategorySelection';
import { Button } from '../../shared/ui/controls';
export function CategoryDisplay({ store, id }: { store: CategoryStore; id: CategoryId | null }) {
  const state = useCategories(store);
  const item = state.data?.items.find((item) => item.id === id);
  return (
    <>
      {id === null
        ? '미분류'
        : (item?.name ??
          (state.status === 'loading' ? '불러오는 중...' : '카테고리를 확인할 수 없어요'))}
      {state.status === 'error' && (
        <span role="alert">
          {' '}
          카테고리 정보가 최신이 아닐 수 있어요.{' '}
          <Button onClick={() => void store.refresh()}>다시 시도</Button>
        </span>
      )}
    </>
  );
}
