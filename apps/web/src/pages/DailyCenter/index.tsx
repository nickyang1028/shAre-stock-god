import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { StatusNotice } from '../../components/basic/StatusNotice/index.js';
import {
  calculateHoldingValuation,
  calculateOpportunityScore,
  calculateRiskScore,
  DEFAULT_OPPORTUNITY_RISK_CONFIG,
  OPPORTUNITY_RISK_PRESETS,
  loadOpportunityRiskConfig,
  saveOpportunityRiskConfig,
  type OpportunityRiskConfig,
} from '../../utils/opportunityRisk.js';
import { readHoldings, type HoldingStock } from '../Holdings/storage.js';
import type { FactorData } from '../Quant/types.js';
import { formatMoney, formatNumber, formatPercent } from '../Quant/utils.js';
import { readWatchlist, type WatchlistStock } from '../Watchlist/storage.js';
import './styles.scss';

type CenterStockSource = 'holding' | 'watchlist' | 'both';

type CenterInput = {
  /** 股票代码 */
  symbol: string;
  /** 股票名称 */
  name: string;
  /** 股票来源 */
  source: CenterStockSource;
  /** 持仓信息 */
  holding: HoldingStock | null;
};

type CenterRow = CenterInput & {
  /** 因子数据 */
  data: FactorData | null;
  /** 错误消息 */
  error: string;
  /** 机会评分 */
  opportunityScore: number;
  /** 风险评分 */
  riskScore: number;
  /** 机会原因 */
  opportunityReasons: string[];
  /** 风险原因 */
  riskReasons: string[];
  /** 当前市值 */
  marketValue: number;
  /** 持仓盈亏 */
  profit: number;
  /** 持仓盈亏比例 */
  profitRate: number;
};

type CenterSummary = {
  /** 跟踪股票数 */
  total: number;
  /** 机会股票数 */
  opportunityCount: number;
  /** 风险股票数 */
  riskCount: number;
  /** 有信号股票数 */
  signalCount: number;
  /** 持仓总市值 */
  marketValue: number;
  /** 持仓总盈亏 */
  profit: number;
};

type QuantApiResponse = {
  /** 请求是否成功 */
  success?: boolean;
  /** 因子分析数据 */
  data?: FactorData;
  /** 错误消息 */
  message?: string;
};

/**
 * 今日机会与风险中心页面。
 * @returns {JSX.Element} 今日中心视图
 */
export function DailyCenterPage() {
  const [rows, setRows] = useState<CenterRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState<'info' | 'success' | 'warning' | 'error'>('info');
  const [lastRefreshTime, setLastRefreshTime] = useState<number | null>(null);
  const [scoreConfig, setScoreConfig] = useState<OpportunityRiskConfig>(() => loadOpportunityRiskConfig());
  const [showConfig, setShowConfig] = useState(false);

  const summary = useMemo(() => createCenterSummary(rows, scoreConfig), [rows, scoreConfig]);
  const opportunityRows = useMemo(
    () => [...rows].sort((first, second) => second.opportunityScore - first.opportunityScore).slice(0, 5),
    [rows]
  );
  const riskRows = useMemo(
    () => [...rows].sort((first, second) => second.riskScore - first.riskScore).slice(0, 5),
    [rows]
  );

  useEffect(() => {
    void refreshCenter();
  }, []);

  /**
   * 刷新今日机会与风险中心。
   * @returns {Promise<void>} 无返回值
   */
  async function refreshCenter(): Promise<void> {
    setLoading(true);
    setMessage('');
    setMessageTone('info');

    try {
      const holdings = await readHoldings();
      const watchlist = await readWatchlist();
      const inputs = mergeCenterInputs(holdings, watchlist);

      if (inputs.length === 0) {
        setRows([]);
        setMessageTone('warning');
        setMessage('暂无持仓或自选股，请先添加股票');
        return;
      }

      const nextRows = await Promise.all(inputs.map(fetchCenterRow));
      setRows(nextRows.map((row) => applyScores(row, scoreConfig)));
      setLastRefreshTime(Date.now());
      setMessageTone('success');
      setMessage(`已刷新 ${nextRows.length} 只股票的机会与风险`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '刷新失败';
      setMessageTone('error');
      setMessage(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  /**
   * 更新评分配置。
   * @param {keyof OpportunityRiskConfig} key 配置键
   * @param {string} value 配置值
   * @returns {void} 无返回值
   */
  function updateScoreConfig(key: keyof OpportunityRiskConfig, value: string): void {
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue)) {
      return;
    }

    const nextConfig = {
      ...scoreConfig,
      [key]: numberValue,
    };
    setScoreConfig(nextConfig);
    saveOpportunityRiskConfig(nextConfig);
    setRows((currentRows) => currentRows.map((row) => applyScores(row, nextConfig)));
  }

  /**
   * 重置评分配置。
   * @returns {void} 无返回值
   */
  function resetScoreConfig(): void {
    setScoreConfig(DEFAULT_OPPORTUNITY_RISK_CONFIG);
    saveOpportunityRiskConfig(DEFAULT_OPPORTUNITY_RISK_CONFIG);
    setRows((currentRows) => currentRows.map((row) => applyScores(row, DEFAULT_OPPORTUNITY_RISK_CONFIG)));
  }

  /**
   * 应用评分规则预设。
   * @param {OpportunityRiskConfig} config 预设配置
   * @returns {void} 无返回值
   */
  function applyScorePreset(config: OpportunityRiskConfig): void {
    setScoreConfig(config);
    saveOpportunityRiskConfig(config);
    setRows((currentRows) => currentRows.map((row) => applyScores(row, config)));
  }

  return (
    <main className="daily-center-page">
      <header className="daily-center-header">
        <div>
          <h1>今日机会与风险</h1>
          <p>自动整合持仓和自选，按信号、趋势、资金流和持仓盈亏给出优先级。</p>
        </div>
        <div className="daily-center-header-actions">
          <button type="button" className="secondary" onClick={() => setShowConfig((value) => !value)}>
            {showConfig ? '收起规则' : '评分规则'}
          </button>
          <button type="button" onClick={() => void refreshCenter()} disabled={loading}>
            {loading ? '刷新中...' : '刷新中心'}
          </button>
        </div>
      </header>

      {showConfig && (
        <section className="daily-center-config daily-center-card">
          <div className="daily-center-section-title">
            <h2>评分规则配置</h2>
            <button type="button" onClick={resetScoreConfig}>恢复默认</button>
          </div>
          <div className="daily-center-preset-list">
            {OPPORTUNITY_RISK_PRESETS.map((preset) => (
              <button key={preset.key} type="button" onClick={() => applyScorePreset(preset.config)}>
                <strong>{preset.label}</strong>
                <span>{preset.description}</span>
              </button>
            ))}
          </div>
          <div className="daily-center-config-grid">
            <ConfigNumberField label="机会候选分" value={scoreConfig.opportunityThreshold} onChange={(value) => updateScoreConfig('opportunityThreshold', value)} />
            <ConfigNumberField label="风险提醒分" value={scoreConfig.riskThreshold} onChange={(value) => updateScoreConfig('riskThreshold', value)} />
            <ConfigNumberField label="温和上涨上限" value={scoreConfig.mildRiseMax} step={0.01} onChange={(value) => updateScoreConfig('mildRiseMax', value)} />
            <ConfigNumberField label="活跃量比下限" value={scoreConfig.activeVolumeMin} step={0.1} onChange={(value) => updateScoreConfig('activeVolumeMin', value)} />
            <ConfigNumberField label="活跃量比上限" value={scoreConfig.activeVolumeMax} step={0.1} onChange={(value) => updateScoreConfig('activeVolumeMax', value)} />
            <ConfigNumberField label="异常放量阈值" value={scoreConfig.highVolumeRatio} step={0.1} onChange={(value) => updateScoreConfig('highVolumeRatio', value)} />
            <ConfigNumberField label="大跌阈值" value={scoreConfig.sharpDropRate} step={0.01} onChange={(value) => updateScoreConfig('sharpDropRate', value)} />
            <ConfigNumberField label="持仓亏损提醒" value={scoreConfig.holdingLossAlertRate} step={0.01} onChange={(value) => updateScoreConfig('holdingLossAlertRate', value)} />
            <ConfigNumberField label="盈利保护提醒" value={scoreConfig.holdingProfitProtectRate} step={0.01} onChange={(value) => updateScoreConfig('holdingProfitProtectRate', value)} />
          </div>
        </section>
      )}

      {message && (
        <section className="daily-center-message">
          <StatusNotice tone={messageTone}>{message}</StatusNotice>
        </section>
      )}

      <section className="daily-center-dashboard">
        <div className="daily-center-stat-card">
          <span>跟踪股票</span>
          <strong>{summary.total}</strong>
        </div>
        <div className="daily-center-stat-card up">
          <span>机会候选</span>
          <strong>{summary.opportunityCount}</strong>
        </div>
        <div className="daily-center-stat-card down">
          <span>风险提醒</span>
          <strong>{summary.riskCount}</strong>
        </div>
        <div className="daily-center-stat-card signal">
          <span>有信号</span>
          <strong>{summary.signalCount}</strong>
        </div>
        <div className="daily-center-stat-card">
          <span>持仓市值</span>
          <strong>{formatMoney(summary.marketValue)}</strong>
        </div>
        <div className={`daily-center-stat-card ${summary.profit >= 0 ? 'up' : 'down'}`}>
          <span>持仓盈亏</span>
          <strong>{formatMoney(summary.profit)}</strong>
        </div>
      </section>

      {lastRefreshTime !== null && (
        <div className="daily-center-refresh-time">最后刷新：{formatDateTime(lastRefreshTime)}</div>
      )}

      <section className="daily-center-grid">
        <div className="daily-center-card">
          <div className="daily-center-section-title">
            <h2>今日最值得关注</h2>
            <span>机会分 TOP 5</span>
          </div>
          <div className="daily-center-list">
            {opportunityRows.length > 0 ? (
              opportunityRows.map((row) => <CenterStockCard key={row.symbol} row={row} type="opportunity" />)
            ) : (
              <div className="daily-center-empty">暂无机会候选</div>
            )}
          </div>
        </div>

        <div className="daily-center-card">
          <div className="daily-center-section-title">
            <h2>今日最需要警惕</h2>
            <span>风险分 TOP 5</span>
          </div>
          <div className="daily-center-list">
            {riskRows.length > 0 ? (
              riskRows.map((row) => <CenterStockCard key={row.symbol} row={row} type="risk" />)
            ) : (
              <div className="daily-center-empty">暂无风险提醒</div>
            )}
          </div>
        </div>
      </section>

      <section className="daily-center-card">
        <div className="daily-center-section-title">
          <h2>全部跟踪股票</h2>
          <span>评分可解释，便于复盘</span>
        </div>
        <div className="daily-center-table-wrap">
          <table className="daily-center-table">
            <thead>
              <tr>
                <th>股票</th>
                <th>来源</th>
                <th>现价</th>
                <th>涨跌幅</th>
                <th>机会分</th>
                <th>风险分</th>
                <th>信号</th>
                <th>持仓盈亏</th>
                <th>入口</th>
              </tr>
            </thead>
            <tbody>
              {rows.length > 0 ? (
                rows.map((row) => (
                  <tr key={row.symbol}>
                    <td>
                      <strong>{row.name}</strong>
                      <span>{row.symbol}</span>
                    </td>
                    <td>{formatSource(row.source)}</td>
                    <td>{row.data === null ? '-' : formatNumber(row.data.latestPrice)}</td>
                    <td className={row.data === null ? '' : getChangeClass(row.data.changePercent)}>
                      {row.data === null ? '-' : formatPercent(row.data.changePercent)}
                    </td>
                    <td>{row.opportunityScore}</td>
                    <td>{row.riskScore}</td>
                    <td>{formatSignals(row.data)}</td>
                    <td className={getProfitClass(row.profit)}>{row.holding === null ? '-' : `${formatMoney(row.profit)} / ${formatPercent(row.profitRate)}`}</td>
                    <td>
                      <Link to={`/kline?symbol=${encodeURIComponent(row.symbol)}`}>K线</Link>
                      <Link to={`/quant?symbol=${encodeURIComponent(row.symbol)}`}>因子</Link>
                      <Link to={`/strategy?tab=backtest&symbol=${encodeURIComponent(row.symbol)}`}>回测</Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="daily-center-empty" colSpan={9}>暂无数据，请点击刷新中心</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

type CenterStockCardProps = {
  /** 股票行 */
  row: CenterRow;
  /** 卡片类型 */
  type: 'opportunity' | 'risk';
};

/**
 * 今日中心股票卡片。
 * @param {CenterStockCardProps} props 组件属性
 * @returns {JSX.Element} 股票卡片
 */
function CenterStockCard(props: CenterStockCardProps) {
  const { row, type } = props;
  const score = type === 'opportunity' ? row.opportunityScore : row.riskScore;
  const reasons = type === 'opportunity' ? row.opportunityReasons : row.riskReasons;

  return (
    <article className={`daily-center-stock-card ${type}`}>
      <div className="daily-center-stock-card-header">
        <div>
          <strong>{row.name}</strong>
          <span>{row.symbol} · {formatSource(row.source)}</span>
        </div>
        <em>{score}</em>
      </div>
      <div className="daily-center-stock-meta">
        <span>现价 {row.data === null ? '-' : formatNumber(row.data.latestPrice)}</span>
        <span className={row.data === null ? '' : getChangeClass(row.data.changePercent)}>
          {row.data === null ? '-' : formatPercent(row.data.changePercent)}
        </span>
        <span>{formatSignals(row.data)}</span>
      </div>
      <ul>
        {reasons.length > 0 ? reasons.map((reason) => <li key={reason}>{reason}</li>) : <li>暂无明显原因</li>}
      </ul>
    </article>
  );
}

type ConfigNumberFieldProps = {
  /** 字段名称 */
  label: string;
  /** 字段值 */
  value: number;
  /** 步长 */
  step?: number;
  /** 变更回调 */
  onChange: (value: string) => void;
};

/**
 * 评分配置数字输入。
 * @param {ConfigNumberFieldProps} props 组件属性
 * @returns {JSX.Element} 数字输入组件
 */
function ConfigNumberField(props: ConfigNumberFieldProps) {
  const { label, value, step = 1, onChange } = props;

  return (
    <label>
      <span>{label}</span>
      <input
        type="number"
        value={value}
        step={step}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

/**
 * 合并今日中心输入。
 * @param {HoldingStock[]} holdings 持仓列表
 * @param {WatchlistStock[]} watchlist 自选股列表
 * @returns {CenterInput[]} 输入列表
 */
function mergeCenterInputs(holdings: HoldingStock[], watchlist: WatchlistStock[]): CenterInput[] {
  const inputMap = new Map<string, CenterInput>();

  holdings.forEach((holding) => {
    inputMap.set(holding.symbol, {
      symbol: holding.symbol,
      name: holding.name || holding.symbol,
      source: 'holding',
      holding,
    });
  });

  watchlist.forEach((stock) => {
    const existingInput = inputMap.get(stock.symbol);
    if (existingInput !== undefined) {
      inputMap.set(stock.symbol, {
        ...existingInput,
        source: 'both',
      });
      return;
    }

    inputMap.set(stock.symbol, {
      symbol: stock.symbol,
      name: stock.symbol,
      source: 'watchlist',
      holding: null,
    });
  });

  return Array.from(inputMap.values());
}

/**
 * 请求今日中心单股数据。
 * @param {CenterInput} input 输入数据
 * @returns {Promise<CenterRow>} 中心行数据
 */
async function fetchCenterRow(input: CenterInput): Promise<CenterRow> {
  try {
    const response = await fetch(`/api/quant/${encodeURIComponent(input.symbol)}/analysis?limit=120`);
    const payload = (await response.json().catch(() => ({}))) as QuantApiResponse;

    if (!response.ok || !payload.success || payload.data === undefined) {
      throw new Error(payload.message ?? `请求失败 (${response.status})`);
    }

    return createCenterRow(input, payload.data, '');
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '刷新失败';
    return createCenterRow(input, null, errorMessage);
  }
}

/**
 * 创建今日中心行。
 * @param {CenterInput} input 输入数据
 * @param {FactorData | null} data 因子数据
 * @param {string} error 错误消息
 * @returns {CenterRow} 中心行数据
 */
function createCenterRow(input: CenterInput, data: FactorData | null, error: string): CenterRow {
  return applyScores(
    {
      ...input,
      name: data?.name ?? input.name,
      data,
      error,
      opportunityScore: 0,
      riskScore: 0,
      opportunityReasons: [],
      riskReasons: [],
      marketValue: 0,
      profit: 0,
      profitRate: 0,
    },
    loadOpportunityRiskConfig()
  );
}

/**
 * 应用评分配置。
 * @param {CenterRow} row 原始行
 * @param {OpportunityRiskConfig} config 评分配置
 * @returns {CenterRow} 已评分行
 */
function applyScores(row: CenterRow, config: OpportunityRiskConfig): CenterRow {
  const valuation = calculateHoldingValuation(row.holding, row.data);
  const opportunity = calculateOpportunityScore(row.data, config);
  const risk = calculateRiskScore(row.holding, row.data, valuation.profitRate, config);

  return {
    ...row,
    opportunityScore: opportunity.score,
    riskScore: risk.score,
    opportunityReasons: opportunity.reasons,
    riskReasons: risk.reasons,
    marketValue: valuation.marketValue,
    profit: valuation.profit,
    profitRate: valuation.profitRate,
  };
}

/**
 * 创建今日中心摘要。
 * @param {CenterRow[]} rows 中心行数据
 * @returns {CenterSummary} 摘要
 */
function createCenterSummary(rows: CenterRow[], config: OpportunityRiskConfig): CenterSummary {
  return rows.reduce<CenterSummary>(
    (summary, row) => ({
      total: summary.total,
      opportunityCount: summary.opportunityCount + (row.opportunityScore >= config.opportunityThreshold ? 1 : 0),
      riskCount: summary.riskCount + (row.riskScore >= config.riskThreshold ? 1 : 0),
      signalCount: summary.signalCount + (hasSignals(row.data) ? 1 : 0),
      marketValue: summary.marketValue + row.marketValue,
      profit: summary.profit + row.profit,
    }),
    {
      total: rows.length,
      opportunityCount: 0,
      riskCount: 0,
      signalCount: 0,
      marketValue: 0,
      profit: 0,
    }
  );
}

/**
 * 判断是否有信号。
 * @param {FactorData | null} data 因子数据
 * @returns {boolean} 是否有信号
 */
function hasSignals(data: FactorData | null): boolean {
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
 * 格式化来源。
 * @param {CenterStockSource} source 股票来源
 * @returns {string} 来源文案
 */
function formatSource(source: CenterStockSource): string {
  if (source === 'both') {
    return '持仓 + 自选';
  }

  if (source === 'holding') {
    return '持仓';
  }

  return '自选';
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
 * 获取涨跌样式类。
 * @param {number} changePercent 涨跌幅
 * @returns {string} 样式类名
 */
function getChangeClass(changePercent: number): string {
  if (changePercent > 0) {
    return 'daily-center-up';
  }

  if (changePercent < 0) {
    return 'daily-center-down';
  }

  return '';
}

/**
 * 获取盈亏样式类。
 * @param {number} profit 盈亏金额
 * @returns {string} 样式类名
 */
function getProfitClass(profit: number): string {
  if (profit > 0) {
    return 'daily-center-up';
  }

  if (profit < 0) {
    return 'daily-center-down';
  }

  return '';
}
