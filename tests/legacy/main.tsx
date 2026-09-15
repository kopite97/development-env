import React from 'react';
import ReactDOM from 'react-dom/client';
import { AppProviders } from '../../src/app/AppProviders';
import { LegacyLayout } from './LegacyLayout';
import { PageRouter } from '../../src/app/PageRouter';
import '../../src/app/styles/global.css';
import '../../src/shared/styles/tokens.css';
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppProviders>
      <LegacyLayout>
        <PageRouter />
      </LegacyLayout>
    </AppProviders>
  </React.StrictMode>,
);
