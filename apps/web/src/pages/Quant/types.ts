/**
 * 因子数据类型定义
 */
export type FactorData = {
  symbol: string;
  name: string;
  latestPrice: number;
  change: number;
  changePercent: number;
  ma: {
    ma5: number;
    ma10: number;
    ma20: number;
    ma60: number;
    trend: 'up' | 'down' | 'sideway';
  };
  volume: {
    latestVolume: number;
    avgVolume5: number;
    volumeRatio: number;
    trend: 'up' | 'down' | 'stable';
  };
  capitalFlow: {
    mainForceInflow: number;
    mainForceOutflow: number;
    netInflow: number;
    inflowRatio: number;
    signal: 'inflow' | 'outflow' | 'neutral';
  };
  signals: {
    maGoldenCross: boolean;
    maDeadCross: boolean;
    volumeBreakout: boolean;
    capitalInflowSignal: boolean;
  };
  source: string;
  timestamp: number;
};
