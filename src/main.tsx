import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './app/App';
import { DocsPage } from './app/DocsPage';
import { StatsPage } from './app/StatsPage';
import { VmPage } from './app/VmPage';
import './styles/app.css';

const pathname = window.location.pathname.replace(/\/+$/, '');
const isStatsRoute = pathname.endsWith('/stats');
const isDocsRoute = pathname.endsWith('/docs');
const isVmRoute = pathname.endsWith('/vm');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isStatsRoute ? <StatsPage /> : isDocsRoute ? <DocsPage /> : isVmRoute ? <VmPage /> : <App />}
  </React.StrictMode>,
);
