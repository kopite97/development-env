import { AppProviders } from './AppProviders';
import { PageRouter } from './PageRouter';
import { AppLayout } from './layouts/AppLayout';

export function App() {
  return (
    <AppProviders>
      <AppLayout>
        <PageRouter />
      </AppLayout>
    </AppProviders>
  );
}
