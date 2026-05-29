import type {
  BacktestConfig,
  BacktestEquityPoint,
  BacktestMetrics,
  BacktestResult,
  BacktestTrade,
  KLine,
} from '@share-stock-god/shared';
import { calculateMACD } from '../indicators/indicators.js';

type BacktestInput = {
  /** 股票代码 */
  symbol: string;
  /** 股票名称 */
  name: string;
  /** 数据来源 */
  source: string;
  /** K 线数据 */
  klines: KLine[];
  /** 回测配置 */
  config: BacktestConfig;
};

type BacktestState = {
  /** 当前现金 */
  cash: number;
  /** 当前持仓股数 */
  position: number;
  /** 当前持仓总成本 */
  positionCost: number;
  /** 当前持仓建仓日期 */
  positionEntryDate: string | null;
  /** 当前持仓建仓索引 */
  positionEntryIndex: number | null;
  /** 累计盈利卖出次数 */
  winCount: number;
  /** 累计亏损卖出次数 */
  lossCount: number;
  /** 累计平仓收益 */
  totalClosedProfit: number;
  /** 累计平仓收益率 */
  totalClosedProfitRate: number;
  /** 盈利交易收益率总和 */
  grossProfitRate: number;
  /** 亏损交易收益率绝对值总和 */
  grossLossRate: number;
  /** 累计持仓天数 */
  totalHoldingDays: number;
  /** 当前连续亏损次数 */
  currentConsecutiveLosses: number;
  /** 最大连续亏损次数 */
  maxConsecutiveLosses: number;
};

type StrategySignal = {
  /** 信号方向 */
  side: 'buy' | 'sell';
  /** 信号所在 K 线索引 */
  signalIndex: number;
  /** 成交所在 K 线索引 */
  tradeIndex: number;
  /** 信号原因 */
  reason: 'strategy' | 'stop_loss' | 'take_profit';
};

/**
 * 执行单股票回测。
 * @param {BacktestInput} input 回测输入
 * @returns {BacktestResult} 回测结果
 */
export function runBacktest(input: BacktestInput): BacktestResult {
  const minimumKLineCount = getMinimumKLineCount(input.config.strategy);

  if (input.klines.length < minimumKLineCount) {
    throw new Error('K线数据不足，无法执行回测');
  }

  const signals = generateSignals(input.klines, input.config);
  const executableSignals = applyRiskExitSignals(
    input.klines,
    input.config,
    normalizeSignalsForEmptyPosition(signals)
  );
  const state: BacktestState = {
    cash: input.config.initialCapital,
    position: 0,
    positionCost: 0,
    positionEntryDate: null,
    positionEntryIndex: null,
    winCount: 0,
    lossCount: 0,
    totalClosedProfit: 0,
    totalClosedProfitRate: 0,
    grossProfitRate: 0,
    grossLossRate: 0,
    totalHoldingDays: 0,
    currentConsecutiveLosses: 0,
    maxConsecutiveLosses: 0,
  };
  const trades: BacktestTrade[] = [];
  const equityCurve: BacktestEquityPoint[] = [];
  let signalCursor = 0;

  input.klines.forEach((kline, index) => {
    // 副作用说明：按时间顺序消费已生成信号并更新账户状态。
    while (executableSignals[signalCursor]?.tradeIndex === index) {
      const signal = executableSignals[signalCursor];
      if (signal !== undefined) {
        const trade = executeSignal({
          signal,
          klines: input.klines,
          symbol: input.symbol,
          config: input.config,
          state,
          tradeOrder: trades.length + 1,
        });
        if (trade !== null) {
          trades.push(trade);
        }
      }
      signalCursor += 1;
    }

    equityCurve.push({
      date: kline.date,
      equity: roundMoney(state.cash + state.position * kline.close),
      cash: roundMoney(state.cash),
      position: state.position,
      close: kline.close,
    });
  });

  const metrics = calculateMetrics({
    equityCurve,
    initialCapital: input.config.initialCapital,
    tradeCount: trades.length,
    winCount: state.winCount,
    lossCount: state.lossCount,
    totalClosedProfit: state.totalClosedProfit,
    totalClosedProfitRate: state.totalClosedProfitRate,
    grossProfitRate: state.grossProfitRate,
    grossLossRate: state.grossLossRate,
    totalHoldingDays: state.totalHoldingDays,
    maxConsecutiveLosses: state.maxConsecutiveLosses,
    klines: input.klines,
  });

  return {
    symbol: input.symbol,
    name: input.name,
    source: input.source,
    config: input.config,
    metrics,
    trades,
    equityCurve,
  };
}

/**
 * 按默认空仓状态归一化策略信号。
 * @param {StrategySignal[]} signals 原始策略信号
 * @returns {StrategySignal[]} 从买入开始且买卖交替的可执行信号
 */
function normalizeSignalsForEmptyPosition(signals: StrategySignal[]): StrategySignal[] {
  const executableSignals: StrategySignal[] = [];
  let hasPosition = false;
  let entrySignal: StrategySignal | null = null;

  signals.forEach((signal) => {
    // 关键边界：回测默认从空仓开始，任何首个或空仓期卖出信号都应忽略。
    if (signal.side === 'buy' && !hasPosition) {
      executableSignals.push(signal);
      hasPosition = true;
      entrySignal = signal;
      return;
    }

    if (
      signal.side === 'sell' &&
      hasPosition &&
      entrySignal !== null &&
      signal.tradeIndex > entrySignal.tradeIndex
    ) {
      executableSignals.push(signal);
      hasPosition = false;
      entrySignal = null;
    }
  });

  return executableSignals;
}

/**
 * 合并策略信号与风控信号。
 * @param {KLine[]} klines K 线数据
 * @param {BacktestConfig} config 回测配置
 * @param {StrategySignal[]} signals 策略信号
 * @returns {StrategySignal[]} 加入止盈止损后的信号
 */
function applyRiskExitSignals(
  klines: KLine[],
  config: BacktestConfig,
  signals: StrategySignal[]
): StrategySignal[] {
  if (config.stopLossRate <= 0 && config.takeProfitRate <= 0) {
    return signals;
  }

  const enhancedSignals: StrategySignal[] = [];

  for (let index = 0; index < signals.length; index += 1) {
    const entrySignal = signals[index];
    const exitSignal = signals[index + 1];

    if (entrySignal === undefined || entrySignal.side !== 'buy') {
      continue;
    }

    enhancedSignals.push(entrySignal);

    if (exitSignal === undefined || exitSignal.side !== 'sell') {
      break;
    }

    const entryKline = klines[entrySignal.tradeIndex];
    if (entryKline === undefined) {
      enhancedSignals.push(exitSignal);
      index += 1;
      continue;
    }

    const riskExitSignal = findRiskExitSignal({
      klines,
      entryKline,
      startIndex: entrySignal.tradeIndex + 1,
      endIndex: Math.max(entrySignal.tradeIndex + 1, exitSignal.signalIndex),
      config,
    });

    enhancedSignals.push(riskExitSignal ?? exitSignal);
    index += 1;
  }

  return enhancedSignals;
}

/**
 * 查找持仓区间内的止盈止损退出信号。
 * @param {object} params 查找参数
 * @returns {StrategySignal | null} 风控退出信号
 */
function findRiskExitSignal(params: {
  klines: KLine[];
  entryKline: KLine;
  startIndex: number;
  endIndex: number;
  config: BacktestConfig;
}): StrategySignal | null {
  for (let index = params.startIndex; index <= params.endIndex; index += 1) {
    const kline = params.klines[index];

    if (kline === undefined || index >= params.klines.length - 1) {
      continue;
    }

    if (
      params.config.stopLossRate > 0 &&
      kline.close <= params.entryKline.open * (1 - params.config.stopLossRate)
    ) {
      return { side: 'sell', signalIndex: index, tradeIndex: index + 1, reason: 'stop_loss' };
    }

    if (
      params.config.takeProfitRate > 0 &&
      kline.close >= params.entryKline.open * (1 + params.config.takeProfitRate)
    ) {
      return { side: 'sell', signalIndex: index, tradeIndex: index + 1, reason: 'take_profit' };
    }
  }

  return null;
}

/**
 * 生成策略信号。
 * @param {KLine[]} klines K 线数据
 * @param {BacktestConfig} config 回测配置
 * @returns {StrategySignal[]} 策略信号数组
 */
function generateSignals(
  klines: KLine[],
  config: BacktestConfig
): StrategySignal[] {
  switch (config.strategy.type) {
    case 'ma_cross':
      return generateMaCrossSignals(klines, config);
    case 'macd_cross':
      return generateMacdCrossSignals(klines, config);
    case 'ma_trend_pullback':
      return generateMaTrendPullbackSignals(klines, config);
    case 'breakout':
      return generateBreakoutSignals(klines, config);
    default:
      return [];
  }
}

/**
 * 获取策略执行所需的最小 K 线数量。
 * @param {BacktestConfig['strategy']} strategy 策略配置
 * @returns {number} 最小 K 线数量
 */
function getMinimumKLineCount(strategy: BacktestConfig['strategy']): number {
  switch (strategy.type) {
    case 'ma_cross':
      return strategy.longPeriod + 2;
    case 'macd_cross':
      return 35;
    case 'ma_trend_pullback':
      return strategy.trendPeriod + 2;
    case 'breakout':
      return Math.max(strategy.breakoutPeriod, strategy.exitPeriod) + 2;
    default:
      return 30;
  }
}

/**
 * 生成 MA 金叉买入、死叉卖出信号。
 * @param {KLine[]} klines K 线数据
 * @param {BacktestConfig} config 回测配置
 * @returns {StrategySignal[]} 策略信号数组
 */
function generateMaCrossSignals(
  klines: KLine[],
  config: BacktestConfig
): StrategySignal[] {
  if (config.strategy.type !== 'ma_cross') {
    return [];
  }

  const closes = klines.map((kline) => kline.close);
  const signals: StrategySignal[] = [];
  const startIndex = config.strategy.longPeriod;

  for (let index = startIndex; index < klines.length - 1; index += 1) {
    const previousShortMA = calculateMA(closes, config.strategy.shortPeriod, index - 1);
    const previousLongMA = calculateMA(closes, config.strategy.longPeriod, index - 1);
    const currentShortMA = calculateMA(closes, config.strategy.shortPeriod, index);
    const currentLongMA = calculateMA(closes, config.strategy.longPeriod, index);

    if (
      previousShortMA === null ||
      previousLongMA === null ||
      currentShortMA === null ||
      currentLongMA === null
    ) {
      continue;
    }

    if (previousShortMA <= previousLongMA && currentShortMA > currentLongMA) {
      signals.push({ side: 'buy', signalIndex: index, tradeIndex: index + 1, reason: 'strategy' });
    } else if (previousShortMA >= previousLongMA && currentShortMA < currentLongMA) {
      signals.push({ side: 'sell', signalIndex: index, tradeIndex: index + 1, reason: 'strategy' });
    }
  }

  return signals;
}

/**
 * 生成 MACD 金叉买入、死叉卖出信号。
 * @param {KLine[]} klines K 线数据
 * @param {BacktestConfig} config 回测配置
 * @returns {StrategySignal[]} 策略信号数组
 */
function generateMacdCrossSignals(
  klines: KLine[],
  config: BacktestConfig
): StrategySignal[] {
  if (config.strategy.type !== 'macd_cross') {
    return [];
  }

  const macdPoints = calculateMACD(klines);
  const signals: StrategySignal[] = [];

  for (let index = 1; index < klines.length - 1; index += 1) {
    const previous = macdPoints[index - 1];
    const current = macdPoints[index];

    if (previous === undefined || current === undefined) {
      continue;
    }

    const isGoldenCross = previous.dif <= previous.dea && current.dif > current.dea;
    const isDeadCross = previous.dif >= previous.dea && current.dif < current.dea;
    const canBuy = !config.strategy.zeroAxisFilter || current.dif > 0;
    const canSell = !config.strategy.zeroAxisFilter || current.dif < 0;

    if (isGoldenCross && canBuy) {
      signals.push({ side: 'buy', signalIndex: index, tradeIndex: index + 1, reason: 'strategy' });
    } else if (isDeadCross && canSell) {
      signals.push({ side: 'sell', signalIndex: index, tradeIndex: index + 1, reason: 'strategy' });
    }
  }

  return signals;
}

/**
 * 生成均线趋势回踩买入、跌破趋势卖出信号。
 * @param {KLine[]} klines K 线数据
 * @param {BacktestConfig} config 回测配置
 * @returns {StrategySignal[]} 策略信号数组
 */
function generateMaTrendPullbackSignals(
  klines: KLine[],
  config: BacktestConfig
): StrategySignal[] {
  if (config.strategy.type !== 'ma_trend_pullback') {
    return [];
  }

  const closes = klines.map((kline) => kline.close);
  const signals: StrategySignal[] = [];
  const startIndex = config.strategy.trendPeriod;

  for (let index = startIndex; index < klines.length - 1; index += 1) {
    const current = klines[index];
    const previous = klines[index - 1];
    const shortMA = calculateMA(closes, config.strategy.shortPeriod, index);
    const trendMA = calculateMA(closes, config.strategy.trendPeriod, index);
    const previousTrendMA = calculateMA(closes, config.strategy.trendPeriod, index - 1);

    if (
      current === undefined ||
      previous === undefined ||
      shortMA === null ||
      trendMA === null ||
      previousTrendMA === null
    ) {
      continue;
    }

    const isTrendUp = trendMA > previousTrendMA && current.close > trendMA;
    const isPullbackNearTrend =
      current.low <= trendMA * (1 + config.strategy.pullbackTolerance) &&
      current.close > current.open;
    const isSellBreakTrend = previous.close >= trendMA && current.close < trendMA;

    if (isTrendUp && shortMA > trendMA && isPullbackNearTrend) {
      signals.push({ side: 'buy', signalIndex: index, tradeIndex: index + 1, reason: 'strategy' });
    } else if (isSellBreakTrend) {
      signals.push({ side: 'sell', signalIndex: index, tradeIndex: index + 1, reason: 'strategy' });
    }
  }

  return signals;
}

/**
 * 生成 N 日突破买入、跌破退出信号。
 * @param {KLine[]} klines K 线数据
 * @param {BacktestConfig} config 回测配置
 * @returns {StrategySignal[]} 策略信号数组
 */
function generateBreakoutSignals(
  klines: KLine[],
  config: BacktestConfig
): StrategySignal[] {
  if (config.strategy.type !== 'breakout') {
    return [];
  }

  const signals: StrategySignal[] = [];
  const startIndex = Math.max(config.strategy.breakoutPeriod, config.strategy.exitPeriod);

  for (let index = startIndex; index < klines.length - 1; index += 1) {
    const current = klines[index];

    if (current === undefined) {
      continue;
    }

    const previousHigh = getHighestHigh(
      klines,
      index - config.strategy.breakoutPeriod,
      index - 1
    );
    const previousLow = getLowestLow(
      klines,
      index - config.strategy.exitPeriod,
      index - 1
    );

    if (previousHigh === null || previousLow === null) {
      continue;
    }

    if (current.close > previousHigh) {
      signals.push({ side: 'buy', signalIndex: index, tradeIndex: index + 1, reason: 'strategy' });
    } else if (current.close < previousLow) {
      signals.push({ side: 'sell', signalIndex: index, tradeIndex: index + 1, reason: 'strategy' });
    }
  }

  return signals;
}

/**
 * 计算指定索引处的移动平均线。
 * @param {number[]} values 输入数值序列
 * @param {number} period 均线周期
 * @param {number} endIndex 结束索引
 * @returns {number | null} 均线数值
 */
function calculateMA(
  values: number[],
  period: number,
  endIndex: number
): number | null {
  const startIndex = endIndex - period + 1;
  if (period <= 0 || startIndex < 0) {
    return null;
  }

  let sum = 0;
  for (let index = startIndex; index <= endIndex; index += 1) {
    const value = values[index];
    if (value === undefined) {
      return null;
    }
    sum += value;
  }

  return sum / period;
}

/**
 * 读取指定区间最高价。
 * @param {KLine[]} klines K 线数据
 * @param {number} startIndex 起始索引
 * @param {number} endIndex 结束索引
 * @returns {number | null} 区间最高价
 */
function getHighestHigh(
  klines: KLine[],
  startIndex: number,
  endIndex: number
): number | null {
  if (startIndex < 0 || endIndex < startIndex) {
    return null;
  }

  let highestHigh: number | null = null;
  for (let index = startIndex; index <= endIndex; index += 1) {
    const kline = klines[index];
    if (kline === undefined) {
      return null;
    }
    highestHigh = highestHigh === null ? kline.high : Math.max(highestHigh, kline.high);
  }

  return highestHigh;
}

/**
 * 读取指定区间最低价。
 * @param {KLine[]} klines K 线数据
 * @param {number} startIndex 起始索引
 * @param {number} endIndex 结束索引
 * @returns {number | null} 区间最低价
 */
function getLowestLow(
  klines: KLine[],
  startIndex: number,
  endIndex: number
): number | null {
  if (startIndex < 0 || endIndex < startIndex) {
    return null;
  }

  let lowestLow: number | null = null;
  for (let index = startIndex; index <= endIndex; index += 1) {
    const kline = klines[index];
    if (kline === undefined) {
      return null;
    }
    lowestLow = lowestLow === null ? kline.low : Math.min(lowestLow, kline.low);
  }

  return lowestLow;
}

/**
 * 执行单个策略信号。
 * @param {object} params 执行参数
 * @param {StrategySignal} params.signal 策略信号
 * @param {KLine[]} params.klines K 线数据
 * @param {string} params.symbol 股票代码
 * @param {BacktestConfig} params.config 回测配置
 * @param {BacktestState} params.state 回测账户状态
 * @param {number} params.tradeOrder 交易序号
 * @returns {BacktestTrade | null} 成交记录
 */
function executeSignal(params: {
  signal: StrategySignal;
  klines: KLine[];
  symbol: string;
  config: BacktestConfig;
  state: BacktestState;
  tradeOrder: number;
}): BacktestTrade | null {
  const signalKline = params.klines[params.signal.signalIndex];
  const tradeKline = params.klines[params.signal.tradeIndex];
  if (signalKline === undefined || tradeKline === undefined) {
    return null;
  }

  if (params.signal.side === 'buy') {
    return executeBuy(params, signalKline, tradeKline);
  }

  return executeSell(params, signalKline, tradeKline);
}

/**
 * 执行买入信号。
 * @param {object} params 执行参数
 * @param {KLine} signalKline 信号 K 线
 * @param {KLine} tradeKline 成交 K 线
 * @returns {BacktestTrade | null} 成交记录
 */
function executeBuy(
  params: {
    signal: StrategySignal;
    symbol: string;
    config: BacktestConfig;
    state: BacktestState;
    tradeOrder: number;
  },
  signalKline: KLine,
  tradeKline: KLine
): BacktestTrade | null {
  if (params.state.position > 0) {
    return null;
  }

  const price = tradeKline.open * (1 + params.config.slippageRate);
  const cashBudget = params.state.cash * params.config.positionRatio;
  const affordableShares =
    cashBudget / (price * (1 + params.config.feeRate));
  const shares =
    Math.floor(affordableShares / params.config.lotSize) * params.config.lotSize;
  if (shares <= 0) {
    return null;
  }

  const amount = price * shares;
  const fee = amount * params.config.feeRate;
  params.state.cash = roundMoney(params.state.cash - amount - fee);
  params.state.position = shares;
  params.state.positionCost = amount + fee;
  params.state.positionEntryDate = tradeKline.date;
  params.state.positionEntryIndex = params.signal.tradeIndex;

  return createTrade({
    id: `${params.symbol}-${params.tradeOrder}`,
    symbol: params.symbol,
    side: 'buy',
    signalDate: signalKline.date,
    tradeDate: tradeKline.date,
    price,
    shares,
    amount,
    fee,
    tax: 0,
    state: params.state,
    profit: 0,
    profitRate: 0,
    holdingDays: 0,
  });
}

/**
 * 执行卖出信号。
 * @param {object} params 执行参数
 * @param {KLine} signalKline 信号 K 线
 * @param {KLine} tradeKline 成交 K 线
 * @returns {BacktestTrade | null} 成交记录
 */
function executeSell(
  params: {
    signal: StrategySignal;
    symbol: string;
    config: BacktestConfig;
    state: BacktestState;
    tradeOrder: number;
  },
  signalKline: KLine,
  tradeKline: KLine
): BacktestTrade | null {
  if (params.state.position <= 0) {
    return null;
  }

  const shares = params.state.position;
  const price = tradeKline.open * (1 - params.config.slippageRate);
  const amount = price * shares;
  const fee = amount * params.config.feeRate;
  const tax = amount * params.config.stampTaxRate;
  const profit = amount - fee - tax - params.state.positionCost;
  const profitRate = params.state.positionCost > 0 ? profit / params.state.positionCost : 0;
  const holdingDays =
    params.state.positionEntryIndex !== null
      ? Math.max(params.signal.tradeIndex - params.state.positionEntryIndex, 0)
      : 0;

  if (profit >= 0) {
    params.state.winCount += 1;
    params.state.currentConsecutiveLosses = 0;
    params.state.grossProfitRate += profitRate;
  } else {
    params.state.lossCount += 1;
    params.state.currentConsecutiveLosses += 1;
    params.state.maxConsecutiveLosses = Math.max(
      params.state.maxConsecutiveLosses,
      params.state.currentConsecutiveLosses
    );
    params.state.grossLossRate += Math.abs(profitRate);
  }

  params.state.totalClosedProfit += profit;
  params.state.totalClosedProfitRate += profitRate;
  params.state.totalHoldingDays += holdingDays;

  params.state.cash = roundMoney(params.state.cash + amount - fee - tax);
  params.state.position = 0;
  params.state.positionCost = 0;
  params.state.positionEntryDate = null;
  params.state.positionEntryIndex = null;

  return createTrade({
    id: `${params.symbol}-${params.tradeOrder}`,
    symbol: params.symbol,
    side: 'sell',
    signalDate: signalKline.date,
    tradeDate: tradeKline.date,
    price,
    shares,
    amount,
    fee,
    tax,
    state: params.state,
    profit,
    profitRate,
    holdingDays,
  });
}

/**
 * 创建标准化交易记录。
 * @param {object} params 交易参数
 * @returns {BacktestTrade} 标准化交易记录
 */
function createTrade(params: {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  signalDate: string;
  tradeDate: string;
  price: number;
  shares: number;
  amount: number;
  fee: number;
  tax: number;
  state: BacktestState;
  profit: number;
  profitRate: number;
  holdingDays: number;
}): BacktestTrade {
  return {
    id: params.id,
    symbol: params.symbol,
    side: params.side,
    signalDate: params.signalDate,
    tradeDate: params.tradeDate,
    price: roundMoney(params.price),
    shares: params.shares,
    amount: roundMoney(params.amount),
    fee: roundMoney(params.fee),
    tax: roundMoney(params.tax),
    cashAfterTrade: roundMoney(params.state.cash),
    positionAfterTrade: params.state.position,
    profit: roundMoney(params.profit),
    profitRate: roundRatio(params.profitRate),
    holdingDays: params.holdingDays,
  };
}

/**
 * 计算回测绩效指标。
 * @param {object} params 指标输入
 * @returns {BacktestMetrics} 绩效指标
 */
function calculateMetrics(params: {
  equityCurve: BacktestEquityPoint[];
  initialCapital: number;
  tradeCount: number;
  winCount: number;
  lossCount: number;
  totalClosedProfit: number;
  totalClosedProfitRate: number;
  grossProfitRate: number;
  grossLossRate: number;
  totalHoldingDays: number;
  maxConsecutiveLosses: number;
  klines: KLine[];
}): BacktestMetrics {
  const finalPoint = params.equityCurve[params.equityCurve.length - 1];
  const finalEquity = finalPoint?.equity ?? params.initialCapital;
  const totalReturn =
    params.initialCapital > 0
      ? (finalEquity - params.initialCapital) / params.initialCapital
      : 0;
  const years = Math.max(params.equityCurve.length / 242, 1 / 242);
  const annualizedReturn =
    params.initialCapital > 0
      ? Math.pow(finalEquity / params.initialCapital, 1 / years) - 1
      : 0;
  const closedTradeCount = params.winCount + params.lossCount;
  const firstKline = params.klines[0];
  const lastKline = params.klines[params.klines.length - 1];
  const benchmarkReturn =
    firstKline !== undefined && lastKline !== undefined && firstKline.close > 0
      ? (lastKline.close - firstKline.close) / firstKline.close
      : 0;
  const averageProfit =
    closedTradeCount > 0 ? params.totalClosedProfit / closedTradeCount : 0;
  const averageProfitRate =
    closedTradeCount > 0 ? params.totalClosedProfitRate / closedTradeCount : 0;
  const averageHoldingDays =
    closedTradeCount > 0 ? params.totalHoldingDays / closedTradeCount : 0;
  const profitLossRatio =
    params.grossLossRate > 0
      ? params.grossProfitRate / params.grossLossRate
      : params.grossProfitRate > 0
        ? params.grossProfitRate
        : 0;

  return {
    initialCapital: roundMoney(params.initialCapital),
    finalEquity: roundMoney(finalEquity),
    totalReturn: roundRatio(totalReturn),
    annualizedReturn: roundRatio(annualizedReturn),
    maxDrawdown: roundRatio(calculateMaxDrawdown(params.equityCurve)),
    tradeCount: params.tradeCount,
    winCount: params.winCount,
    lossCount: params.lossCount,
    winRate:
      closedTradeCount > 0
        ? roundRatio(params.winCount / closedTradeCount)
        : 0,
    averageProfit: roundMoney(averageProfit),
    averageProfitRate: roundRatio(averageProfitRate),
    profitLossRatio: roundRatio(profitLossRatio),
    averageHoldingDays: roundRatio(averageHoldingDays),
    maxConsecutiveLosses: params.maxConsecutiveLosses,
    benchmarkReturn: roundRatio(benchmarkReturn),
    excessReturn: roundRatio(totalReturn - benchmarkReturn),
  };
}

/**
 * 计算最大回撤。
 * @param {BacktestEquityPoint[]} equityCurve 权益曲线
 * @returns {number} 最大回撤
 */
function calculateMaxDrawdown(equityCurve: BacktestEquityPoint[]): number {
  let peak = 0;
  let maxDrawdown = 0;

  equityCurve.forEach((point) => {
    peak = Math.max(peak, point.equity);
    if (peak > 0) {
      maxDrawdown = Math.max(maxDrawdown, (peak - point.equity) / peak);
    }
  });

  return maxDrawdown;
}

/**
 * 金额保留两位小数。
 * @param {number} value 原始金额
 * @returns {number} 标准化金额
 */
function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * 比率保留六位小数。
 * @param {number} value 原始比率
 * @returns {number} 标准化比率
 */
function roundRatio(value: number): number {
  return Math.round(value * 1000000) / 1000000;
}
