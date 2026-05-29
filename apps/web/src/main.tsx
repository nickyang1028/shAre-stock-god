import React, { lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout.js';

const KlineAnalysis = lazy(() => import('./pages/KlineAnalysis.js').then((module) => ({ default: module.KlineAnalysis })));
const BoardsPage = lazy(() => import('./pages/Boards/index.js').then((module) => ({ default: module.BoardsPage })));
const DailyCenterPage = lazy(() => import('./pages/DailyCenter/index.js').then((module) => ({ default: module.DailyCenterPage })));
const DailyReportPage = lazy(() => import('./pages/DailyReport/index.js').then((module) => ({ default: module.DailyReportPage })));
const QuantPage = lazy(() => import('./pages/Quant').then((module) => ({ default: module.QuantPage })));
const SignalStatsPage = lazy(() => import('./pages/SignalStats/index.js').then((module) => ({ default: module.SignalStatsPage })));
const StrategyPage = lazy(() => import('./pages/Strategy/index.js').then((module) => ({ default: module.StrategyPage })));

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

type LegacyRedirectProps = {
  /** 目标路径 */
  pathname: string;
  /** 默认页签 */
  tab: string;
};

/**
 * 保留旧入口查询参数并重定向到组合页。
 * @param {LegacyRedirectProps} props 重定向属性
 * @returns {JSX.Element} 重定向组件
 */
function LegacyRedirect(props: LegacyRedirectProps) {
  const { pathname, tab } = props;
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  searchParams.set('tab', tab);

  return <Navigate to={`${pathname}?${searchParams.toString()}`} replace />;
}

createRoot(rootElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <Suspense fallback={<div style={{ padding: 24, color: '#94a3b8' }}>页面加载中...</div>}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Navigate to="/daily-center" replace />} />
            <Route path="/daily-center" element={<DailyCenterPage />} />
            <Route path="/kline" element={<KlineAnalysis />} />
            <Route path="/quant" element={<QuantPage />} />
            <Route path="/boards" element={<BoardsPage />} />
            <Route path="/watchlist" element={<LegacyRedirect pathname="/boards" tab="watchlist" />} />
            <Route path="/holdings" element={<LegacyRedirect pathname="/boards" tab="holdings" />} />
            <Route path="/signal-stats" element={<SignalStatsPage />} />
            <Route path="/strategy" element={<StrategyPage />} />
            <Route path="/strategy-stability" element={<LegacyRedirect pathname="/strategy" tab="stability" />} />
            <Route path="/daily-report" element={<DailyReportPage />} />
            <Route path="/backtest" element={<LegacyRedirect pathname="/strategy" tab="backtest" />} />
            <Route path="*" element={<Navigate to="/kline" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  </React.StrictMode>
);
