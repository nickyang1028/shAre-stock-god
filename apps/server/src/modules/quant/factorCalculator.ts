import type { KLine } from '@share-stock-god/shared';

/**
 * 股票因子计算结果
 */
export type StockFactors = {
  /** 股票代码 */
  symbol: string;
  /** 股票名称 */
  name: string;
  /** 最新收盘价 */
  latestPrice: number;
  /** 涨跌额 */
  change: number;
  /** 涨跌幅（小数形式，如 0.05 表示 5%） */
  changePercent: number;
  /** 移动平均线因子 */
  ma: {
    ma5: number;
    ma10: number;
    ma20: number;
    ma60: number;
    trend: 'up' | 'down' | 'sideway';
  };
  /** 成交量因子 */
  volume: {
    latestVolume: number;
    avgVolume5: number;
    volumeRatio: number;
    trend: 'up' | 'down' | 'stable';
  };
  /** 资金流向因子（估算） */
  capitalFlow: {
    mainForceInflow: number;
    mainForceOutflow: number;
    netInflow: number;
    inflowRatio: number;
    signal: 'inflow' | 'outflow' | 'neutral';
  };
  /** 技术指标信号 */
  signals: {
    maGoldenCross: boolean;
    maDeadCross: boolean;
    volumeBreakout: boolean;
    capitalInflowSignal: boolean;
  };
  /** 计算时间戳 */
  timestamp: number;
};

/**
 * 计算移动平均线
 */
function calculateMA(data: number[], period: number): number {
  if (data.length < period) return 0;
  const sum = data.slice(-period).reduce((a, b) => a + b, 0);
  return sum / period;
}

/**
 * 计算趋势方向
 */
function calculateTrend(shortMA: number, longMA: number): 'up' | 'down' | 'sideway' {
  const diff = (shortMA - longMA) / longMA;
  if (diff > 0.02) return 'up';
  if (diff < -0.02) return 'down';
  return 'sideway';
}

/**
 * 估算主力资金流向（简化算法）
 * 基于价格位置和大单占比估算
 */
function estimateCapitalFlow(
  klines: KLine[],
  periods: number = 5
): StockFactors['capitalFlow'] {
  const recentKlines = klines.slice(-periods);

  let totalInflow = 0;
  let totalOutflow = 0;

  recentKlines.forEach((kline) => {
    // 简化估算：收盘价在当日区间位置 + 成交量判断
    const pricePosition = (kline.close - kline.low) / (kline.high - kline.low);
    const volumeWeight = kline.volume / 10000; // 简化权重

    // 收盘在高位且放量，估算为流入
    if (pricePosition > 0.6 && kline.close > kline.open) {
      totalInflow += volumeWeight * pricePosition;
    }
    // 收盘在低位且放量，估算为流出
    else if (pricePosition < 0.4 && kline.close < kline.open) {
      totalOutflow += volumeWeight * (1 - pricePosition);
    }
  });

  const netInflow = totalInflow - totalOutflow;
  const totalFlow = totalInflow + totalOutflow;
  const inflowRatio = totalFlow > 0 ? (totalInflow / totalFlow) * 100 : 50;

  return {
    mainForceInflow: Math.round(totalInflow * 100) / 100,
    mainForceOutflow: Math.round(totalOutflow * 100) / 100,
    netInflow: Math.round(netInflow * 100) / 100,
    inflowRatio: Math.round(inflowRatio * 100) / 100,
    signal: netInflow > 0 ? 'inflow' : netInflow < 0 ? 'outflow' : 'neutral',
  };
}

/**
 * 计算股票因子
 * @param klines K线数据
 * @param symbol 股票代码
 * @param name 股票名称
 * @returns 完整的因子计算结果
 */
export function calculateFactors(
  klines: KLine[],
  symbol: string,
  name: string
): StockFactors {
  if (klines.length === 0) {
    throw new Error('K线数据为空，无法计算因子');
  }

  const closes = klines.map((k) => k.close);
  const volumes = klines.map((k) => k.volume);
  const latestKline = klines[klines.length - 1];
  const prevKline = klines[klines.length - 2] || latestKline;

  // 计算MA
  const ma5 = calculateMA(closes, 5);
  const ma10 = calculateMA(closes, 10);
  const ma20 = calculateMA(closes, 20);
  const ma60 = calculateMA(closes, 60);

  // 计算成交量
  const latestVolume = latestKline.volume;
  const avgVolume5 = calculateMA(volumes, 5);
  const volumeRatio = avgVolume5 > 0 ? latestVolume / avgVolume5 : 1;

  // 计算涨跌幅
  const change = latestKline.close - prevKline.close;
  const changePercent = prevKline.close > 0 ? change / prevKline.close : 0;

  // 计算资金流向
  const capitalFlow = estimateCapitalFlow(klines, 5);

  // 计算信号
  const maGoldenCross = ma5 > ma10 && calculateMA(closes.slice(0, -1), 5) <= calculateMA(closes.slice(0, -1), 10);
  const maDeadCross = ma5 < ma10 && calculateMA(closes.slice(0, -1), 5) >= calculateMA(closes.slice(0, -1), 10);
  const volumeBreakout = volumeRatio > 2.0;
  const capitalInflowSignal = capitalFlow.signal === 'inflow' && capitalFlow.inflowRatio > 60;

  return {
    symbol,
    name,
    latestPrice: latestKline.close,
    change,
    changePercent,
    ma: {
      ma5,
      ma10,
      ma20,
      ma60,
      trend: calculateTrend(ma5, ma20),
    },
    volume: {
      latestVolume,
      avgVolume5,
      volumeRatio,
      trend: volumeRatio > 1.5 ? 'up' : volumeRatio < 0.7 ? 'down' : 'stable',
    },
    capitalFlow,
    signals: {
      maGoldenCross,
      maDeadCross,
      volumeBreakout,
      capitalInflowSignal,
    },
    timestamp: Date.now(),
  };
}

/**
 * 批量计算多只股票因子
 * @param stocks 股票代码和K线数据数组
 * @returns 因子结果数组
 */
export function batchCalculateFactors(
  stocks: { symbol: string; name: string; klines: KLine[] }[]
): StockFactors[] {
  return stocks
    .map((stock) => {
      try {
        return calculateFactors(stock.klines, stock.symbol, stock.name);
      } catch {
        return null;
      }
    })
    .filter((factor): factor is StockFactors => factor !== null);
}
