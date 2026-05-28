# shAre-stock-god

一个面向股票 K 线分析的前后端项目，目标是自动识别常见技术形态与交易信号，例如阴包阳、阳包阴、均线金叉、均线死叉、MACD 金叉、MACD 死叉等，并在前端 K 线图上进行可视化标注。

## 项目目标

本项目希望提供一个可扩展的股票技术信号识别系统：

- 前端使用 `TypeScript + React` 构建交互式 K 线分析界面。
- 后端使用 `Node.js` 提供行情数据、指标计算和信号识别服务。
- 支持将识别出的技术信号展示在 K 线图、指标面板和信号列表中。
- 支持后续扩展更多策略规则，例如 K 线组合、均线系统、MACD、KDJ、RSI、成交量形态等。

## 技术栈

### 前端

- TypeScript
- React
- K 线图表组件可选方案：
  - `klinecharts`
  - `lightweight-charts`
  - `echarts`
- 状态管理可选方案：
  - React Context
  - Zustand
  - Redux Toolkit

### 后端

- Node.js
- TypeScript
- Web 框架可选方案：
  - Express
  - Fastify
  - NestJS
- 数据存储可选方案：
  - PostgreSQL
  - MySQL
  - MongoDB
  - Redis 缓存

## 核心功能规划

### 1. K 线数据管理

后端负责统一处理股票 K 线数据，基础字段建议包括：

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

支持的周期可逐步扩展：

- 日 K
- 周 K
- 月 K
- 分钟 K

### 2. 技术指标计算

后端可提供统一的指标计算模块，常见指标包括：

- MA：移动平均线
- EMA：指数移动平均线
- MACD：DIF、DEA、MACD 柱
- KDJ
- RSI
- BOLL
- VOL 均量线

### 3. 信号自动识别

信号识别模块根据 K 线数据和指标数据输出结构化信号。

```ts
type Signal = {
  id: string;
  symbol: string;
  timestamp: number;
  type: SignalType;
  name: string;
  direction: "bullish" | "bearish" | "neutral";
  strength: 1 | 2 | 3 | 4 | 5;
  description: string;
};
```

首批可支持的信号：

- 阳包阴
- 阴包阳
- 十字星
- 锤子线
- 射击之星
- 均线金叉
- 均线死叉
- MACD 金叉
- MACD 死叉
- 放量上涨
- 放量下跌

### 4. 前端可视化

前端负责展示：

- 股票 K 线图
- 均线、MACD 等技术指标
- K 线信号标记
- 信号列表
- 信号详情说明
- 股票代码和周期切换

## 推荐目录结构


```txt
shAre-stock-god/
├── README.md                         # 项目说明文档
├── package.json                      # 项目依赖与脚本配置
├── apps/
│   ├── web/                          # React 前端应用
│   │   └── src/
│   │       ├── components/           # 前端组件
│   │       │   └── basic/            # 通用组件
│   │       │   └── biz/              # 业务组件
│   │       ├── pages/                # 页面入口
│   │       ├── hooks/                # React Hooks
│   │       ├── services/             # API 请求封装
│   │       └── types/                # 前端类型定义
│   └── server/                       # Node.js 后端服务
│       └── src/
│           ├── modules/              # 后端功能模块
│           ├── routes/               # API 路由
│           ├── types/                # 后端类型定义
│           └── utils/                # 通用工具函数
└── packages/
    └── shared/                       # 前后端共享代码
        └── src/
            ├── types/                # 共享类型
            └── constants/            # 共享常量
```

## 信号识别设计思路

建议将每一种信号规则实现为独立函数，统一接收 K 线序列或指标序列，统一输出 `Signal[]`。

示例：

```ts
function detectBullishEngulfing(klines: KLine[]): Signal[] {
  // 阳包阴识别逻辑
  return [];
}

function detectBearishEngulfing(klines: KLine[]): Signal[] {
  // 阴包阳识别逻辑
  return [];
}

function detectMovingAverageCross(params: {
  klines: KLine[];
  shortPeriod: number;
  longPeriod: number;
}): Signal[] {
  // 均线金叉 / 死叉识别逻辑
  return [];
}
```

这样后续扩展新信号时，只需要新增规则函数，并注册到统一的信号扫描器中。

## API 设计草案

### 获取 K 线数据

```http
GET /api/stocks/:symbol/klines?period=1d&limit=300
```

### 获取技术指标

```http
GET /api/stocks/:symbol/indicators?period=1d&indicators=ma,macd,kdj
```

### 获取识别信号

```http
GET /api/stocks/:symbol/signals?period=1d&limit=300
```

返回示例：

```json
{
  "symbol": "600519",
  "period": "1d",
  "signals": [
    {
      "id": "600519-1714982400000-bullish-engulfing",
      "symbol": "600519",
      "timestamp": 1714982400000,
      "type": "bullish_engulfing",
      "name": "阳包阴",
      "direction": "bullish",
      "strength": 3,
      "description": "当前 K 线实体向上包住前一根阴线实体，属于偏多反转信号。"
    }
  ]
}
```

## 本地运行

项目要求使用 Node.js 22：

```bash
nvm use 22
npm install
npm run dev
```

前端默认运行在 `http://localhost:5173`，后端默认运行在 `http://localhost:3001`。

MVP 接口：

```http
GET /api/stocks/:symbol/analysis?limit=20
```

示例：

```http
GET /api/stocks/600519/analysis?limit=20
```

## 开发计划

1. 初始化 monorepo 项目结构。
2. 搭建 React 前端应用。
3. 搭建 Node.js 后端服务。
4. 定义共享类型：`KLine`、`Signal`、`Indicator`。
5. 实现基础 K 线图展示。
6. 实现阳包阴、阴包阳等 K 线组合识别。
7. 实现 MA、MACD 指标计算。
8. 实现金叉、死叉等指标交叉识别。
9. 在前端 K 线图上展示信号标记。
10. 增加回测、筛选和告警能力。

## Codex 协作模板

本仓库包含项目级 Codex 模板：

- `AGENTS.md`：项目长期协作约定。
- `.codex/config.example.toml`：Codex 配置示例。
- `.codex/skills：Codex skills

## 风险提示

技术信号只能作为行情分析辅助工具，不构成投资建议。任何自动识别出来的 K 线形态或指标信号，都应结合趋势位置、成交量、市场环境、基本面和个人风险承受能力综合判断。
