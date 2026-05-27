import cors from "cors";
import express, { type Request, type Response } from "express";
import { getStockAnalysis } from "./modules/analysis/getStockAnalysis.js";
import { handleQuantAnalysis, handleBatchQuantAnalysis } from "./modules/quant/quantRoutes.js";

const app = express();
const port = Number(process.env.PORT ?? 3001);

app.use(cors());
app.use(express.json());

/**
 * 健康检查接口处理函数。
 * @param {Request} _request Express 请求对象
 * @param {Response} response Express 响应对象
 * @returns {void} 无返回值
 */
function handleHealth(_request: Request, response: Response): void {
  response.json({ ok: true });
}

/**
 * 股票分析接口处理函数。
 * @param {Request} request Express 请求对象
 * @param {Response} response Express 响应对象
 * @returns {Promise<void>} 无返回值
 */
async function handleStockAnalysis(request: Request, response: Response): Promise<void> {
  const symbolParam = request.params.symbol;
  const symbol = typeof symbolParam === "string" ? symbolParam : "";
  const limitParam = request.query.limit;
  const limit = typeof limitParam === "string" ? Number(limitParam) : 20;

  try {
    // 副作用说明：调用分析服务并将结果写回 HTTP 响应。
    const analysis = await getStockAnalysis({ symbol, limit });
    response.json(analysis);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "未知错误";
    response.status(400).json({ message });
  }
}

/**
 * 启动 HTTP 服务。
 * @returns {void} 无返回值
 */
function startServer(): void {
  app.listen(port, () => {
    console.log(`server listening on http://localhost:${port}`);
  });
}

app.get("/api/health", handleHealth);
app.get("/api/stocks/:symbol/analysis", handleStockAnalysis);

// 量化分析路由
app.get("/api/quant/:symbol/analysis", handleQuantAnalysis);
app.post("/api/quant/batch", handleBatchQuantAnalysis);

startServer();
