import { AppProviders } from './app/AppProviders';
import { PageRouter } from './app/PageRouter';
import { AppLayout } from './layouts/AppLayout';

export default function App() {
  return (
    <AppProviders>
      <AppLayout>
        <PageRouter />
      </AppLayout>
    </AppProviders>
  );
}
