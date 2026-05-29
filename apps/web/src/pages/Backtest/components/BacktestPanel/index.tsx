import { useMemo, useState } from 'react';
import type {
  BacktestResult,
  BacktestScanResult,
  BacktestStrategyCompareResult,
  BacktestStrategyConfig,
  BacktestStrategyType,
} from '@share-stock-god/shared';
import { Tooltip } from '../../../../components/basic/Tooltip.js';
import { formatMoney, formatPercent } from '../../../../utils/format.js';
import { EquityStrip } from '../EquityStrip/index.js';
import { MetricCard } from '../MetricCard/index.js';
import { NumberField } from '../NumberField/index.js';
import { TradeTable } from '../TradeTable/index.js';
import './styles.scss';

type BacktestPanelProps = {
  /** 当前股票代码 */
  symbol: string;
};

type BacktestApiResponse = {
  /** 请求是否成功 */
  success?: boolean;
  /** 回测结果 */
  data?: BacktestResult;
  /** 错误消息 */
  message?: string;
};

type BacktestScanApiResponse = {
  /** 请求是否成功 */
  success?: boolean;
  /** 扫描结果 */
  data?: BacktestScanResult;
  /** 错误消息 */
  message?: string;
};

type BacktestCompareApiResponse = {
  /** 请求是否成功 */
  success?: boolean;
  /** 策略对比结果 */
  data?: BacktestStrategyCompareResult;
  /** 错误消息 */
  message?: string;
};

type BacktestFormState = {
  /** 回测样本 K 线条数 */
  limit: number;
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
  /** 短周期均线 */
  shortPeriod: number;
  /** 长周期均线 */
  longPeriod: number;
  /** 趋势均线 */
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

const DEFAULT_FORM: BacktestFormState = {
  limit: 240,
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

const STRATEGY_OPTIONS: Array<{
  /** 策略类型 */
  type: BacktestStrategyType;
  /** 策略名称 */
  label: string;
  /** 策略说明 */
  description: string;
}> = [
  {
    type: 'ma_cross',
    label: '均线交叉',
    description: '短均线上穿长均线买入，下穿卖出。',
  },
  {
    type: 'macd_cross',
    label: 'MACD 交叉',
    description: 'DIF 上穿 DEA 买入，下穿卖出。',
  },
  {
    type: 'ma_trend_pullback',
    label: '趋势回踩',
    description: '趋势均线上行时回踩买入，跌破趋势均线卖出。',
  },
  {
    type: 'breakout',
    label: '区间突破',
    description: '突破 N 日高点买入，跌破退出周期低点卖出。',
  },
];

/**
 * 回测控制面板组件
 * @param {BacktestPanelProps} props 组件属性
 * @returns {JSX.Element} 回测控制面板
 */
export function BacktestPanel({ symbol }: BacktestPanelProps) {
  const [form, setForm] = useState<BacktestFormState>(DEFAULT_FORM);
  const [loading, setLoading] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);
  const [compareLoading, setCompareLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [scanResult, setScanResult] = useState<BacktestScanResult | null>(null);
  const [compareResult, setCompareResult] = useState<BacktestStrategyCompareResult | null>(null);

  const trades = useMemo(
    () => result?.trades ?? [],
    [result]
  );

  const currentStrategyDescription =
    STRATEGY_OPTIONS.find((strategy) => strategy.type === form.strategyType)
      ?.description ?? '短均线上穿长均线买入，下穿卖出。';

  /**
   * 更新表单数值字段。
   * @param {keyof BacktestFormState} key 字段名
   * @param {string} value 输入值
   * @returns {void} 无返回值
   */
  function updateNumberField(
    key: keyof BacktestFormState,
    value: string
  ): void {
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue)) {
      return;
    }

    setForm((current) => ({
      ...current,
      [key]: numberValue,
    }));
  }

  /**
   * 更新策略类型。
   * @param {string} value 原始策略类型
   * @returns {void} 无返回值
   */
  function updateStrategyType(value: string): void {
    const strategyType = STRATEGY_OPTIONS.some((strategy) => strategy.type === value)
      ? (value as BacktestStrategyType)
      : 'ma_cross';

    setForm((current) => ({
      ...current,
      strategyType,
    }));

    if (strategyType !== 'ma_cross') {
      setScanResult(null);
    }
  }

  /**
   * 更新 MACD 零轴过滤开关。
   * @param {boolean} checked 是否启用
   * @returns {void} 无返回值
   */
  function updateZeroAxisFilter(checked: boolean): void {
    setForm((current) => ({
      ...current,
      zeroAxisFilter: checked,
    }));
  }

  /**
   * 根据当前表单创建策略配置。
   * @returns {BacktestStrategyConfig} 策略配置
   */
  function createStrategyConfig(): BacktestStrategyConfig {
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
   * 执行回测请求。
   * @returns {Promise<void>} 无返回值
   */
  async function handleRunBacktest(): Promise<void> {
    if (!symbol.trim()) {
      setError('请输入股票代码');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/backtest/${symbol.trim()}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...form,
          strategy: createStrategyConfig(),
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as BacktestApiResponse;
      if (!response.ok || !payload.success || payload.data === undefined) {
        throw new Error(payload.message ?? `请求失败 (${response.status})`);
      }

      setResult(payload.data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '回测失败';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  /**
   * 执行 MA 参数扫描请求。
   * @returns {Promise<void>} 无返回值
   */
  async function handleRunScan(): Promise<void> {
    if (!symbol.trim()) {
      setError('请输入股票代码');
      return;
    }

    setScanLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/backtest/${symbol.trim()}/scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...form,
          strategy: createStrategyConfig(),
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as BacktestScanApiResponse;
      if (!response.ok || !payload.success || payload.data === undefined) {
        throw new Error(payload.message ?? `请求失败 (${response.status})`);
      }

      setScanResult(payload.data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '参数扫描失败';
      setError(message);
    } finally {
      setScanLoading(false);
    }
  }

  /**
   * 执行策略表现对比请求。
   * @returns {Promise<void>} 无返回值
   */
  async function handleRunCompare(): Promise<void> {
    if (!symbol.trim()) {
      setError('请输入股票代码');
      return;
    }

    setCompareLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/backtest/${symbol.trim()}/compare`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...form,
          strategy: createStrategyConfig(),
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as BacktestCompareApiResponse;
      if (!response.ok || !payload.success || payload.data === undefined) {
        throw new Error(payload.message ?? `请求失败 (${response.status})`);
      }

      setCompareResult(payload.data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '策略对比失败';
      setError(message);
    } finally {
      setCompareLoading(false);
    }
  }

  return (
    <section className="backtest-section">
      <div className="backtest-header">
        <div>
          <h2>策略回测</h2>
          <p>{currentStrategyDescription} 次日开盘价成交。</p>
        </div>
        <div className="backtest-actions">
          <button
            type="button"
            className="run-backtest-btn"
            onClick={handleRunBacktest}
            disabled={loading || scanLoading || compareLoading || !symbol.trim()}
          >
            {loading ? '回测中...' : '运行回测'}
          </button>
          <button
            type="button"
            className="compare-backtest-btn"
            onClick={handleRunCompare}
            disabled={loading || scanLoading || compareLoading || !symbol.trim()}
          >
            {compareLoading ? '对比中...' : '策略表现对比'}
          </button>
          {form.strategyType === 'ma_cross' && (
            <button
              type="button"
              className="scan-backtest-btn"
              onClick={handleRunScan}
              disabled={loading || scanLoading || compareLoading || !symbol.trim()}
            >
              {scanLoading ? '对比中...' : '均线组合对比'}
            </button>
          )}
        </div>
      </div>

      <div className="backtest-form">
        <NumberField
          label={<Tooltip label="样本数" content="参与回测的最近交易日数量。样本越多，覆盖行情越长。" />}
          value={form.limit}
          min={30}
          max={1000}
          step={10}
          onChange={(value) => updateNumberField('limit', value)}
        />
        <NumberField
          label={<Tooltip label="初始资金" content="回测开始时账户可用现金，后续收益率以它作为基准。" />}
          value={form.initialCapital}
          min={1000}
          max={100000000}
          step={10000}
          onChange={(value) => updateNumberField('initialCapital', value)}
        />
        <NumberField
          label={<Tooltip label="手续费率" content="买入和卖出都会收取的交易费用比例。费用 = 成交金额 × 手续费率。" />}
          value={form.feeRate}
          min={0}
          max={0.01}
          step={0.0001}
          onChange={(value) => updateNumberField('feeRate', value)}
        />
        <NumberField
          label={<Tooltip label="印花税率" content="A 股卖出时收取的税费比例。印花税 = 卖出成交金额 × 印花税率。" />}
          value={form.stampTaxRate}
          min={0}
          max={0.01}
          step={0.0001}
          onChange={(value) => updateNumberField('stampTaxRate', value)}
        />
        <NumberField
          label={<Tooltip label="滑点率" content="模拟实际成交价相对信号价的不利偏移。买入价上浮，卖出价下调。" />}
          value={form.slippageRate}
          min={0}
          max={0.02}
          step={0.0005}
          onChange={(value) => updateNumberField('slippageRate', value)}
        />
        <NumberField
          label={<Tooltip label="仓位比例" content="每次买入使用可用现金的比例。1 表示满仓，0.5 表示半仓。" />}
          value={form.positionRatio}
          min={0.01}
          max={1}
          step={0.05}
          onChange={(value) => updateNumberField('positionRatio', value)}
        />
        <NumberField
          label={<Tooltip label="止损比例" content="持仓亏损达到该比例时触发卖出。0 表示不启用止损。" />}
          value={form.stopLossRate}
          min={0}
          max={0.5}
          step={0.01}
          onChange={(value) => updateNumberField('stopLossRate', value)}
        />
        <NumberField
          label={<Tooltip label="止盈比例" content="持仓盈利达到该比例时触发卖出。0 表示不启用止盈。" />}
          value={form.takeProfitRate}
          min={0}
          max={1}
          step={0.01}
          onChange={(value) => updateNumberField('takeProfitRate', value)}
        />
        <label className="select-field">
          <span>策略类型</span>
          <select
            value={form.strategyType}
            onChange={(event) => updateStrategyType(event.target.value)}
          >
            {STRATEGY_OPTIONS.map((strategy) => (
              <option key={strategy.type} value={strategy.type}>
                {strategy.label}
              </option>
            ))}
          </select>
        </label>
        {form.strategyType === 'macd_cross' && (
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={form.zeroAxisFilter}
              onChange={(event) => updateZeroAxisFilter(event.target.checked)}
            />
            <span>启用零轴过滤</span>
          </label>
        )}
        {(form.strategyType === 'ma_cross' ||
          form.strategyType === 'ma_trend_pullback') && (
          <NumberField
            label={<Tooltip label="短均线" content="短周期移动平均线，反映近期价格趋势；均线交叉中上穿长均线视为买入信号。" />}
            value={form.shortPeriod}
            min={2}
            max={120}
            step={1}
            onChange={(value) => updateNumberField('shortPeriod', value)}
          />
        )}
        {form.strategyType === 'ma_cross' && (
          <NumberField
            label={<Tooltip label="长均线" content="长周期移动平均线，反映更长时间趋势；短均线下穿长均线视为卖出信号。" />}
            value={form.longPeriod}
            min={3}
            max={240}
            step={1}
            onChange={(value) => updateNumberField('longPeriod', value)}
          />
        )}
        {form.strategyType === 'ma_trend_pullback' && (
          <>
            <NumberField
              label={<Tooltip label="趋势均线" content="趋势回踩策略中的趋势判断均线。均线上行且价格位于其上方时认为趋势较强。" />}
              value={form.trendPeriod}
              min={5}
              max={240}
              step={1}
              onChange={(value) => updateNumberField('trendPeriod', value)}
            />
            <NumberField
              label={<Tooltip label="回踩容忍" content="允许最低价距离趋势均线的比例范围。例如 0.015 表示允许在均线上方约 1.5% 内视为回踩。" />}
              value={form.pullbackTolerance}
              min={0}
              max={0.15}
              step={0.005}
              onChange={(value) => updateNumberField('pullbackTolerance', value)}
            />
          </>
        )}
        {form.strategyType === 'breakout' && (
          <>
            <NumberField
              label={<Tooltip label="突破周期" content="区间突破策略中，用过去 N 日最高价作为突破参考。收盘价突破该高点买入。" />}
              value={form.breakoutPeriod}
              min={5}
              max={240}
              step={1}
              onChange={(value) => updateNumberField('breakoutPeriod', value)}
            />
            <NumberField
              label={<Tooltip label="退出周期" content="区间突破策略中，用过去 N 日最低价作为退出参考。收盘价跌破该低点卖出。" />}
              value={form.exitPeriod}
              min={3}
              max={120}
              step={1}
              onChange={(value) => updateNumberField('exitPeriod', value)}
            />
          </>
        )}
      </div>

      {error && <div className="backtest-error">{error}</div>}

      {result && (
        <div className="backtest-results">
          <div className="metrics-grid">
            <MetricCard label={<Tooltip label="期末权益" content="回测结束时账户总权益。公式：现金 + 持仓股数 × 最后一日收盘价。" />} value={formatMoney(result.metrics.finalEquity)} />
            <MetricCard label={<Tooltip label="总收益率" content="公式：(期末权益 - 初始资金) / 初始资金。" />} value={formatPercent(result.metrics.totalReturn)} />
            <MetricCard
              label={<Tooltip label="年化收益率" content="将总收益按回测天数折算为一年收益。按 242 个交易日近似计算。" />}
              value={formatPercent(result.metrics.annualizedReturn)}
            />
            <MetricCard
              label={<Tooltip label="最大回撤" content="公式：(历史最高权益 - 后续最低权益) / 历史最高权益。表示账户从峰值最大跌幅。" />}
              value={formatPercent(result.metrics.maxDrawdown)}
            />
            <MetricCard label={<Tooltip label="交易次数" content="回测期间实际成交的买入和卖出流水总数。" />} value={`${result.metrics.tradeCount}`} />
            <MetricCard label={<Tooltip label="胜率" content="公式：盈利平仓次数 / 全部平仓次数。未卖出的持仓不计入胜率。" />} value={formatPercent(result.metrics.winRate)} />
            <MetricCard
              label={<Tooltip label="平均收益率" content="公式：全部平仓交易收益率之和 / 平仓次数。" />}
              value={formatPercent(result.metrics.averageProfitRate)}
            />
            <MetricCard label={<Tooltip label="盈亏比" content="公式：盈利交易收益率总和 / 亏损交易收益率绝对值总和。" />} value={`${result.metrics.profitLossRatio.toFixed(2)}`} />
            <MetricCard
              label={<Tooltip label="平均持仓" content="公式：全部平仓交易持仓天数之和 / 平仓次数。" />}
              value={`${result.metrics.averageHoldingDays.toFixed(1)} 天`}
            />
            <MetricCard
              label={<Tooltip label="最大连亏" content="回测中连续亏损平仓的最大次数，用来衡量策略连续失败风险。" />}
              value={`${result.metrics.maxConsecutiveLosses}`}
            />
            <MetricCard
              label={<Tooltip label="基准收益" content="买入并持有收益。公式：(最后收盘价 - 首日收盘价) / 首日收盘价。" />}
              value={formatPercent(result.metrics.benchmarkReturn)}
            />
            <MetricCard
              label={<Tooltip label="超额收益" content="公式：策略总收益率 - 买入并持有基准收益率。" />}
              value={formatPercent(result.metrics.excessReturn)}
            />
          </div>

          <EquityStrip result={result} />
          <TradeTable trades={trades} />
        </div>
      )}

      {scanResult && (
        <div className="scan-results">
          <div className="scan-results-header">
            <h3>均线组合对比</h3>
            <p>自动对比 MA5/10、MA5/20、MA5/30、MA10/20、MA10/30，按超额收益排序。</p>
          </div>
          <div className="scan-table-wrap">
            <table className="scan-table">
              <thead>
                <tr>
                  <th>
                    <Tooltip
                      label="短均线"
                      content="短周期移动平均线，反映较近交易日的价格趋势；本表对比 MA5 和 MA10。"
                    />
                  </th>
                  <th>
                    <Tooltip
                      label="长均线"
                      content="长周期移动平均线，反映更长时间的趋势；短均线上穿长均线视为买入信号。"
                    />
                  </th>
                  <th>
                    <Tooltip
                      label="总收益"
                      content="公式：(期末权益 - 初始资金) / 初始资金。"
                    />
                  </th>
                  <th>
                    <Tooltip
                      label="超额收益"
                      content="公式：策略总收益率 - 买入并持有基准收益率。用于观察策略是否跑赢单纯持有。"
                    />
                  </th>
                  <th>
                    <Tooltip
                      label="最大回撤"
                      content="公式：(历史最高权益 - 后续最低权益) / 历史最高权益。表示账户从峰值最大跌幅。"
                    />
                  </th>
                  <th>
                    <Tooltip
                      label="胜率"
                      content="公式：盈利平仓次数 / 全部平仓次数。未卖出的持仓不计入胜率。"
                    />
                  </th>
                  <th>
                    <Tooltip
                      label="交易次数"
                      content="回测期间实际成交的买入和卖出流水总数。"
                    />
                  </th>
                  <th>
                    <Tooltip
                      label="盈亏比"
                      content="公式：盈利交易收益率总和 / 亏损交易收益率绝对值总和。"
                    />
                  </th>
                </tr>
              </thead>
              <tbody>
                {scanResult.items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.strategy.type === 'ma_cross' ? item.strategy.shortPeriod : '-'}</td>
                    <td>{item.strategy.type === 'ma_cross' ? item.strategy.longPeriod : '-'}</td>
                    <td>{formatPercent(item.totalReturn)}</td>
                    <td>{formatPercent(item.excessReturn)}</td>
                    <td>{formatPercent(item.maxDrawdown)}</td>
                    <td>{formatPercent(item.winRate)}</td>
                    <td>{item.tradeCount}</td>
                    <td>{item.profitLossRatio.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {compareResult && (
        <div className="scan-results">
          <div className="scan-results-header">
            <h3>策略表现对比</h3>
            <p>使用当前资金、费用、仓位和止盈止损设置，对比四种策略默认参数。</p>
          </div>
          <div className="scan-table-wrap">
            <table className="scan-table">
              <thead>
                <tr>
                  <th>策略</th>
                  <th>
                    <Tooltip
                      label="总收益"
                      content="公式：(期末权益 - 初始资金) / 初始资金。"
                    />
                  </th>
                  <th>
                    <Tooltip
                      label="超额收益"
                      content="公式：策略总收益率 - 买入并持有基准收益率。用于观察策略是否跑赢单纯持有。"
                    />
                  </th>
                  <th>
                    <Tooltip
                      label="最大回撤"
                      content="公式：(历史最高权益 - 后续最低权益) / 历史最高权益。表示账户从峰值最大跌幅。"
                    />
                  </th>
                  <th>
                    <Tooltip
                      label="胜率"
                      content="公式：盈利平仓次数 / 全部平仓次数。未卖出的持仓不计入胜率。"
                    />
                  </th>
                  <th>
                    <Tooltip
                      label="交易次数"
                      content="回测期间实际成交的买入和卖出流水总数。"
                    />
                  </th>
                  <th>
                    <Tooltip
                      label="盈亏比"
                      content="公式：盈利交易收益率总和 / 亏损交易收益率绝对值总和。"
                    />
                  </th>
                </tr>
              </thead>
              <tbody>
                {compareResult.items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.strategyName}</td>
                    <td>{formatPercent(item.totalReturn)}</td>
                    <td>{formatPercent(item.excessReturn)}</td>
                    <td>{formatPercent(item.maxDrawdown)}</td>
                    <td>{formatPercent(item.winRate)}</td>
                    <td>{item.tradeCount}</td>
                    <td>{item.profitLossRatio.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
