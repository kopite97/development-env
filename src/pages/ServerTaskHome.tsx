import { WidgetFrame } from '../features/dashboard/WidgetFrame';
import { ApiTaskManager } from '../features/tasks/ApiTaskManager';
import type { TaskStore } from '../features/tasks/apiStore';
import type { TaskProjectOptions } from '../features/tasks/projectOptions';
import type { TaskMemory } from '../features/tasks/draftMemory';
export function ServerTaskHome({
  store,
  options,
  memory,
  limit = 20,
}: {
  store: TaskStore;
  options: TaskProjectOptions;
  memory: TaskMemory;
  limit?: number;
}) {
  return (
    <div className="task-surface">
      <WidgetFrame
        widget={{
          id: 'server-task-board',
          type: 'board',
          title: '작업 보드',
          scope: 'unity',
          size: 'wide',
        }}
        editing={false}
        index={0}
        total={1}
        dragging={false}
        onDrag={() => {}}
        onDrop={() => {}}
        onMove={() => {}}
        onEdit={() => {}}
        onRemove={() => {}}
      >
        <ApiTaskManager
          store={store}
          options={options}
          memory={memory}
          filter={{ scope: 'unity', query: '', projectStatus: 'all' }}
          limit={limit}
        />
      </WidgetFrame>
    </div>
  );
}
