import type { KLine } from '@share-stock-god/shared';

// Tushare API Token（从环境变量读取）
const TUSHARE_TOKEN =
  process.env.TUSHARE_TOKEN ??
  'fc7ba32990fdfcd10b72cef7bdf686b2f65c109872cc60b2079521c8';
const TUSHARE_API_URL = 'https://api.tushare.pro';

// 缓存上次使用的token是否有效，避免反复请求无效token
let lastTokenValid: boolean | null = null;

/**
 * 检查 Tushare token 是否配置且有效
 * @returns {boolean} token 是否有效
 */
export function isTushareAvailable(): boolean {
  if (!TUSHARE_TOKEN) return false;
  if (lastTokenValid !== null) return lastTokenValid;
  return true;
}

/**
 * 将标准股票代码转换为 Tushare 的 ts_code 格式
 * @param {string} symbol 标准股票代码，如 600519.SH
 * @returns {string} Tushare ts_code，如 600519.SH
 */
function toTushareCode(symbol: string): string {
  // Tushare 的 ts_code 格式就是 600519.SH / 000001.SZ
  const trimmed = symbol.trim().toUpperCase();
  if (trimmed.endsWith('.SH') || trimmed.endsWith('.SZ')) {
    return trimmed;
  }
  // 如果没有后缀，根据首位判断
  const code = trimmed.slice(0, 6);
  if (code.startsWith('6')) {
    return `${code}.SH`;
  }
  return `${code}.SZ`;
}

/**
 * 从 Tushare 获取股票基本信息（名称等）
 * @param {string} tsCode Tushare 格式的股票代码
 * @returns {Promise<string>} 股票名称
 */
async function fetchStockName(tsCode: string): Promise<string> {
  try {
    const response = await fetch(TUSHARE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_name: 'stock_basic',
        token: TUSHARE_TOKEN,
        params: {
          ts_code: tsCode,
        },
        fields: 'ts_code,name',
      }),
    });

    if (!response.ok) {
      return tsCode;
    }

    const data = (await response.json()) as {
      code?: number;
      data?: {
        fields: string[];
        items: (string | number | null)[][];
      };
    };

    if (data.code === 0 && data.data?.items && data.data.items.length > 0) {
      const fields = data.data.fields;
      const items = data.data.items[0];
      const nameIndex = fields.indexOf('name');
      if (nameIndex !== -1 && items && items[nameIndex]) {
        return String(items[nameIndex]);
      }
    }
  } catch {
    // 获取名称失败时返回代码
  }
  return tsCode;
}

/**
 * 从 Tushare 获取股票日线数据
 * @param {object} params 查询参数
 * @param {string} params.symbol 股票代码，如 600519.SH
 * @param {number} params.limit 获取数据条数
 * @returns {Promise<{symbol: string; name: string; klines: KLine[]}>} 标准化后的行情数据
 */
export async function fetchDailyKLines(params: {
  symbol: string;
  limit: number;
}): Promise<{ symbol: string; name: string; klines: KLine[] }> {
  if (!TUSHARE_TOKEN) {
    throw new Error('TUSHARE_TOKEN 未配置');
  }

  const tsCode = toTushareCode(params.symbol);

  // 计算起始日期：多取一些数据用于技术指标计算
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - params.limit - 60);

  const startDateStr = startDate.toISOString().slice(0, 10).replace(/-/g, '');
  const endDateStr = endDate.toISOString().slice(0, 10).replace(/-/g, '');

  const response = await fetch(TUSHARE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      api_name: 'daily',
      token: TUSHARE_TOKEN,
      params: {
        ts_code: tsCode,
        start_date: startDateStr,
        end_date: endDateStr,
      },
      fields: 'ts_code,trade_date,open,high,low,close,vol,amount',
    }),
  });

  if (!response.ok) {
    throw new Error(`Tushare API 请求失败：${response.status}`);
  }

  const data = (await response.json()) as {
    code?: number;
    msg?: string;
    data?: {
      fields: string[];
      items: (string | number | null)[][];
    };
  };

  // 检查 API 返回的错误码
  if (data.code !== 0) {
    throw new Error(`Tushare API 错误：${data.msg ?? '未知错误'}`);
  }

  if (!data.data?.items?.length) {
    throw new Error(`未查询到 ${tsCode} 的日K数据`);
  }

  // 解析字段索引
  const fields = data.data.fields;
  const fieldIndex: Record<string, number> = {};
  fields.forEach((f, i) => {
    fieldIndex[f] = i;
  });

  // 转换数据格式
  const klines: KLine[] = data.data.items
    .map((item) => {
      const tradeDate = String(item[fieldIndex.trade_date] ?? '');
      const timestamp = new Date(
        `${tradeDate.slice(0, 4)}-${tradeDate.slice(4, 6)}-${tradeDate.slice(6, 8)}T15:00:00+08:00`
      ).getTime();

      return {
        symbol: tsCode.replace('.', '_'),
        timestamp,
        date: `${tradeDate.slice(0, 4)}-${tradeDate.slice(4, 6)}-${tradeDate.slice(6, 8)}`,
        open: Number(item[fieldIndex.open] ?? 0),
        high: Number(item[fieldIndex.high] ?? 0),
        low: Number(item[fieldIndex.low] ?? 0),
        close: Number(item[fieldIndex.close] ?? 0),
        volume: Number(item[fieldIndex.vol] ?? 0),
        amount: Number(item[fieldIndex.amount] ?? 0),
      };
    })
    .sort((a, b) => a.timestamp - b.timestamp);

  // 截取最后 limit 条
  const recentKlines = klines.slice(-params.limit);

  // 获取股票真实名称
  const stockName = await fetchStockName(tsCode);
  console.log(stockName);
  return {
    symbol: tsCode,
    name: stockName,
    klines: recentKlines,
  };
}
