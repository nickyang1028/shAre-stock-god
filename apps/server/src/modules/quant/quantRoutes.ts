import type { Request, Response } from 'express';
import { fetchMarketData } from '../market-data/fetchMarketData.js';
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
 * 解析并限制量化分析数据条数。
 * @param {unknown} value 原始 limit 参数
 * @returns {number} 可用于行情查询的条数
 */
function parseLimit(value: unknown): number {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return 60;
  }

  const parsedLimit = Number(value);
  if (!Number.isFinite(parsedLimit)) {
    return 60;
  }

  // 边界处理：至少需要 2 条才能计算涨跌，最多限制 240 条避免误请求过大。
  return Math.min(Math.max(Math.trunc(parsedLimit), 2), 240);
}

/**
 * 处理量化分析请求
 * GET /api/quant/:symbol/analysis
 * @param {Request} request Express 请求对象
 * @param {Response} response Express 响应对象
 * @returns {Promise<void>} 无返回值
 */
export async function handleQuantAnalysis(
  request: Request,
  response: Response
): Promise<void> {
  const symbolParam = request.params.symbol;
  const symbol = typeof symbolParam === 'string' ? symbolParam : '';

  const limitParam = request.query.limit;
  const limit = parseLimit(limitParam);

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
 * @param {Request} request Express 请求对象
 * @param {Response} response Express 响应对象
 * @returns {Promise<void>} 无返回值
 */
export async function handleBatchQuantAnalysis(
  request: Request,
  response: Response
): Promise<void> {
  const body = request.body as { symbols?: unknown; limit?: unknown };
  const symbols = body.symbols;
  const limit = parseLimit(body.limit);

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
      if (typeof symbol !== 'string' || !symbol.trim()) {
        errors.push({ symbol: String(symbol), error: '股票代码必须为非空字符串' });
        continue;
      }

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
