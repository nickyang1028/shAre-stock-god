import type { KLine, Signal, SignalDirection, SignalType } from "@share-stock-god/shared";
import { calculateMA, calculateMACD } from "../indicators/indicators.js";
import {
  detectHammerSignals,
  detectDojiSignals,
  detectMorningStarEveningStarSignals,
  detectShootingStarHangingManSignals,
  detectSupportResistanceSignals,
} from "./advancedPatterns.js";

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
  /** 信号可信度评分，0~100 */
  confidence?: number;
  /** 信号触发原因 */
  reasons?: string[];
  /** 信号计算时的关键数据快照 */
  metrics?: Signal['metrics'];
  /** 信号辅助标签 */
  tags?: string[];
};

/**
 * 聚合识别所有支持的技术信号并按时间升序输出。
 * @param {KLine[]} klines 已按时间升序排列的 K 线数据
 * @returns {Signal[]} 识别出的信号列表
 */
export function detectSignals(klines: KLine[]): Signal[] {
  // 聚合多种信号来源后统一排序，保证前端展示时间线稳定。
  return [
    ...detectEngulfingSignals(klines),
    ...detectMaCrossSignals(klines),
    ...detectMacdCrossSignals(klines),
    ...detectHammerSignals(klines),
    ...detectDojiSignals(klines),
    ...detectMorningStarEveningStarSignals(klines),
    ...detectShootingStarHangingManSignals(klines),
    ...detectSupportResistanceSignals(klines),
  ].sort((first, second) => first.timestamp - second.timestamp);
}

/**
 * 识别阳包阴和阴包阳两类实体吞没形态。
 * @param {KLine[]} klines 已按时间升序排列的 K 线数据
 * @returns {Signal[]} 吞没形态信号列表
 */
function detectEngulfingSignals(klines: KLine[]): Signal[] {
  const signals: Signal[] = [];

  for (let index = 1; index < klines.length; index += 1) {
    const previous = klines[index - 1];
    const current = klines[index];
    if (!previous || !current) {
      continue;
    }

    // 阳包阴：当前阳线实体覆盖前一根阴线实体，提示偏多。
    if (
      previous.close < previous.open &&
      current.close > current.open &&
      current.open <= previous.close &&
      current.close >= previous.open
    ) {
      const reasons = ["前一日为阴线", "当前为阳线", "当前实体完全覆盖前一日实体"];
      signals.push(createSignal(current, {
        type: "bullish_engulfing",
        name: "阳包阴",
        direction: "bullish",
        strength: 3,
        description: "当前阳线实体向上包住前一根阴线实体，属于偏多形态提示。",
        confidence: calculateConfidence({ strength: 3, reasons }),
        reasons,
        metrics: [
          { label: "前日实体", value: formatPriceRange(previous.open, previous.close) },
          { label: "当日实体", value: formatPriceRange(current.open, current.close) },
        ],
        tags: ["K线形态", "反转提示"],
      }));
    }

    // 阴包阳：当前阴线实体覆盖前一根阳线实体，提示偏空。
    if (
      previous.close > previous.open &&
      current.close < current.open &&
      current.open >= previous.close &&
      current.close <= previous.open
    ) {
      const reasons = ["前一日为阳线", "当前为阴线", "当前实体完全覆盖前一日实体"];
      signals.push(createSignal(current, {
        type: "bearish_engulfing",
        name: "阴包阳",
        direction: "bearish",
        strength: 3,
        description: "当前阴线实体向下包住前一根阳线实体，属于偏空形态提示。",
        confidence: calculateConfidence({ strength: 3, reasons }),
        reasons,
        metrics: [
          { label: "前日实体", value: formatPriceRange(previous.open, previous.close) },
          { label: "当日实体", value: formatPriceRange(current.open, current.close) },
        ],
        tags: ["K线形态", "反转提示"],
      }));
    }
  }

  return signals;
}

/**
 * 识别 MA5 与 MA10 的金叉与死叉信号。
 * @param {KLine[]} klines 已按时间升序排列的 K 线数据
 * @returns {Signal[]} 均线交叉信号列表
 */
function detectMaCrossSignals(klines: KLine[]): Signal[] {
  const signals: Signal[] = [];
  const ma5 = calculateMA(klines, 5);
  const ma10 = calculateMA(klines, 10);

  for (let index = 1; index < klines.length; index += 1) {
    const previousShort = ma5[index - 1];
    const previousLong = ma10[index - 1];
    const currentShort = ma5[index];
    const currentLong = ma10[index];
    const current = klines[index];

    // 边界处理：均线前期可能为空，必须等短长均线都具备后再判断。
    if (
      current &&
      previousShort != null &&
      previousLong != null &&
      currentShort != null &&
      currentLong != null &&
      previousShort <= previousLong &&
      currentShort > currentLong
    ) {
      const reasons = [
        "上一交易日 MA5 未站上 MA10",
        "当前 MA5 上穿 MA10",
        current.close >= currentShort ? "收盘价位于 MA5 上方" : "收盘价尚未站上 MA5",
      ];
      signals.push(createSignal(current, {
        type: "ma_golden_cross",
        name: "均线金叉",
        direction: "bullish",
        strength: 3,
        description: "MA5 从下方向上穿越 MA10，属于短期均线偏多提示。",
        confidence: calculateConfidence({
          strength: 3,
          reasons,
          confirmations: current.close >= currentShort ? 1 : 0,
        }),
        reasons,
        metrics: [
          { label: "昨日 MA5/MA10", value: `${formatNumber(previousShort)} / ${formatNumber(previousLong)}` },
          { label: "当前 MA5/MA10", value: `${formatNumber(currentShort)} / ${formatNumber(currentLong)}` },
          { label: "收盘价", value: formatNumber(current.close) },
        ],
        tags: ["均线", "趋势"],
      }));
    }

    if (
      current &&
      previousShort != null &&
      previousLong != null &&
      currentShort != null &&
      currentLong != null &&
      previousShort >= previousLong &&
      currentShort < currentLong
    ) {
      const reasons = [
        "上一交易日 MA5 未跌破 MA10",
        "当前 MA5 下穿 MA10",
        current.close <= currentShort ? "收盘价位于 MA5 下方" : "收盘价仍在 MA5 上方",
      ];
      signals.push(createSignal(current, {
        type: "ma_dead_cross",
        name: "均线死叉",
        direction: "bearish",
        strength: 3,
        description: "MA5 从上方向下穿越 MA10，属于短期均线偏空提示。",
        confidence: calculateConfidence({
          strength: 3,
          reasons,
          confirmations: current.close <= currentShort ? 1 : 0,
        }),
        reasons,
        metrics: [
          { label: "昨日 MA5/MA10", value: `${formatNumber(previousShort)} / ${formatNumber(previousLong)}` },
          { label: "当前 MA5/MA10", value: `${formatNumber(currentShort)} / ${formatNumber(currentLong)}` },
          { label: "收盘价", value: formatNumber(current.close) },
        ],
        tags: ["均线", "趋势"],
      }));
    }
  }

  return signals;
}

/**
 * 识别 MACD 指标的金叉与死叉信号。
 * @param {KLine[]} klines 已按时间升序排列的 K 线数据
 * @returns {Signal[]} MACD 交叉信号列表
 */
function detectMacdCrossSignals(klines: KLine[]): Signal[] {
  const signals: Signal[] = [];
  const macd = calculateMACD(klines);

  for (let index = 1; index < klines.length; index += 1) {
    const previous = macd[index - 1];
    const current = macd[index];
    const kline = klines[index];

    // 复杂条件：在零轴上方/下方发生交叉时，使用不同强度提升可解释性。
    if (previous && current && kline && previous.dif <= previous.dea && current.dif > current.dea) {
      const aboveZeroAxis = current.dif > 0 && current.dea > 0;
      const reasons = [
        "上一交易日 DIF 未站上 DEA",
        "当前 DIF 上穿 DEA",
        aboveZeroAxis ? "金叉发生在零轴上方" : "金叉发生在零轴下方",
      ];
      signals.push(createSignal(kline, {
        type: "macd_golden_cross",
        name: "MACD 金叉",
        direction: "bullish",
        strength: aboveZeroAxis ? 4 : 3,
        description: "DIF 从下方向上穿越 DEA，属于 MACD 偏多提示。",
        confidence: calculateConfidence({
          strength: aboveZeroAxis ? 4 : 3,
          reasons,
          confirmations: aboveZeroAxis ? 1 : 0,
        }),
        reasons,
        metrics: [
          { label: "昨日 DIF/DEA", value: `${formatNumber(previous.dif)} / ${formatNumber(previous.dea)}` },
          { label: "当前 DIF/DEA", value: `${formatNumber(current.dif)} / ${formatNumber(current.dea)}` },
          { label: "MACD柱", value: formatNumber(current.macd) },
        ],
        tags: ["MACD", "动能"],
      }));
    }

    if (previous && current && kline && previous.dif >= previous.dea && current.dif < current.dea) {
      const belowZeroAxis = current.dif < 0 && current.dea < 0;
      const reasons = [
        "上一交易日 DIF 未跌破 DEA",
        "当前 DIF 下穿 DEA",
        belowZeroAxis ? "死叉发生在零轴下方" : "死叉发生在零轴上方",
      ];
      signals.push(createSignal(kline, {
        type: "macd_dead_cross",
        name: "MACD 死叉",
        direction: "bearish",
        strength: belowZeroAxis ? 4 : 3,
        description: "DIF 从上方向下穿越 DEA，属于 MACD 偏空提示。",
        confidence: calculateConfidence({
          strength: belowZeroAxis ? 4 : 3,
          reasons,
          confirmations: belowZeroAxis ? 1 : 0,
        }),
        reasons,
        metrics: [
          { label: "昨日 DIF/DEA", value: `${formatNumber(previous.dif)} / ${formatNumber(previous.dea)}` },
          { label: "当前 DIF/DEA", value: `${formatNumber(current.dif)} / ${formatNumber(current.dea)}` },
          { label: "MACD柱", value: formatNumber(current.macd) },
        ],
        tags: ["MACD", "动能"],
      }));
    }
  }

  return signals;
}

/**
 * 组装统一结构的信号对象。
 * @param {KLine} kline 触发信号的 K 线
 * @param {SignalMeta} meta 信号元信息
 * @returns {Signal} 标准化后的信号
 */
function createSignal(kline: KLine, meta: SignalMeta): Signal {
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
    confidence: meta.confidence ?? calculateConfidence({
      strength: meta.strength,
      reasons: meta.reasons ?? [meta.description],
    }),
    reasons: meta.reasons ?? [meta.description],
    metrics: meta.metrics ?? [
      { label: "开盘价", value: formatNumber(kline.open) },
      { label: "收盘价", value: formatNumber(kline.close) },
      { label: "最高/最低", value: `${formatNumber(kline.high)} / ${formatNumber(kline.low)}` },
    ],
    tags: meta.tags ?? ["技术信号"],
  };
}

/**
 * 计算信号可信度评分。
 * @param {{ strength: 1 | 2 | 3 | 4 | 5; reasons: string[]; confirmations?: number }} params 评分参数
 * @returns {number} 0~100 的可信度评分
 */
function calculateConfidence(params: {
  strength: 1 | 2 | 3 | 4 | 5;
  reasons: string[];
  confirmations?: number;
}): number {
  // 关键逻辑：用强度作为基础分，原因数量和额外确认只做保守加分。
  const reasonScore = Math.min(params.reasons.length * 4, 12);
  const confirmationScore = (params.confirmations ?? 0) * 8;
  return Math.min(params.strength * 15 + reasonScore + confirmationScore, 95);
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
 * 格式化实体价格区间。
 * @param {number} open 开盘价
 * @param {number} close 收盘价
 * @returns {string} 开收盘价格区间
 */
function formatPriceRange(open: number, close: number): string {
  return `${formatNumber(open)} → ${formatNumber(close)}`;
}
