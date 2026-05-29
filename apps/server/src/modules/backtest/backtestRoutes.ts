import type { Request, Response } from 'express';
import type {
  BacktestConfig,
  BacktestScanItem,
  BacktestScanResult,
  BacktestStabilityResult,
  BacktestStabilitySummary,
  BacktestStabilityWindow,
  BacktestStrategyCompareItem,
  BacktestStrategyCompareResult,
  BacktestStrategyConfig,
  BacktestStrategyType,
} from '@share-stock-god/shared';
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
 * 解析策略类型。
 * @param {unknown} value 原始策略类型
 * @returns {BacktestStrategyType} 支持的策略类型
 */
function parseStrategyType(value: unknown): BacktestStrategyType {
  if (
    value === 'macd_cross' ||
    value === 'ma_trend_pullback' ||
    value === 'breakout'
  ) {
    return value;
  }

  return 'ma_cross';
}

/**
 * 解析布尔参数。
 * @param {unknown} value 原始参数
 * @param {boolean} fallback 默认值
 * @returns {boolean} 解析后的布尔值
 */
function parseBooleanParam(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    return value === 'true' ? true : value === 'false' ? false : fallback;
  }

  return fallback;
}

/**
 * 从请求体解析策略配置。
 * @param {Record<string, unknown>} strategy 原始策略配置
 * @returns {BacktestStrategyConfig} 回测策略配置
 */
function parseStrategyConfig(
  strategy: Record<string, unknown>
): BacktestStrategyConfig {
  const strategyType = parseStrategyType(strategy.type);

  if (strategyType === 'macd_cross') {
    return {
      type: 'macd_cross',
      zeroAxisFilter: parseBooleanParam(strategy.zeroAxisFilter, false),
    };
  }

  if (strategyType === 'ma_trend_pullback') {
    const shortPeriod = parseIntegerParam(strategy.shortPeriod, 5, 2, 120);
    const trendPeriod = parseIntegerParam(strategy.trendPeriod, 20, 5, 240);

    return {
      type: 'ma_trend_pullback',
      shortPeriod: Math.min(shortPeriod, trendPeriod - 1),
      trendPeriod,
      pullbackTolerance: parseNumberParam(
        strategy.pullbackTolerance,
        0.015,
        0,
        0.15
      ),
    };
  }

  if (strategyType === 'breakout') {
    const breakoutPeriod = parseIntegerParam(strategy.breakoutPeriod, 20, 5, 240);
    const exitPeriod = parseIntegerParam(strategy.exitPeriod, 10, 3, 120);

    return {
      type: 'breakout',
      breakoutPeriod,
      exitPeriod: Math.min(exitPeriod, breakoutPeriod),
    };
  }

  const shortPeriod = parseIntegerParam(strategy.shortPeriod, 5, 2, 120);
  const longPeriod = parseIntegerParam(strategy.longPeriod, 10, 3, 240);

  return {
    type: 'ma_cross',
    shortPeriod: Math.min(shortPeriod, longPeriod - 1),
    longPeriod,
  };
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
  const strategyConfig = parseStrategyConfig(strategy);

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
      positionRatio: parseNumberParam(
        requestBody.positionRatio,
        1,
        0.01,
        1
      ),
      stopLossRate: parseNumberParam(requestBody.stopLossRate, 0, 0, 0.5),
      takeProfitRate: parseNumberParam(requestBody.takeProfitRate, 0, 0, 1),
      lotSize: parseIntegerParam(requestBody.lotSize, 100, 1, 10000),
      executionPrice: 'next_open',
      strategy: strategyConfig,
    },
  };
}

/**
 * 解析稳定性分析请求。
 * @param {unknown} body 请求体
 * @returns {{ config: BacktestConfig; limit: number; windowSize: number; stepSize: number }} 稳定性配置
 */
function parseStabilityRequest(body: unknown): {
  config: BacktestConfig;
  limit: number;
  windowSize: number;
  stepSize: number;
} {
  const parsedRequest = parseBacktestRequest(body);
  const requestBody =
    typeof body === 'object' && body !== null
      ? (body as Record<string, unknown>)
      : {};

  const windowSize = parseIntegerParam(requestBody.windowSize, 120, 60, 500);
  const stepSize = parseIntegerParam(requestBody.stepSize, 30, 10, 240);

  return {
    config: parsedRequest.config,
    limit: Math.max(parsedRequest.limit, windowSize + stepSize),
    windowSize,
    stepSize,
  };
}

/**
 * 基于当前配置生成 MA 参数扫描配置。
 * @param {BacktestConfig} baseConfig 基础回测配置
 * @returns {BacktestConfig[]} 扫描配置列表
 */
function createMaCrossScanConfigs(baseConfig: BacktestConfig): BacktestConfig[] {
  const shortPeriods = [5, 10];
  const longPeriods = [10, 20, 30];
  const configs: BacktestConfig[] = [];

  shortPeriods.forEach((shortPeriod) => {
    longPeriods.forEach((longPeriod) => {
      // 边界处理：短周期必须小于长周期，否则跳过无效组合。
      if (shortPeriod >= longPeriod) {
        return;
      }

      configs.push({
        ...baseConfig,
        strategy: {
          type: 'ma_cross',
          shortPeriod,
          longPeriod,
        },
      });
    });
  });

  return configs;
}

/**
 * 将回测结果压缩为扫描列表项。
 * @param {ReturnType<typeof runBacktest>} result 回测结果
 * @returns {BacktestScanItem} 扫描列表项
 */
function createScanItem(result: ReturnType<typeof runBacktest>): BacktestScanItem {
  return {
    id: `${result.config.strategy.type}-${JSON.stringify(result.config.strategy)}`,
    strategy: result.config.strategy,
    totalReturn: result.metrics.totalReturn,
    annualizedReturn: result.metrics.annualizedReturn,
    maxDrawdown: result.metrics.maxDrawdown,
    winRate: result.metrics.winRate,
    tradeCount: result.metrics.tradeCount,
    excessReturn: result.metrics.excessReturn,
    profitLossRatio: result.metrics.profitLossRatio,
  };
}

/**
 * 创建默认策略对比配置。
 * @param {BacktestConfig} baseConfig 基础回测配置
 * @returns {Array<{ name: string; config: BacktestConfig }>} 对比配置列表
 */
function createStrategyCompareConfigs(
  baseConfig: BacktestConfig
): Array<{ name: string; config: BacktestConfig }> {
  return [
    {
      name: '均线交叉',
      config: {
        ...baseConfig,
        strategy: { type: 'ma_cross', shortPeriod: 5, longPeriod: 20 },
      },
    },
    {
      name: 'MACD 交叉',
      config: {
        ...baseConfig,
        strategy: { type: 'macd_cross', zeroAxisFilter: false },
      },
    },
    {
      name: '趋势回踩',
      config: {
        ...baseConfig,
        strategy: {
          type: 'ma_trend_pullback',
          shortPeriod: 5,
          trendPeriod: 20,
          pullbackTolerance: 0.015,
        },
      },
    },
    {
      name: '区间突破',
      config: {
        ...baseConfig,
        strategy: { type: 'breakout', breakoutPeriod: 20, exitPeriod: 10 },
      },
    },
  ];
}

/**
 * 将回测结果压缩为策略对比列表项。
 * @param {string} strategyName 策略名称
 * @param {ReturnType<typeof runBacktest>} result 回测结果
 * @returns {BacktestStrategyCompareItem} 策略对比项
 */
function createStrategyCompareItem(
  strategyName: string,
  result: ReturnType<typeof runBacktest>
): BacktestStrategyCompareItem {
  return {
    ...createScanItem(result),
    strategyName,
  };
}

/**
 * 创建滚动窗口稳定性明细。
 * @param {ReturnType<typeof runBacktest>} result 回测结果
 * @param {number} index 窗口索引
 * @returns {BacktestStabilityWindow} 稳定性窗口明细
 */
function createStabilityWindow(
  result: ReturnType<typeof runBacktest>,
  index: number
): BacktestStabilityWindow {
  const firstPoint = result.equityCurve[0];
  const lastPoint = result.equityCurve[result.equityCurve.length - 1];

  return {
    id: `window-${index + 1}`,
    startDate: firstPoint?.date ?? '',
    endDate: lastPoint?.date ?? '',
    totalReturn: result.metrics.totalReturn,
    annualizedReturn: result.metrics.annualizedReturn,
    maxDrawdown: result.metrics.maxDrawdown,
    winRate: result.metrics.winRate,
    tradeCount: result.metrics.tradeCount,
    excessReturn: result.metrics.excessReturn,
    profitLossRatio: result.metrics.profitLossRatio,
  };
}

/**
 * 计算数值平均值。
 * @param {number[]} values 数值列表
 * @returns {number} 平均值
 */
function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * 计算数值标准差。
 * @param {number[]} values 数值列表
 * @returns {number} 标准差
 */
function standardDeviation(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const mean = average(values);
  const variance = average(values.map((value) => (value - mean) ** 2));
  return Math.sqrt(variance);
}

/**
 * 计算稳定性评分。
 * @param {number} positiveWindowRate 正收益窗口占比
 * @param {number} averageReturn 平均收益率
 * @param {number} returnStdDev 收益率标准差
 * @param {number} averageMaxDrawdown 平均最大回撤
 * @returns {number} 0~100 分稳定性评分
 */
function calculateStabilityScore(
  positiveWindowRate: number,
  averageReturn: number,
  returnStdDev: number,
  averageMaxDrawdown: number
): number {
  const consistencyScore = positiveWindowRate * 45;
  const returnScore = Math.max(Math.min(averageReturn, 0.3), -0.3) / 0.3 * 25;
  const volatilityPenalty = Math.min(returnStdDev / 0.25, 1) * 20;
  const drawdownPenalty = Math.min(averageMaxDrawdown / 0.3, 1) * 20;
  const rawScore = 50 + consistencyScore + returnScore - volatilityPenalty - drawdownPenalty;

  return Math.round(Math.min(Math.max(rawScore, 0), 100));
}

/**
 * 创建稳定性摘要。
 * @param {BacktestStabilityWindow[]} windows 滚动窗口明细
 * @returns {BacktestStabilitySummary} 稳定性摘要
 */
function createStabilitySummary(
  windows: BacktestStabilityWindow[]
): BacktestStabilitySummary {
  const returns = windows.map((window) => window.totalReturn);
  const drawdowns = windows.map((window) => window.maxDrawdown);
  const winRates = windows.map((window) => window.winRate);
  const tradeCounts = windows.map((window) => window.tradeCount);
  const positiveWindowCount = returns.filter((value) => value > 0).length;
  const averageReturn = average(returns);
  const returnStdDev = standardDeviation(returns);
  const averageMaxDrawdown = average(drawdowns);

  return {
    windowCount: windows.length,
    positiveWindowCount,
    positiveWindowRate: windows.length > 0 ? positiveWindowCount / windows.length : 0,
    averageReturn,
    returnStdDev,
    bestReturn: returns.length > 0 ? Math.max(...returns) : 0,
    worstReturn: returns.length > 0 ? Math.min(...returns) : 0,
    averageMaxDrawdown,
    averageWinRate: average(winRates),
    averageTradeCount: average(tradeCounts),
    stabilityScore: calculateStabilityScore(
      windows.length > 0 ? positiveWindowCount / windows.length : 0,
      averageReturn,
      returnStdDev,
      averageMaxDrawdown
    ),
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

/**
 * 处理 MA 参数扫描请求。
 * POST /api/backtest/:symbol/scan
 * @param {Request} request Express 请求对象
 * @param {Response} response Express 响应对象
 * @returns {Promise<void>} 无返回值
 */
export async function handleBacktestScan(
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
    const klines = marketData.klines.slice(-limit);
    const items = createMaCrossScanConfigs(config)
      .map((scanConfig) =>
        runBacktest({
          symbol: marketData.symbol,
          name: marketData.name,
          source: marketData.source,
          klines,
          config: scanConfig,
        })
      )
      .map(createScanItem)
      .sort((first, second) => second.excessReturn - first.excessReturn);

    const result: BacktestScanResult = {
      symbol: marketData.symbol,
      name: marketData.name,
      source: marketData.source,
      items,
    };

    response.json({
      success: true,
      data: result,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '参数扫描失败';
    console.error(`[BacktestScan] ${symbol} 参数扫描失败:`, message);
    response.status(500).json({
      success: false,
      message,
    });
  }
}

/**
 * 处理策略表现对比请求。
 * POST /api/backtest/:symbol/compare
 * @param {Request} request Express 请求对象
 * @param {Response} response Express 响应对象
 * @returns {Promise<void>} 无返回值
 */
export async function handleBacktestCompare(
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
    const klines = marketData.klines.slice(-limit);
    const items = createStrategyCompareConfigs(config)
      .map((item) => ({
        name: item.name,
        result: runBacktest({
          symbol: marketData.symbol,
          name: marketData.name,
          source: marketData.source,
          klines,
          config: item.config,
        }),
      }))
      .map((item) => createStrategyCompareItem(item.name, item.result))
      .sort((first, second) => second.excessReturn - first.excessReturn);

    const result: BacktestStrategyCompareResult = {
      symbol: marketData.symbol,
      name: marketData.name,
      source: marketData.source,
      items,
    };

    response.json({
      success: true,
      data: result,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '策略对比失败';
    console.error(`[BacktestCompare] ${symbol} 策略对比失败:`, message);
    response.status(500).json({
      success: false,
      message,
    });
  }
}

/**
 * 处理策略历史稳定性分析请求。
 * POST /api/backtest/:symbol/stability
 * @param {Request} request Express 请求对象
 * @param {Response} response Express 响应对象
 * @returns {Promise<void>} 无返回值
 */
export async function handleBacktestStability(
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
    const { config, limit, windowSize, stepSize } = parseStabilityRequest(request.body);
    const marketData = await fetchMarketData(symbol, limit);
    const klines = marketData.klines.slice(-limit);
    const windows: BacktestStabilityWindow[] = [];

    for (let startIndex = 0; startIndex + windowSize <= klines.length; startIndex += stepSize) {
      const windowKlines = klines.slice(startIndex, startIndex + windowSize);
      const result = runBacktest({
        symbol: marketData.symbol,
        name: marketData.name,
        source: marketData.source,
        klines: windowKlines,
        config,
      });
      windows.push(createStabilityWindow(result, windows.length));
    }

    if (windows.length === 0) {
      throw new Error('历史数据不足，无法生成滚动窗口');
    }

    const result: BacktestStabilityResult = {
      symbol: marketData.symbol,
      name: marketData.name,
      source: marketData.source,
      strategy: config.strategy,
      windowSize,
      stepSize,
      summary: createStabilitySummary(windows),
      windows,
    };

    response.json({
      success: true,
      data: result,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '稳定性分析失败';
    console.error(`[BacktestStability] ${symbol} 稳定性分析失败:`, message);
    response.status(500).json({
      success: false,
      message,
    });
  }
}
