import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { StatusNotice } from '../../components/basic/StatusNotice/index.js';
import type { FactorData } from '../Quant/types.js';
import { formatNumber, formatPercent } from '../Quant/utils.js';
import {
  addWatchlistStock,
  clearWatchlist,
  parseSymbolInput,
  readWatchlist,
  removeWatchlistStock,
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

type WatchlistFilter = 'all' | 'up' | 'down' | 'signal' | 'inflow' | 'ma_up' | 'focus';

type WatchlistSort =
  | 'default'
  | 'focus_desc'
  | 'change_desc'
  | 'volume_desc'
  | 'price_desc'
  | 'signal_first';

type WatchlistStats = {
  /** 自选股数量 */
  total: number;
  /** 上涨数量 */
  upCount: number;
  /** 下跌数量 */
  downCount: number;
  /** 有信号数量 */
  signalCount: number;
  /** 资金流入数量 */
  inflowCount: number;
  /** 高关注数量 */
  focusCount: number;
};

type FocusInfo = {
  /** 关注分 */
  score: number;
  /** 关注原因 */
  reasons: string[];
};

type WatchlistPageProps = {
  /** 是否隐藏页面标题 */
  hideHeader?: boolean;
};

const WATCHLIST_FILTERS: Array<{ label: string; value: WatchlistFilter }> = [
  { label: '全部', value: 'all' },
  { label: '上涨', value: 'up' },
  { label: '下跌', value: 'down' },
  { label: '有信号', value: 'signal' },
  { label: '资金流入', value: 'inflow' },
  { label: 'MA上行', value: 'ma_up' },
  { label: '高关注', value: 'focus' },
];

const WATCHLIST_SORTS: Array<{ label: string; value: WatchlistSort }> = [
  { label: '默认顺序', value: 'default' },
  { label: '关注度优先', value: 'focus_desc' },
  { label: '涨跌幅优先', value: 'change_desc' },
  { label: '量比优先', value: 'volume_desc' },
  { label: '最新价优先', value: 'price_desc' },
  { label: '信号优先', value: 'signal_first' },
];

/**
 * 自选股看板页面。
 * @returns {JSX.Element} 自选股看板视图
 */
export function WatchlistPage(props: WatchlistPageProps) {
  const { hideHeader = false } = props;
  const [stocks, setStocks] = useState<WatchlistStock[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [rows, setRows] = useState<Record<string, WatchlistRow>>({});
  const [message, setMessage] = useState('');
  const [lastRefreshTime, setLastRefreshTime] = useState<number | null>(null);
  const [openMenuSymbol, setOpenMenuSymbol] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ left: number; top: number } | null>(null);
  const [activeFilter, setActiveFilter] = useState<WatchlistFilter>('all');
  const [activeSort, setActiveSort] = useState<WatchlistSort>('default');
  const hasAutoRefreshedRef = useRef(false);
  const hasLoadedStocksRef = useRef(false);

  const baseRows = useMemo(
    () => stocks.map((stock) => rows[stock.symbol] ?? createEmptyRow(stock.symbol)),
    [stocks, rows]
  );

  const stats = useMemo(() => createWatchlistStats(baseRows), [baseRows]);

  const orderedRows = useMemo(
    () => sortRows(filterRows(baseRows, activeFilter), activeSort),
    [activeFilter, activeSort, baseRows]
  );

  useEffect(() => {
    void loadWatchlistStocks();
  }, []);

  useEffect(() => {
    if (!hasLoadedStocksRef.current) {
      return;
    }

    void writeWatchlist(stocks);
  }, [stocks]);

  /**
   * 加载本地数据库自选股。
   * @returns {Promise<void>} 无返回值
   */
  async function loadWatchlistStocks(): Promise<void> {
    const storedStocks = await readWatchlist();
    hasLoadedStocksRef.current = true;
    setStocks(storedStocks);
  }

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
   * @returns {Promise<void>} 无返回值
   */
  async function handleAddStocks(): Promise<void> {
    const symbols = parseSymbolInput(inputValue);
    if (symbols.length === 0) {
      setMessage('请输入至少一个股票代码');
      return;
    }

    const existingSymbols = new Set(stocks.map((stock) => stock.symbol));
    const newSymbols = symbols.filter((symbol) => !existingSymbols.has(symbol));
    const nextStocks = [
      ...stocks,
      ...newSymbols.map((symbol) => ({ symbol })),
    ];

    setStocks(nextStocks);
    await Promise.all(newSymbols.map(addWatchlistStock));
    setInputValue('');
    setMessage(`已添加 ${symbols.length} 个代码，重复代码会自动忽略`);
  }

  /**
   * 删除一只自选股。
   * @param {string} symbol 股票代码
   * @returns {Promise<void>} 无返回值
   */
  async function handleRemoveStock(symbol: string): Promise<void> {
    setStocks((currentStocks) => currentStocks.filter((stock) => stock.symbol !== symbol));
    await removeWatchlistStock(symbol);
    setRows((currentRows) => {
      const nextRows = { ...currentRows };
      delete nextRows[symbol];
      return nextRows;
    });
  }

  /**
   * 清空全部自选股。
   * @returns {Promise<void>} 无返回值
   */
  async function handleClearStocks(): Promise<void> {
    setStocks([]);
    await clearWatchlist();
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
    setLastRefreshTime(Date.now());
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
      {!hideHeader && (
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
      )}

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
        {message && <StatusNotice tone="success">{message}</StatusNotice>}
        {lastRefreshTime !== null && (
          <div className="watchlist-refresh-time">最后刷新：{formatDateTime(lastRefreshTime)}</div>
        )}
      </section>

      <section className="watchlist-dashboard">
        <div className="watchlist-stat-card">
          <span>自选股</span>
          <strong>{stats.total}</strong>
        </div>
        <div className="watchlist-stat-card up">
          <span>上涨</span>
          <strong>{stats.upCount}</strong>
        </div>
        <div className="watchlist-stat-card down">
          <span>下跌</span>
          <strong>{stats.downCount}</strong>
        </div>
        <div className="watchlist-stat-card signal">
          <span>有信号</span>
          <strong>{stats.signalCount}</strong>
        </div>
        <div className="watchlist-stat-card inflow">
          <span>资金流入</span>
          <strong>{stats.inflowCount}</strong>
        </div>
        <div className="watchlist-stat-card focus">
          <span>高关注</span>
          <strong>{stats.focusCount}</strong>
        </div>
      </section>

      <section className="watchlist-toolbar">
        <div className="watchlist-filter-tabs">
          {WATCHLIST_FILTERS.map((filter) => (
            <button
              type="button"
              className={activeFilter === filter.value ? 'active' : ''}
              key={filter.value}
              onClick={() => setActiveFilter(filter.value)}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <label className="watchlist-sort-field">
          <span>排序</span>
          <select
            value={activeSort}
            onChange={(event) => setActiveSort(event.target.value as WatchlistSort)}
          >
            {WATCHLIST_SORTS.map((sort) => (
              <option key={sort.value} value={sort.value}>
                {sort.label}
              </option>
            ))}
          </select>
        </label>
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
                <th>关注度</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {orderedRows.length > 0 ? (
                orderedRows.map((row) => (
                  <tr className={getRowClassName(row)} key={row.symbol}>
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
                    <td>{formatFocusInfo(row)}</td>
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
                              <Link to={`/strategy?tab=backtest&symbol=${encodeURIComponent(row.symbol)}`}>策略回测</Link>
                            </div>
                          )}
                        </div>
                        <button type="button" onClick={() => void refreshStock(row.symbol)}>刷新</button>
                        <button type="button" className="danger" onClick={() => void handleRemoveStock(row.symbol)}>删除</button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="watchlist-empty" colSpan={10}>暂无自选股，请先添加股票代码</td>
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

/**
 * 格式化日期时间。
 * @param {number} timestamp 时间戳
 * @returns {string} 日期时间文本
 */
function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * 判断行是否存在关注信号。
 * @param {WatchlistRow} row 自选股行
 * @returns {boolean} 是否有信号
 */
function hasWatchSignal(row: WatchlistRow): boolean {
  const signals = row.data?.signals;
  if (signals === undefined) {
    return false;
  }

  return signals.maGoldenCross || signals.maDeadCross || signals.volumeBreakout || signals.capitalInflowSignal;
}

/**
 * 统计自选股看板摘要。
 * @param {WatchlistRow[]} rows 自选股行
 * @returns {WatchlistStats} 看板统计
 */
function createWatchlistStats(rows: WatchlistRow[]): WatchlistStats {
  return rows.reduce<WatchlistStats>(
    (stats, row) => {
      const data = row.data;
      if (data === null) {
        return stats;
      }

      return {
        total: stats.total,
        upCount: stats.upCount + (data.changePercent > 0 ? 1 : 0),
        downCount: stats.downCount + (data.changePercent < 0 ? 1 : 0),
        signalCount: stats.signalCount + (hasWatchSignal(row) ? 1 : 0),
        inflowCount: stats.inflowCount + (data.capitalFlow.signal === 'inflow' ? 1 : 0),
        focusCount: stats.focusCount + (calculateFocusInfo(row).score >= 60 ? 1 : 0),
      };
    },
    {
      total: rows.length,
      upCount: 0,
      downCount: 0,
      signalCount: 0,
      inflowCount: 0,
      focusCount: 0,
    }
  );
}

/**
 * 按条件筛选自选股行。
 * @param {WatchlistRow[]} rows 自选股行
 * @param {WatchlistFilter} filter 筛选条件
 * @returns {WatchlistRow[]} 筛选后的行
 */
function filterRows(rows: WatchlistRow[], filter: WatchlistFilter): WatchlistRow[] {
  if (filter === 'all') {
    return rows;
  }

  return rows.filter((row) => {
    const data = row.data;
    if (data === null) {
      return false;
    }

    if (filter === 'up') {
      return data.changePercent > 0;
    }

    if (filter === 'down') {
      return data.changePercent < 0;
    }

    if (filter === 'signal') {
      return hasWatchSignal(row);
    }

    if (filter === 'inflow') {
      return data.capitalFlow.signal === 'inflow';
    }

    if (filter === 'focus') {
      return calculateFocusInfo(row).score >= 60;
    }

    return data.ma.trend === 'up';
  });
}

/**
 * 按指定方式排序自选股行。
 * @param {WatchlistRow[]} rows 自选股行
 * @param {WatchlistSort} sort 排序方式
 * @returns {WatchlistRow[]} 排序后的行
 */
function sortRows(rows: WatchlistRow[], sort: WatchlistSort): WatchlistRow[] {
  const nextRows = [...rows];

  if (sort === 'default') {
    return nextRows;
  }

  return nextRows.sort((first, second) => {
    if (sort === 'focus_desc') {
      return calculateFocusInfo(second).score - calculateFocusInfo(first).score;
    }

    if (sort === 'signal_first') {
      return Number(hasWatchSignal(second)) - Number(hasWatchSignal(first));
    }

    const firstData = first.data;
    const secondData = second.data;
    if (firstData === null || secondData === null) {
      return firstData === null ? 1 : -1;
    }

    if (sort === 'change_desc') {
      return secondData.changePercent - firstData.changePercent;
    }

    if (sort === 'volume_desc') {
      return secondData.volume.volumeRatio - firstData.volume.volumeRatio;
    }

    return secondData.latestPrice - firstData.latestPrice;
  });
}

/**
 * 获取表格行样式。
 * @param {WatchlistRow} row 自选股行
 * @returns {string} 表格行样式
 */
function getRowClassName(row: WatchlistRow): string {
  const classNames: string[] = [];

  if (hasWatchSignal(row)) {
    classNames.push('has-signal');
  }

  if (calculateFocusInfo(row).score >= 60) {
    classNames.push('high-focus');
  }

  if (row.loading) {
    classNames.push('is-loading');
  }

  if (row.error) {
    classNames.push('has-error');
  }

  return classNames.join(' ');
}

/**
 * 计算自选股关注度。
 * @param {WatchlistRow} row 自选股行
 * @returns {FocusInfo} 关注度信息
 */
function calculateFocusInfo(row: WatchlistRow): FocusInfo {
  const data = row.data;
  if (data === null) {
    return { score: 0, reasons: [] };
  }

  const reasons: string[] = [];
  let score = 0;

  if (data.ma.trend === 'up') {
    score += 20;
    reasons.push('MA上行');
  }

  if (data.signals.maGoldenCross) {
    score += 25;
    reasons.push('均线金叉');
  }

  if (data.signals.volumeBreakout) {
    score += 20;
    reasons.push('放量');
  }

  if (data.signals.capitalInflowSignal || data.capitalFlow.signal === 'inflow') {
    score += 20;
    reasons.push('资金流入');
  }

  if (data.changePercent > 0) {
    score += 10;
    reasons.push('上涨');
  }

  if (data.volume.volumeRatio >= 1.5) {
    score += 10;
    reasons.push('量比偏高');
  }

  if (data.signals.maDeadCross) {
    score -= 20;
    reasons.push('均线死叉扣分');
  }

  if (data.changePercent < -0.03) {
    score -= 10;
    reasons.push('跌幅较大扣分');
  }

  return {
    score: Math.max(Math.min(score, 100), 0),
    reasons,
  };
}

/**
 * 格式化关注度展示。
 * @param {WatchlistRow} row 自选股行
 * @returns {string} 关注度文案
 */
function formatFocusInfo(row: WatchlistRow): string {
  if (row.loading) {
    return '加载中...';
  }

  if (row.error) {
    return '-';
  }

  const focusInfo = calculateFocusInfo(row);
  if (focusInfo.reasons.length === 0) {
    return `${focusInfo.score}分 / 暂无明显原因`;
  }

  return `${focusInfo.score}分 / ${focusInfo.reasons.slice(0, 3).join('、')}`;
}

export default WatchlistPage;
