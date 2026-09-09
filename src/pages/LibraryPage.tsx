import { useState } from 'react';
import { Button } from '../components/ui';
import { LinkEditor } from '../features/links/LinkEditor';
import { useLinks } from '../features/links/LinksProvider';
import type { QuickLink } from '../features/links/model';
import { useWorkspace } from '../app/WorkspaceProvider';
import { PageScaffold } from '../layouts/PageScaffold';
import { QuickLinks } from '../features/links/QuickLinks';
export function LibraryPage() {
  const { filter, query, resetSearch } = useWorkspace();
  const { upsert } = useLinks();
  const [editing, setEditing] = useState<QuickLink | null | undefined>(undefined);
  return (
    <PageScaffold>
      <Button onClick={() => setEditing(null)}>링크 추가</Button>
      <div className="content-panel">
        <div className="panel-heading">
          <h2>개발 레퍼런스</h2>
          <p>공식 문서와 개발 도구를 모아 두었어요.</p>
        </div>
        <QuickLinks
          scope={filter}
          search={query}
          onReset={resetSearch}
          onAdd={() => setEditing(null)}
          onEdit={setEditing}
        />
      </div>
      {editing !== undefined && (
        <LinkEditor
          existing={editing ?? undefined}
          onClose={() => setEditing(undefined)}
          onSave={(link) => {
            if (!upsert(link)) return false;
            resetSearch();
            return true;
          }}
        />
      )}
    </PageScaffold>
  );
}
