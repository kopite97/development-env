import { describe, it, expect } from 'vitest';
import { pagePaths, projectPath, readLocation, locationUrl } from './routes';
const read = (path: string) => readLocation(new URL(path, 'https://devspace.example'));
describe('workspace routes', () => {
  it('recognizes all menu paths and trailing slashes', () => {
    for (const [page, path] of Object.entries(pagePaths)) {
      expect(read(path).page).toBe(page);
      expect(read(path === '/' ? path : path + '/').notFound).toBe(false);
    }
  });
  it('round trips encoded project ids and list conditions', () => {
    const id = '프로젝트 /?#%';
    const path = projectPath(id) + '?scope=unity&q=hello+world&archived=true';
    expect(read(path).projectId).toBe(id);
    expect(locationUrl(read(path))).toBe(path);
  });
  it('rejects malformed/unknown paths and normalizes invalid filters', () => {
    for (const path of ['/unknown', '/projects/a/b', '/projects/%E0%A4%A'])
      expect(read(path).notFound).toBe(true);
    const location = read('/tasks?scope=wrong&archived=no&q=');
    expect(location.filter).toBe('all');
    expect(location.showArchivedProjects).toBe(false);
    expect(locationUrl(location)).toBe('/tasks');
  });
});
