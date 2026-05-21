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
  klines: KLine[];
  signals: Signal[];
};

type ChartKLineData = {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  turnover: number;
};

type SignalLabelData = {
  label: string;
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

export function KLineChartPanel(props: KLineChartPanelProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return undefined;
    }

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
