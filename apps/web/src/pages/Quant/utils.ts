/**
 * 数字格式化
 * @param {number} num 原始数字
 * @param {number} decimals 小数位数
 * @returns {string} 格式化后的数字
 */
export function formatNumber(num: number, decimals: number = 2): string {
  if (!Number.isFinite(num)) return '-';
  return num.toFixed(decimals);
}

/**
 * 金额格式化
 * @param {number} amount 原始金额
 * @returns {string} 格式化后的金额
 */
export function formatMoney(amount: number): string {
  if (!Number.isFinite(amount)) return '-';
  return `¥${amount.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * 百分比格式化
 * @param {number} ratio 小数形式比率
 * @returns {string} 格式化后的百分比
 */
export function formatPercent(ratio: number): string {
  if (!Number.isFinite(ratio)) return '-';
  return `${(ratio * 100).toFixed(2)}%`;
}

/**
 * 成交量格式化
 * @param {number} volume 成交量
 * @returns {string} 格式化后的成交量
 */
export function formatVolume(volume: number): string {
  if (volume >= 100000000) {
    return `${(volume / 100000000).toFixed(2)}亿`;
  }
  if (volume >= 10000) {
    return `${(volume / 10000).toFixed(2)}万`;
  }
  return volume.toString();
}

/**
 * 趋势样式类名
 * @param {'up' | 'down' | 'sideway' | 'stable'} trend 趋势类型
 * @returns {string} 样式类名
 */
export function getTrendClass(trend: 'up' | 'down' | 'sideway' | 'stable'): string {
  switch (trend) {
    case 'up':
      return 'trend-up';
    case 'down':
      return 'trend-down';
    default:
      return 'trend-neutral';
  }
}
