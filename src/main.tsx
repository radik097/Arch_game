import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './app/App';
import { StatsPage } from './app/StatsPage';
import './styles/app.css';

const isStatsRoute = window.location.pathname === '/stats';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      {isStatsRoute ? <StatsPage /> : <App />}
    </BrowserRouter>
  </React.StrictMode>,
);
