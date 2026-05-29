const DATABASE_NAME = 'share-stock-god-db';
const DATABASE_VERSION = 2;
const WATCHLIST_STORE = 'watchlist';
const HOLDINGS_STORE = 'holdings';
const DAILY_REPORTS_STORE = 'dailyReports';

export type WatchlistRecord = {
  /** 股票代码 */
  symbol: string;
  /** 创建时间戳 */
  createdAt: number;
};

export type HoldingRecord = {
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

export type DailyReportRecord = {
  /** 报告编号 */
  id: string;
  /** 报告标题 */
  title: string;
  /** Markdown 内容 */
  content: string;
  /** 创建时间戳 */
  createdAt: number;
};

/**
 * 打开本地 IndexedDB 数据库。
 * @returns {Promise<IDBDatabase>} 数据库实例
 */
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(WATCHLIST_STORE)) {
        database.createObjectStore(WATCHLIST_STORE, { keyPath: 'symbol' });
      }
      if (!database.objectStoreNames.contains(HOLDINGS_STORE)) {
        database.createObjectStore(HOLDINGS_STORE, { keyPath: 'symbol' });
      }
      if (!database.objectStoreNames.contains(DAILY_REPORTS_STORE)) {
        database.createObjectStore(DAILY_REPORTS_STORE, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('打开本地数据库失败'));
  });
}

/**
 * 在事务中读取对象仓库。
 * @param {string} storeName 仓库名称
 * @param {IDBTransactionMode} mode 事务模式
 * @returns {Promise<{ database: IDBDatabase; store: IDBObjectStore }>} 数据库和仓库
 */
async function getStore(
  storeName: string,
  mode: IDBTransactionMode
): Promise<{ database: IDBDatabase; store: IDBObjectStore }> {
  const database = await openDatabase();
  const transaction = database.transaction(storeName, mode);
  return { database, store: transaction.objectStore(storeName) };
}

/**
 * 读取仓库全部记录。
 * @param {string} storeName 仓库名称
 * @returns {Promise<T[]>} 记录数组
 */
async function getAllRecords<T>(storeName: string): Promise<T[]> {
  const { database, store } = await getStore(storeName, 'readonly');
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => {
      database.close();
      resolve(request.result as T[]);
    };
    request.onerror = () => {
      database.close();
      reject(request.error ?? new Error('读取本地数据失败'));
    };
  });
}

/**
 * 写入一条记录。
 * @param {string} storeName 仓库名称
 * @param {T} record 记录
 * @returns {Promise<void>} 无返回值
 */
async function putRecord<T>(storeName: string, record: T): Promise<void> {
  const { database, store } = await getStore(storeName, 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.put(record);
    request.onsuccess = () => {
      database.close();
      resolve();
    };
    request.onerror = () => {
      database.close();
      reject(request.error ?? new Error('写入本地数据失败'));
    };
  });
}

/**
 * 删除一条记录。
 * @param {string} storeName 仓库名称
 * @param {IDBValidKey} key 主键
 * @returns {Promise<void>} 无返回值
 */
async function deleteRecord(storeName: string, key: IDBValidKey): Promise<void> {
  const { database, store } = await getStore(storeName, 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.delete(key);
    request.onsuccess = () => {
      database.close();
      resolve();
    };
    request.onerror = () => {
      database.close();
      reject(request.error ?? new Error('删除本地数据失败'));
    };
  });
}

/**
 * 清空仓库。
 * @param {string} storeName 仓库名称
 * @returns {Promise<void>} 无返回值
 */
async function clearStore(storeName: string): Promise<void> {
  const { database, store } = await getStore(storeName, 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.clear();
    request.onsuccess = () => {
      database.close();
      resolve();
    };
    request.onerror = () => {
      database.close();
      reject(request.error ?? new Error('清空本地数据失败'));
    };
  });
}

/**
 * 读取自选股。
 * @returns {Promise<WatchlistRecord[]>} 自选股记录
 */
export async function getWatchlistRecords(): Promise<WatchlistRecord[]> {
  const records = await getAllRecords<WatchlistRecord>(WATCHLIST_STORE);
  return records.sort((first, second) => first.createdAt - second.createdAt);
}

/**
 * 保存自选股。
 * @param {WatchlistRecord} record 自选股记录
 * @returns {Promise<void>} 无返回值
 */
export function saveWatchlistRecord(record: WatchlistRecord): Promise<void> {
  return putRecord(WATCHLIST_STORE, record);
}

/**
 * 删除自选股。
 * @param {string} symbol 股票代码
 * @returns {Promise<void>} 无返回值
 */
export function deleteWatchlistRecord(symbol: string): Promise<void> {
  return deleteRecord(WATCHLIST_STORE, symbol);
}

/**
 * 清空自选股。
 * @returns {Promise<void>} 无返回值
 */
export function clearWatchlistRecords(): Promise<void> {
  return clearStore(WATCHLIST_STORE);
}

/**
 * 读取持仓记录。
 * @returns {Promise<HoldingRecord[]>} 持仓记录
 */
export async function getHoldingRecords(): Promise<HoldingRecord[]> {
  const records = await getAllRecords<HoldingRecord>(HOLDINGS_STORE);
  return records.sort((first, second) => first.createdAt - second.createdAt);
}

/**
 * 保存持仓记录。
 * @param {HoldingRecord} record 持仓记录
 * @returns {Promise<void>} 无返回值
 */
export function saveHoldingRecord(record: HoldingRecord): Promise<void> {
  return putRecord(HOLDINGS_STORE, record);
}

/**
 * 删除持仓记录。
 * @param {string} symbol 股票代码
 * @returns {Promise<void>} 无返回值
 */
export function deleteHoldingRecord(symbol: string): Promise<void> {
  return deleteRecord(HOLDINGS_STORE, symbol);
}

/**
 * 读取每日复盘报告。
 * @returns {Promise<DailyReportRecord[]>} 每日复盘报告记录
 */
export async function getDailyReportRecords(): Promise<DailyReportRecord[]> {
  const records = await getAllRecords<DailyReportRecord>(DAILY_REPORTS_STORE);
  return records.sort((first, second) => second.createdAt - first.createdAt);
}

/**
 * 保存每日复盘报告。
 * @param {DailyReportRecord} record 每日复盘报告记录
 * @returns {Promise<void>} 无返回值
 */
export function saveDailyReportRecord(record: DailyReportRecord): Promise<void> {
  return putRecord(DAILY_REPORTS_STORE, record);
}

/**
 * 删除每日复盘报告。
 * @param {string} id 报告编号
 * @returns {Promise<void>} 无返回值
 */
export function deleteDailyReportRecord(id: string): Promise<void> {
  return deleteRecord(DAILY_REPORTS_STORE, id);
}
