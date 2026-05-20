# 行情数据契约

## 内部 K 线格式

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

## 字段规则

- `symbol`：内部统一格式，建议使用 `600519.SH`、`000001.SZ`。
- `timestamp`：毫秒级 Unix 时间戳。
- `open/high/low/close`：统一价格口径，不能混用不复权、前复权、后复权。
- `volume`：保留单位说明，常见单位可能是股、手或成交额。

## 数据清洗

1. 转换外部字段名到内部 DTO。
2. 过滤缺失关键价格的数据。
3. 按 `timestamp` 升序排序。
4. 按 `symbol + period + timestamp` 去重。
5. 对 `high < low`、价格为负数等异常数据报错或丢弃。
6. 对停牌、零成交量、非交易日数据做显式标记或过滤。

## 周期聚合

从分钟 K 聚合到日 K 时：

- `open` 取第一根。
- `close` 取最后一根。
- `high` 取最高值。
- `low` 取最低值。
- `volume` 求和。
- `timestamp` 使用聚合周期对应的统一时间。

## 缓存键

缓存键建议包含：

```txt
market-data:{source}:{symbol}:{period}:{adjustment}:{start}:{end}
```

其中 `adjustment` 表示不复权、前复权或后复权。
