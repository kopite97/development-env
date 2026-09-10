import type { Scope } from '../features/projects/scope';
import type { PageScaffoldProps } from '../shared/ui/PageScaffold';

export type PagePresentation = {
  scaffold: Omit<PageScaffoldProps, 'children' | 'actions'>;
};

export type SearchInputs = {
  filter: Scope;
  query: string;
  onReset: () => void;
};

export type SearchActions = {
  onFilterChange: (scope: Scope) => void;
  onQueryChange: (query: string) => void;
};
