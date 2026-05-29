import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { FactorData } from './types.js';
import { StockInfoCard } from './components/StockInfoCard/index.js';
import { MAIndicator } from './components/MAIndicator/index.js';
import { VolumeAnalysis } from './components/VolumeAnalysis/index.js';
import { CapitalFlow } from './components/CapitalFlow/index.js';
import { SignalSummary } from './components/SignalSummary/index.js';
import './styles.scss';

/**
 * 量化分析页面组件
 * @returns {JSX.Element} 量化分析页面
 */
export function QuantPage() {
  const [searchParams] = useSearchParams();
  const [symbol, setSymbol] = useState(searchParams.get('symbol') ?? '600519');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [factorData, setFactorData] = useState<FactorData | null>(null);

  /**
   * 执行因子计算分析
   */
  async function handleAnalyze() {
    if (!symbol.trim()) {
      setError('请输入股票代码');
      return;
    }

    setLoading(true);
    setError('');
    setFactorData(null);

    try {
      const response = await fetch(`/api/quant/${symbol.trim()}/analysis`);

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || `请求失败 (${response.status})`);
      }

      const result = await response.json();

      if (result.success && result.data) {
        setFactorData(result.data);
      } else {
        throw new Error(result.message || '数据解析失败');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '分析失败';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="quant-page">
      <header className="quant-header">
        <h1>量化因子分析</h1>
        <p>输入股票代码，获取多维度因子分析结果</p>
      </header>

      <section className="quant-search">
        <div className="search-form">
          <input
            type="text"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            placeholder="输入股票代码，如 600519"
            className="symbol-input"
            disabled={loading}
          />
          <button
            onClick={handleAnalyze}
            disabled={loading || !symbol.trim()}
            className="analyze-btn"
          >
            {loading ? '分析中...' : '开始分析'}
          </button>
        </div>

        {error && (
          <div className="error-message">
            <span className="error-icon">⚠️</span>
            {error}
          </div>
        )}
      </section>

      {factorData && (
        <section className="quant-results">
          <StockInfoCard data={factorData} />
          <MAIndicator data={factorData.ma} />
          <VolumeAnalysis data={factorData.volume} />
          <CapitalFlow data={factorData.capitalFlow} />
          <SignalSummary data={factorData.signals} />
        </section>
      )}
    </div>
  );
}

export default QuantPage;
