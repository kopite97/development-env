import { WidgetFrame } from '../features/dashboard/WidgetFrame';
import { ApiLinks } from '../features/links/ApiLinks';
import type { LinkStore, LinkFilter } from '../features/links/apiStore';
export function ServerLinkHome({
  store,
  category = 'all',
}: {
  store: LinkStore;
  category?: LinkFilter['category'];
}) {
  return (
    <div className="link-surface">
      <WidgetFrame
        widget={{ id: 'server-links', type: 'links', title: '빠른 링크', size: 'small' }}
        editing={false}
        index={3}
        total={4}
        dragging={false}
        onDrag={() => {}}
        onDrop={() => {}}
        onMove={() => {}}
        onEdit={() => {}}
        onRemove={() => {}}
      >
        <ApiLinks store={store} filter={{ category, query: '' }} />
      </WidgetFrame>
    </div>
  );
}
