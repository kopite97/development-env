import type { CategoryFilter } from '../features/projects/categoryFilter';
import { WidgetFrame } from '../features/dashboard/WidgetFrame';
import { ApiMilestoneList } from '../features/milestones/ApiMilestoneList';
import type { MilestoneStore } from '../features/milestones/apiStore';
import type { MilestoneMemory } from '../features/milestones/draftMemory';
import type { MilestoneProjectOptions } from '../features/milestones/projectOptions';
export function ServerMilestoneHome({
  store,
  options,
  memory,
  onNavigate,
  limit = 2,
  category = 'all',
  projectId,
}: {
  store: MilestoneStore;
  options: MilestoneProjectOptions;
  memory: MilestoneMemory;
  onNavigate: (path: string) => void;
  limit?: number;
  category?: CategoryFilter;
  projectId?: string;
}) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 20)
    throw new Error('Invalid Milestone widget limit');
  return (
    <div className="milestone-surface">
      <WidgetFrame
        widget={{
          id: 'server-milestones',
          type: 'milestone',
          title: '다가오는 마일스톤',
          size: 'small',
        }}
        editing={false}
        index={2}
        total={3}
        dragging={false}
        onDrag={() => {}}
        onDrop={() => {}}
        onMove={() => {}}
        onEdit={() => {}}
        onRemove={() => {}}
      >
        <ApiMilestoneList
          store={store}
          options={options}
          memory={memory}
          category={category}
          projectId={projectId}
          limit={limit}
          readOnly
          onNavigate={onNavigate}
        />
      </WidgetFrame>
    </div>
  );
}
