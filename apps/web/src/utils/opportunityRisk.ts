import type { FactorData } from '../pages/Quant/types.js';
import type { HoldingStock } from '../pages/Holdings/storage.js';

const CONFIG_STORAGE_KEY = 'share-stock-god-opportunity-risk-config';

export type ScoreResult = {
  /** 分数 */
  score: number;
  /** 评分原因 */
  reasons: string[];
};

export type HoldingValuation = {
  /** 当前市值 */
  marketValue: number;
  /** 持仓盈亏 */
  profit: number;
  /** 持仓盈亏比例 */
  profitRate: number;
};

export type OpportunityRiskConfig = {
  /** 机会候选最低分 */
  opportunityThreshold: number;
  /** 风险提醒最低分 */
  riskThreshold: number;
  /** 温和上涨上限，小数形式 */
  mildRiseMax: number;
  /** 活跃量比下限 */
  activeVolumeMin: number;
  /** 活跃量比上限 */
  activeVolumeMax: number;
  /** 异常放量阈值 */
  highVolumeRatio: number;
  /** 大跌提醒阈值，小数形式 */
  sharpDropRate: number;
  /** 持仓亏损提醒阈值，小数形式 */
  holdingLossAlertRate: number;
  /** 持仓盈利保护阈值，小数形式 */
  holdingProfitProtectRate: number;
};

export const DEFAULT_OPPORTUNITY_RISK_CONFIG: OpportunityRiskConfig = {
  opportunityThreshold: 50,
  riskThreshold: 50,
  mildRiseMax: 0.05,
  activeVolumeMin: 1.2,
  activeVolumeMax: 3,
  highVolumeRatio: 3,
  sharpDropRate: -0.03,
  holdingLossAlertRate: -0.08,
  holdingProfitProtectRate: 0.2,
};

export type OpportunityRiskPreset = {
  /** 预设编号 */
  key: string;
  /** 预设名称 */
  label: string;
  /** 预设说明 */
  description: string;
  /** 预设配置 */
  config: OpportunityRiskConfig;
};

export const OPPORTUNITY_RISK_PRESETS: OpportunityRiskPreset[] = [
  {
    key: 'balanced',
    label: '均衡',
    description: '默认规则，机会与风险提醒相对均衡。',
    config: DEFAULT_OPPORTUNITY_RISK_CONFIG,
  },
  {
    key: 'conservative',
    label: '稳健',
    description: '提高机会门槛，提前提示风险。',
    config: {
      opportunityThreshold: 60,
      riskThreshold: 42,
      mildRiseMax: 0.04,
      activeVolumeMin: 1.1,
      activeVolumeMax: 2.5,
      highVolumeRatio: 2.5,
      sharpDropRate: -0.02,
      holdingLossAlertRate: -0.05,
      holdingProfitProtectRate: 0.15,
    },
  },
  {
    key: 'aggressive',
    label: '激进',
    description: '降低机会门槛，容忍更高波动。',
    config: {
      opportunityThreshold: 42,
      riskThreshold: 62,
      mildRiseMax: 0.08,
      activeVolumeMin: 1.5,
      activeVolumeMax: 4,
      highVolumeRatio: 4.5,
      sharpDropRate: -0.05,
      holdingLossAlertRate: -0.12,
      holdingProfitProtectRate: 0.3,
    },
  },
];

/**
 * 读取机会风险配置。
 * @returns {OpportunityRiskConfig} 机会风险配置
 */
export function loadOpportunityRiskConfig(): OpportunityRiskConfig {
  const rawValue = window.localStorage.getItem(CONFIG_STORAGE_KEY);
  if (rawValue === null) {
    return DEFAULT_OPPORTUNITY_RISK_CONFIG;
  }

  try {
    const parsedValue = JSON.parse(rawValue) as Partial<OpportunityRiskConfig>;
    return normalizeOpportunityRiskConfig(parsedValue);
  } catch {
    return DEFAULT_OPPORTUNITY_RISK_CONFIG;
  }
}

/**
 * 保存机会风险配置。
 * @param {OpportunityRiskConfig} config 机会风险配置
 * @returns {void} 无返回值
 */
export function saveOpportunityRiskConfig(config: OpportunityRiskConfig): void {
  window.localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(normalizeOpportunityRiskConfig(config)));
}

/**
 * 规范化机会风险配置。
 * @param {Partial<OpportunityRiskConfig>} config 原始配置
 * @returns {OpportunityRiskConfig} 规范化后的配置
 */
function normalizeOpportunityRiskConfig(config: Partial<OpportunityRiskConfig>): OpportunityRiskConfig {
  return {
    opportunityThreshold: normalizeNumber(config.opportunityThreshold, DEFAULT_OPPORTUNITY_RISK_CONFIG.opportunityThreshold, 0, 100),
    riskThreshold: normalizeNumber(config.riskThreshold, DEFAULT_OPPORTUNITY_RISK_CONFIG.riskThreshold, 0, 100),
    mildRiseMax: normalizeNumber(config.mildRiseMax, DEFAULT_OPPORTUNITY_RISK_CONFIG.mildRiseMax, 0, 0.2),
    activeVolumeMin: normalizeNumber(config.activeVolumeMin, DEFAULT_OPPORTUNITY_RISK_CONFIG.activeVolumeMin, 0, 10),
    activeVolumeMax: normalizeNumber(config.activeVolumeMax, DEFAULT_OPPORTUNITY_RISK_CONFIG.activeVolumeMax, 0, 20),
    highVolumeRatio: normalizeNumber(config.highVolumeRatio, DEFAULT_OPPORTUNITY_RISK_CONFIG.highVolumeRatio, 0, 20),
    sharpDropRate: normalizeNumber(config.sharpDropRate, DEFAULT_OPPORTUNITY_RISK_CONFIG.sharpDropRate, -0.5, 0),
    holdingLossAlertRate: normalizeNumber(config.holdingLossAlertRate, DEFAULT_OPPORTUNITY_RISK_CONFIG.holdingLossAlertRate, -0.9, 0),
    holdingProfitProtectRate: normalizeNumber(config.holdingProfitProtectRate, DEFAULT_OPPORTUNITY_RISK_CONFIG.holdingProfitProtectRate, 0, 5),
  };
}

/**
 * 规范化数字配置。
 * @param {number | undefined} value 原始值
 * @param {number} fallback 默认值
 * @param {number} min 最小值
 * @param {number} max 最大值
 * @returns {number} 规范化数字
 */
function normalizeNumber(value: number | undefined, fallback: number, min: number, max: number): number {
  if (value === undefined || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(Math.max(value, min), max);
}

/**
 * 计算机会分。
 * @param {FactorData | null} data 因子数据
 * @returns {ScoreResult} 机会评分
 */
export function calculateOpportunityScore(
  data: FactorData | null,
  config: OpportunityRiskConfig = DEFAULT_OPPORTUNITY_RISK_CONFIG
): ScoreResult {
  if (data === null) {
    return { score: 0, reasons: [] };
  }

  const reasons: string[] = [];
  let score = 0;

  if (data.signals.maGoldenCross) {
    score += 28;
    reasons.push('均线金叉，趋势可能转强');
  }
  if (data.signals.volumeBreakout) {
    score += 18;
    reasons.push('出现放量，关注资金参与度');
  }
  if (data.signals.capitalInflowSignal || data.capitalFlow.signal === 'inflow') {
    score += 22;
    reasons.push('资金流入信号较明确');
  }
  if (data.ma.trend === 'up') {
    score += 18;
    reasons.push('均线趋势上行');
  }
  if (data.changePercent > 0 && data.changePercent <= config.mildRiseMax) {
    score += 8;
    reasons.push('当日上涨但未明显过热');
  }
  if (data.volume.volumeRatio >= config.activeVolumeMin && data.volume.volumeRatio <= config.activeVolumeMax) {
    score += 6;
    reasons.push('量比处于活跃区间');
  }

  return { score: Math.min(score, 100), reasons };
}

/**
 * 计算风险分。
 * @param {HoldingStock | null} holding 持仓信息
 * @param {FactorData | null} data 因子数据
 * @param {number} profitRate 盈亏比例
 * @returns {ScoreResult} 风险评分
 */
export function calculateRiskScore(
  holding: HoldingStock | null,
  data: FactorData | null,
  profitRate: number,
  config: OpportunityRiskConfig = DEFAULT_OPPORTUNITY_RISK_CONFIG
): ScoreResult {
  if (data === null) {
    return { score: 40, reasons: ['行情数据获取失败，需要人工确认'] };
  }

  const reasons: string[] = [];
  let score = 0;

  if (data.signals.maDeadCross) {
    score += 30;
    reasons.push('均线死叉，趋势可能转弱');
  }
  if (data.capitalFlow.signal === 'outflow') {
    score += 22;
    reasons.push('资金流出，需要警惕承压');
  }
  if (data.ma.trend === 'down') {
    score += 18;
    reasons.push('均线趋势下行');
  }
  if (data.changePercent < config.sharpDropRate) {
    score += 12;
    reasons.push('当日跌幅较大');
  }
  if (data.volume.volumeRatio > config.highVolumeRatio) {
    score += 8;
    reasons.push('异常放量，波动风险升高');
  }
  if (holding !== null && profitRate < config.holdingLossAlertRate) {
    score += 18;
    reasons.push('持仓亏损超过 8%，需复核止损');
  }
  if (holding !== null && profitRate > config.holdingProfitProtectRate) {
    score += 6;
    reasons.push('持仓盈利较高，注意回撤保护');
  }

  return { score: Math.min(score, 100), reasons };
}

/**
 * 计算持仓估值。
 * @param {HoldingStock | null} holding 持仓信息
 * @param {FactorData | null} data 因子数据
 * @returns {HoldingValuation} 持仓估值
 */
export function calculateHoldingValuation(
  holding: HoldingStock | null,
  data: FactorData | null
): HoldingValuation {
  if (holding === null) {
    return { marketValue: 0, profit: 0, profitRate: 0 };
  }

  const latestPrice = data?.latestPrice ?? holding.costPrice;
  const marketValue = latestPrice * holding.shares;
  const costValue = holding.costPrice * holding.shares;
  const profit = marketValue - costValue;

  return {
    marketValue,
    profit,
    profitRate: costValue > 0 ? profit / costValue : 0,
  };
}
