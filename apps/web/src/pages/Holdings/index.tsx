import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { StatusNotice } from '../../components/basic/StatusNotice/index.js';
import type { FactorData } from '../Quant/types.js';
import { formatMoney, formatNumber, formatPercent } from '../Quant/utils.js';
import { normalizeSymbol } from '../Watchlist/storage.js';
import { readHoldings, removeHolding, saveHolding, type HoldingStock } from './storage.js';
import './styles.scss';

type HoldingRow = {
  /** 股票代码 */
  symbol: string;
  /** 加载状态 */
  loading: boolean;
  /** 错误消息 */
  error: string;
  /** 因子分析数据 */
  data: FactorData | null;
};

type HoldingFormState = {
  /** 股票代码 */
  symbol: string;
  /** 股票名称 */
  name: string;
  /** 持仓数量 */
  shares: string;
  /** 成本价 */
  costPrice: string;
};

type HoldingStats = {
  /** 持仓数量 */
  total: number;
  /** 总市值 */
  marketValue: number;
  /** 总成本 */
  costValue: number;
  /** 总盈亏 */
  profit: number;
  /** 总盈亏比例 */
  profitRate: number;
  /** 有信号数量 */
  signalCount: number;
};

type HoldingsPageProps = {
  /** 是否隐藏页面标题 */
  hideHeader?: boolean;
};

const EMPTY_FORM: HoldingFormState = {
  symbol: '',
  name: '',
  shares: '',
  costPrice: '',
};

/**
 * 持仓看板页面。
 * @returns {JSX.Element} 持仓看板视图
 */
export function HoldingsPage(props: HoldingsPageProps) {
  const { hideHeader = false } = props;
  const [holdings, setHoldings] = useState<HoldingStock[]>([]);
  const [formState, setFormState] = useState<HoldingFormState>(EMPTY_FORM);
  const [rows, setRows] = useState<Record<string, HoldingRow>>({});
  const [message, setMessage] = useState('');
  const [lastRefreshTime, setLastRefreshTime] = useState<number | null>(null);
  const [openMenuSymbol, setOpenMenuSymbol] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ left: number; top: number } | null>(null);
  const hasAutoRefreshedRef = useRef(false);

  const displayRows = useMemo(
    () => holdings.map((holding) => rows[holding.symbol] ?? createEmptyRow(holding.symbol)),
    [holdings, rows]
  );

  const stats = useMemo(() => createHoldingStats(holdings, rows), [holdings, rows]);

  useEffect(() => {
    void loadHoldings();
  }, []);

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

      if (target.closest('.holdings-menu-wrap') === null) {
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
    if (hasAutoRefreshedRef.current || holdings.length === 0) {
      return;
    }

    // 副作用说明：首次进入持仓看板时自动刷新行情和信号，便于直接查看盈亏。
    hasAutoRefreshedRef.current = true;
    void Promise.all(holdings.map((holding) => refreshHolding(holding.symbol)));
  }, [holdings]);

  /**
   * 加载本地持仓。
   * @returns {Promise<void>} 无返回值
   */
  async function loadHoldings(): Promise<void> {
    const storedHoldings = await readHoldings();
    setHoldings(storedHoldings);
  }

  /**
   * 更新表单字段。
   * @param {keyof HoldingFormState} field 字段名
   * @param {string} value 字段值
   * @returns {void} 无返回值
   */
  function updateFormField(field: keyof HoldingFormState, value: string): void {
    setFormState((currentState) => ({
      ...currentState,
      [field]: value,
    }));
  }

  /**
   * 添加或更新持仓。
   * @returns {Promise<void>} 无返回值
   */
  async function handleSubmitHolding(): Promise<void> {
    const symbol = normalizeSymbol(formState.symbol);
    const shares = Number(formState.shares);
    const costPrice = Number(formState.costPrice);

    if (symbol.length === 0) {
      setMessage('请输入股票代码');
      return;
    }

    if (!Number.isFinite(shares) || shares <= 0) {
      setMessage('持仓数量需要大于 0');
      return;
    }

    if (!Number.isFinite(costPrice) || costPrice <= 0) {
      setMessage('成本价需要大于 0');
      return;
    }

    const existingHolding = holdings.find((holding) => holding.symbol === symbol);
    const savedHolding = await saveHolding(
      {
        symbol,
        name: formState.name.trim() || symbol,
        shares,
        costPrice,
      },
      existingHolding
    );

    setHoldings((currentHoldings) => {
      if (existingHolding !== undefined) {
        return currentHoldings.map((holding) =>
          holding.symbol === savedHolding.symbol ? savedHolding : holding
        );
      }

      return [...currentHoldings, savedHolding];
    });
    setFormState(EMPTY_FORM);
    setMessage(existingHolding === undefined ? '已添加持仓' : '已更新持仓');
    void refreshHolding(savedHolding.symbol);
  }

  /**
   * 删除一条持仓。
   * @param {string} symbol 股票代码
   * @returns {Promise<void>} 无返回值
   */
  async function handleRemoveHolding(symbol: string): Promise<void> {
    await removeHolding(symbol);
    setHoldings((currentHoldings) => currentHoldings.filter((holding) => holding.symbol !== symbol));
    setRows((currentRows) => {
      const nextRows = { ...currentRows };
      delete nextRows[symbol];
      return nextRows;
    });
    setOpenMenuSymbol(null);
    setMessage('已删除持仓');
  }

  /**
   * 刷新全部持仓数据。
   * @returns {Promise<void>} 无返回值
   */
  async function handleRefreshAll(): Promise<void> {
    setMessage('');
    await Promise.all(holdings.map((holding) => refreshHolding(holding.symbol)));
    setLastRefreshTime(Date.now());
  }

  /**
   * 刷新单只持仓行情与信号。
   * @param {string} symbol 股票代码
   * @returns {Promise<void>} 无返回值
   */
  async function refreshHolding(symbol: string): Promise<void> {
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

  /**
   * 切换行内查看菜单。
   * @param {string} symbol 股票代码
   * @param {HTMLElement} element 触发按钮元素
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

  return (
    <main className="holdings-page">
      {!hideHeader && (
        <header className="holdings-header">
          <div>
            <h1>持仓看板</h1>
            <p>手动维护持仓，自动刷新现价、盈亏和当前信号。</p>
          </div>
          <button
            type="button"
            className="holdings-refresh-btn"
            onClick={() => void handleRefreshAll()}
            disabled={holdings.length === 0}
          >
            刷新全部
          </button>
        </header>
      )}

      <section className="holdings-editor">
        <div className="holdings-form-grid">
          <label>
            <span>股票代码</span>
            <input
              value={formState.symbol}
              onChange={(event) => updateFormField('symbol', event.target.value)}
              placeholder="如 600519"
            />
          </label>
          <label>
            <span>股票名称</span>
            <input
              value={formState.name}
              onChange={(event) => updateFormField('name', event.target.value)}
              placeholder="可选，不填则用代码"
            />
          </label>
          <label>
            <span>持仓数量</span>
            <input
              value={formState.shares}
              onChange={(event) => updateFormField('shares', event.target.value)}
              placeholder="如 100"
              inputMode="decimal"
            />
          </label>
          <label>
            <span>成本价</span>
            <input
              value={formState.costPrice}
              onChange={(event) => updateFormField('costPrice', event.target.value)}
              placeholder="如 168.88"
              inputMode="decimal"
            />
          </label>
        </div>
        <div className="holdings-actions">
          <button type="button" onClick={() => void handleSubmitHolding()}>保存持仓</button>
          <button type="button" className="secondary" onClick={() => setFormState(EMPTY_FORM)}>清空输入</button>
        </div>
        {message && <StatusNotice tone="success">{message}</StatusNotice>}
        {lastRefreshTime !== null && (
          <div className="holdings-refresh-time">最后刷新：{formatDateTime(lastRefreshTime)}</div>
        )}
      </section>

      <section className="holdings-dashboard">
        <div className="holdings-stat-card">
          <span>持仓数</span>
          <strong>{stats.total}</strong>
        </div>
        <div className="holdings-stat-card">
          <span>总市值</span>
          <strong>{formatMoney(stats.marketValue)}</strong>
        </div>
        <div className="holdings-stat-card">
          <span>总成本</span>
          <strong>{formatMoney(stats.costValue)}</strong>
        </div>
        <div className={`holdings-stat-card ${stats.profit >= 0 ? 'up' : 'down'}`}>
          <span>总盈亏</span>
          <strong>{formatMoney(stats.profit)}</strong>
        </div>
        <div className={`holdings-stat-card ${stats.profitRate >= 0 ? 'up' : 'down'}`}>
          <span>盈亏比例</span>
          <strong>{formatPercent(stats.profitRate)}</strong>
        </div>
        <div className="holdings-stat-card signal">
          <span>当前信号</span>
          <strong>{stats.signalCount}</strong>
        </div>
      </section>

      <section className="holdings-table-card">
        <div className="holdings-table-wrap">
          <table className="holdings-table">
            <thead>
              <tr>
                <th>股票</th>
                <th>现价</th>
                <th>成本价</th>
                <th>数量</th>
                <th>市值</th>
                <th>盈亏额</th>
                <th>盈亏比例</th>
                <th>当前信号</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {displayRows.length > 0 ? (
                displayRows.map((row) => {
                  const holding = holdings.find((item) => item.symbol === row.symbol);
                  if (holding === undefined) {
                    return null;
                  }

                  const valuation = calculateValuation(holding, row.data);

                  return (
                    <tr key={row.symbol} className={row.loading ? 'is-loading' : row.error ? 'has-error' : ''}>
                      <td>
                        <strong>{holding.name}</strong>
                        <span className="holdings-symbol">{holding.symbol}</span>
                      </td>
                      <td>{row.data === null ? '-' : formatNumber(row.data.latestPrice)}</td>
                      <td>{formatNumber(holding.costPrice)}</td>
                      <td>{formatNumber(holding.shares, 0)}</td>
                      <td>{formatMoney(valuation.marketValue)}</td>
                      <td className={getProfitClass(valuation.profit)}>{formatMoney(valuation.profit)}</td>
                      <td className={getProfitClass(valuation.profitRate)}>{formatPercent(valuation.profitRate)}</td>
                      <td>{formatSignals(row.data)}</td>
                      <td>{row.loading ? '刷新中...' : row.error || '正常'}</td>
                      <td>
                        <div className="holdings-row-actions">
                          <div className="holdings-menu-wrap">
                            <button
                              type="button"
                              className="holdings-menu-trigger"
                              onClick={(event) => handleToggleMenu(row.symbol, event.currentTarget)}
                            >
                              查看
                            </button>
                            {openMenuSymbol === row.symbol && menuPosition !== null && (
                              <div
                                className="holdings-menu"
                                style={{ left: menuPosition.left, top: menuPosition.top }}
                              >
                                <Link to={`/kline?symbol=${encodeURIComponent(row.symbol)}`}>K线信号</Link>
                                <Link to={`/quant?symbol=${encodeURIComponent(row.symbol)}`}>因子分析</Link>
                                <Link to={`/strategy?tab=backtest&symbol=${encodeURIComponent(row.symbol)}`}>策略回测</Link>
                              </div>
                            )}
                          </div>
                          <button type="button" onClick={() => void refreshHolding(row.symbol)}>刷新</button>
                          <button
                            type="button"
                            className="danger"
                            onClick={() => void handleRemoveHolding(row.symbol)}
                          >
                            删除
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td className="holdings-empty" colSpan={10}>暂无持仓，请先手动添加</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

type HoldingValuation = {
  /** 当前市值 */
  marketValue: number;
  /** 持仓成本 */
  costValue: number;
  /** 盈亏金额 */
  profit: number;
  /** 盈亏比例 */
  profitRate: number;
};

/**
 * 创建空持仓行情行。
 * @param {string} symbol 股票代码
 * @returns {HoldingRow} 空行数据
 */
function createEmptyRow(symbol: string): HoldingRow {
  return {
    symbol,
    loading: false,
    error: '',
    data: null,
  };
}

/**
 * 计算持仓估值。
 * @param {HoldingStock} holding 持仓信息
 * @param {FactorData | null} data 因子数据
 * @returns {HoldingValuation} 估值结果
 */
function calculateValuation(holding: HoldingStock, data: FactorData | null): HoldingValuation {
  const latestPrice = data?.latestPrice ?? holding.costPrice;
  const marketValue = holding.shares * latestPrice;
  const costValue = holding.shares * holding.costPrice;
  const profit = marketValue - costValue;
  const profitRate = costValue > 0 ? profit / costValue : 0;

  return {
    marketValue,
    costValue,
    profit,
    profitRate,
  };
}

/**
 * 统计持仓看板摘要。
 * @param {HoldingStock[]} holdings 持仓列表
 * @param {Record<string, HoldingRow>} rows 行情行数据
 * @returns {HoldingStats} 看板统计
 */
function createHoldingStats(
  holdings: HoldingStock[],
  rows: Record<string, HoldingRow>
): HoldingStats {
  const totalStats = holdings.reduce(
    (stats, holding) => {
      const row = rows[holding.symbol] ?? createEmptyRow(holding.symbol);
      const valuation = calculateValuation(holding, row.data);

      return {
        marketValue: stats.marketValue + valuation.marketValue,
        costValue: stats.costValue + valuation.costValue,
        profit: stats.profit + valuation.profit,
        signalCount: stats.signalCount + (hasSignal(row.data) ? 1 : 0),
      };
    },
    {
      marketValue: 0,
      costValue: 0,
      profit: 0,
      signalCount: 0,
    }
  );

  return {
    total: holdings.length,
    marketValue: totalStats.marketValue,
    costValue: totalStats.costValue,
    profit: totalStats.profit,
    profitRate: totalStats.costValue > 0 ? totalStats.profit / totalStats.costValue : 0,
    signalCount: totalStats.signalCount,
  };
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
 * 判断是否存在当前信号。
 * @param {FactorData | null} data 因子数据
 * @returns {boolean} 是否有信号
 */
function hasSignal(data: FactorData | null): boolean {
  if (data === null) {
    return false;
  }

  return (
    data.signals.maGoldenCross ||
    data.signals.maDeadCross ||
    data.signals.volumeBreakout ||
    data.signals.capitalInflowSignal
  );
}

/**
 * 获取盈亏样式类。
 * @param {number} value 数值
 * @returns {string} 样式类名
 */
function getProfitClass(value: number): string {
  if (value > 0) {
    return 'holdings-up';
  }

  if (value < 0) {
    return 'holdings-down';
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
