import { Field } from '../../shared/ui/controls';
import type { Project } from './model';
export function ProjectSelect({
  projects,
  value,
  onChange,
}: {
  projects: Project[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <Field label="프로젝트">
      <select
        aria-label="프로젝트"
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">프로젝트 선택</option>
        {projects
          .filter((p) => !p.archived || p.id === value)
          .map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.archived ? ' (보관됨)' : ''}
            </option>
          ))}
      </select>
    </Field>
  );
}
