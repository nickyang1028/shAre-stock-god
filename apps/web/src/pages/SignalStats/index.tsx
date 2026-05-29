import { useMemo, useState, type FormEvent } from 'react';
import type { KLine, Signal, StockAnalysisResponse } from '@share-stock-god/shared';
import { formatNumber, formatPercent } from '../Quant/utils.js';
import { normalizeSymbol } from '../Watchlist/storage.js';
import './styles.scss';

type SignalStatsForm = {
  /** 股票代码 */
  symbol: string;
  /** 观察交易日数量 */
  horizonDays: number;
  /** 最低信号可信度 */
  minConfidence: number;
};

type EvaluatedSignal = {
  /** 信号唯一标识 */
  id: string;
  /** 信号日期 */
  date: string;
  /** 信号名称 */
  name: string;
  /** 信号类型 */
  type: string;
  /** 信号方向 */
  direction: 'bullish' | 'bearish' | 'neutral';
  /** 信号可信度 */
  confidence: number;
  /** 触发价格 */
  entryPrice: number;
  /** 观察结束价格 */
  exitPrice: number | null;
  /** 方向收益率 */
  directionalReturn: number | null;
  /** 是否命中 */
  hit: boolean | null;
  /** 是否可评估 */
  evaluable: boolean;
};

type SignalTypeStats = {
  /** 信号类型 */
  type: string;
  /** 信号名称 */
  name: string;
  /** 信号总数 */
  total: number;
  /** 可评估数量 */
  evaluated: number;
  /** 命中数量 */
  hits: number;
  /** 命中率 */
  hitRate: number;
  /** 平均方向收益率 */
  averageReturn: number;
  /** 最好方向收益率 */
  bestReturn: number;
  /** 最差方向收益率 */
  worstReturn: number;
};

type OverallSignalStats = {
  /** 信号总数 */
  total: number;
  /** 可评估数量 */
  evaluated: number;
  /** 命中数量 */
  hits: number;
  /** 未到观察期数量 */
  pending: number;
  /** 命中率 */
  hitRate: number;
  /** 平均方向收益率 */
  averageReturn: number;
};

const DEFAULT_FORM: SignalStatsForm = {
  symbol: '600519',
  horizonDays: 5,
  minConfidence: 0,
};

const HORIZON_OPTIONS = [3, 5, 10, 20];
const CONFIDENCE_OPTIONS = [0, 50, 60, 70, 80];

/**
 * 信号命中率统计页面。
 * @returns {JSX.Element} 信号命中率统计视图
 */
export function SignalStatsPage() {
  const [formState, setFormState] = useState<SignalStatsForm>(DEFAULT_FORM);
  const [analysis, setAnalysis] = useState<StockAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const evaluatedSignals = useMemo(
    () =>
      analysis === null
        ? []
        : evaluateSignals(
            analysis.klines,
            analysis.signals.filter((signal) => signal.confidence >= formState.minConfidence),
            formState.horizonDays
          ),
    [analysis, formState.horizonDays, formState.minConfidence]
  );

  const overallStats = useMemo(
    () => createOverallStats(evaluatedSignals),
    [evaluatedSignals]
  );

  const typeStats = useMemo(
    () => createTypeStats(evaluatedSignals),
    [evaluatedSignals]
  );

  /**
   * 提交查询并刷新统计数据。
   * @param {FormEvent<HTMLFormElement>} event 表单提交事件
   * @returns {void} 无返回值
   */
  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void loadSignalStats();
  }

  /**
   * 请求股票 K 线和信号数据。
   * @returns {Promise<void>} 无返回值
   */
  async function loadSignalStats(): Promise<void> {
    const symbol = normalizeSymbol(formState.symbol);
    if (symbol.length === 0) {
      setErrorMessage('请输入股票代码');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const response = await fetch(`/api/stocks/${encodeURIComponent(symbol)}/analysis?limit=120`);
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? `请求失败 (${response.status})`);
      }

      const nextAnalysis = (await response.json()) as StockAnalysisResponse;
      setAnalysis(nextAnalysis);
      setFormState((currentState) => ({
        ...currentState,
        symbol,
      }));
    } catch (error: unknown) {
      const nextMessage = error instanceof Error ? error.message : '统计失败';
      setAnalysis(null);
      setErrorMessage(nextMessage);
    } finally {
      setLoading(false);
    }
  }

  /**
   * 更新观察交易日。
   * @param {string} value 选择值
   * @returns {void} 无返回值
   */
  function updateHorizonDays(value: string): void {
    const nextValue = Number(value);
    setFormState((currentState) => ({
      ...currentState,
      horizonDays: Number.isFinite(nextValue) ? nextValue : DEFAULT_FORM.horizonDays,
    }));
  }

  /**
   * 更新最低可信度。
   * @param {string} value 选择值
   * @returns {void} 无返回值
   */
  function updateMinConfidence(value: string): void {
    const nextValue = Number(value);
    setFormState((currentState) => ({
      ...currentState,
      minConfidence: Number.isFinite(nextValue) ? nextValue : DEFAULT_FORM.minConfidence,
    }));
  }

  return (
    <main className="signal-stats-page">
      <header className="signal-stats-header">
        <div>
          <h1>信号命中率统计</h1>
          <p>统计历史信号在指定观察期内是否沿预测方向运行。</p>
        </div>
      </header>

      <section className="signal-stats-card signal-stats-query">
        <form onSubmit={handleSubmit}>
          <label>
            <span>股票代码</span>
            <input
              value={formState.symbol}
              onChange={(event) => setFormState((currentState) => ({
                ...currentState,
                symbol: event.target.value,
              }))}
              placeholder="如 600519"
              disabled={loading}
            />
          </label>
          <label>
            <span>观察期</span>
            <select
              value={formState.horizonDays}
              onChange={(event) => updateHorizonDays(event.target.value)}
              disabled={loading}
            >
              {HORIZON_OPTIONS.map((days) => (
                <option key={days} value={days}>{days} 个交易日</option>
              ))}
            </select>
          </label>
          <label>
            <span>最低可信度</span>
            <select
              value={formState.minConfidence}
              onChange={(event) => updateMinConfidence(event.target.value)}
              disabled={loading}
            >
              {CONFIDENCE_OPTIONS.map((confidence) => (
                <option key={confidence} value={confidence}>{confidence} 分以上</option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={loading}>{loading ? '统计中...' : '开始统计'}</button>
        </form>
        <p className="signal-stats-rule">
          计算口径：看涨信号后第 N 个交易日收盘价高于触发价记为命中；看跌信号后第 N 个交易日收盘价低于触发价记为命中；中性信号和未满观察期信号不计入命中率分母。
        </p>
        {errorMessage && <div className="signal-stats-error">{errorMessage}</div>}
      </section>

      <section className="signal-stats-dashboard">
        <div className="signal-stats-stat-card">
          <span>信号总数</span>
          <strong>{overallStats.total}</strong>
        </div>
        <div className="signal-stats-stat-card">
          <span>可评估</span>
          <strong>{overallStats.evaluated}</strong>
        </div>
        <div className="signal-stats-stat-card hit">
          <span>命中数量</span>
          <strong>{overallStats.hits}</strong>
        </div>
        <div className="signal-stats-stat-card hit">
          <span>命中率</span>
          <strong>{formatPercent(overallStats.hitRate)}</strong>
        </div>
        <div className="signal-stats-stat-card">
          <span>平均方向收益</span>
          <strong>{formatPercent(overallStats.averageReturn)}</strong>
        </div>
        <div className="signal-stats-stat-card pending">
          <span>未满观察期</span>
          <strong>{overallStats.pending}</strong>
        </div>
      </section>

      <section className="signal-stats-card">
        <div className="signal-stats-section-title">
          <h2>按信号类型统计</h2>
          <span>{analysis?.name ?? '未查询'}</span>
        </div>
        <div className="signal-stats-table-wrap">
          <table className="signal-stats-table">
            <thead>
              <tr>
                <th>信号类型</th>
                <th>总数</th>
                <th>可评估</th>
                <th>命中</th>
                <th>命中率</th>
                <th>平均方向收益</th>
                <th>最好</th>
                <th>最差</th>
              </tr>
            </thead>
            <tbody>
              {typeStats.length > 0 ? (
                typeStats.map((item) => (
                  <tr key={item.type}>
                    <td>
                      <strong>{item.name}</strong>
                      <span>{item.type}</span>
                    </td>
                    <td>{item.total}</td>
                    <td>{item.evaluated}</td>
                    <td>{item.hits}</td>
                    <td>{formatPercent(item.hitRate)}</td>
                    <td className={getReturnClass(item.averageReturn)}>{formatPercent(item.averageReturn)}</td>
                    <td className={getReturnClass(item.bestReturn)}>{formatPercent(item.bestReturn)}</td>
                    <td className={getReturnClass(item.worstReturn)}>{formatPercent(item.worstReturn)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="signal-stats-empty" colSpan={8}>暂无统计结果，请先查询股票</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="signal-stats-card">
        <div className="signal-stats-section-title">
          <h2>最近信号明细</h2>
          <span>{formState.horizonDays} 个交易日观察期</span>
        </div>
        <div className="signal-stats-table-wrap">
          <table className="signal-stats-table detail">
            <thead>
              <tr>
                <th>日期</th>
                <th>信号</th>
                <th>方向</th>
                <th>可信度</th>
                <th>触发价</th>
                <th>观察价</th>
                <th>方向收益</th>
                <th>结果</th>
              </tr>
            </thead>
            <tbody>
              {evaluatedSignals.length > 0 ? (
                evaluatedSignals.slice(0, 30).map((signal) => (
                  <tr key={signal.id}>
                    <td>{signal.date}</td>
                    <td>{signal.name}</td>
                    <td>{formatDirection(signal.direction)}</td>
                    <td>{formatNumber(signal.confidence, 0)}</td>
                    <td>{formatNumber(signal.entryPrice)}</td>
                    <td>{signal.exitPrice === null ? '-' : formatNumber(signal.exitPrice)}</td>
                    <td className={getReturnClass(signal.directionalReturn ?? 0)}>
                      {signal.directionalReturn === null ? '-' : formatPercent(signal.directionalReturn)}
                    </td>
                    <td>{formatHitResult(signal)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="signal-stats-empty" colSpan={8}>暂无信号明细</td>
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
 * 评估信号在观察期后的命中情况。
 * @param {KLine[]} klines K 线序列
 * @param {Signal[]} signals 信号列表
 * @param {number} horizonDays 观察交易日数量
 * @returns {EvaluatedSignal[]} 评估后的信号列表
 */
function evaluateSignals(
  klines: KLine[],
  signals: Signal[],
  horizonDays: number
): EvaluatedSignal[] {
  const klineIndexMap = new Map(klines.map((kline, index) => [kline.timestamp, index]));

  return signals.map((signal) => {
    const signalIndex = klineIndexMap.get(signal.timestamp);
    const entryKline = signalIndex === undefined ? null : klines[signalIndex] ?? null;
    const exitKline =
      signalIndex === undefined ? null : klines[signalIndex + horizonDays] ?? null;
    const entryPrice = entryKline?.close ?? signal.price;

    // 边界处理：没有足够未来 K 线或中性信号时，只展示但不计入命中率。
    if (exitKline === null || signal.direction === 'neutral' || entryPrice <= 0) {
      return {
        id: signal.id,
        date: signal.date,
        name: signal.name,
        type: signal.type,
        direction: signal.direction,
        confidence: signal.confidence,
        entryPrice,
        exitPrice: exitKline?.close ?? null,
        directionalReturn: null,
        hit: null,
        evaluable: false,
      };
    }

    const rawReturn = (exitKline.close - entryPrice) / entryPrice;
    const directionalReturn = signal.direction === 'bullish' ? rawReturn : -rawReturn;

    return {
      id: signal.id,
      date: signal.date,
      name: signal.name,
      type: signal.type,
      direction: signal.direction,
      confidence: signal.confidence,
      entryPrice,
      exitPrice: exitKline.close,
      directionalReturn,
      hit: directionalReturn > 0,
      evaluable: true,
    };
  });
}

/**
 * 创建总体统计。
 * @param {EvaluatedSignal[]} signals 评估信号列表
 * @returns {OverallSignalStats} 总体统计
 */
function createOverallStats(signals: EvaluatedSignal[]): OverallSignalStats {
  const evaluatedSignals = signals.filter((signal) => signal.evaluable && signal.directionalReturn !== null);
  const hits = evaluatedSignals.filter((signal) => signal.hit === true).length;
  const returnSum = evaluatedSignals.reduce(
    (sum, signal) => sum + (signal.directionalReturn ?? 0),
    0
  );

  return {
    total: signals.length,
    evaluated: evaluatedSignals.length,
    hits,
    pending: signals.length - evaluatedSignals.length,
    hitRate: evaluatedSignals.length > 0 ? hits / evaluatedSignals.length : 0,
    averageReturn: evaluatedSignals.length > 0 ? returnSum / evaluatedSignals.length : 0,
  };
}

/**
 * 创建按信号类型分组统计。
 * @param {EvaluatedSignal[]} signals 评估信号列表
 * @returns {SignalTypeStats[]} 分组统计
 */
function createTypeStats(signals: EvaluatedSignal[]): SignalTypeStats[] {
  const statsMap = new Map<string, EvaluatedSignal[]>();

  signals.forEach((signal) => {
    const currentSignals = statsMap.get(signal.type) ?? [];
    currentSignals.push(signal);
    statsMap.set(signal.type, currentSignals);
  });

  return Array.from(statsMap.entries())
    .map(([type, groupSignals]) => createSingleTypeStats(type, groupSignals))
    .sort((first, second) => second.evaluated - first.evaluated || second.hitRate - first.hitRate);
}

/**
 * 创建单个信号类型统计。
 * @param {string} type 信号类型
 * @param {EvaluatedSignal[]} signals 同类型信号列表
 * @returns {SignalTypeStats} 单类型统计
 */
function createSingleTypeStats(type: string, signals: EvaluatedSignal[]): SignalTypeStats {
  const evaluatedSignals = signals.filter((signal) => signal.evaluable && signal.directionalReturn !== null);
  const returns = evaluatedSignals.map((signal) => signal.directionalReturn ?? 0);
  const hits = evaluatedSignals.filter((signal) => signal.hit === true).length;
  const returnSum = returns.reduce((sum, value) => sum + value, 0);

  return {
    type,
    name: signals[0]?.name ?? type,
    total: signals.length,
    evaluated: evaluatedSignals.length,
    hits,
    hitRate: evaluatedSignals.length > 0 ? hits / evaluatedSignals.length : 0,
    averageReturn: evaluatedSignals.length > 0 ? returnSum / evaluatedSignals.length : 0,
    bestReturn: returns.length > 0 ? Math.max(...returns) : 0,
    worstReturn: returns.length > 0 ? Math.min(...returns) : 0,
  };
}

/**
 * 格式化信号方向。
 * @param {'bullish' | 'bearish' | 'neutral'} direction 信号方向
 * @returns {string} 方向文案
 */
function formatDirection(direction: 'bullish' | 'bearish' | 'neutral'): string {
  if (direction === 'bullish') {
    return '看涨';
  }

  if (direction === 'bearish') {
    return '看跌';
  }

  return '中性';
}

/**
 * 格式化命中结果。
 * @param {EvaluatedSignal} signal 评估信号
 * @returns {string} 命中结果文案
 */
function formatHitResult(signal: EvaluatedSignal): string {
  if (!signal.evaluable) {
    return '未满观察期';
  }

  return signal.hit === true ? '命中' : '未命中';
}

/**
 * 获取收益样式类。
 * @param {number} value 收益率
 * @returns {string} 样式类名
 */
function getReturnClass(value: number): string {
  if (value > 0) {
    return 'signal-stats-up';
  }

  if (value < 0) {
    return 'signal-stats-down';
  }

  return '';
}
