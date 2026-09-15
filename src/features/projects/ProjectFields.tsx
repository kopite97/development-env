import { Field } from '../../shared/ui/controls';
import type { Project } from './model';
import type { ReactNode } from 'react';

type Fields = Pick<
  Project,
  'name' | 'scope' | 'stack' | 'progress' | 'milestone' | 'repositoryUrl' | 'subtitle'
>;
export function ProjectFields({
  form,
  onChange,
  errors = {},
  progressStep,
  classification,
}: {
  form: Omit<Fields, 'scope'> & { scope?: Fields['scope'] };
  onChange: <K extends keyof Fields>(key: K, value: Fields[K]) => void;
  errors?: Record<string, string>;
  progressStep?: 'any';
  classification?: ReactNode;
}) {
  return (
    <div className="form-grid">
      <Field label="프로젝트 이름">
        <input
          required
          maxLength={100}
          value={form.name}
          onChange={(e) => onChange('name', e.target.value)}
          autoFocus
          aria-invalid={!!errors.name}
        />
        {errors.name && <span role="alert">{errors.name}</span>}
      </Field>
      {classification}
      {!classification && (
        <Field label="개발 분야">
          <select
            aria-label="개발 분야"
            value={form.scope}
            onChange={(e) => onChange('scope', e.target.value as Fields['scope'])}
          >
            <option value="unity">Unity 개발</option>
            <option value="server">서버 · 웹 개발</option>
          </select>
        </Field>
      )}
      <Field label="기술 스택">
        <input
          required
          maxLength={200}
          value={form.stack}
          onChange={(e) => onChange('stack', e.target.value)}
          placeholder="Unity · C# 또는 Java · React"
          aria-invalid={!!errors.stack}
        />
        {errors.stack && <span role="alert">{errors.stack}</span>}
      </Field>
      <Field label="진행률 (%)">
        <input
          type="number"
          min={0}
          max={100}
          required
          step={progressStep}
          value={Number.isNaN(form.progress) ? '' : form.progress}
          onChange={(e) => onChange('progress', e.target.valueAsNumber)}
          aria-invalid={!!errors.progress}
        />
        {errors.progress && <span role="alert">{errors.progress}</span>}
      </Field>
      <Field label="프로젝트 목표 메모">
        <input
          maxLength={200}
          value={form.milestone}
          onChange={(e) => onChange('milestone', e.target.value)}
          aria-invalid={!!errors.milestone}
        />
        {errors.milestone && <span role="alert">{errors.milestone}</span>}
      </Field>
      <Field label="저장소 URL">
        <input
          type="url"
          maxLength={2000}
          value={form.repositoryUrl}
          onChange={(e) => onChange('repositoryUrl', e.target.value)}
          aria-invalid={!!errors.repositoryUrl}
        />
        {errors.repositoryUrl && <span role="alert">{errors.repositoryUrl}</span>}
      </Field>
      <Field label="프로젝트 설명">
        <textarea
          aria-label="프로젝트 설명"
          rows={4}
          maxLength={4000}
          value={form.subtitle}
          onChange={(e) => onChange('subtitle', e.target.value)}
          aria-invalid={!!errors.subtitle}
        />
        {errors.subtitle && <span role="alert">{errors.subtitle}</span>}
      </Field>
    </div>
  );
}
