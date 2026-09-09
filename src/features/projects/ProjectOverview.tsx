import { Box, ChevronRight, Gamepad2, Globe, Server, type LucideIcon } from 'lucide-react';
import { EmptyState, Progress } from '../../components/ui';
import type { ReactNode } from 'react';
import { type Scope, type Task } from '../../data/demo';
import type { Project } from './model';
import type { DetailHandler } from '../../types/ui';
export const projectIcons: Record<string, LucideIcon> = {
  forest: Gamepad2,
  orbit: Box,
  api: Server,
  web: Globe,
};
export function ProjectOverview({
  scope,
  tasks,
  onDetail,
  search = '',
  projects,
  onEdit,
  onReset,
  emptyAction,
  archived = false,
}: {
  scope: Scope;
  tasks: Task[];
  onDetail: DetailHandler;
  search?: string;
  projects: Project[];
  onEdit?: (project: Project) => void;
  onReset?: () => void;
  emptyAction?: ReactNode;
  archived?: boolean;
}) {
  const list = projects.filter(
    (p) =>
      (scope === 'all' || p.scope === scope) &&
      (p.name + p.stack).toLowerCase().includes(search.toLowerCase()),
  );
  const filtered = tasks.filter((t) => scope === 'all' || t.scope === scope);
  const total = projects.filter((p) => scope === 'all' || p.scope === scope).length;
  return (
    <>
      <div className="stats">
        <div>
          <span>{archived ? '보관된 프로젝트' : '현재 프로젝트'}</span>
          <strong>
            {total}
            <small>개</small>
          </strong>
        </div>
        <div>
          <span>분야 전체 진행 중인 작업</span>
          <strong>
            {filtered.filter((t) => t.status === 'doing').length}
            <small>개</small>
          </strong>
        </div>
        <div>
          <span>분야 전체 완료한 작업</span>
          <strong>
            {filtered.filter((t) => t.status === 'done').length}
            <small>개</small>
          </strong>
        </div>
      </div>
      {search && <p role="status">검색 결과 {list.length}개</p>}
      {!list.length && (
        <EmptyState
          title={
            search || scope !== 'all'
              ? '검색 조건에 맞는 프로젝트가 없어요'
              : archived
                ? '보관된 프로젝트가 없어요'
                : '프로젝트가 없어요'
          }
          onReset={search || scope !== 'all' ? onReset : undefined}
        >
          {emptyAction}
        </EmptyState>
      )}
      <div className="project-list">
        {list.map((p) => {
          const Icon = projectIcons[p.id] ?? (p.scope === 'unity' ? Gamepad2 : Server);
          return (
            <button
              className="project-row"
              key={p.id}
              onClick={() =>
                onEdit
                  ? onEdit(p)
                  : onDetail(
                      p.name,
                      `${p.subtitle}\n기술 스택: ${p.stack}\n현재 목표: ${p.milestone}\n진행률: ${p.progress}%\n저장소: ${p.repositoryUrl || '등록하지 않음'}`,
                    )
              }
            >
              <span className={`project-icon ${p.color}`}>
                <Icon size={22} />
              </span>
              <span className="project-info">
                <strong>{p.name}</strong>
                <small>{p.stack}</small>
              </span>
              <div className="project-progress">
                <span>{p.progress}%</span>
                <Progress value={p.progress} />
              </div>
              <ChevronRight size={16} />
            </button>
          );
        })}
      </div>
    </>
  );
}
