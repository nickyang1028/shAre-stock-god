import type { KLine } from '@share-stock-god/shared';
import { fetchDailyKLines as fetchFromEastmoney } from './eastmoney.js';
import { fetchDailyKLines as fetchFromTushare, isTushareAvailable } from './tushare.js';

export type MarketDataResult = {
  /** 股票代码 */
  symbol: string;
  /** 股票名称 */
  name: string;
  /** K 线数据 */
  klines: KLine[];
  /** 行情来源 */
  source: string;
};

/**
 * 获取市场数据（优先 Tushare，失败回退到东方财富）。
 * @param {string} symbol 股票代码
 * @param {number} limit 返回数据条数
 * @returns {Promise<MarketDataResult>} 行情数据
 */
export async function fetchMarketData(
  symbol: string,
  limit: number
): Promise<MarketDataResult> {
  // 计算起始日期：多取一些数据用于技术指标计算。
  const historyLimit = Math.max(limit + 60, 120);

  // 副作用说明：优先请求 Tushare，失败时降级到东方财富。
  if (isTushareAvailable()) {
    try {
      const data = await fetchFromTushare({ symbol, limit: historyLimit });
      return { ...data, source: 'tushare' };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`Tushare获取失败，回退到东方财富: ${message}`);
    }
  }

  const data = await fetchFromEastmoney({ symbol, limit: historyLimit });
  return { ...data, source: 'eastmoney' };
}
