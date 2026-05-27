import type { Request, Response } from 'express';
import { fetchDailyKLines as fetchFromTushare } from '../market-data/tushare.js';
import { fetchDailyKLines as fetchFromEastmoney } from '../market-data/eastmoney.js';
import { isTushareAvailable } from '../market-data/tushare.js';
import { calculateFactors, type StockFactors } from './factorCalculator.js';
import type { KLine } from '@share-stock-god/shared';

/**
 * 量化分析查询参数
 */
interface QuantQueryParams {
  /** 股票代码 */
  symbol: string;
  /** 历史数据条数（默认60） */
  limit?: number;
}

/**
 * 获取市场数据（优先Tushare，失败回退到东方财富）
 */
async function fetchMarketData(
  symbol: string,
  limit: number
): Promise<{ symbol: string; name: string; klines: KLine[]; source: string }> {
  // 计算起始日期：多取一些数据用于技术指标计算
  const historyLimit = Math.max(limit + 60, 120);

  // 尝试Tushare优先
  if (isTushareAvailable()) {
    try {
      const data = await fetchFromTushare({ symbol, limit: historyLimit });
      return { ...data, source: 'tushare' };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`Tushare获取失败，回退到东方财富: ${message}`);
    }
  }

  // 回退到东方财富
  const data = await fetchFromEastmoney({ symbol, limit: historyLimit });
  return { ...data, source: 'eastmoney' };
}

/**
 * 处理量化分析请求
 * GET /api/quant/:symbol/analysis
 */
export async function handleQuantAnalysis(
  request: Request,
  response: Response
): Promise<void> {
  const symbolParam = request.params.symbol;
  const symbol = typeof symbolParam === 'string' ? symbolParam : '';

  const limitParam = request.query.limit;
  const limit =
    typeof limitParam === 'string' ? Number(limitParam) || 60 : 60;

  if (!symbol) {
    response.status(400).json({ message: '股票代码不能为空' });
    return;
  }

  try {
    // 1. 获取市场数据
    const marketData = await fetchMarketData(symbol, limit);

    // 2. 计算因子
    const factors: StockFactors = calculateFactors(
      marketData.klines.slice(-limit),
      marketData.symbol,
      marketData.name
    );

    // 3. 返回结果
    response.json({
      success: true,
      data: {
        ...factors,
        source: marketData.source,
        dataPoints: marketData.klines.length,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '计算因子失败';
    console.error(`[QuantAnalysis] ${symbol} 计算失败:`, message);
    response.status(500).json({
      success: false,
      message,
    });
  }
}

/**
 * 处理批量量化分析请求
 * POST /api/quant/batch
 * Body: { symbols: string[], limit?: number }
 */
export async function handleBatchQuantAnalysis(
  request: Request,
  response: Response
): Promise<void> {
  const { symbols, limit = 60 } = request.body;

  if (!Array.isArray(symbols) || symbols.length === 0) {
    response.status(400).json({ message: '股票代码列表不能为空' });
    return;
  }

  if (symbols.length > 50) {
    response.status(400).json({ message: '单次最多查询50只股票' });
    return;
  }

  try {
    const results: (StockFactors & { source: string })[] = [];
    const errors: { symbol: string; error: string }[] = [];

    // 串行处理避免触发频率限制
    for (const symbol of symbols) {
      try {
        const marketData = await fetchMarketData(symbol, limit);
        const factors = calculateFactors(
          marketData.klines.slice(-limit),
          marketData.symbol,
          marketData.name
        );
        results.push({ ...factors, source: marketData.source });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : '计算失败';
        errors.push({ symbol, error: message });
      }
    }

    response.json({
      success: true,
      data: {
        results,
        errors: errors.length > 0 ? errors : undefined,
        total: symbols.length,
        success: results.length,
        failed: errors.length,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '批量计算失败';
    response.status(500).json({
      success: false,
      message,
    });
  }
}
