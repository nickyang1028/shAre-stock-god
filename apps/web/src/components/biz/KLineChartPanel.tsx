import { useEffect, useRef } from "react";
import type { KLine, Signal } from "@share-stock-god/shared";
import {
  dispose,
  init,
  registerOverlay,
  type Chart,
  type OverlayCreateFiguresCallbackParams,
  type OverlayFigure,
} from "klinecharts";

type KLineChartPanelProps = {
  /** K 线序列 */
  klines: KLine[];
  /** 需要叠加到图表上的信号列表 */
  signals: Signal[];
};

type ChartKLineData = {
  /** 时间戳 */
  timestamp: number;
  /** 开盘价 */
  open: number;
  /** 最高价 */
  high: number;
  /** 最低价 */
  low: number;
  /** 收盘价 */
  close: number;
  /** 成交量 */
  volume: number;
  /** 成交额 */
  turnover: number;
};

type SignalLabelData = {
  /** 图表标记文案 */
  label: string;
  /** 信号方向，用于控制标记颜色 */
  direction: Signal["direction"];
};

registerOverlay({
  name: "signalLabel",
  totalStep: 1,
  needDefaultPointFigure: false,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: false,
  createPointFigures: (params: OverlayCreateFiguresCallbackParams): OverlayFigure[] => {
    const coordinate = params.coordinates[0];
    if (!coordinate) {
      return [];
    }

    const data = params.overlay.extendData as SignalLabelData;
    const color = data.direction === "bullish" ? "#16794c" : "#a33131";

    return [
      {
        type: "circle",
        attrs: {
          x: coordinate.x,
          y: coordinate.y,
          r: 4,
        },
        styles: {
          color,
          borderColor: "#ffffff",
          borderSize: 1,
        },
        ignoreEvent: true,
      },
      {
        type: "text",
        attrs: {
          x: coordinate.x,
          y: coordinate.y - 12,
          text: data.label,
          align: "center",
          baseline: "bottom",
        },
        styles: {
          color,
          size: 12,
          weight: "bold",
          backgroundColor: "transparent",
        },
        ignoreEvent: true,
      },
    ];
  },
});

/**
 * 渲染 K 线图并在对应价格位置叠加技术信号标记。
 * @param {KLineChartPanelProps} props 组件属性
 * @returns {JSX.Element} K 线图容器
 */
export function KLineChartPanel(props: KLineChartPanelProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return undefined;
    }

    // 副作用说明：创建图表实例并注册内置指标，卸载时销毁实例。
    const chart = init(container);
    chartRef.current = chart;
    chart?.createIndicator("MA", true, { id: "candle_pane" });
    chart?.createIndicator("MACD", false, { height: 120 });

    return () => {
      dispose(container);
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) {
      return;
    }

    const chartData: ChartKLineData[] = props.klines.map((kline) => ({
      timestamp: kline.timestamp,
      open: kline.open,
      high: kline.high,
      low: kline.low,
      close: kline.close,
      volume: kline.volume,
      turnover: kline.amount,
    }));

    chart.applyNewData(chartData);
    // 关键逻辑：每次重绘前先清空旧信号，避免叠加重复标记。
    chart.removeOverlay({ groupId: "signals" });

    props.signals.forEach((signal) => {
      chart.createOverlay({
        name: "signalLabel",
        groupId: "signals",
        lock: true,
        points: [{ timestamp: signal.timestamp, value: signal.price }],
        extendData: {
          label: signal.name,
          direction: signal.direction,
        },
      });
    });
  }, [props.klines, props.signals]);

  return <div ref={containerRef} className="chartSurface" />;
}
