import {
  BookOpen,
  Check,
  ExternalLink,
  Layers3,
  Server,
  Timer,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import type { Task } from '../../data/demo';
import type { DetailHandler } from '../../types/ui';
import type { JournalEntry } from '../journal/model';
import { RecentJournals } from '../journal/RecentJournals';
import { QuickLinks } from '../links/QuickLinks';
import { MilestoneList } from '../milestones/MilestoneList';
import { DeploymentStatus } from '../operations/DeploymentStatus';
import { ProjectOverview } from '../projects/ProjectOverview';
import { TaskBoard } from '../tasks/TaskBoard';
import type { Widget, WidgetType } from './model';
export type WidgetProps = {
  widget: Widget;
  tasks: Task[];
  journals: JournalEntry[];
  onTaskChange: (id: string, status: Task['status']) => void;
  onDetail: DetailHandler;
};
export const registry: Record<
  WidgetType,
  {
    title: string;
    description: string;
    icon: LucideIcon;
    component: (props: WidgetProps) => ReactNode;
  }
> = {
  overview: {
    title: '프로젝트 한눈에 보기',
    description: '진행률과 작업 현황을 한곳에서 확인해요.',
    icon: Layers3,
    component: (p) => (
      <ProjectOverview scope={p.widget.scope} tasks={p.tasks} onDetail={p.onDetail} />
    ),
  },
  board: {
    title: '작업 보드',
    description: '할 일부터 완료까지 작업 흐름을 관리해요.',
    icon: Check,
    component: (p) => (
      <TaskBoard scope={p.widget.scope} tasks={p.tasks} onTaskChange={p.onTaskChange} />
    ),
  },
  deploy: {
    title: '운영 · 배포 현황',
    description: '서비스 상태와 최근 배포 버전을 확인해요.',
    icon: Server,
    component: (p) => <DeploymentStatus scope={p.widget.scope} onDetail={p.onDetail} />,
  },
  links: {
    title: '빠른 링크',
    description: '자주 사용하는 개발 도구로 이동해요.',
    icon: ExternalLink,
    component: (p) => <QuickLinks scope={p.widget.scope} />,
  },
  journal: {
    title: '최근 개발 일지',
    description: '개발 과정과 다음 할 일을 되짚어 봐요.',
    icon: BookOpen,
    component: (p) => (
      <RecentJournals scope={p.widget.scope} journals={p.journals} onDetail={p.onDetail} />
    ),
  },
  milestone: {
    title: '다가오는 마일스톤',
    description: '프로젝트의 다음 목표를 확인해요.',
    icon: Timer,
    component: (p) => <MilestoneList scope={p.widget.scope} onDetail={p.onDetail} />,
  },
};
