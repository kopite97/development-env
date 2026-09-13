import { WidgetFrame } from '../features/dashboard/WidgetFrame';
import { ApiLinks } from '../features/links/ApiLinks';
import type { LinkStore, LinkFilter } from '../features/links/apiStore';
export function ServerLinkHome({
  store,
  scope = 'all',
}: {
  store: LinkStore;
  scope?: LinkFilter['scope'];
}) {
  return (
    <div className="link-surface">
      <WidgetFrame
        widget={{ id: 'server-links', type: 'links', title: '빠른 링크', scope, size: 'small' }}
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
        <ApiLinks store={store} filter={{ scope, query: '' }} />
      </WidgetFrame>
    </div>
  );
}
