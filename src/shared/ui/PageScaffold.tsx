import type { ReactNode } from 'react';
import { useBlueprintPointer } from '../hooks/useBlueprintPointer';
import '../styles/page-heading.css';

export type PageScaffoldProps = {
  title: string;
  description: string;
  overview?: ReactNode;
  feedback?: ReactNode;
  filters?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
};

export function PageScaffold({
  title,
  description,
  overview,
  feedback,
  filters,
  actions,
  children,
}: PageScaffoldProps) {
  const blueprintRef = useBlueprintPointer();
  return (
    <>
      <div className="page-heading blueprint-surface" ref={blueprintRef}>
        <div>
          <div className="eyebrow">YOUR PERSONAL DEV SPACE</div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {actions && <div className="page-heading-actions">{actions}</div>}
      </div>
      {overview}
      {feedback}
      {filters}
      {children}
    </>
  );
}
