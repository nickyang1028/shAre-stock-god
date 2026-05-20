# 项目架构参考

## 推荐目录

```txt
apps/
  web/
    src/
      components/
      hooks/
      pages/
      services/
      types/
  server/
    src/
      modules/
        market-data/
        indicators/
        signals/
      routes/
      types/
      utils/
packages/
  shared/
    src/
      types/
      constants/
```

## 共享类型

优先把跨前后端使用的类型放到 `packages/shared`：

- `KLine`
- `Signal`
- `SignalType`
- `Period`
- `IndicatorName`
- API request/response DTO

## API 草案

```http
GET /api/stocks/:symbol/klines?period=1d&limit=300
GET /api/stocks/:symbol/indicators?period=1d&indicators=ma,macd,kdj
GET /api/stocks/:symbol/signals?period=1d&limit=300
```

## 前端模块建议

- `services/marketDataClient.ts`：封装后端 API 请求。
- `components/KLineChart.tsx`：渲染 K 线与信号标记。
- `components/SignalList.tsx`：展示信号列表。
- `components/SignalDetail.tsx`：展示单个信号解释。
- `hooks/useStockAnalysis.ts`：组合 K 线、指标、信号请求状态。

## 后端模块建议

- `market-data`：数据源接入、缓存、周期聚合。
- `indicators`：MA、EMA、MACD、KDJ、RSI、BOLL 等指标计算。
- `signals`：K 线组合、指标交叉、成交量形态识别。

## 验证建议

- 共享类型：运行 TypeScript 类型检查。
- 后端规则：使用固定 K 线样本做单元测试。
- 前端图表：用 mock 数据确认标记位置、颜色、tooltip 和空状态。
