import { useState } from 'react';
import { Button } from '../../shared/ui/controls';
import { LinkEditor } from './LinkEditor';
import { useLinks } from './LinksProvider';
import type { QuickLink } from './model';
import type { Scope } from '../projects/scope';
import { PageScaffold, type PageScaffoldProps } from '../../shared/ui/PageScaffold';
import { QuickLinks } from './QuickLinks';

export type LinkLibraryProps = {
  scaffold: Omit<PageScaffoldProps, 'children' | 'actions'>;
  filter: Scope;
  query: string;
  onReset: () => void;
};

export function LinkLibrary({ scaffold, filter, query, onReset: resetSearch }: LinkLibraryProps) {
  const { upsert } = useLinks();
  const [editing, setEditing] = useState<QuickLink | null | undefined>(undefined);
  return (
    <PageScaffold {...scaffold}>
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
