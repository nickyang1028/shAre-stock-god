import { useEffect, useRef, useState, useCallback } from "react";
import type { KLine, Signal } from "@share-stock-god/shared";
import { dispose, init, registerOverlay, type Chart, type OverlayCreateFiguresCallbackParams, type OverlayFigure, type Crosshair } from "klinecharts";

type KLineChartPanelProps = {
  klines: KLine[];
  signals: Signal[];
  stockName?: string;
  stockSymbol?: string;
  dataSource?: string;
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

type SignalGroup = {
  timestamp: number;
  signals: Signal[];
  kline: KLine | null;
};

function groupSignalsByTimestamp(signals: Signal[], klines: KLine[]): SignalGroup[] {
  const klineMap = new Map(klines.map(k => [k.timestamp, k]));
  const groups = new Map<number, Signal[]>();

  signals.forEach(signal => {
    const existing = groups.get(signal.timestamp) || [];
    existing.push(signal);
    groups.set(signal.timestamp, existing);
  });

  return Array.from(groups.entries())
    .map(([timestamp, signals]) => ({
      timestamp,
      signals,
      kline: klineMap.get(timestamp) || null,
    }))
    .sort((a, b) => a.timestamp - b.timestamp);
}

function formatChangePercent(open: number, close: number): string {
  if (open === 0) return "0.00%";
  const change = ((close - open) / open) * 100;
  const sign = change >= 0 ? "+" : "";
  return `${sign}${change.toFixed(2)}%`;
}

function getChangeColor(change: number): string {
  if (change > 0) return "#ef5350";
  if (change < 0) return "#26a69a";
  return "#888888";
}

// 注册信号点标记overlay - 只显示圆点
registerOverlay({
  name: "signalDot",
  totalStep: 1,
  needDefaultPointFigure: false,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: false,
  createPointFigures: (params: OverlayCreateFiguresCallbackParams): OverlayFigure[] => {
    const coordinate = params.coordinates[0];
    if (!coordinate) return [];

    const data = params.overlay.extendData as { direction: Signal["direction"]; label: string };
    const color = data.direction === "bullish" ? "#16794c" : "#a33131";

    return [
      {
        type: "circle",
        attrs: { x: coordinate.x, y: coordinate.y, r: 5 },
        styles: { color, borderColor: "#ffffff", borderSize: 2 },
        ignoreEvent: true,
      },
    ];
  },
});

// 注册信号文字overlay
registerOverlay({
  name: "signalTooltip",
  totalStep: 1,
  needDefaultPointFigure: false,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: false,
  createPointFigures: (params: OverlayCreateFiguresCallbackParams): OverlayFigure[] => {
    const coordinate = params.coordinates[0];
    if (!coordinate) return [];

    const data = params.overlay.extendData as { label: string; direction: Signal["direction"]; visible: boolean };
    if (!data.visible) return [];

    const labelWidth = data.label.length * 12 + 16;

    return [
      {
        type: "rect",
        attrs: {
          x: coordinate.x - labelWidth / 2,
          y: coordinate.y - 30,
          width: labelWidth,
          height: 20,
        },
        styles: { color: "rgba(0, 0, 0, 0.8)", borderRadius: 4 },
        ignoreEvent: true,
      },
      {
        type: "text",
        attrs: {
          x: coordinate.x,
          y: coordinate.y - 20,
          text: data.label,
          align: "center",
          baseline: "middle",
        },
        styles: { color: "#ffffff", size: 12 },
        ignoreEvent: true,
      },
    ];
  },
});

export function KLineChartPanel(props: KLineChartPanelProps) {
  const { klines, signals, stockName, stockSymbol, dataSource } = props;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<Chart | null>(null);

  // 当前显示的数据索引（crosshair位置）
  const [currentIndex, setCurrentIndex] = useState<number>(klines.length - 1);

  // 当前显示的K线数据
  const currentKline = klines[currentIndex] || klines[klines.length - 1];

  // 计算涨跌幅
  const change = currentKline ? ((currentKline.close - currentKline.open) / currentKline.open) : 0;

  // 记录当前 crosshair 所在的时间戳
  const [hoveredTimestamp, setHoveredTimestamp] = useState<number | null>(null);

  // 使用 useCallback 缓存回调函数
  const handleCrosshairMove = useCallback((crosshair: Crosshair | null) => {
    if (crosshair && crosshair.kLineData) {
      const timestamp = crosshair.kLineData.timestamp;
      const index = klines.findIndex(k => k.timestamp === timestamp);
      if (index !== -1) {
        setCurrentIndex(index);
      }
      setHoveredTimestamp(timestamp);
    } else {
      setHoveredTimestamp(null);
    }
  }, [klines]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const chart = init(container, { locale: 'zh-CN' });
    chartRef.current = chart;
    chart?.createIndicator("MA", true, { id: "candle_pane" });
    chart?.createIndicator("MACD", false, { height: 120 });

    // 订阅 crosshair 移动事件
    // 使用类型断言绕过类型检查，因为 klinecharts 的 ActionType 可能没有包含所有事件类型
    (chart as any).subscribeAction('onCrosshairChange', (crosshair: Crosshair) => {
      handleCrosshairMove(crosshair);
    });

    return () => {
      dispose(container);
      chartRef.current = null;
    };
  }, [handleCrosshairMove]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const chartData: ChartKLineData[] = klines.map((kline) => ({
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
    chart.removeOverlay({ groupId: "signalTooltips" });

    const signalGroups = groupSignalsByTimestamp(signals, klines);

    signalGroups.forEach((group) => {
      const isHovered = hoveredTimestamp === group.timestamp;

      group.signals.forEach((signal) => {
        // 圆点显示在K线最高价位置（虚线顶部）
        const dotPrice = group.kline?.high || signal.price;

        // 显示圆点标记
        chart.createOverlay({
          name: "signalDot",
          groupId: "signals",
          lock: true,
          points: [{ timestamp: signal.timestamp, value: dotPrice }],
          extendData: {
            direction: signal.direction,
            label: signal.name,
          },
        });

        // 只有在悬浮时才显示文字tooltip
        if (isHovered) {
          chart.createOverlay({
            name: "signalTooltip",
            groupId: "signalTooltips",
            lock: true,
            points: [{ timestamp: signal.timestamp, value: dotPrice }],
            extendData: {
              label: signal.name,
              direction: signal.direction,
              visible: true,
            },
          });
        }
      });
    });
  }, [klines, signals, hoveredTimestamp]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* 股票信息栏 - 显示在图表上方 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        padding: '8px 16px',
        borderRadius: '8px',
      }}>
        <span style={{ fontWeight: 'bold', fontSize: '16px', color: '#333' }}>
          {stockName || '股票'} {stockSymbol}
        </span>
        {currentKline && (
          <>
            <span style={{ fontSize: '14px', color: '#666' }}>
              收: {currentKline.close.toFixed(2)}
            </span>
            <span style={{
              fontSize: '14px',
              fontWeight: 'bold',
              color: getChangeColor(change)
            }}>
              {change >= 0 ? '+' : ''}{(change * 100).toFixed(2)}%
            </span>
          </>
        )}
      </div>

      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
