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
    />
  ),
  board: (p) => <TaskManager scope={p.widget.scope} />,
  deploy: (p) => <DeploymentStatus scope={p.widget.scope} onDetail={p.onDetail} />,
  links: (p) => <QuickLinks scope={p.widget.scope} />,
  journal: (p) => (
    <RecentJournals scope={p.widget.scope} journals={p.journals} onDetail={p.onDetail} />
  ),
  milestone: (p) => (
    <MilestoneList projects={p.projects} scope={p.widget.scope} onDetail={p.onDetail} />
  ),
};
