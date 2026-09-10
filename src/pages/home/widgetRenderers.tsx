import type { ReactNode } from 'react';
import type { Task } from '../../features/tasks/model';
import type { DetailHandler } from '../../shared/types/ui';
import type { JournalEntry } from '../../features/journal/model';
import { RecentJournals } from '../../features/journal/RecentJournals';
import { QuickLinks } from '../../features/links/QuickLinks';
import { MilestoneList } from '../../features/milestones/MilestoneList';
import { DeploymentStatus } from '../../features/operations/DeploymentStatus';
import { ProjectOverview } from '../../features/projects/ProjectOverview';
import { TaskManager } from '../../features/tasks/TaskManager';
import type { Project } from '../../features/projects/model';
import type { Widget, WidgetType } from '../../features/dashboard/model';
import { Button, EmptyState } from '../../shared/ui/controls';

type WidgetProps = {
  widget: Widget;
  tasks: Task[];
  journals: JournalEntry[];
  projects: Project[];
  onDetail: DetailHandler;
  onProjectOpen: (id: string) => void;
};

export const widgetRenderers: Record<WidgetType, (props: WidgetProps) => ReactNode> = {
  overview: (p) => (
    <ProjectOverview
      projects={p.projects}
      scope={p.widget.scope}
      tasks={p.tasks}
      onOpen={p.onProjectOpen}
      limit={p.widget.limit}
      projectOnly={!!p.widget.projectId}
      archived={!!p.widget.projectId && !!p.projects[0]?.archived}
    />
  ),
  board: (p) => (
    <TaskManager scope={p.widget.scope} projectId={p.widget.projectId} limit={p.widget.limit} />
  ),
  deploy: (p) => <DeploymentStatus scope={p.widget.scope} onDetail={p.onDetail} />,
  links: (p) => <QuickLinks scope={p.widget.scope} />,
  journal: (p) =>
    p.journals.some((j) => p.widget.scope === 'all' || j.scope === p.widget.scope) ? (
      <RecentJournals
        scope={p.widget.scope}
        journals={p.journals}
        onDetail={p.onDetail}
        limit={p.widget.limit}
      />
    ) : (
      <EmptyState title="개발일지가 없어요" />
    ),
  milestone: (p) =>
    p.projects.some((project) => p.widget.scope === 'all' || project.scope === p.widget.scope) ? (
      <MilestoneList
        projects={p.projects}
        scope={p.widget.scope}
        projectId={p.widget.projectId}
        limit={p.widget.limit ?? 2}
      />
    ) : (
      <EmptyState title="마일스톤이 없어요" />
    ),
};

export function renderProjectWidget(props: WidgetProps) {
  const { widget } = props;
  const supportsProject = ['overview', 'board', 'journal', 'milestone'].includes(widget.type);
  const selected =
    supportsProject && widget.projectId
      ? props.projects.find((p) => p.id === widget.projectId)
      : undefined;
  if (supportsProject && widget.projectId && !selected)
    return (
      <EmptyState title="선택한 프로젝트가 없어요">
        <p>위젯 설정에서 프로젝트를 다시 선택해 주세요.</p>
      </EmptyState>
    );
  const projects = selected ? [selected] : props.projects.filter((p) => !p.archived);
  return (
    <>
      {selected && (
        <Button onClick={() => props.onProjectOpen(selected.id)}>{selected.name} 상세 보기</Button>
      )}
      {widgetRenderers[widget.type]({
        ...props,
        projects,
        widget: selected ? { ...widget, scope: 'all' } : widget,
        tasks: selected ? props.tasks.filter((t) => t.projectId === selected.id) : props.tasks,
        journals: selected
          ? props.journals.filter((j) => j.projectId === selected.id)
          : props.journals,
      })}
    </>
  );
}
