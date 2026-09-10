import type { ReactNode } from 'react';

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
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">YOUR PERSONAL DEV SPACE</div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {actions}
      </div>
      {overview}
      {feedback}
      {filters}
      {children}
    </>
  );
}
