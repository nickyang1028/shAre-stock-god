import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import type {
  BacktestConfig,
  BacktestStabilityResult,
  BacktestStrategyConfig,
  BacktestStrategyType,
} from '@share-stock-god/shared';
import { formatNumber, formatPercent } from '../Quant/utils.js';
import { normalizeSymbol } from '../Watchlist/storage.js';
import './styles.scss';

type StabilityFormState = {
  /** 股票代码 */
  symbol: string;
  /** 历史 K 线数量 */
  limit: number;
  /** 滚动窗口 K 线数量 */
  windowSize: number;
  /** 滚动步长 K 线数量 */
  stepSize: number;
  /** 初始资金 */
  initialCapital: number;
  /** 手续费率 */
  feeRate: number;
  /** 卖出印花税率 */
  stampTaxRate: number;
  /** 滑点率 */
  slippageRate: number;
  /** 仓位比例 */
  positionRatio: number;
  /** 止损比例 */
  stopLossRate: number;
  /** 止盈比例 */
  takeProfitRate: number;
  /** 策略类型 */
  strategyType: BacktestStrategyType;
  /** 短均线周期 */
  shortPeriod: number;
  /** 长均线周期 */
  longPeriod: number;
  /** 趋势均线周期 */
  trendPeriod: number;
  /** 回踩容忍比例 */
  pullbackTolerance: number;
  /** 突破回看周期 */
  breakoutPeriod: number;
  /** 跌破退出周期 */
  exitPeriod: number;
  /** MACD 零轴过滤 */
  zeroAxisFilter: boolean;
};

type StabilityApiResponse = {
  /** 请求是否成功 */
  success?: boolean;
  /** 稳定性分析结果 */
  data?: BacktestStabilityResult;
  /** 错误消息 */
  message?: string;
};

type StrategyOption = {
  /** 策略类型 */
  type: BacktestStrategyType;
  /** 策略名称 */
  label: string;
};

type StrategyStabilityPageProps = {
  /** 外部传入的股票代码 */
  symbol?: string;
  /** 股票代码变更回调 */
  onSymbolChange?: (symbol: string) => void;
  /** 是否隐藏页面标题 */
  hideHeader?: boolean;
};

const DEFAULT_FORM: StabilityFormState = {
  symbol: '600519',
  limit: 500,
  windowSize: 120,
  stepSize: 30,
  initialCapital: 100000,
  feeRate: 0.0003,
  stampTaxRate: 0.0005,
  slippageRate: 0,
  positionRatio: 1,
  stopLossRate: 0,
  takeProfitRate: 0,
  strategyType: 'ma_cross',
  shortPeriod: 5,
  longPeriod: 10,
  trendPeriod: 20,
  pullbackTolerance: 0.015,
  breakoutPeriod: 20,
  exitPeriod: 10,
  zeroAxisFilter: false,
};

const STRATEGY_OPTIONS: StrategyOption[] = [
  { type: 'ma_cross', label: '均线交叉' },
  { type: 'macd_cross', label: 'MACD 交叉' },
  { type: 'ma_trend_pullback', label: '趋势回踩' },
  { type: 'breakout', label: '区间突破' },
];

/**
 * 策略历史稳定性分析页面。
 * @returns {JSX.Element} 策略稳定性分析视图
 */
export function StrategyStabilityPage(props: StrategyStabilityPageProps) {
  const { symbol: controlledSymbol, onSymbolChange, hideHeader = false } = props;
  const [searchParams] = useSearchParams();
  const [formState, setFormState] = useState<StabilityFormState>({
    ...DEFAULT_FORM,
    symbol: controlledSymbol ?? searchParams.get('symbol') ?? DEFAULT_FORM.symbol,
  });
  const [result, setResult] = useState<BacktestStabilityResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (controlledSymbol === undefined) {
      return;
    }

    setFormState((currentState) => ({
      ...currentState,
      symbol: controlledSymbol,
    }));
  }, [controlledSymbol]);

  /**
   * 提交稳定性分析。
   * @param {FormEvent<HTMLFormElement>} event 表单提交事件
   * @returns {void} 无返回值
   */
  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void runStabilityAnalysis();
  }

  /**
   * 更新股票代码。
   * @param {string} symbol 股票代码
   * @returns {void} 无返回值
   */
  function updateSymbol(symbol: string): void {
    setFormState((currentState) => ({
      ...currentState,
      symbol,
    }));
    onSymbolChange?.(symbol);
  }

  /**
   * 更新数字表单字段。
   * @param {keyof StabilityFormState} field 字段名
   * @param {string} value 字段值
   * @returns {void} 无返回值
   */
  function updateNumberField(field: keyof StabilityFormState, value: string): void {
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue)) {
      return;
    }

    setFormState((currentState) => ({
      ...currentState,
      [field]: numberValue,
    }));
  }

  /**
   * 更新策略类型。
   * @param {string} value 策略类型原始值
   * @returns {void} 无返回值
   */
  function updateStrategyType(value: string): void {
    const strategyType = STRATEGY_OPTIONS.some((option) => option.type === value)
      ? (value as BacktestStrategyType)
      : 'ma_cross';

    setFormState((currentState) => ({
      ...currentState,
      strategyType,
    }));
  }

  /**
   * 请求稳定性分析接口。
   * @returns {Promise<void>} 无返回值
   */
  async function runStabilityAnalysis(): Promise<void> {
    const symbol = normalizeSymbol(formState.symbol);
    if (symbol.length === 0) {
      setErrorMessage('请输入股票代码');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const response = await fetch(`/api/backtest/${encodeURIComponent(symbol)}/stability`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(createRequestBody(formState)),
      });
      const payload = (await response.json().catch(() => ({}))) as StabilityApiResponse;

      if (!response.ok || !payload.success || payload.data === undefined) {
        throw new Error(payload.message ?? `请求失败 (${response.status})`);
      }

      setResult(payload.data);
      setFormState((currentState) => ({
        ...currentState,
        symbol,
      }));
    } catch (error: unknown) {
      const nextMessage = error instanceof Error ? error.message : '稳定性分析失败';
      setResult(null);
      setErrorMessage(nextMessage);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="strategy-stability-page">
      {!hideHeader && (
        <header className="strategy-stability-header">
          <div>
            <h1>策略历史稳定性</h1>
            <p>用滚动窗口多次回测，观察策略是否只在少数行情阶段有效。</p>
          </div>
        </header>
      )}

      <section className="strategy-stability-card strategy-stability-form-card">
        <form onSubmit={handleSubmit}>
          <label>
            <span>股票代码</span>
            <input
              value={formState.symbol}
              onChange={(event) => updateSymbol(event.target.value)}
              disabled={loading}
              placeholder="如 600519"
            />
          </label>
          <label>
            <span>策略类型</span>
            <select
              value={formState.strategyType}
              onChange={(event) => updateStrategyType(event.target.value)}
              disabled={loading}
            >
              {STRATEGY_OPTIONS.map((option) => (
                <option key={option.type} value={option.type}>{option.label}</option>
              ))}
            </select>
          </label>
          <label>
            <span>历史范围</span>
            <input
              value={formState.limit}
              onChange={(event) => updateNumberField('limit', event.target.value)}
              disabled={loading}
              inputMode="numeric"
            />
          </label>
          <label>
            <span>窗口大小</span>
            <input
              value={formState.windowSize}
              onChange={(event) => updateNumberField('windowSize', event.target.value)}
              disabled={loading}
              inputMode="numeric"
            />
          </label>
          <label>
            <span>滚动步长</span>
            <input
              value={formState.stepSize}
              onChange={(event) => updateNumberField('stepSize', event.target.value)}
              disabled={loading}
              inputMode="numeric"
            />
          </label>
          {(formState.strategyType === 'ma_cross' || formState.strategyType === 'ma_trend_pullback') && (
            <label>
              <span>短均线</span>
              <input
                value={formState.shortPeriod}
                onChange={(event) => updateNumberField('shortPeriod', event.target.value)}
                disabled={loading}
                inputMode="numeric"
              />
            </label>
          )}
          {formState.strategyType === 'ma_cross' && (
            <label>
              <span>长均线</span>
              <input
                value={formState.longPeriod}
                onChange={(event) => updateNumberField('longPeriod', event.target.value)}
                disabled={loading}
                inputMode="numeric"
              />
            </label>
          )}
          {formState.strategyType === 'ma_trend_pullback' && (
            <>
              <label>
                <span>趋势均线</span>
                <input
                  value={formState.trendPeriod}
                  onChange={(event) => updateNumberField('trendPeriod', event.target.value)}
                  disabled={loading}
                  inputMode="numeric"
                />
              </label>
              <label>
                <span>回踩容忍</span>
                <input
                  value={formState.pullbackTolerance}
                  onChange={(event) => updateNumberField('pullbackTolerance', event.target.value)}
                  disabled={loading}
                  inputMode="decimal"
                />
              </label>
            </>
          )}
          {formState.strategyType === 'breakout' && (
            <>
              <label>
                <span>突破周期</span>
                <input
                  value={formState.breakoutPeriod}
                  onChange={(event) => updateNumberField('breakoutPeriod', event.target.value)}
                  disabled={loading}
                  inputMode="numeric"
                />
              </label>
              <label>
                <span>退出周期</span>
                <input
                  value={formState.exitPeriod}
                  onChange={(event) => updateNumberField('exitPeriod', event.target.value)}
                  disabled={loading}
                  inputMode="numeric"
                />
              </label>
            </>
          )}
          {formState.strategyType === 'macd_cross' && (
            <label className="strategy-stability-checkbox">
              <input
                type="checkbox"
                checked={formState.zeroAxisFilter}
                onChange={(event) => setFormState((currentState) => ({
                  ...currentState,
                  zeroAxisFilter: event.target.checked,
                }))}
                disabled={loading}
              />
              <span>启用零轴过滤</span>
            </label>
          )}
          <button type="submit" disabled={loading}>{loading ? '分析中...' : '开始分析'}</button>
        </form>
        <p className="strategy-stability-rule">
          稳定性口径：在指定历史范围内，每隔“滚动步长”截取一段“窗口大小”的历史数据独立回测；正收益窗口越多、收益波动越小、平均回撤越低，稳定性评分越高。
        </p>
        {errorMessage && <div className="strategy-stability-error">{errorMessage}</div>}
      </section>

      {result !== null && (
        <>
          <section className="strategy-stability-dashboard">
            <div className="strategy-stability-stat-card score">
              <span>稳定性评分</span>
              <strong>{result.summary.stabilityScore}</strong>
            </div>
            <div className="strategy-stability-stat-card">
              <span>窗口数</span>
              <strong>{result.summary.windowCount}</strong>
            </div>
            <div className="strategy-stability-stat-card up">
              <span>正收益占比</span>
              <strong>{formatPercent(result.summary.positiveWindowRate)}</strong>
            </div>
            <div className="strategy-stability-stat-card">
              <span>平均收益</span>
              <strong>{formatPercent(result.summary.averageReturn)}</strong>
            </div>
            <div className="strategy-stability-stat-card">
              <span>收益波动</span>
              <strong>{formatPercent(result.summary.returnStdDev)}</strong>
            </div>
            <div className="strategy-stability-stat-card down">
              <span>平均回撤</span>
              <strong>{formatPercent(result.summary.averageMaxDrawdown)}</strong>
            </div>
          </section>

          <section className="strategy-stability-card">
            <div className="strategy-stability-section-title">
              <h2>滚动窗口明细</h2>
              <span>{result.name} · {result.windowSize} 根 K 线 / 步长 {result.stepSize}</span>
            </div>
            <div className="strategy-stability-table-wrap">
              <table className="strategy-stability-table">
                <thead>
                  <tr>
                    <th>窗口</th>
                    <th>区间</th>
                    <th>总收益</th>
                    <th>年化收益</th>
                    <th>最大回撤</th>
                    <th>胜率</th>
                    <th>交易次数</th>
                    <th>超额收益</th>
                    <th>盈亏比</th>
                  </tr>
                </thead>
                <tbody>
                  {result.windows.map((window, index) => (
                    <tr key={window.id}>
                      <td>#{index + 1}</td>
                      <td>{window.startDate} ~ {window.endDate}</td>
                      <td className={getReturnClass(window.totalReturn)}>{formatPercent(window.totalReturn)}</td>
                      <td className={getReturnClass(window.annualizedReturn)}>{formatPercent(window.annualizedReturn)}</td>
                      <td className="strategy-stability-down">{formatPercent(window.maxDrawdown)}</td>
                      <td>{formatPercent(window.winRate)}</td>
                      <td>{formatNumber(window.tradeCount, 0)}</td>
                      <td className={getReturnClass(window.excessReturn)}>{formatPercent(window.excessReturn)}</td>
                      <td>{formatNumber(window.profitLossRatio)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  );
}

/**
 * 生成稳定性分析请求体。
 * @param {StabilityFormState} form 表单状态
 * @returns {BacktestConfig & { limit: number; windowSize: number; stepSize: number }} 请求体
 */
function createRequestBody(
  form: StabilityFormState
): BacktestConfig & { limit: number; windowSize: number; stepSize: number } {
  return {
    limit: form.limit,
    windowSize: form.windowSize,
    stepSize: form.stepSize,
    initialCapital: form.initialCapital,
    feeRate: form.feeRate,
    stampTaxRate: form.stampTaxRate,
    slippageRate: form.slippageRate,
    positionRatio: form.positionRatio,
    stopLossRate: form.stopLossRate,
    takeProfitRate: form.takeProfitRate,
    lotSize: 100,
    executionPrice: 'next_open',
    strategy: createStrategyConfig(form),
  };
}

/**
 * 生成策略配置。
 * @param {StabilityFormState} form 表单状态
 * @returns {BacktestStrategyConfig} 策略配置
 */
function createStrategyConfig(form: StabilityFormState): BacktestStrategyConfig {
  if (form.strategyType === 'macd_cross') {
    return {
      type: 'macd_cross',
      zeroAxisFilter: form.zeroAxisFilter,
    };
  }

  if (form.strategyType === 'ma_trend_pullback') {
    return {
      type: 'ma_trend_pullback',
      shortPeriod: form.shortPeriod,
      trendPeriod: form.trendPeriod,
      pullbackTolerance: form.pullbackTolerance,
    };
  }

  if (form.strategyType === 'breakout') {
    return {
      type: 'breakout',
      breakoutPeriod: form.breakoutPeriod,
      exitPeriod: form.exitPeriod,
    };
  }

  return {
    type: 'ma_cross',
    shortPeriod: form.shortPeriod,
    longPeriod: form.longPeriod,
  };
}

/**
 * 获取收益样式类。
 * @param {number} value 收益率
 * @returns {string} 样式类名
 */
function getReturnClass(value: number): string {
  if (value > 0) {
    return 'strategy-stability-up';
  }

  if (value < 0) {
    return 'strategy-stability-down';
  }

  return '';
}
