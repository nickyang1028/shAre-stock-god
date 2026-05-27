import { useState } from 'react';
import './QuantPage.scss';

/**
 * 因子数据类型定义
 */
type FactorData = {
  symbol: string;
  name: string;
  latestPrice: number;
  change: number;
  changePercent: number;
  ma: {
    ma5: number;
    ma10: number;
    ma20: number;
    ma60: number;
    trend: 'up' | 'down' | 'sideway';
  };
  volume: {
    latestVolume: number;
    avgVolume5: number;
    volumeRatio: number;
    trend: 'up' | 'down' | 'stable';
  };
  capitalFlow: {
    mainForceInflow: number;
    mainForceOutflow: number;
    netInflow: number;
    inflowRatio: number;
    signal: 'inflow' | 'outflow' | 'neutral';
  };
  signals: {
    maGoldenCross: boolean;
    maDeadCross: boolean;
    volumeBreakout: boolean;
    capitalInflowSignal: boolean;
  };
};

/**
 * 量化分析页面组件
 * @returns {JSX.Element} 量化分析页面
 */
export function QuantPage() {
  const [symbol, setSymbol] = useState('600519');
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

  /**
   * 格式化数字显示
   */
  function formatNumber(num: number, decimals: number = 2): string {
    if (!Number.isFinite(num)) return '-';
    return num.toFixed(decimals);
  }

  /**
   * 格式化成交量
   */
  function formatVolume(volume: number): string {
    if (volume >= 100000000) {
      return `${(volume / 100000000).toFixed(2)}亿`;
    }
    if (volume >= 10000) {
      return `${(volume / 10000).toFixed(2)}万`;
    }
    return volume.toString();
  }

  /**
   * 获取趋势样式类名
   */
  function getTrendClass(trend: 'up' | 'down' | 'sideway' | 'stable'): string {
    switch (trend) {
      case 'up':
        return 'trend-up';
      case 'down':
        return 'trend-down';
      default:
        return 'trend-neutral';
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
          {/* 基础信息卡片 */}
          <div className="info-card">
            <div className="stock-header">
              <h2>{factorData.name}</h2>
              <span className="stock-code">{factorData.symbol}</span>
            </div>
            <div className="price-info">
              <span className="current-price">
                ¥{formatNumber(factorData.latestPrice)}
              </span>
              <span
                className={`change ${
                  factorData.change >= 0 ? 'positive' : 'negative'
                }`}
              >
                {factorData.change >= 0 ? '+' : ''}
                {formatNumber(factorData.change)} (
                {factorData.changePercent >= 0 ? '+' : ''}
                {formatNumber(factorData.changePercent * 100)}%)
              </span>
            </div>
          </div>

          {/* MA 移动平均线 */}
          <div className="factor-card">
            <h3>移动平均线 (MA)</h3>
            <div className="ma-grid">
              <div className="ma-item">
                <span className="ma-label">MA5</span>
                <span className="ma-value">
                  {formatNumber(factorData.ma.ma5)}
                </span>
              </div>
              <div className="ma-item">
                <span className="ma-label">MA10</span>
                <span className="ma-value">
                  {formatNumber(factorData.ma.ma10)}
                </span>
              </div>
              <div className="ma-item">
                <span className="ma-label">MA20</span>
                <span className="ma-value">
                  {formatNumber(factorData.ma.ma20)}
                </span>
              </div>
              <div className="ma-item">
                <span className="ma-label">MA60</span>
                <span className="ma-value">
                  {formatNumber(factorData.ma.ma60)}
                </span>
              </div>
            </div>
            <div className={`trend-badge ${getTrendClass(factorData.ma.trend)}`}>
              MA趋势:{' '}
              {factorData.ma.trend === 'up'
                ? '上涨'
                : factorData.ma.trend === 'down'
                ? '下跌'
                : '盘整'}
            </div>
          </div>

          {/* 成交量因子 */}
          <div className="factor-card">
            <h3>成交量分析</h3>
            <div className="volume-stats">
              <div className="stat-row">
                <span className="stat-label">最新成交量</span>
                <span className="stat-value">
                  {formatVolume(factorData.volume.latestVolume)}
                </span>
              </div>
              <div className="stat-row">
                <span className="stat-label">5日均量</span>
                <span className="stat-value">
                  {formatVolume(factorData.volume.avgVolume5)}
                </span>
              </div>
              <div className="stat-row">
                <span className="stat-label">量比</span>
                <span
                  className={`stat-value ${
                    factorData.volume.volumeRatio > 2
                      ? 'highlight'
                      : ''
                  }`}
                >
                  {formatNumber(factorData.volume.volumeRatio)}x
                  {factorData.volume.volumeRatio > 2 && ' 🔥'}
                </span>
              </div>
            </div>
            <div
              className={`trend-badge ${getTrendClass(
                factorData.volume.trend
              )}`}
            >
              量能趋势:{' '}
              {factorData.volume.trend === 'up'
                ? '放大'
                : factorData.volume.trend === 'down'
                ? '萎缩'
                : '平稳'}
            </div>
          </div>

          {/* 资金流向因子 */}
          <div className="factor-card">
            <h3>资金流向估算</h3>
            <div className="capital-flow-stats">
              <div className="flow-row inflow">
                <span className="flow-label">主力流入</span>
                <span className="flow-value">
                  ¥{formatNumber(factorData.capitalFlow.mainForceInflow)}万
                </span>
              </div>
              <div className="flow-row outflow">
                <span className="flow-label">主力流出</span>
                <span className="flow-value">
                  ¥{formatNumber(factorData.capitalFlow.mainForceOutflow)}万
                </span>
              </div>
              <div
                className={`flow-row net ${
                  factorData.capitalFlow.netInflow >= 0 ? 'positive' : 'negative'
                }`}
              >
                <span className="flow-label">净流入</span>
                <span className="flow-value">
                  {factorData.capitalFlow.netInflow >= 0 ? '+' : ''}
                  ¥{formatNumber(factorData.capitalFlow.netInflow)}万
                </span>
              </div>
            </div>
            <div className="inflow-ratio">
              <div className="ratio-bar">
                <div
                  className="ratio-fill"
                  style={{
                    width: `${Math.min(
                      factorData.capitalFlow.inflowRatio,
                      100
                    )}%`,
                  }}
                />
              </div>
              <span className="ratio-text">
                流入占比: {formatNumber(factorData.capitalFlow.inflowRatio)}%
              </span>
            </div>
            <div
              className={`signal-badge ${factorData.capitalFlow.signal}`}
            >
              {factorData.capitalFlow.signal === 'inflow'
                ? '💰 资金流入'
                : factorData.capitalFlow.signal === 'outflow'
                ? '📉 资金流出'
                : '⚖️ 资金平衡'}
            </div>
          </div>

          {/* 技术信号汇总 */}
          <div className="factor-card signals-card">
            <h3>技术信号汇总</h3>
            <div className="signals-grid">
              <div
                className={`signal-item ${
                  factorData.signals.maGoldenCross ? 'active' : ''
                }`}
              >
                <span className="signal-icon">🌟</span>
                <span className="signal-text">MA金叉</span>
                <span className="signal-status">
                  {factorData.signals.maGoldenCross ? '触发' : '未触发'}
                </span>
              </div>
              <div
                className={`signal-item ${
                  factorData.signals.maDeadCross ? 'active danger' : ''
                }`}
              >
                <span className="signal-icon">⚠️</span>
                <span className="signal-text">MA死叉</span>
                <span className="signal-status">
                  {factorData.signals.maDeadCross ? '触发' : '未触发'}
                </span>
              </div>
              <div
                className={`signal-item ${
                  factorData.signals.volumeBreakout ? 'active' : ''
                }`}
              >
                <span className="signal-icon">🔥</span>
                <span className="signal-text">量能突破</span>
                <span className="signal-status">
                  {factorData.signals.volumeBreakout ? '触发' : '未触发'}
                </span>
              </div>
              <div
                className={`signal-item ${
                  factorData.signals.capitalInflowSignal ? 'active' : ''
                }`}
              >
                <span className="signal-icon">💰</span>
                <span className="signal-text">资金流入</span>
                <span className="signal-status">
                  {factorData.signals.capitalInflowSignal ? '触发' : '未触发'}
                </span>
              </div>
            </div>
          </div>

          {/* 数据来源 */}
          <div className="data-source">
            <span>数据来源: {factorData.source === 'tushare' ? 'Tushare' : '东方财富'}</span>
            <span>计算时间: {new Date(factorData.timestamp).toLocaleString()}</span>
          </div>
        </section>
      )}
    </div>
  );
}
