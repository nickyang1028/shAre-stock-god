import { useEffect, useMemo, useState } from 'react';
import type { FactorData } from '../Quant/types.js';
import { StatusNotice } from '../../components/basic/StatusNotice/index.js';
import {
  getDailyReportRecords,
  saveDailyReportRecord,
  type DailyReportRecord,
} from '../../services/localDatabase.js';
import {
  calculateHoldingValuation,
  calculateOpportunityScore,
  calculateRiskScore,
  loadOpportunityRiskConfig,
} from '../../utils/opportunityRisk.js';
import { formatMoney, formatNumber, formatPercent } from '../Quant/utils.js';
import { readHoldings, type HoldingStock } from '../Holdings/storage.js';
import { readWatchlist, type WatchlistStock } from '../Watchlist/storage.js';
import './styles.scss';

type ReportStockSource = 'holding' | 'watchlist' | 'both';

type ReportStockInput = {
  /** 股票代码 */
  symbol: string;
  /** 股票名称 */
  name: string;
  /** 股票来源 */
  source: ReportStockSource;
  /** 持仓信息 */
  holding: HoldingStock | null;
};

type ReportStockRow = ReportStockInput & {
  /** 加载到的因子数据 */
  data: FactorData | null;
  /** 错误消息 */
  error: string;
};

type ReportSummary = {
  /** 股票数量 */
  total: number;
  /** 持仓数量 */
  holdingCount: number;
  /** 自选数量 */
  watchlistCount: number;
  /** 上涨数量 */
  upCount: number;
  /** 下跌数量 */
  downCount: number;
  /** 有信号数量 */
  signalCount: number;
  /** 资金流入数量 */
  inflowCount: number;
  /** 总市值 */
  marketValue: number;
  /** 总成本 */
  costValue: number;
  /** 总盈亏 */
  profit: number;
  /** 总盈亏比例 */
  profitRate: number;
};

type QuantApiResponse = {
  /** 请求是否成功 */
  success?: boolean;
  /** 因子分析数据 */
  data?: FactorData;
  /** 错误消息 */
  message?: string;
};

/**
 * 每日复盘报告页面。
 * @returns {JSX.Element} 每日复盘报告视图
 */
export function DailyReportPage() {
  const [rows, setRows] = useState<ReportStockRow[]>([]);
  const [reportMarkdown, setReportMarkdown] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState<'info' | 'success' | 'warning' | 'error'>('info');
  const [historyReports, setHistoryReports] = useState<DailyReportRecord[]>([]);

  const summary = useMemo(() => createReportSummary(rows), [rows]);

  useEffect(() => {
    // 副作用说明：进入页面时加载最近保存的复盘报告，方便快速回看。
    void loadHistoryReports();
  }, []);

  /**
   * 生成每日复盘报告。
   * @returns {Promise<void>} 无返回值
   */
  async function handleGenerateReport(): Promise<void> {
    setLoading(true);
    setMessage('');
    setMessageTone('info');

    try {
      const holdings = await readHoldings();
      const watchlist = await readWatchlist();
      const inputs = mergeReportInputs(holdings, watchlist);

      if (inputs.length === 0) {
        setRows([]);
        setReportMarkdown('');
        setMessageTone('warning');
        setMessage('暂无持仓或自选股，请先添加股票');
        return;
      }

      const nextRows = await Promise.all(inputs.map(fetchReportRow));
      const createdAt = Date.now();
      const nextMarkdown = createReportMarkdown(nextRows, new Date(createdAt));
      const nextRecord: DailyReportRecord = {
        id: `${createdAt}`,
        title: `每日复盘-${formatDateForFile(new Date(createdAt))}`,
        content: nextMarkdown,
        createdAt,
      };
      await saveDailyReportRecord(nextRecord);
      setRows(nextRows);
      setReportMarkdown(nextMarkdown);
      await loadHistoryReports();
      setMessageTone('success');
      setMessage(`已生成 ${nextRows.length} 只股票的复盘报告`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '生成报告失败';
      setMessageTone('error');
      setMessage(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  /**
   * 下载 Markdown 报告。
   * @returns {void} 无返回值
   */
  function handleDownloadReport(): void {
    if (reportMarkdown.length === 0) {
      setMessageTone('warning');
      setMessage('请先生成报告');
      return;
    }

    downloadTextFile(reportMarkdown, `每日复盘-${formatDateForFile(new Date())}.md`, 'text/markdown;charset=utf-8');
  }

  /**
   * 下载 CSV 报告。
   * @returns {void} 无返回值
   */
  function handleDownloadCsv(): void {
    if (rows.length === 0) {
      setMessageTone('warning');
      setMessage('请先生成报告');
      return;
    }

    downloadTextFile(createReportCsv(rows), `每日复盘-${formatDateForFile(new Date())}.csv`, 'text/csv;charset=utf-8');
  }

  /**
   * 下载 HTML 报告。
   * @returns {void} 无返回值
   */
  function handleDownloadHtml(): void {
    if (reportMarkdown.length === 0) {
      setMessageTone('warning');
      setMessage('请先生成报告');
      return;
    }

    downloadTextFile(createReportHtml(reportMarkdown), `每日复盘-${formatDateForFile(new Date())}.html`, 'text/html;charset=utf-8');
  }

  /**
   * 复制 Markdown 报告。
   * @returns {Promise<void>} 无返回值
   */
  async function handleCopyReport(): Promise<void> {
    if (reportMarkdown.length === 0) {
      setMessageTone('warning');
      setMessage('请先生成报告');
      return;
    }

    await window.navigator.clipboard.writeText(reportMarkdown);
    setMessageTone('success');
    setMessage('已复制 Markdown 到剪贴板');
  }

  /**
   * 加载历史报告。
   * @returns {Promise<void>} 无返回值
   */
  async function loadHistoryReports(): Promise<void> {
    const reports = await getDailyReportRecords();
    setHistoryReports(reports.slice(0, 5));
  }

  /**
   * 载入历史报告到预览区。
   * @param {DailyReportRecord} report 历史报告
   * @returns {void} 无返回值
   */
  function handleLoadHistoryReport(report: DailyReportRecord): void {
    setReportMarkdown(report.content);
    setRows([]);
    setMessageTone('info');
    setMessage(`已载入历史报告：${report.title}`);
  }

  return (
    <main className="daily-report-page">
      <header className="daily-report-header">
        <div>
          <h1>每日复盘报告</h1>
          <p>汇总持仓和自选股，生成可保存的 Markdown 复盘记录。</p>
        </div>
        <div className="daily-report-actions">
          <button type="button" onClick={() => void handleGenerateReport()} disabled={loading}>
            {loading ? '生成中...' : '生成报告'}
          </button>
          <button
            type="button"
            className="secondary"
            onClick={handleDownloadReport}
            disabled={reportMarkdown.length === 0}
          >
            下载 Markdown
          </button>
          <button type="button" className="secondary" onClick={() => void handleCopyReport()} disabled={reportMarkdown.length === 0}>
            复制
          </button>
          <button type="button" className="secondary" onClick={handleDownloadCsv} disabled={rows.length === 0}>
            CSV
          </button>
          <button type="button" className="secondary" onClick={handleDownloadHtml} disabled={reportMarkdown.length === 0}>
            HTML
          </button>
        </div>
      </header>

      {message && (
        <section className="daily-report-message">
          <StatusNotice tone={messageTone}>{message}</StatusNotice>
        </section>
      )}

      <section className="daily-report-dashboard">
        <div className="daily-report-stat-card">
          <span>跟踪股票</span>
          <strong>{summary.total}</strong>
        </div>
        <div className="daily-report-stat-card">
          <span>持仓 / 自选</span>
          <strong>{summary.holdingCount} / {summary.watchlistCount}</strong>
        </div>
        <div className="daily-report-stat-card up">
          <span>上涨</span>
          <strong>{summary.upCount}</strong>
        </div>
        <div className="daily-report-stat-card down">
          <span>下跌</span>
          <strong>{summary.downCount}</strong>
        </div>
        <div className="daily-report-stat-card signal">
          <span>有信号</span>
          <strong>{summary.signalCount}</strong>
        </div>
        <div className="daily-report-stat-card">
          <span>持仓盈亏</span>
          <strong>{formatMoney(summary.profit)} / {formatPercent(summary.profitRate)}</strong>
        </div>
      </section>

      <section className="daily-report-card">
        <div className="daily-report-section-title">
          <h2>复盘股票</h2>
          <span>资金流入 {summary.inflowCount} 只</span>
        </div>
        <div className="daily-report-table-wrap">
          <table className="daily-report-table">
            <thead>
              <tr>
                <th>股票</th>
                <th>来源</th>
                <th>现价</th>
                <th>涨跌幅</th>
                <th>MA趋势</th>
                <th>量比</th>
                <th>资金流</th>
                <th>信号</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {rows.length > 0 ? (
                rows.map((row) => (
                  <tr key={row.symbol}>
                    <td>
                      <strong>{row.name}</strong>
                      <span>{row.symbol}</span>
                    </td>
                    <td>{formatSource(row.source)}</td>
                    <td>{row.data === null ? '-' : formatNumber(row.data.latestPrice)}</td>
                    <td className={row.data === null ? '' : getChangeClass(row.data.changePercent)}>
                      {row.data === null ? '-' : formatPercent(row.data.changePercent)}
                    </td>
                    <td>{row.data === null ? '-' : formatTrend(row.data.ma.trend)}</td>
                    <td>{row.data === null ? '-' : formatNumber(row.data.volume.volumeRatio)}</td>
                    <td>{row.data === null ? '-' : formatCapitalFlow(row.data.capitalFlow.signal)}</td>
                    <td>{formatSignals(row.data)}</td>
                    <td>{row.error || '正常'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="daily-report-empty" colSpan={9}>暂无报告数据，请点击生成报告</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="daily-report-card">
        <div className="daily-report-section-title">
          <h2>Markdown 预览</h2>
          <span>{reportMarkdown.length > 0 ? '可下载保存' : '等待生成'}</span>
        </div>
        {historyReports.length > 0 && (
          <div className="daily-report-history">
            {historyReports.map((report) => (
              <button key={report.id} type="button" onClick={() => handleLoadHistoryReport(report)}>
                {report.title}
              </button>
            ))}
          </div>
        )}
        <pre className="daily-report-preview">
          {reportMarkdown || '点击“生成报告”后，这里会展示可导出的 Markdown 内容。'}
        </pre>
      </section>
    </main>
  );
}

/**
 * 合并持仓和自选股输入。
 * @param {HoldingStock[]} holdings 持仓列表
 * @param {WatchlistStock[]} watchlist 自选股列表
 * @returns {ReportStockInput[]} 报告股票输入
 */
function mergeReportInputs(
  holdings: HoldingStock[],
  watchlist: WatchlistStock[]
): ReportStockInput[] {
  const inputMap = new Map<string, ReportStockInput>();

  holdings.forEach((holding) => {
    inputMap.set(holding.symbol, {
      symbol: holding.symbol,
      name: holding.name || holding.symbol,
      source: 'holding',
      holding,
    });
  });

  watchlist.forEach((stock) => {
    const existingInput = inputMap.get(stock.symbol);
    if (existingInput !== undefined) {
      inputMap.set(stock.symbol, {
        ...existingInput,
        source: 'both',
      });
      return;
    }

    inputMap.set(stock.symbol, {
      symbol: stock.symbol,
      name: stock.symbol,
      source: 'watchlist',
      holding: null,
    });
  });

  return Array.from(inputMap.values());
}

/**
 * 请求单只股票报告数据。
 * @param {ReportStockInput} input 报告股票输入
 * @returns {Promise<ReportStockRow>} 报告股票行
 */
async function fetchReportRow(input: ReportStockInput): Promise<ReportStockRow> {
  try {
    const response = await fetch(`/api/quant/${encodeURIComponent(input.symbol)}/analysis?limit=120`);
    const payload = (await response.json().catch(() => ({}))) as QuantApiResponse;

    if (!response.ok || !payload.success || payload.data === undefined) {
      throw new Error(payload.message ?? `请求失败 (${response.status})`);
    }

    return {
      ...input,
      name: payload.data.name || input.name,
      data: payload.data,
      error: '',
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '刷新失败';
    return {
      ...input,
      data: null,
      error: errorMessage,
    };
  }
}

/**
 * 创建报告摘要。
 * @param {ReportStockRow[]} rows 报告股票行
 * @returns {ReportSummary} 报告摘要
 */
function createReportSummary(rows: ReportStockRow[]): ReportSummary {
  const initialSummary: ReportSummary = {
    total: rows.length,
    holdingCount: 0,
    watchlistCount: 0,
    upCount: 0,
    downCount: 0,
    signalCount: 0,
    inflowCount: 0,
    marketValue: 0,
    costValue: 0,
    profit: 0,
    profitRate: 0,
  };

  const summary = rows.reduce<ReportSummary>((currentSummary, row) => {
    const latestPrice = row.data?.latestPrice ?? row.holding?.costPrice ?? 0;
    const holdingMarketValue = row.holding === null ? 0 : row.holding.shares * latestPrice;
    const holdingCostValue = row.holding === null ? 0 : row.holding.shares * row.holding.costPrice;

    return {
      total: currentSummary.total,
      holdingCount: currentSummary.holdingCount + (row.holding === null ? 0 : 1),
      watchlistCount: currentSummary.watchlistCount + (row.source === 'holding' ? 0 : 1),
      upCount: currentSummary.upCount + (row.data !== null && row.data.changePercent > 0 ? 1 : 0),
      downCount: currentSummary.downCount + (row.data !== null && row.data.changePercent < 0 ? 1 : 0),
      signalCount: currentSummary.signalCount + (hasSignals(row.data) ? 1 : 0),
      inflowCount: currentSummary.inflowCount + (row.data?.capitalFlow.signal === 'inflow' ? 1 : 0),
      marketValue: currentSummary.marketValue + holdingMarketValue,
      costValue: currentSummary.costValue + holdingCostValue,
      profit: currentSummary.profit + holdingMarketValue - holdingCostValue,
      profitRate: 0,
    };
  }, initialSummary);

  return {
    ...summary,
    profitRate: summary.costValue > 0 ? summary.profit / summary.costValue : 0,
  };
}

/**
 * 生成 Markdown 报告。
 * @param {ReportStockRow[]} rows 报告股票行
 * @param {Date} date 报告日期
 * @returns {string} Markdown 内容
 */
function createReportMarkdown(rows: ReportStockRow[], date: Date): string {
  const summary = createReportSummary(rows);
  const lines = [
    `# 每日复盘报告（${formatDate(date)}）`,
    '',
    '## 总览',
    `- 跟踪股票：${summary.total} 只`,
    `- 持仓 / 自选：${summary.holdingCount} / ${summary.watchlistCount}`,
    `- 上涨 / 下跌：${summary.upCount} / ${summary.downCount}`,
    `- 有信号：${summary.signalCount} 只`,
    `- 资金流入：${summary.inflowCount} 只`,
    `- 持仓市值：${formatMoney(summary.marketValue)}`,
    `- 持仓盈亏：${formatMoney(summary.profit)}（${formatPercent(summary.profitRate)}）`,
    '',
    '## 今日机会与风险',
    ...createOpportunityRiskLines(rows),
    '',
    '## 重点信号',
    ...createSignalLines(rows),
    '',
    '## 持仓复盘',
    ...createHoldingLines(rows),
    '',
    '## 自选观察',
    ...createWatchlistLines(rows),
    '',
    '## 明日计划',
    '- 需要重点跟踪：',
    '- 计划加仓/减仓：',
    '- 风险提醒：',
    '',
  ];

  return lines.join('\n');
}

/**
 * 创建机会与风险 Markdown 行。
 * @param {ReportStockRow[]} rows 报告股票行
 * @returns {string[]} Markdown 行
 */
function createOpportunityRiskLines(rows: ReportStockRow[]): string[] {
  const config = loadOpportunityRiskConfig();
  const scoredRows = rows.map((row) => {
    const valuation = calculateHoldingValuation(row.holding, row.data);
    const opportunity = calculateOpportunityScore(row.data, config);
    const risk = calculateRiskScore(row.holding, row.data, valuation.profitRate, config);

    return {
      row,
      opportunity,
      risk,
    };
  });
  const opportunityRows = [...scoredRows]
    .sort((first, second) => second.opportunity.score - first.opportunity.score)
    .slice(0, 5);
  const riskRows = [...scoredRows]
    .sort((first, second) => second.risk.score - first.risk.score)
    .slice(0, 5);

  return [
    '- 机会关注：',
    ...opportunityRows.map((item) =>
      `  - ${item.row.name}（${item.row.symbol}）：机会分 ${item.opportunity.score}，${formatReasons(item.opportunity.reasons)}`
    ),
    '- 风险警惕：',
    ...riskRows.map((item) =>
      `  - ${item.row.name}（${item.row.symbol}）：风险分 ${item.risk.score}，${formatReasons(item.risk.reasons)}`
    ),
  ];
}

/**
 * 生成 CSV 报告。
 * @param {ReportStockRow[]} rows 报告股票行
 * @returns {string} CSV 内容
 */
function createReportCsv(rows: ReportStockRow[]): string {
  const headers = ['股票代码', '股票名称', '来源', '现价', '涨跌幅', 'MA趋势', '量比', '资金流', '信号', '状态'];
  const lines = rows.map((row) => [
    row.symbol,
    row.name,
    formatSource(row.source),
    row.data === null ? '-' : formatNumber(row.data.latestPrice),
    row.data === null ? '-' : formatPercent(row.data.changePercent),
    row.data === null ? '-' : formatTrend(row.data.ma.trend),
    row.data === null ? '-' : formatNumber(row.data.volume.volumeRatio),
    row.data === null ? '-' : formatCapitalFlow(row.data.capitalFlow.signal),
    formatSignals(row.data),
    row.error || '正常',
  ]);

  return [headers, ...lines]
    .map((line) => line.map(escapeCsvCell).join(','))
    .join('\n');
}

/**
 * 生成 HTML 报告。
 * @param {string} markdown Markdown 内容
 * @returns {string} HTML 内容
 */
function createReportHtml(markdown: string): string {
  const body = markdown
    .split('\n')
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join('\n');

  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>每日复盘报告</title><style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.7;padding:32px;color:#0f172a;}p{margin:0 0 8px;} </style></head><body>${body}</body></html>`;
}

/**
 * 下载文本文件。
 * @param {string} content 文件内容
 * @param {string} filename 文件名
 * @param {string} type MIME 类型
 * @returns {void} 无返回值
 */
function downloadTextFile(content: string, filename: string, type: string): void {
  // 副作用说明：在浏览器中创建临时 Blob 链接并触发文件下载。
  const blob = new Blob([content], { type });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.URL.revokeObjectURL(url);
}

/**
 * 转义 CSV 单元格。
 * @param {string} value 单元格内容
 * @returns {string} 转义后的内容
 */
function escapeCsvCell(value: string): string {
  return `"${value.replace(/"/gu, '""')}"`;
}

/**
 * 转义 HTML 文本。
 * @param {string} value 原始文本
 * @returns {string} 转义后的文本
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')
    .replace(/'/gu, '&#39;');
}

/**
 * 创建重点信号 Markdown 行。
 * @param {ReportStockRow[]} rows 报告股票行
 * @returns {string[]} Markdown 行
 */
function createSignalLines(rows: ReportStockRow[]): string[] {
  const signalRows = rows.filter((row) => hasSignals(row.data));
  if (signalRows.length === 0) {
    return ['- 暂无明显信号'];
  }

  return signalRows.map((row) =>
    `- ${row.name}（${row.symbol}）：${formatSignals(row.data)}，涨跌幅 ${row.data === null ? '-' : formatPercent(row.data.changePercent)}`
  );
}

/**
 * 创建持仓 Markdown 行。
 * @param {ReportStockRow[]} rows 报告股票行
 * @returns {string[]} Markdown 行
 */
function createHoldingLines(rows: ReportStockRow[]): string[] {
  const holdingRows = rows.filter((row) => row.holding !== null);
  if (holdingRows.length === 0) {
    return ['- 暂无持仓'];
  }

  return holdingRows.map((row) => {
    const holding = row.holding;
    if (holding === null) {
      return '- 持仓数据异常';
    }

    const latestPrice = row.data?.latestPrice ?? holding.costPrice;
    const marketValue = holding.shares * latestPrice;
    const costValue = holding.shares * holding.costPrice;
    const profit = marketValue - costValue;
    const profitRate = costValue > 0 ? profit / costValue : 0;

    return `- ${row.name}（${row.symbol}）：现价 ${formatNumber(latestPrice)}，市值 ${formatMoney(marketValue)}，盈亏 ${formatMoney(profit)}（${formatPercent(profitRate)}），信号 ${formatSignals(row.data)}`;
  });
}

/**
 * 创建自选 Markdown 行。
 * @param {ReportStockRow[]} rows 报告股票行
 * @returns {string[]} Markdown 行
 */
function createWatchlistLines(rows: ReportStockRow[]): string[] {
  const watchRows = rows.filter((row) => row.source !== 'holding');
  if (watchRows.length === 0) {
    return ['- 暂无自选观察'];
  }

  return watchRows.map((row) =>
    `- ${row.name}（${row.symbol}）：涨跌幅 ${row.data === null ? '-' : formatPercent(row.data.changePercent)}，MA ${row.data === null ? '-' : formatTrend(row.data.ma.trend)}，资金 ${row.data === null ? '-' : formatCapitalFlow(row.data.capitalFlow.signal)}，信号 ${formatSignals(row.data)}`
  );
}

/**
 * 格式化评分原因。
 * @param {string[]} reasons 评分原因
 * @returns {string} 原因文本
 */
function formatReasons(reasons: string[]): string {
  return reasons.length > 0 ? reasons.join('；') : '暂无明显原因';
}

/**
 * 判断是否存在信号。
 * @param {FactorData | null} data 因子数据
 * @returns {boolean} 是否有信号
 */
function hasSignals(data: FactorData | null): boolean {
  if (data === null) {
    return false;
  }

  return (
    data.signals.maGoldenCross ||
    data.signals.maDeadCross ||
    data.signals.volumeBreakout ||
    data.signals.capitalInflowSignal
  );
}

/**
 * 格式化信号摘要。
 * @param {FactorData | null} data 因子数据
 * @returns {string} 信号摘要
 */
function formatSignals(data: FactorData | null): string {
  if (data === null) {
    return '-';
  }

  const signals = [
    data.signals.maGoldenCross ? '均线金叉' : '',
    data.signals.maDeadCross ? '均线死叉' : '',
    data.signals.volumeBreakout ? '放量' : '',
    data.signals.capitalInflowSignal ? '资金流入' : '',
  ].filter(Boolean);

  return signals.length > 0 ? signals.join(' / ') : '暂无';
}

/**
 * 格式化股票来源。
 * @param {ReportStockSource} source 股票来源
 * @returns {string} 来源文案
 */
function formatSource(source: ReportStockSource): string {
  if (source === 'both') {
    return '持仓 + 自选';
  }

  if (source === 'holding') {
    return '持仓';
  }

  return '自选';
}

/**
 * 格式化趋势文案。
 * @param {'up' | 'down' | 'sideway'} trend 趋势值
 * @returns {string} 趋势文案
 */
function formatTrend(trend: 'up' | 'down' | 'sideway'): string {
  if (trend === 'up') {
    return '上行';
  }

  if (trend === 'down') {
    return '下行';
  }

  return '震荡';
}

/**
 * 格式化资金流文案。
 * @param {'inflow' | 'outflow' | 'neutral'} signal 资金流信号
 * @returns {string} 资金流文案
 */
function formatCapitalFlow(signal: 'inflow' | 'outflow' | 'neutral'): string {
  if (signal === 'inflow') {
    return '流入';
  }

  if (signal === 'outflow') {
    return '流出';
  }

  return '中性';
}

/**
 * 获取涨跌样式类。
 * @param {number} changePercent 涨跌幅
 * @returns {string} 样式类名
 */
function getChangeClass(changePercent: number): string {
  if (changePercent > 0) {
    return 'daily-report-up';
  }

  if (changePercent < 0) {
    return 'daily-report-down';
  }

  return '';
}

/**
 * 格式化展示日期。
 * @param {Date} date 日期
 * @returns {string} 日期字符串
 */
function formatDate(date: Date): string {
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'long',
  });
}

/**
 * 格式化文件名日期。
 * @param {Date} date 日期
 * @returns {string} 文件名日期
 */
function formatDateForFile(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}
