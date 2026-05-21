import cors from "cors";
import express, { type Request, type Response } from "express";
import { getStockAnalysis } from "./modules/analysis/getStockAnalysis.js";

const app = express();
const port = Number(process.env.PORT ?? 3001);

app.use(cors());
app.use(express.json());

app.get("/api/health", (_request: Request, response: Response) => {
  response.json({ ok: true });
});

app.get("/api/stocks/:symbol/analysis", async (request: Request, response: Response) => {
  const symbolParam = request.params.symbol;
  const symbol = typeof symbolParam === "string" ? symbolParam : "";
  const limitParam = request.query.limit;
  const limit = typeof limitParam === "string" ? Number(limitParam) : 20;

  try {
    const analysis = await getStockAnalysis({ symbol, limit });
    response.json(analysis);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "未知错误";
    response.status(400).json({ message });
  }
});

app.listen(port, () => {
  console.log(`server listening on http://localhost:${port}`);
});
