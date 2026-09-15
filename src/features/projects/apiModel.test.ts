import { describe, expect, it } from 'vitest';
import {
  createBody,
  parseProject,
  parseHistoricalCreatedProject,
  parseProjectPage,
  patchBody,
  presentation,
  projectPresentation,
  projectDraft,
  validateDraft,
} from './apiModel';
const dto = {
  id: '00000000-0000-0000-0000-000000000001',
  revision: 4,
  createdAt: '2026-09-13T00:00:00Z',
  updatedAt: '2026-09-13T01:00:00Z',
  name: 'Project',
  subtitle: '',
  stack: 'C#',
  progress: 12.345,
  currentMilestone: 'memo',
  repositoryUrl: '',
  status: 'archived',
  categoryId: null,
};
describe('server Project boundary', () => {
  it('requires normal categoryId, isolates legacy replay omission and serializes nullable relation independently', () => {
    const { categoryId: _category, ...legacy } = dto;
    expect(() => parseProject(legacy)).toThrow();
    expect(parseHistoricalCreatedProject(legacy)).not.toHaveProperty('categoryId');
    const project = parseProject(dto),
      draft = projectDraft(project);
    const selected = parseProject({ ...dto, categoryId: dto.id }).categoryId;
    expect(patchBody(project, { ...draft, categoryId: selected })).toEqual({
      revision: 4,
      categoryId: dto.id,
    });
    expect(patchBody(parseProject({ ...dto, categoryId: dto.id }), draft)).toEqual({
      revision: 4,
      categoryId: null,
    });
    expect(draft).not.toHaveProperty('scope');
  });
  it('retains server metadata and maps presentation without fixture IDs', () => {
    const project = parseProject(dto);
    expect(presentation(project)).toEqual({ milestone: 'memo', archived: true, color: 'neutral' });
    expect(projectPresentation(project)).toEqual({
      id: dto.id,
      name: dto.name,
      subtitle: '',
      stack: 'C#',
      progress: 12.345,
      milestone: 'memo',
      repositoryUrl: '',
      archived: true,
      color: 'neutral',
    });
    expect(createBody(projectDraft(project))).toEqual({
      categoryId: null,
      name: 'Project',
      subtitle: '',
      stack: 'C#',
      progress: 12.345,
      currentMilestone: 'memo',
      repositoryUrl: '',
    });
    expect(presentation(parseProject({ ...dto, colorToken: 'future' })).color).toBe('neutral');
  });
  it('rejects local IDs, unsafe revisions, missing metadata and malformed pages', () => {
    for (const change of [
      { id: 'forest' },
      { revision: 0 },
      { revision: Number.MAX_SAFE_INTEGER + 1 },
      { updatedAt: null },
      { currentMilestone: null },
      { progress: Infinity },
    ])
      expect(() => parseProject({ ...dto, ...change })).toThrow();
    expect(() => parseProjectPage({ items: [dto], total: 1, nextCursor: '' })).toThrow();
  });
  it('preserves omission and sends only edited memo/zero/empty fields with expected revision', () => {
    const project = parseProject(dto),
      draft = projectDraft(project);
    expect(patchBody(project, { ...draft, milestone: '' })).toEqual({
      revision: 4,
      currentMilestone: '',
    });
    expect(patchBody(project, { ...draft, progress: 0 })).toEqual({ revision: 4, progress: 0 });
    expect(patchBody(project, draft)).toEqual({ revision: 4 });
    expect(
      validateDraft({ ...draft, name: ' ', repositoryUrl: 'javascript:alert(1)' }),
    ).toHaveProperty('repositoryUrl');
  });
});
