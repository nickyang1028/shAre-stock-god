import type { StockAnalysisResponse } from '@share-stock-god/shared';
import { fetchDailyKLines as fetchFromEastmoney } from '../market-data/eastmoney.js';
import {
  fetchDailyKLines as fetchFromTushare,
  isTushareAvailable,
} from '../market-data/tushare.js';
import { detectSignals } from '../signals/detectSignals.js';

type GetStockAnalysisParams = {
  /** 股票代码 */
  symbol: string;
  /** 返回的最近交易日数量 */
  limit: number;
};

/**
 * 获取股票分析结果（K 线 + 信号）。
 * 优先使用 Tushare 数据源，失败时回退到东方财富。
 * @param {GetStockAnalysisParams} params 查询参数
 * @returns {Promise<StockAnalysisResponse>} 面向前端的分析结果
 */
export async function getStockAnalysis(
  params: GetStockAnalysisParams
): Promise<StockAnalysisResponse> {
  // 边界处理：将 limit 限制在 1~120，避免异常参数导致接口压力过大。
  const safeLimit = Number.isFinite(params.limit)
    ? Math.min(Math.max(params.limit, 1), 120)
    : 20;
  // 关键逻辑：额外拉取更长历史，保证均线与 MACD 计算有足够预热数据。
  const historyLimit = Math.max(safeLimit + 60, 120);

  // 尝试 Tushare 优先
  let marketData: {
    symbol: string;
    name: string;
    klines: import('@share-stock-god/shared').KLine[];
  };
  let dataSource: 'tushare' | 'eastmoney';

  if (isTushareAvailable()) {
    try {
      marketData = await fetchFromTushare({
        symbol: params.symbol,
        limit: historyLimit,
      });
      dataSource = 'tushare';
      console.log(`[${params.symbol}] 使用 Tushare 数据源`);
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.warn(`Tushare 获取失败，回退到东方财富: ${errorMsg}`);
      marketData = await fetchFromEastmoney({
        symbol: params.symbol,
        limit: historyLimit,
      });
      dataSource = 'eastmoney';
    }
  } else {
    // Tushare 未配置，直接使用东方财富
    console.log(`[${params.symbol}] Tushare 未配置，使用东方财富数据源`);
    marketData = await fetchFromEastmoney({
      symbol: params.symbol,
      limit: historyLimit,
    });
    dataSource = 'eastmoney';
  }

  const recentKlines = marketData.klines.slice(-safeLimit);
  const signals = detectSignals(marketData.klines).filter((signal) =>
    recentKlines.some((kline) => kline.timestamp === signal.timestamp)
  );
  // 按由近及远排序
  signals.reverse();

  return {
    symbol: marketData.symbol,
    name: marketData.name,
    period: '1d',
    limit: safeLimit,
    klines: recentKlines,
    signals,
    source: dataSource,
    adjustment: 'qfq',
  };
}
