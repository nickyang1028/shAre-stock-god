# 信号规则参考

## 通用输入

```ts
type KLine = {
  symbol: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};
```

规则函数默认接收按时间升序排列的数据。信号只允许使用当前 K 线及之前的数据。

## 阳包阴

建议默认使用实体包覆：

- 前一根为阴线：`prev.close < prev.open`
- 当前为阳线：`curr.close > curr.open`
- 当前实体包住前一根实体：`curr.open <= prev.close && curr.close >= prev.open`

可选增强条件：

- 当前实体长度大于最近 N 根平均实体。
- 当前成交量大于最近 N 根均量。
- 当前处于阶段低位或均线附近。

## 阴包阳

建议默认使用实体包覆：

- 前一根为阳线：`prev.close > prev.open`
- 当前为阴线：`curr.close < curr.open`
- 当前实体包住前一根实体：`curr.open >= prev.close && curr.close <= prev.open`

## 十字星

使用阈值判断，不要写死完全相等：

- 实体比例：`abs(close - open) / (high - low) <= dojiBodyRatio`
- 默认 `dojiBodyRatio` 可从 `0.05` 到 `0.1` 起步。
- 当 `high === low` 时直接跳过，避免除零。

## 锤子线

常见规则：

- 实体较小。
- 下影线长度至少为实体的 2 倍。
- 上影线较短。
- 出现在下跌趋势后更有意义。

## 射击之星

常见规则：

- 实体较小。
- 上影线长度至少为实体的 2 倍。
- 下影线较短。
- 出现在上涨趋势后更有意义。

## 均线金叉 / 死叉

金叉：

- 前一根：`shortMA <= longMA`
- 当前：`shortMA > longMA`

死叉：

- 前一根：`shortMA >= longMA`
- 当前：`shortMA < longMA`

只比较当前两条线大小不够，必须比较前后两根的穿越关系。

## MACD 金叉 / 死叉

MACD 金叉：

- 前一根：`dif <= dea`
- 当前：`dif > dea`

MACD 死叉：

- 前一根：`dif >= dea`
- 当前：`dif < dea`

可选增强条件：

- 零轴上方金叉强于零轴下方金叉。
- 零轴下方死叉弱于零轴上方死叉。
- 柱体连续放大可提高信号强度。

## 信号输出

```ts
type Signal = {
  id: string;
  symbol: string;
  timestamp: number;
  type: string;
  name: string;
  direction: "bullish" | "bearish" | "neutral";
  strength: 1 | 2 | 3 | 4 | 5;
  description: string;
};
```

`id` 建议使用 `${symbol}-${timestamp}-${type}`。描述应解释形态事实，不应承诺后续涨跌。
