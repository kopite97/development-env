import type { PagePresentation } from './pageInputs';
import { Button, EmptyState } from '../shared/ui/controls';
import { PageScaffold } from '../shared/ui/PageScaffold';
export function NotFoundPage({ scaffold, onHome }: PagePresentation & { onHome: () => void }) {
  return (
    <PageScaffold
      {...scaffold}
      title="페이지를 찾을 수 없어요"
      description="주소를 확인하거나 홈으로 이동해 주세요."
      overview={null}
      filters={null}
    >
      <EmptyState title="등록되지 않은 페이지 주소입니다">
        <Button onClick={onHome}>홈으로 이동</Button>
      </EmptyState>
    </PageScaffold>
  );
}
