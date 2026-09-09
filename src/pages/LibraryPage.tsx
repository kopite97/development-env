import { useWorkspace } from '../app/WorkspaceProvider';
import { PageScaffold } from '../layouts/PageScaffold';
import { QuickLinks } from '../features/links/QuickLinks';
export function LibraryPage() {
  const { filter, query } = useWorkspace();
  return (
    <PageScaffold>
      <div className="content-panel">
        <div className="panel-heading">
          <h2>개발 레퍼런스</h2>
          <p>공식 문서와 개발 도구를 모아 두었어요.</p>
        </div>
        <QuickLinks scope={filter} search={query} />
      </div>
    </PageScaffold>
  );
}
