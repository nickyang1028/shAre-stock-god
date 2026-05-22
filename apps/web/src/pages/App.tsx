import { FormEvent, useEffect, useState } from "react";
import type { StockAnalysisResponse } from "@share-stock-god/shared";
import { KLineChartPanel } from "../components/biz/KLineChartPanel.js";
import { SignalList } from "../components/biz/SignalList.js";
import { fetchStockAnalysis } from "../services/stockAnalysisClient.js";

const DEFAULT_SYMBOL = "600519";

// 格式化涨跌幅
function formatChangePercent(open: number, close: number): string {
  if (open === 0) return "0.00%";
  const change = ((close - open) / open) * 100;
  const sign = change >= 0 ? "+" : "";
  return `${sign}${change.toFixed(2)}%`;
}

// 获取涨跌幅颜色
function getChangeColor(change: number): string {
  if (change > 0) return "#ef5350";
  if (change < 0) return "#26a69a";
  return "#888888";
}

/**
 * 应用主页面，负责股票查询、结果展示与错误提示。
 * @returns {JSX.Element} 页面主视图
 */
export function App() {
  const [symbol, setSymbol] = useState(DEFAULT_SYMBOL);
  const [analysis, setAnalysis] = useState<StockAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  /**
   * 加载指定股票的分析结果并更新页面状态。
   * @param {string} nextSymbol 待查询的股票代码
   * @returns {Promise<void>} 无返回值
   */
  async function loadAnalysis(nextSymbol: string) {
    // 副作用说明：发起网络请求并更新 loading / error / analysis 三类状态。
    setLoading(true);
    setErrorMessage("");

    try {
      const result = await fetchStockAnalysis(nextSymbol);
      setAnalysis(result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "查询失败";
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  }

  /**
   * 处理股票查询表单提交。
   * @param {FormEvent<HTMLFormElement>} event 表单提交事件
   * @returns {void} 无返回值
   */
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadAnalysis(symbol);
  }

  return (
    <main className="appShell">
      <section className="toolbar">
        <div>
          <h1>A 股 K 线信号识别</h1>
          <p>查询近 20 个交易日日 K，并标记阳包阴、阴包阳、均线交叉和 MACD 交叉。</p>
        </div>
        <form className="searchForm" onSubmit={handleSubmit}>
          <input
            aria-label="股票代码"
            inputMode="numeric"
            maxLength={9}
            onChange={(event) => setSymbol(event.target.value)}
            placeholder="例如 600519"
            value={symbol}
          />
          <button disabled={loading} type="submit">
            {loading ? "查询中" : "查询"}
          </button>
        </form>
      </section>

      {errorMessage ? <div className="errorBanner">{errorMessage}</div> : null}

      <section className="contentGrid">
        <div className="chartPanel">
          {analysis ? (
            <KLineChartPanel
              klines={analysis.klines}
              signals={analysis.signals}
              stockName={analysis.name}
              stockSymbol={analysis.symbol}
              dataSource={analysis.source}
            />
          ) : (
            <div className="panelHeader">
              <div>
                <h2>K 线图</h2>
                <p>等待查询结果</p>
              </div>
            </div>
          )}
        </div>

        <aside className="sidePanel">
          <div className="panelHeader">
            <div>
              <h2>信号列表</h2>
              <p>技术信号仅作为形态提示</p>
            </div>
            <span>{analysis?.signals.length ?? 0}</span>
          </div>
          <SignalList signals={analysis?.signals ?? []} />
        </aside>
      </section>
    </main>
  );
}
