import { useWorkspace } from '../app/WorkspaceProvider';
import { Button, EmptyState } from '../components/ui';
import { PageScaffold } from '../layouts/PageScaffold';
export function NotFoundPage() {
  const { navigate } = useWorkspace();
  return (
    <PageScaffold
      title="페이지를 찾을 수 없어요"
      description="주소를 확인하거나 홈으로 이동해 주세요."
      showOverview={false}
      showFilters={false}
    >
      <EmptyState title="등록되지 않은 페이지 주소입니다">
        <Button onClick={() => navigate('나의 홈')}>홈으로 이동</Button>
      </EmptyState>
    </PageScaffold>
  );
}
