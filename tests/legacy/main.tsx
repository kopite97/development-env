import React from 'react';
import ReactDOM from 'react-dom/client';
import { AppProviders } from '../../src/app/AppProviders';
import { AppLayout } from '../../src/app/layouts/AppLayout';
import { PageRouter } from '../../src/app/PageRouter';
import '../../src/app/styles/global.css';
import '../../src/shared/styles/tokens.css';
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppProviders>
      <AppLayout>
        <PageRouter />
      </AppLayout>
    </AppProviders>
  </React.StrictMode>,
);
