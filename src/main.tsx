import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './app/App';
import { StatsPage } from './app/StatsPage';
import './styles/app.css';

const isStatsRoute = window.location.pathname === '/stats';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isStatsRoute ? <StatsPage /> : <App />}
  </React.StrictMode>,
);
