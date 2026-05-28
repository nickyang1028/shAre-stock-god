import type { Request, Response } from 'express';
import type { BacktestConfig } from '@share-stock-god/shared';
import { fetchMarketData } from '../market-data/fetchMarketData.js';
import { runBacktest } from '../quant/backtester.js';

/**
 * 解析回测历史数据条数。
 * @param {unknown} value 原始 limit 参数
 * @returns {number} 可用于回测的 K 线条数
 */
function parseBacktestLimit(value: unknown): number {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return 240;
  }

  const parsedLimit = Number(value);
  if (!Number.isFinite(parsedLimit)) {
    return 240;
  }

  // 边界处理：回测至少需要 30 根 K 线，最多拉取 1000 根避免误请求过大。
  return Math.min(Math.max(Math.trunc(parsedLimit), 30), 1000);
}

/**
 * 解析数字参数。
 * @param {unknown} value 原始参数
 * @param {number} fallback 默认值
 * @param {number} min 最小值
 * @param {number} max 最大值
 * @returns {number} 解析后的数字
 */
function parseNumberParam(
  value: unknown,
  fallback: number,
  min: number,
  max: number
): number {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return fallback;
  }

  const parsedValue = Number(value);
  if (!Number.isFinite(parsedValue)) {
    return fallback;
  }

  return Math.min(Math.max(parsedValue, min), max);
}

/**
 * 解析整数参数。
 * @param {unknown} value 原始参数
 * @param {number} fallback 默认值
 * @param {number} min 最小值
 * @param {number} max 最大值
 * @returns {number} 解析后的整数
 */
function parseIntegerParam(
  value: unknown,
  fallback: number,
  min: number,
  max: number
): number {
  return Math.trunc(parseNumberParam(value, fallback, min, max));
}

/**
 * 从请求体解析回测配置。
 * @param {unknown} body 请求体
 * @returns {{ config: BacktestConfig; limit: number }} 回测配置和数据条数
 */
function parseBacktestRequest(body: unknown): {
  config: BacktestConfig;
  limit: number;
} {
  const requestBody =
    typeof body === 'object' && body !== null
      ? (body as Record<string, unknown>)
      : {};
  const strategy =
    typeof requestBody.strategy === 'object' && requestBody.strategy !== null
      ? (requestBody.strategy as Record<string, unknown>)
      : {};
  const shortPeriod = parseIntegerParam(strategy.shortPeriod, 5, 2, 120);
  const longPeriod = parseIntegerParam(strategy.longPeriod, 10, 3, 240);
  const normalizedShortPeriod = Math.min(shortPeriod, longPeriod - 1);

  return {
    limit: parseBacktestLimit(requestBody.limit),
    config: {
      initialCapital: parseNumberParam(
        requestBody.initialCapital,
        100000,
        1000,
        100000000
      ),
      feeRate: parseNumberParam(requestBody.feeRate, 0.0003, 0, 0.01),
      stampTaxRate: parseNumberParam(
        requestBody.stampTaxRate,
        0.0005,
        0,
        0.01
      ),
      slippageRate: parseNumberParam(requestBody.slippageRate, 0, 0, 0.02),
      lotSize: parseIntegerParam(requestBody.lotSize, 100, 1, 10000),
      executionPrice: 'next_open',
      strategy: {
        type: 'ma_cross',
        shortPeriod: normalizedShortPeriod,
        longPeriod,
      },
    },
  };
}

/**
 * 处理单股票回测请求。
 * POST /api/backtest/:symbol
 * @param {Request} request Express 请求对象
 * @param {Response} response Express 响应对象
 * @returns {Promise<void>} 无返回值
 */
export async function handleBacktest(
  request: Request,
  response: Response
): Promise<void> {
  const symbolParam = request.params.symbol;
  const symbol = typeof symbolParam === 'string' ? symbolParam : '';

  if (!symbol) {
    response.status(400).json({ message: '股票代码不能为空' });
    return;
  }

  try {
    const { config, limit } = parseBacktestRequest(request.body);
    const marketData = await fetchMarketData(symbol, limit);
    const result = runBacktest({
      symbol: marketData.symbol,
      name: marketData.name,
      source: marketData.source,
      klines: marketData.klines.slice(-limit),
      config,
    });

    response.json({
      success: true,
      data: result,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '回测失败';
    console.error(`[Backtest] ${symbol} 回测失败:`, message);
    response.status(500).json({
      success: false,
      message,
    });
  }
}
