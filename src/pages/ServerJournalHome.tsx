import { WidgetFrame } from '../features/dashboard/WidgetFrame';
import { ApiRecentJournals } from '../features/journal/ApiRecentJournals';
import type { JournalStore } from '../features/journal/apiStore';

export function ServerJournalHome({ store, limit = 3 }: { store: JournalStore; limit?: number }) {
  return (
    <div className="journal-home-surface">
      <WidgetFrame
        widget={{
          id: 'server-journal-recent',
          type: 'journal',
          title: '최근 개발 일지',
          scope: 'all',
          size: 'medium',
        }}
        editing={false}
        index={1}
        total={2}
        dragging={false}
        onDrag={() => {}}
        onDrop={() => {}}
        onMove={() => {}}
        onEdit={() => {}}
        onRemove={() => {}}
      >
        <ApiRecentJournals store={store} limit={limit} />
      </WidgetFrame>
    </div>
  );
}
