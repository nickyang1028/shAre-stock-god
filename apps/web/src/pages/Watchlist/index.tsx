import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { FactorData } from '../Quant/types.js';
import { formatNumber, formatPercent } from '../Quant/utils.js';
import {
  parseSymbolInput,
  readWatchlist,
  writeWatchlist,
  type WatchlistStock,
} from './storage.js';
import './styles.scss';

type WatchlistRow = {
  /** 股票代码 */
  symbol: string;
  /** 加载状态 */
  loading: boolean;
  /** 错误消息 */
  error: string;
  /** 因子分析数据 */
  data: FactorData | null;
};

/**
 * 自选股看板页面。
 * @returns {JSX.Element} 自选股看板视图
 */
export function WatchlistPage() {
  const [stocks, setStocks] = useState<WatchlistStock[]>(() => readWatchlist());
  const [inputValue, setInputValue] = useState('');
  const [rows, setRows] = useState<Record<string, WatchlistRow>>({});
  const [message, setMessage] = useState('');
  const [openMenuSymbol, setOpenMenuSymbol] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ left: number; top: number } | null>(null);
  const hasAutoRefreshedRef = useRef(false);

  const orderedRows = useMemo(
    () => stocks.map((stock) => rows[stock.symbol] ?? createEmptyRow(stock.symbol)),
    [stocks, rows]
  );

  useEffect(() => {
    writeWatchlist(stocks);
  }, [stocks]);

  useEffect(() => {
    /**
     * 点击菜单外部时关闭展开菜单。
     * @param {MouseEvent} event 鼠标事件
     * @returns {void} 无返回值
     */
    function handleDocumentClick(event: MouseEvent): void {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      if (target.closest('.watchlist-menu-wrap') === null) {
        setOpenMenuSymbol(null);
        setMenuPosition(null);
      }
    }

    document.addEventListener('mousedown', handleDocumentClick);
    return () => {
      document.removeEventListener('mousedown', handleDocumentClick);
    };
  }, []);

  useEffect(() => {
    if (hasAutoRefreshedRef.current || stocks.length === 0) {
      return;
    }

    // 副作用说明：进入自选看板时自动刷新一次，避免用户看到空数据表。
    hasAutoRefreshedRef.current = true;
    void Promise.all(stocks.map((stock) => refreshStock(stock.symbol)));
  }, [stocks]);

  /**
   * 添加用户输入的自选股。
   * @returns {void} 无返回值
   */
  function handleAddStocks(): void {
    const symbols = parseSymbolInput(inputValue);
    if (symbols.length === 0) {
      setMessage('请输入至少一个股票代码');
      return;
    }

    setStocks((currentStocks) => {
      const existingSymbols = new Set(currentStocks.map((stock) => stock.symbol));
      const nextStocks = [...currentStocks];
      symbols.forEach((symbol) => {
        if (!existingSymbols.has(symbol)) {
          nextStocks.push({ symbol });
          existingSymbols.add(symbol);
        }
      });
      return nextStocks;
    });
    setInputValue('');
    setMessage(`已添加 ${symbols.length} 个代码，重复代码会自动忽略`);
  }

  /**
   * 删除一只自选股。
   * @param {string} symbol 股票代码
   * @returns {void} 无返回值
   */
  function handleRemoveStock(symbol: string): void {
    setStocks((currentStocks) => currentStocks.filter((stock) => stock.symbol !== symbol));
    setRows((currentRows) => {
      const nextRows = { ...currentRows };
      delete nextRows[symbol];
      return nextRows;
    });
  }

  /**
   * 清空全部自选股。
   * @returns {void} 无返回值
   */
  function handleClearStocks(): void {
    setStocks([]);
    setRows({});
    setOpenMenuSymbol(null);
    setMessage('已清空自选股');
  }

  /**
   * 切换行内查看菜单。
   * @param {string} symbol 股票代码
   * @returns {void} 无返回值
   */
  function handleToggleMenu(symbol: string, element: HTMLElement): void {
    setOpenMenuSymbol((currentSymbol) => {
      if (currentSymbol === symbol) {
        setMenuPosition(null);
        return null;
      }

      const rect = element.getBoundingClientRect();
      setMenuPosition({
        left: rect.left,
        top: rect.bottom + 6,
      });
      return symbol;
    });
  }

  /**
   * 刷新全部自选股分析数据。
   * @returns {Promise<void>} 无返回值
   */
  async function handleRefreshAll(): Promise<void> {
    setMessage('');
    await Promise.all(stocks.map((stock) => refreshStock(stock.symbol)));
  }

  /**
   * 刷新单只股票分析数据。
   * @param {string} symbol 股票代码
   * @returns {Promise<void>} 无返回值
   */
  async function refreshStock(symbol: string): Promise<void> {
    setRows((currentRows) => ({
      ...currentRows,
      [symbol]: { ...createEmptyRow(symbol), loading: true },
    }));

    try {
      const response = await fetch(`/api/quant/${encodeURIComponent(symbol)}/analysis?limit=120`);
      const payload = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        data?: FactorData;
        message?: string;
      };

      if (!response.ok || !payload.success || payload.data === undefined) {
        throw new Error(payload.message ?? `请求失败 (${response.status})`);
      }

      setRows((currentRows) => ({
        ...currentRows,
        [symbol]: {
          symbol,
          loading: false,
          error: '',
          data: payload.data ?? null,
        },
      }));
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '刷新失败';
      setRows((currentRows) => ({
        ...currentRows,
        [symbol]: {
          symbol,
          loading: false,
          error: errorMessage,
          data: null,
        },
      }));
    }
  }

  return (
    <main className="watchlist-page">
      <header className="watchlist-header">
        <div>
          <h1>自选股看板</h1>
          <p>手动添加自选股，批量查看价格、趋势、量能、资金流和信号状态。</p>
        </div>
        <button
          type="button"
          className="watchlist-refresh-btn"
          disabled={stocks.length === 0}
          onClick={() => void handleRefreshAll()}
        >
          刷新看板
        </button>
      </header>

      <section className="watchlist-editor">
        <textarea
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          placeholder="输入股票代码，支持逗号、空格或换行分隔，例如：600519, 000001, 300750"
        />
        <div className="watchlist-actions">
          <button type="button" onClick={handleAddStocks}>添加自选</button>
          <button type="button" className="secondary" onClick={handleClearStocks} disabled={stocks.length === 0}>
            清空自选
          </button>
        </div>
        {message && <div className="watchlist-message">{message}</div>}
      </section>

      <section className="watchlist-table-card">
        <div className="watchlist-table-wrap">
          <table className="watchlist-table">
            <thead>
              <tr>
                <th>代码</th>
                <th>名称</th>
                <th>最新价</th>
                <th>涨跌幅</th>
                <th>MA趋势</th>
                <th>量比</th>
                <th>资金流</th>
                <th>信号</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {orderedRows.length > 0 ? (
                orderedRows.map((row) => (
                  <tr key={row.symbol}>
                    <td>{row.symbol}</td>
                    <td>{row.data?.name ?? '-'}</td>
                    <td>{row.data ? formatNumber(row.data.latestPrice) : '-'}</td>
                    <td className={getChangeClass(row.data?.changePercent ?? 0)}>
                      {row.data ? formatPercent(row.data.changePercent) : '-'}
                    </td>
                    <td>{row.data ? formatTrend(row.data.ma.trend) : '-'}</td>
                    <td>{row.data ? formatNumber(row.data.volume.volumeRatio) : '-'}</td>
                    <td>{row.data ? formatCapitalFlow(row.data.capitalFlow.signal) : '-'}</td>
                    <td>{row.loading ? '加载中...' : row.error || formatSignals(row.data)}</td>
                    <td>
                      <div className="watchlist-row-actions">
                        <div className="watchlist-menu-wrap">
                          <button
                            type="button"
                            className="watchlist-menu-trigger"
                            aria-expanded={openMenuSymbol === row.symbol}
                            onClick={(event) => {
                              event.stopPropagation();
                              handleToggleMenu(row.symbol, event.currentTarget);
                            }}
                          >
                            查看
                          </button>
                          {openMenuSymbol === row.symbol && menuPosition !== null && (
                            <div
                              className="watchlist-menu"
                              style={{ left: menuPosition.left, top: menuPosition.top }}
                            >
                              <Link to={`/kline?symbol=${encodeURIComponent(row.symbol)}`}>K线信号</Link>
                              <Link to={`/quant?symbol=${encodeURIComponent(row.symbol)}`}>因子分析</Link>
                              <Link to={`/backtest?symbol=${encodeURIComponent(row.symbol)}`}>策略回测</Link>
                            </div>
                          )}
                        </div>
                        <button type="button" onClick={() => void refreshStock(row.symbol)}>刷新</button>
                        <button type="button" className="danger" onClick={() => handleRemoveStock(row.symbol)}>删除</button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="watchlist-empty" colSpan={9}>暂无自选股，请先添加股票代码</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

/**
 * 创建空行数据。
 * @param {string} symbol 股票代码
 * @returns {WatchlistRow} 空行数据
 */
function createEmptyRow(symbol: string): WatchlistRow {
  return {
    symbol,
    loading: false,
    error: '',
    data: null,
  };
}

/**
 * 格式化趋势文案。
 * @param {'up' | 'down' | 'sideway'} trend 趋势值
 * @returns {string} 趋势文案
 */
function formatTrend(trend: 'up' | 'down' | 'sideway'): string {
  if (trend === 'up') {
    return '上行';
  }

  if (trend === 'down') {
    return '下行';
  }

  return '震荡';
}

/**
 * 格式化资金流文案。
 * @param {'inflow' | 'outflow' | 'neutral'} signal 资金流信号
 * @returns {string} 资金流文案
 */
function formatCapitalFlow(signal: 'inflow' | 'outflow' | 'neutral'): string {
  if (signal === 'inflow') {
    return '流入';
  }

  if (signal === 'outflow') {
    return '流出';
  }

  return '中性';
}

/**
 * 格式化信号摘要。
 * @param {FactorData | null} data 因子数据
 * @returns {string} 信号摘要
 */
function formatSignals(data: FactorData | null): string {
  if (data === null) {
    return '-';
  }

  const signals = [
    data.signals.maGoldenCross ? '均线金叉' : '',
    data.signals.maDeadCross ? '均线死叉' : '',
    data.signals.volumeBreakout ? '放量' : '',
    data.signals.capitalInflowSignal ? '资金流入' : '',
  ].filter(Boolean);

  return signals.length > 0 ? signals.join(' / ') : '暂无';
}

/**
 * 获取涨跌样式。
 * @param {number} changePercent 涨跌幅
 * @returns {string} 样式类名
 */
function getChangeClass(changePercent: number): string {
  if (changePercent > 0) {
    return 'watchlist-up';
  }

  if (changePercent < 0) {
    return 'watchlist-down';
  }

  return '';
}

export default WatchlistPage;
