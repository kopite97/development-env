import { useEffect, useRef, type ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../../shared/ui/controls';
import { PageScaffold, type PageScaffoldProps } from '../../shared/ui/PageScaffold';

export function ProjectDetailLayout({
  title,
  onBack,
  actions,
  children,
  feedback,
}: {
  title: string;
  onBack: () => void;
  actions?: ReactNode;
  children: ReactNode;
  feedback?: PageScaffoldProps['feedback'];
}) {
  const region = useRef<HTMLDivElement>(null);
  useEffect(() => {
    region.current?.focus();
    window.scrollTo(0, 0);
  }, []);
  return (
    <div ref={region} tabIndex={-1} className="project-detail" aria-label="프로젝트 상세 페이지">
      <PageScaffold
        title={title}
        description="프로젝트 정보와 연결된 작업·개발 일지를 확인하세요."
        feedback={feedback}
        actions={
          <div className="heading-actions">
            <Button onClick={onBack}>
              <ArrowLeft size={16} />
              프로젝트 목록
            </Button>
            {actions}
          </div>
        }
      >
        {children}
      </PageScaffold>
    </div>
  );
}
