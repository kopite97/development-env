import type { CategoryFilter, CategoryOption } from './categoryFilter';
import { parseCategoryFilter } from './categoryFilter';

export function CategoryFilterControl({
  value,
  options,
  onChange,
  disabled = false,
}: {
  value: CategoryFilter;
  options: readonly CategoryOption[];
  onChange: (value: CategoryFilter) => void;
  disabled?: boolean;
}) {
  return (
    <label className="field category-filter-control">
      개발 분야
      <select
        aria-label="개발 분야 필터"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(parseCategoryFilter(event.target.value))}
      >
        <option value="all">전체 프로젝트</option>
        <option value="uncategorized">미분류</option>
        {value !== 'all' &&
          value !== 'uncategorized' &&
          !options.some((item) => item.id === value) && (
            <option value={value}>사용할 수 없는 개발 분야</option>
          )}
        {options.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>
    </label>
  );
}
