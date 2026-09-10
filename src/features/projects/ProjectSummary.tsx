import { Badge, Progress } from '../../shared/ui/controls';
import { scopes } from './scope';
import type { Project } from './model';
function repositoryHref(value: string) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}
export function ProjectSummary({ project }: { project: Project }) {
  const href = repositoryHref(project.repositoryUrl);
  return (
    <section className="content-panel project-summary" aria-label="프로젝트 기본 정보">
      <div className="feature-actions">
        <Badge tone={project.archived ? 'neutral' : 'green'}>
          {project.archived ? '보관됨' : '진행 중'}
        </Badge>
        <Badge>{scopes[project.scope]}</Badge>
      </div>
      <h2>프로젝트 소개</h2>
      <p className="project-description">{project.subtitle || '등록된 설명이 없어요.'}</p>
      <dl className="project-facts">
        <div>
          <dt>기술 스택</dt>
          <dd>{project.stack}</dd>
        </div>
        <div>
          <dt>현재 목표</dt>
          <dd>{project.milestone || '등록된 목표가 없어요.'}</dd>
        </div>
        <div>
          <dt>진행률 (직접 설정)</dt>
          <dd>
            <span>{project.progress}%</span>
            <Progress value={project.progress} />
          </dd>
        </div>
        <div>
          <dt>저장소</dt>
          <dd>
            {href ? (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {project.repositoryUrl}
              </a>
            ) : (
              '등록된 유효한 저장소 주소가 없어요.'
            )}
          </dd>
        </div>
      </dl>
    </section>
  );
}
