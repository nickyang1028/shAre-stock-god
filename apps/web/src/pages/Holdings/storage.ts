import {
  deleteHoldingRecord,
  getHoldingRecords,
  saveHoldingRecord,
  type HoldingRecord,
} from '../../services/localDatabase.js';
import { normalizeSymbol } from '../Watchlist/storage.js';

export type HoldingStock = {
  /** 股票代码 */
  symbol: string;
  /** 股票名称 */
  name: string;
  /** 持仓数量 */
  shares: number;
  /** 成本价 */
  costPrice: number;
  /** 创建时间戳 */
  createdAt: number;
  /** 更新时间戳 */
  updatedAt: number;
};

export type HoldingDraft = {
  /** 股票代码 */
  symbol: string;
  /** 股票名称 */
  name: string;
  /** 持仓数量 */
  shares: number;
  /** 成本价 */
  costPrice: number;
};

/**
 * 读取本地持仓。
 * @returns {Promise<HoldingStock[]>} 持仓列表
 */
export async function readHoldings(): Promise<HoldingStock[]> {
  const records = await getHoldingRecords();
  return records.map(mapRecordToHolding);
}

/**
 * 保存一条持仓。
 * @param {HoldingDraft} draft 持仓草稿
 * @param {HoldingStock | undefined} existingHolding 已存在持仓
 * @returns {Promise<HoldingStock>} 保存后的持仓
 */
export async function saveHolding(
  draft: HoldingDraft,
  existingHolding: HoldingStock | undefined
): Promise<HoldingStock> {
  const now = Date.now();
  const holding: HoldingStock = {
    symbol: normalizeSymbol(draft.symbol),
    name: draft.name.trim(),
    shares: draft.shares,
    costPrice: draft.costPrice,
    createdAt: existingHolding?.createdAt ?? now,
    updatedAt: now,
  };

  await saveHoldingRecord(holding);
  return holding;
}

/**
 * 删除一条持仓。
 * @param {string} symbol 股票代码
 * @returns {Promise<void>} 无返回值
 */
export function removeHolding(symbol: string): Promise<void> {
  return deleteHoldingRecord(symbol);
}

/**
 * 将数据库记录映射为页面持仓。
 * @param {HoldingRecord} record 数据库记录
 * @returns {HoldingStock} 页面持仓
 */
function mapRecordToHolding(record: HoldingRecord): HoldingStock {
  return {
    symbol: record.symbol,
    name: record.name,
    shares: record.shares,
    costPrice: record.costPrice,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}
