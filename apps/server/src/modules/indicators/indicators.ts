import type { KLine } from "@share-stock-god/shared";

export type MacdPoint = {
  /** DIF 快线值 */
  dif: number;
  /** DEA 慢线值 */
  dea: number;
  /** MACD 柱值（2 * (DIF - DEA)） */
  macd: number;
};

/**
 * 计算简单移动平均线（MA）。
 * @param {KLine[]} klines K 线序列
 * @param {number} period 均线周期
 * @returns {Array<number | null>} 与 K 线等长的均线序列
 */
export function calculateMA(klines: KLine[], period: number): Array<number | null> {
  const result: Array<number | null> = [];
  let sum = 0;

  klines.forEach((kline, index) => {
    // 关键逻辑：使用滑动窗口累计和，避免每次重复遍历 period 个元素。
    sum += kline.close;
    if (index >= period) {
      sum -= klines[index - period]?.close ?? 0;
    }
    result.push(index >= period - 1 ? round(sum / period) : null);
  });

  return result;
}

/**
 * 计算 MACD 指标序列（DIF、DEA、MACD 柱值）。
 * @param {KLine[]} klines K 线序列
 * @returns {MacdPoint[]} MACD 点位序列
 */
export function calculateMACD(klines: KLine[]): MacdPoint[] {
  const closes = klines.map((kline) => kline.close);
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);
  const difValues = closes.map((_close, index) => {
    const shortValue = ema12[index] ?? closes[index] ?? 0;
    const longValue = ema26[index] ?? closes[index] ?? 0;
    return shortValue - longValue;
  });
  const deaValues = calculateEMA(difValues, 9);

  return difValues.map((dif, index) => {
    const dea = deaValues[index] ?? 0;
    return {
      dif: round(dif),
      dea: round(dea),
      macd: round((dif - dea) * 2),
    };
  });
}

/**
 * 计算指数移动平均线（EMA）。
 * @param {number[]} values 输入值序列
 * @param {number} period EMA 周期
 * @returns {number[]} EMA 结果序列
 */
function calculateEMA(values: number[], period: number): number[] {
  const result: number[] = [];
  const multiplier = 2 / (period + 1);

  values.forEach((value, index) => {
    // 边界处理：首个值没有前序 EMA，直接作为初始值。
    if (index === 0) {
      result.push(value);
      return;
    }
    const previous = result[index - 1] ?? value;
    result.push(round((value - previous) * multiplier + previous));
  });

  return result;
}

/**
 * 对数值保留 4 位小数。
 * @param {number} value 原始数值
 * @returns {number} 四舍五入后的数值
 */
function round(value: number): number {
  return Number(value.toFixed(4));
}
