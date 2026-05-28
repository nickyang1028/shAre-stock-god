import type { KLine, Signal, SignalDirection, SignalType } from "@share-stock-god/shared";
import { calculateMACD } from "../indicators/indicators.js";

type SignalMeta = {
  /** 信号类型 */
  type: SignalType;
  /** 信号名称 */
  name: string;
  /** 信号方向 */
  direction: SignalDirection;
  /** 信号强度，1~5 */
  strength: 1 | 2 | 3 | 4 | 5;
  /** 信号说明 */
  description: string;
};

/**
 * 创建信号对象。
 * @param {KLine} kline 触发信号的 K 线
 * @param {SignalMeta} meta 信号元信息
 * @returns {Signal} 标准化后的信号
 */
function createSignal(kline: KLine, meta: SignalMeta): Signal {
  const reasons = createDefaultReasons(meta);

  return {
    id: `${kline.symbol}-${kline.timestamp}-${meta.type}`,
    symbol: kline.symbol,
    timestamp: kline.timestamp,
    date: kline.date,
    type: meta.type,
    name: meta.name,
    direction: meta.direction,
    strength: meta.strength,
    description: meta.description,
    price: kline.close,
    confidence: calculateConfidence(meta.strength, reasons),
    reasons,
    metrics: [
      { label: "开盘价", value: formatNumber(kline.open) },
      { label: "收盘价", value: formatNumber(kline.close) },
      { label: "最高/最低", value: `${formatNumber(kline.high)} / ${formatNumber(kline.low)}` },
    ],
    tags: createDefaultTags(meta.type),
  };
}

/**
 * 创建高级形态的默认解释原因。
 * @param {SignalMeta} meta 信号元信息
 * @returns {string[]} 信号触发原因
 */
function createDefaultReasons(meta: SignalMeta): string[] {
  // 关键逻辑：高级形态检测函数内部已完成严格条件判断，这里将判断结果转成用户可读解释。
  return [meta.description, `信号方向：${formatDirection(meta.direction)}`, `基础强度：${meta.strength}/5`];
}

/**
 * 创建高级形态的默认标签。
 * @param {SignalType} type 信号类型
 * @returns {string[]} 信号标签
 */
function createDefaultTags(type: SignalType): string[] {
  if (type.includes("support") || type.includes("resistance")) {
    return ["支撑阻力", "位置" ];
  }

  if (type.includes("divergence")) {
    return ["背离", "动能" ];
  }

  return ["K线形态", "高级形态"];
}

/**
 * 计算信号可信度评分。
 * @param {1 | 2 | 3 | 4 | 5} strength 信号强度
 * @param {string[]} reasons 信号原因
 * @returns {number} 0~100 的可信度评分
 */
function calculateConfidence(strength: 1 | 2 | 3 | 4 | 5, reasons: string[]): number {
  // 保守评分：高级形态只按强度和解释完整度加分，避免因为接入更多形态导致过度乐观。
  return Math.min(strength * 15 + Math.min(reasons.length * 4, 12), 90);
}

/**
 * 格式化信号方向。
 * @param {SignalDirection} direction 信号方向
 * @returns {string} 中文方向
 */
function formatDirection(direction: SignalDirection): string {
  if (direction === "bullish") {
    return "偏多";
  }

  if (direction === "bearish") {
    return "偏空";
  }

  return "中性";
}

/**
 * 格式化数值展示。
 * @param {number} value 原始数值
 * @returns {string} 两位小数字符串
 */
function formatNumber(value: number): string {
  return value.toFixed(2);
}

/**
 * 安全读取指定位置的 K 线。
 * @param {KLine[]} klines K 线序列
 * @param {number} index 目标索引
 * @returns {KLine | null} K 线或空值
 */
function getKLineAt(klines: KLine[], index: number): KLine | null {
  return klines[index] ?? null;
}

/**
 * 计算K线实体大小
 */
function getBodySize(kline: KLine): number {
  return Math.abs(kline.close - kline.open);
}

/**
 * 计算K线影线大小
 */
function getUpperShadow(kline: KLine): number {
  return kline.high - Math.max(kline.open, kline.close);
}

function getLowerShadow(kline: KLine): number {
  return Math.min(kline.open, kline.close) - kline.low;
}

/**
 * 判断是否为阳线
 */
function isBullish(kline: KLine): boolean {
  return kline.close > kline.open;
}

/**
 * 判断是否为阴线
 */
function isBearish(kline: KLine): boolean {
  return kline.close < kline.open;
}

/**
 * 判断是否为十字星
 */
function isDoji(kline: KLine, threshold: number = 0.01): boolean {
  const bodySize = getBodySize(kline);
  const range = kline.high - kline.low;
  return range > 0 && bodySize / range < threshold;
}

/**
 * 识别锤子线形态
 */
export function detectHammerSignals(klines: KLine[]): Signal[] {
  const signals: Signal[] = [];

  for (let i = 2; i < klines.length; i++) {
    const current = getKLineAt(klines, i);
    const prev1 = getKLineAt(klines, i - 1);
    const prev2 = getKLineAt(klines, i - 2);

    if (current === null || prev1 === null || prev2 === null) {
      continue;
    }


    // 锤子线条件：
    // 1. 出现在下跌趋势后（前两根K线整体下跌）
    // 2. 下影线长度是实体的2倍以上
    // 3. 上影线很短或几乎没有
    // 4. 实体较小（阳线或阴线都可以）

    const isDowntrend = prev2.close > prev1.close || prev2.high > prev1.high;
    const bodySize = getBodySize(current);
    const lowerShadow = getLowerShadow(current);
    const upperShadow = getUpperShadow(current);
    const totalRange = current.high - current.low;

    const isHammer =
      isDowntrend &&
      bodySize > 0 &&
      lowerShadow >= bodySize * 2 &&
      upperShadow <= bodySize * 0.3 &&
      bodySize / totalRange < 0.3;

    if (isHammer) {
      signals.push(createSignal(current, {
        type: "hammer",
        name: "锤子线",
        direction: "bullish",
        strength: 4,
        description: "出现在下跌趋势底部，下影线长实体小，提示可能的底部反转。",
      }));
    }

    // 倒锤子线（Inverted Hammer）
    // 出现在下跌趋势底部，上影线长，实体在底部
    const isInvertedHammer =
      isDowntrend &&
      bodySize > 0 &&
      upperShadow >= bodySize * 2 &&
      lowerShadow <= bodySize * 0.3 &&
      bodySize / totalRange < 0.3;

    if (isInvertedHammer) {
      signals.push(createSignal(current, {
        type: "inverted_hammer",
        name: "倒锤子线",
        direction: "bullish",
        strength: 3,
        description: "出现在下跌趋势底部，上影线长，提示可能的反转信号（需次日确认）。",
      }));
    }
  }

  return signals;
}

/**
 * 识别十字星信号
 */
export function detectDojiSignals(klines: KLine[]): Signal[] {
  const signals: Signal[] = [];


  for (let i = 1; i < klines.length; i++) {
    const current = getKLineAt(klines, i);
    const prev = getKLineAt(klines, i - 1);

    if (current === null || prev === null) {
      continue;
    }


    const bodySize = getBodySize(current);
    const totalRange = current.high - current.low;


    // 严格十字星：实体非常小（小于范围的1%）
    const isStrictDoji = totalRange > 0 && bodySize / totalRange < 0.01;

    // 长腿十字星：上下影线都很长
    const upperShadow = getUpperShadow(current);
    const lowerShadow = getLowerShadow(current);
    const isLongLeggedDoji =
      isStrictDoji &&
      upperShadow > bodySize * 3 &&
      lowerShadow > bodySize * 3;

    // 墓碑十字星（T形）：上影线很长，下影线很短或无，出现在上涨趋势顶部
    const isGravestoneDoji =
      isStrictDoji &&
      upperShadow > bodySize * 4 &&
      lowerShadow < bodySize * 0.5 &&
      prev.close < current.close; // 处于上涨趋势

    // 蜻蜓十字星（倒T形）：下影线很长，上影线很短或无，出现在下跌趋势底部
    const isDragonflyDoji =
      isStrictDoji &&
      lowerShadow > bodySize * 4 &&
      upperShadow < bodySize * 0.5 &&
      prev.close > current.close; // 处于下跌趋势

    // 根据十字星类型生成不同的信号
    if (isDragonflyDoji) {
      signals.push(createSignal(current, {
        type: "doji",
        name: "蜻蜓十字星",
        direction: "bullish",
        strength: 4,
        description: "出现在下跌趋势底部，下影线很长，提示可能的底部反转。",
      }));
    } else if (isGravestoneDoji) {
      signals.push(createSignal(current, {
        type: "doji",
        name: "墓碑十字星",
        direction: "bearish",
        strength: 4,
        description: "出现在上涨趋势顶部，上影线很长，提示可能的顶部反转。",
      }));
    } else if (isLongLeggedDoji) {
      signals.push(createSignal(current, {
        type: "doji",
        name: "长腿十字星",
        direction: "neutral",
        strength: 2,
        description: "多空双方激烈博弈后势均力敌，市场处于犹豫状态，需等待方向确认。",
      }));
    } else if (isStrictDoji) {
      // 普通十字星
      signals.push(createSignal(current, {
        type: "doji",
        name: "十字星",
        direction: "neutral",
        strength: 1,
        description: "开盘价与收盘价几乎相同，表示市场暂时失去方向，需结合前后K线判断。",
      }));
    }
  }

  return signals;
}

/**
 * 识别早晨之星和黄昏之星形态
 */
export function detectMorningStarEveningStarSignals(klines: KLine[]): Signal[] {
  const signals: Signal[] = [];

  for (let i = 2; i < klines.length; i++) {
    const first = getKLineAt(klines, i - 2);
    const second = getKLineAt(klines, i - 1);
    const third = getKLineAt(klines, i);

    if (first === null || second === null || third === null) {
      continue;
    }

    // 早晨之星：下跌趋势后出现，第一根大阴线，第二根小实体（十字星或陀螺），第三根大阳线
    const isMorningStar =
      first.close < first.open && // 第一根阴线
      (third.close - third.open) > (first.open - first.close) * 0.6 && // 第三根阳线实体较大
      third.close > third.open && // 第三根阳线
      third.close > (first.open + first.close) / 2 && // 第三根收盘价深入第一根实体
      getBodySize(second) < Math.abs(first.close - first.open) * 0.3 && // 第二根实体很小
      second.low < first.low && second.low < third.low; // 第二根是最低点

    if (isMorningStar) {
      signals.push(createSignal(third, {
        type: "morning_star",
        name: "早晨之星",
        direction: "bullish",
        strength: 5,
        description: "三根K线组成的底部反转形态，第一根大阴线，第二根小实体，第三根大阳线确认反转。",
      }));
    }

    // 黄昏之星：上涨趋势后出现，第一根大阳线，第二根小实体，第三根大阴线
    const isEveningStar =
      first.close > first.open && // 第一根阳线
      (first.close - first.open) > (third.open - third.close) * 0.6 &&
      third.close < third.open && // 第三根阴线
      third.close < (first.open + first.close) / 2 && // 第三根收盘价深入第一根实体
      getBodySize(second) < Math.abs(first.close - first.open) * 0.3 && // 第二根实体很小
      second.high > first.high && second.high > third.high; // 第二根是最高点

    if (isEveningStar) {
      signals.push(createSignal(third, {
        type: "evening_star",
        name: "黄昏之星",
        direction: "bearish",
        strength: 5,
        description: "三根K线组成的顶部反转形态，第一根大阳线，第二根小实体，第三根大阴线确认反转。",
      }));
    }
  }

  return signals;
}

/**
 * 识别流星线和吊颈线
 */
export function detectShootingStarHangingManSignals(klines: KLine[]): Signal[] {
  const signals: Signal[] = [];

  for (let i = 2; i < klines.length; i++) {
    const current = getKLineAt(klines, i);
    const prev1 = getKLineAt(klines, i - 1);
    const prev2 = getKLineAt(klines, i - 2);

    if (current === null || prev1 === null || prev2 === null) {
      continue;
    }

    const bodySize = getBodySize(current);
    const upperShadow = getUpperShadow(current);
    const lowerShadow = getLowerShadow(current);
    const totalRange = current.high - current.low;

    // 流星线：出现在上涨趋势顶部，上影线很长（实体2倍以上），实体小，下影线很短
    const isUptrend = prev2.close < prev1.close || prev2.high < prev1.high;
    const isShootingStar =
      isUptrend &&
      bodySize > 0 &&
      upperShadow >= bodySize * 2 &&
      lowerShadow <= bodySize * 0.2 &&
      bodySize / totalRange < 0.3;

    if (isShootingStar) {
      signals.push(createSignal(current, {
        type: "shooting_star",
        name: "流星线",
        direction: "bearish",
        strength: 4,
        description: "出现在上涨趋势顶部，上影线长下影线短，提示可能的顶部反转。",
      }));
    }

    // 吊颈线：出现在下跌趋势底部，下影线很长（实体2倍以上），实体小，上影线很短
    const isDowntrend = prev2.close > prev1.close || prev2.high > prev1.high;
    const isHangingMan =
      isDowntrend &&
      bodySize > 0 &&
      lowerShadow >= bodySize * 2 &&
      upperShadow <= bodySize * 0.2 &&
      bodySize / totalRange < 0.3;

    if (isHangingMan) {
      signals.push(createSignal(current, {
        type: "hanging_man",
        name: "吊颈线",
        direction: "bearish",
        strength: 3,
        description: "出现在下跌趋势中，下影线长上影线短，可能是下跌中继或弱反弹信号。",
      }));
    }
  }

  return signals;
}

/**
 * 计算RSI指标
 */
function calculateRSI(klines: KLine[], period: number = 14): number[] {
  const rsi: number[] = [];
  const gains: number[] = [];
  const losses: number[] = [];

  // 计算价格变化
  for (let i = 1; i < klines.length; i++) {
    const current = getKLineAt(klines, i);
    const previous = getKLineAt(klines, i - 1);

    if (current === null || previous === null) {
      continue;
    }

    const change = current.close - previous.close;
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? -change : 0);
  }

  // 计算RSI
  for (let i = 0; i < klines.length; i++) {
    if (i < period) {
      rsi.push(50); // 默认中性值
      continue;
    }

    const avgGain = gains.slice(i - period, i).reduce((a, b) => a + b, 0) / period;
    const avgLoss = losses.slice(i - period, i).reduce((a, b) => a + b, 0) / period;

    if (avgLoss === 0) {
      rsi.push(100);
    } else {
      const rs = avgGain / avgLoss;
      rsi.push(100 - 100 / (1 + rs));
    }
  }

  return rsi;
}

/**
 * 检测背离信号
 */
export function detectDivergenceSignals(klines: KLine[]): Signal[] {
  const signals: Signal[] = [];
  const macd = calculateMACD(klines);
  const rsi = calculateRSI(klines, 14);

  // 需要至少30根K线才能计算可靠的背离
  if (klines.length < 30) return signals;

  // 寻找价格极值点
  for (let i = 5; i < klines.length - 5; i++) {
    const current = getKLineAt(klines, i);
    const past = getKLineAt(klines, i - 5);
    const future = getKLineAt(klines, i + 5);
    const prevMacd = macd[i - 1];
    const currentMacd = macd[i];
    const currentRSI = rsi[i];
    const prevRSI = rsi[i - 5];

    if (
      current === null ||
      past === null ||
      future === null ||
      prevMacd === undefined ||
      currentMacd === undefined ||
      currentRSI === undefined ||
      prevRSI === undefined
    ) {
      continue;
    }

    // 检测MACD底背离（看涨）
    // 价格创新低，但MACD未创新低
    const isPriceLowerLow =
      current.low < past.low &&
      current.low < future.low;

    const isMacdNotLowerLow =
      currentMacd.macd > prevMacd.macd;

    if (isPriceLowerLow && isMacdNotLowerLow && currentMacd.macd < 0) {
      signals.push(createSignal(current, {
        type: "macd_bullish_divergence",
        name: "MACD底背离",
        direction: "bullish",
        strength: 4,
        description: "价格创新低但MACD未创新低，可能预示下跌趋势即将反转。",
      }));
    }

    // 检测MACD顶背离（看跌）
    // 价格创新高，但MACD未创新高
    const isPriceHigherHigh =
      current.high > past.high &&
      current.high > future.high;

    const isMacdNotHigherHigh =
      currentMacd.macd < prevMacd.macd;

    if (isPriceHigherHigh && isMacdNotHigherHigh && currentMacd.macd > 0) {
      signals.push(createSignal(current, {
        type: "macd_bearish_divergence",
        name: "MACD顶背离",
        direction: "bearish",
        strength: 4,
        description: "价格创新高但MACD未创新高，可能预示上涨趋势即将反转。",
      }));
    }

    // 检测RSI背离（类似逻辑，使用RSI值）
    // RSI底背离
    if (
      isPriceLowerLow &&
      currentRSI > prevRSI &&
      currentRSI < 40
    ) {
      signals.push(createSignal(current, {
        type: "rsi_bullish_divergence",
        name: "RSI底背离",
        direction: "bullish",
        strength: 3,
        description: "价格创新低但RSI未创新低，显示下跌动能减弱。",
      }));
    }

    // RSI顶背离
    if (
      isPriceHigherHigh &&
      currentRSI < prevRSI &&
      currentRSI > 60
    ) {
      signals.push(createSignal(current, {
        type: "rsi_bearish_divergence",
        name: "RSI顶背离",
        direction: "bearish",
        strength: 3,
        description: "价格创新高但RSI未创新高，显示上涨动能减弱。",
      }));
    }
  }

  return signals;
}

/**
 * 计算简单移动平均
 */
function calculateSMA(values: number[], period: number): number[] {
  const sma: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      sma.push(values[i] ?? 0);
    } else {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += values[i - j] ?? 0;
      }
      sma.push(sum / period);
    }
  }
  return sma;
}

/**
 * 寻找局部极值点
 */
function findExtremes(
  klines: KLine[],
  window: number = 5
): { highs: number[]; lows: number[] } {
  const highs: number[] = [];
  const lows: number[] = [];

  for (let i = window; i < klines.length - window; i++) {
    const current = getKLineAt(klines, i);
    let isHigh = true;
    let isLow = true;

    if (current === null) {
      continue;
    }

    for (let j = 1; j <= window; j++) {
      const previous = getKLineAt(klines, i - j);
      const next = getKLineAt(klines, i + j);

      if (previous === null || next === null) {
        isHigh = false;
        isLow = false;
        continue;
      }

      if (current.high <= previous.high || current.high <= next.high) {
        isHigh = false;
      }
      if (current.low >= previous.low || current.low >= next.low) {
        isLow = false;
      }
    }

    if (isHigh) highs.push(i);
    if (isLow) lows.push(i);
  }

  return { highs, lows };
}

/**
 * 检测支撑阻力位突破信号
 */
export function detectSupportResistanceSignals(klines: KLine[]): Signal[] {
  const signals: Signal[] = [];

  if (klines.length < 20) return signals;

  // 寻找近期的高点和低点作为支撑阻力位
  const { highs, lows } = findExtremes(klines, 3);
  const latest = getKLineAt(klines, klines.length - 1);

  if (latest === null) {
    return signals;
  }

  // 计算支撑阻力位（使用近期极值点的均值）
  const recentHighs = highs
    .slice(-3)
    .map((index) => getKLineAt(klines, index)?.high)
    .filter((value): value is number => value !== undefined);
  const recentLows = lows
    .slice(-3)
    .map((index) => getKLineAt(klines, index)?.low)
    .filter((value): value is number => value !== undefined);

  const resistanceLevel = recentHighs.length > 0
    ? recentHighs.reduce((a, b) => a + b, 0) / recentHighs.length
    : latest.high * 1.02;

  const supportLevel = recentLows.length > 0
    ? recentLows.reduce((a, b) => a + b, 0) / recentLows.length
    : latest.low * 0.98;

  // 检测突破信号
  for (let i = 5; i < klines.length; i++) {
    const current = getKLineAt(klines, i);
    const prev = getKLineAt(klines, i - 1);

    if (current === null || prev === null) {
      continue;
    }

    // 突破阻力位：前一根K线收盘价低于阻力位，当前K线收盘价高于阻力位
    if (
      prev.close < resistanceLevel &&
      current.close > resistanceLevel &&
      current.close > current.open // 阳线突破更可靠
    ) {
      signals.push(createSignal(current, {
        type: "resistance_break",
        name: "突破阻力",
        direction: "bullish",
        strength: 4,
        description: `价格突破近期阻力位（${resistanceLevel.toFixed(2)}），可能开启上涨趋势。`,
      }));
    }
    // 跌破支撑位：前一根K线收盘价高于支撑位，当前K线收盘价低于支撑位
    if (
      prev.close > supportLevel &&
      current.close < supportLevel &&
      current.close < current.open // 阴线跌破更可靠
    ) {
      signals.push(createSignal(current, {
        type: "support_break",
        name: "跌破支撑",
        direction: "bearish",
        strength: 4,
        description: `价格跌破近期支撑位（${supportLevel.toFixed(2)}），可能开启下跌趋势。`,
      }));
    }
    // 支撑反弹：价格触及支撑位后反弹
    if (
      prev.low <= supportLevel * 1.01 && // 前一根触及或接近支撑位
      current.close > current.open && // 当前收阳线
      current.close > prev.close // 收盘价上涨
    ) {
      signals.push(createSignal(current, {
        type: "support_bounce",
        name: "支撑反弹",
        direction: "bullish",
        strength: 3,
        description: `价格在支撑位（${supportLevel.toFixed(2)}）附近获得支撑并反弹。`,
      }));
    }
    // 阻力回落：价格触及阻力位后回落
    if (
      prev.high >= resistanceLevel * 0.99 && // 前一根触及或接近阻力位
      current.close < current.open && // 当前收阴线
      current.close < prev.close // 收盘价下跌
    ) {
      signals.push(createSignal(current, {
        type: "resistance_rejection",
        name: "阻力回落",
        direction: "bearish",
        strength: 3,
        description: `价格在阻力位（${resistanceLevel.toFixed(2)}）附近遇阻回落。`,
      }));
    }
  }

  return signals;
}

// TODO: 实现更多信号检测函数
// - detectDivergenceSignals (背离检测)
// - detectVolumeSignals (成交量异常)
