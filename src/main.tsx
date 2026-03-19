import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './app/App';
import { StatsPage } from './app/StatsPage';
import './styles/app.css';

const base = import.meta.env.BASE_URL;
const isStatsRoute = window.location.pathname.replace(/\/+$/, '') === (base + 'stats').replace(/\/+$/, '').replace(/\/+/g, '/');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename={base}>
      {isStatsRoute ? <StatsPage /> : <App />}
    </BrowserRouter>
  </React.StrictMode>,
);
