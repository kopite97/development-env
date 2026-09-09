import { Box, ChevronRight, Gamepad2, Globe, Server, type LucideIcon } from 'lucide-react';
import { Progress } from '../../components/ui';
import { projects, type Scope, type Task } from '../../data/demo';
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
}: {
  scope: Scope;
  tasks: Task[];
  onDetail: DetailHandler;
  search?: string;
}) {
  const list = projects.filter(
    (p) =>
      (scope === 'all' || p.scope === scope) &&
      (p.name + p.stack).toLowerCase().includes(search.toLowerCase()),
  );
  const filtered = tasks.filter((t) => scope === 'all' || t.scope === scope);
  return (
    <>
      <div className="stats">
        <div>
          <span>진행 중인 프로젝트</span>
          <strong>
            {list.length}
            <small>개</small>
          </strong>
        </div>
        <div>
          <span>진행 중인 작업</span>
          <strong>
            {filtered.filter((t) => t.status === 'doing').length}
            <small>개</small>
          </strong>
        </div>
        <div>
          <span>완료한 작업</span>
          <strong>
            {filtered.filter((t) => t.status === 'done').length}
            <small>개</small>
          </strong>
        </div>
      </div>
      <div className="project-list">
        {list.map((p) => {
          const Icon = projectIcons[p.id];
          return (
            <button
              className="project-row"
              key={p.id}
              onClick={() =>
                onDetail(
                  p.name,
                  `${p.subtitle}\n기술 스택: ${p.stack}\n현재 목표: ${p.milestone}\n진행률: ${p.progress}%\n\n예시 프로젝트입니다. 실제 저장소 연동은 아직 설정되지 않았습니다.`,
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
