import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout.js';
import { KlineAnalysis } from './pages/KlineAnalysis.js';
import { BacktestPage } from './pages/Backtest/index.js';
import { QuantPage } from './pages/Quant';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

createRoot(rootElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/kline" replace />} />
          <Route path="/kline" element={<KlineAnalysis />} />
          <Route path="/quant" element={<QuantPage />} />
          <Route path="/backtest" element={<BacktestPage />} />
          <Route path="*" element={<Navigate to="/kline" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
