import { useMemo } from 'react';
import type { BacktestResult } from '@share-stock-god/shared';

type EquityStripProps = {
  /** 回测结果 */
  result: BacktestResult;
};

type EquitySamplePoint = {
  /** 日期 */
  date: string;
  /** 权益 */
  equity: number;
  /** 柱高百分比 */
  height: number;
};

/**
 * 权益曲线概览组件。
 * @param {EquityStripProps} props 组件属性
 * @returns {JSX.Element} 权益曲线概览
 */
export function EquityStrip({ result }: EquityStripProps) {
  const equitySample = useMemo(() => createEquitySample(result), [result]);

  return (
    <div className="equity-strip" aria-label="权益曲线概览">
      {equitySample.map((point) => (
        <span
          key={point.date}
          className="equity-bar"
          style={{ height: `${point.height}%` }}
        />
      ))}
    </div>
  );
}

/**
 * 创建用于展示的权益曲线抽样数据。
 * @param {BacktestResult} result 回测结果
 * @returns {EquitySamplePoint[]} 抽样权益数据
 */
function createEquitySample(result: BacktestResult): EquitySamplePoint[] {
  if (result.equityCurve.length === 0) {
    return [];
  }

  const sampleSize = 40;
  const step = Math.max(Math.floor(result.equityCurve.length / sampleSize), 1);
  const sampled = result.equityCurve.filter((_, index) => index % step === 0);
  const equities = sampled.map((point) => point.equity);
  const minEquity = Math.min(...equities);
  const maxEquity = Math.max(...equities);
  const range = Math.max(maxEquity - minEquity, 1);

  return sampled.slice(-sampleSize).map((point) => ({
    date: point.date,
    equity: point.equity,
    height: 20 + ((point.equity - minEquity) / range) * 80,
  }));
}
