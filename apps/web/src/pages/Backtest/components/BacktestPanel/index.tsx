import { useMemo, useState } from 'react';
import type { BacktestResult } from '@share-stock-god/shared';
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
  /** 短周期均线 */
  shortPeriod: number;
  /** 长周期均线 */
  longPeriod: number;
};

const DEFAULT_FORM: BacktestFormState = {
  limit: 240,
  initialCapital: 100000,
  feeRate: 0.0003,
  stampTaxRate: 0.0005,
  slippageRate: 0,
  shortPeriod: 5,
  longPeriod: 10,
};

/**
 * 回测控制面板组件
 * @param {BacktestPanelProps} props 组件属性
 * @returns {JSX.Element} 回测控制面板
 */
export function BacktestPanel({ symbol }: BacktestPanelProps) {
  const [form, setForm] = useState<BacktestFormState>(DEFAULT_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<BacktestResult | null>(null);

  const recentTrades = useMemo(
    () => result?.trades.slice(-8).reverse() ?? [],
    [result]
  );

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
          strategy: {
            type: 'ma_cross',
            shortPeriod: form.shortPeriod,
            longPeriod: form.longPeriod,
          },
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

  return (
    <section className="backtest-section">
      <div className="backtest-header">
        <div>
          <h2>策略回测</h2>
          <p>MA 金叉买入、死叉卖出，次日开盘价成交</p>
        </div>
        <button
          type="button"
          className="run-backtest-btn"
          onClick={handleRunBacktest}
          disabled={loading || !symbol.trim()}
        >
          {loading ? '回测中...' : '运行回测'}
        </button>
      </div>

      <div className="backtest-form">
        <NumberField
          label="样本数"
          value={form.limit}
          min={30}
          max={1000}
          step={10}
          onChange={(value) => updateNumberField('limit', value)}
        />
        <NumberField
          label="初始资金"
          value={form.initialCapital}
          min={1000}
          max={100000000}
          step={10000}
          onChange={(value) => updateNumberField('initialCapital', value)}
        />
        <NumberField
          label="手续费率"
          value={form.feeRate}
          min={0}
          max={0.01}
          step={0.0001}
          onChange={(value) => updateNumberField('feeRate', value)}
        />
        <NumberField
          label="印花税率"
          value={form.stampTaxRate}
          min={0}
          max={0.01}
          step={0.0001}
          onChange={(value) => updateNumberField('stampTaxRate', value)}
        />
        <NumberField
          label="滑点率"
          value={form.slippageRate}
          min={0}
          max={0.02}
          step={0.0005}
          onChange={(value) => updateNumberField('slippageRate', value)}
        />
        <NumberField
          label="短均线"
          value={form.shortPeriod}
          min={2}
          max={120}
          step={1}
          onChange={(value) => updateNumberField('shortPeriod', value)}
        />
        <NumberField
          label="长均线"
          value={form.longPeriod}
          min={3}
          max={240}
          step={1}
          onChange={(value) => updateNumberField('longPeriod', value)}
        />
      </div>

      {error && <div className="backtest-error">{error}</div>}

      {result && (
        <div className="backtest-results">
          <div className="metrics-grid">
            <MetricCard label="期末权益" value={formatMoney(result.metrics.finalEquity)} />
            <MetricCard label="总收益率" value={formatPercent(result.metrics.totalReturn)} />
            <MetricCard
              label="年化收益率"
              value={formatPercent(result.metrics.annualizedReturn)}
            />
            <MetricCard
              label="最大回撤"
              value={formatPercent(result.metrics.maxDrawdown)}
            />
            <MetricCard label="交易次数" value={`${result.metrics.tradeCount}`} />
            <MetricCard label="胜率" value={formatPercent(result.metrics.winRate)} />
          </div>

          <EquityStrip result={result} />
          <TradeTable trades={recentTrades} />
        </div>
      )}
    </section>
  );
}
