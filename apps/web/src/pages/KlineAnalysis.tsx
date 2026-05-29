import { FormEvent, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { StockAnalysisResponse } from '@share-stock-god/shared';
import { KLineChartPanel } from '../components/biz/KLineChartPanel.js';
import { SignalList } from '../components/biz/SignalList.js';
import { StatusBanner } from '../components/biz/StatusBanner.js';
import {
  fetchStockAnalysisWithRetry,
  createRequestState,
  resetRequestState,
  cancelRequest,
  type RequestState,
} from '../services/stockAnalysisClient.js';
import './KlineAnalysis.scss';

const DEFAULT_SYMBOL = '600519';

/**
 * 应用主页面，负责股票查询、结果展示与错误提示。
 * @returns {JSX.Element} 页面主视图
 */
export function KlineAnalysis() {
  const [searchParams] = useSearchParams();
  const initialSymbol = searchParams.get('symbol') ?? DEFAULT_SYMBOL;
  const [symbol, setSymbol] = useState(initialSymbol);
  const [analysis, setAnalysis] = useState<StockAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [retryInfo, setRetryInfo] = useState<{
    current: number;
    max: number;
  } | null>(null);

  // 使用 ref 来存储请求状态，避免重渲染问题
  const requestStateRef = useRef<RequestState>(createRequestState());
  // 用于存储 AbortController 以便取消请求
  const abortControllerRef = useRef<AbortController | null>(null);

  // 组件卸载时取消请求
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      cancelRequest(requestStateRef.current);
    };
  }, []);

  /**
   * 加载指定股票的分析结果并更新页面状态。
   * @param {string} nextSymbol 待查询的股票代码
   * @returns {Promise<void>} 无返回值
   */
  async function loadAnalysis(nextSymbol: string) {
    // 如果有正在进行的请求，先取消
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    cancelRequest(requestStateRef.current);

    // 重置状态
    resetRequestState(requestStateRef.current);
    abortControllerRef.current = new AbortController();

    setLoading(true);
    setErrorMessage('');
    setRetryInfo(null);

    try {
      await fetchStockAnalysisWithRetry(
        nextSymbol,
        requestStateRef.current,
        {
          onStart: () => {
            setLoading(true);
          },
          onSuccess: (data) => {
            setAnalysis(data);
            setErrorMessage('');
            setRetryInfo(null);
          },
          onError: (error) => {
            // 检查是否是因为取消而报错
            if (
              error.message.includes('cancel') ||
              error.message.includes('abort')
            ) {
              return;
            }
            setErrorMessage(error.message);
            setAnalysis(null);
          },
          onRetry: (current, max) => {
            setRetryInfo({ current, max });
          },
          onCancel: () => {
            setLoading(false);
            setRetryInfo(null);
          },
          onFinally: () => {
            setLoading(false);
            abortControllerRef.current = null;
          },
        },
        {
          maxRetries: 3,
          retryDelay: 1000,
          backoffMultiplier: 1,
        }
      );
    } catch {
      // 错误已经在 onError 回调中处理
    }
  }

  /**
   * 取消当前正在进行的请求
   */
  function handleCancel() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    cancelRequest(requestStateRef.current);
    setLoading(false);
    setRetryInfo(null);
  }

  /**
   * 处理股票查询表单提交。
   * @param {FormEvent<HTMLFormElement>} event 表单提交事件
   * @returns {void} 无返回值
   */
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadAnalysis(symbol);
  }

  return (
    <main className="kline-page">
      <section className="toolbar">
        <div>
          <h1>A 股 K 线信号识别</h1>
          <p>查询近 60 个交易日日 K，并标记相应的信号。</p>
        </div>
        <form className="searchForm" onSubmit={handleSubmit}>
          <input
            aria-label="股票代码"
            inputMode="numeric"
            maxLength={9}
            onChange={(event) => setSymbol(event.target.value)}
            placeholder="例如 600519"
            value={symbol}
            disabled={loading}
          />
          {loading ? (
            <button
              type="button"
              onClick={handleCancel}
              className="cancelButton"
            >
              取消
            </button>
          ) : (
            <button type="submit">查询</button>
          )}
        </form>
      </section>

      <StatusBanner
        retryInfo={retryInfo}
        errorMessage={errorMessage}
        showLoading={loading}
        onCancel={handleCancel}
      />

      <section className="contentGrid">
        <div className="chartPanel">
          {analysis ? (
            <KLineChartPanel
              klines={analysis.klines}
              signals={analysis.signals}
              stockName={analysis.name}
              stockSymbol={analysis.symbol}
              dataSource={analysis.source}
            />
          ) : (
            <div className="panelHeader">
              <div>
                <h2>K 线图</h2>
                <p>等待查询结果</p>
              </div>
            </div>
          )}
        </div>

        <aside className="sidePanel">
          <div className="panelHeader">
            <div>
              <h2>信号列表</h2>
              <p>技术信号仅作为形态提示</p>
            </div>
            <span>{analysis?.signals.length ?? 0}</span>
          </div>
          <SignalList signals={analysis?.signals ?? []} />
        </aside>
      </section>
    </main>
  );
}
