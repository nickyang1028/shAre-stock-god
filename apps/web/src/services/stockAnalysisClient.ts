import type { StockAnalysisResponse } from '@share-stock-god/shared';

export type RequestState = {
  /** 是否正在请求中 */
  loading: boolean;
  /** 当前重试次数 */
  retryCount: number;
  /** 是否已取消 */
  cancelled: boolean;
  /** 中断控制器 */
  abortController: AbortController | null;
};

export type RequestCallbacks = {
  /** 请求开始回调 */
  onStart?: () => void;
  /** 请求成功回调 */
  onSuccess?: (data: StockAnalysisResponse) => void;
  /** 请求失败回调 */
  onError?: (error: Error) => void;
  /** 重试回调 */
  onRetry?: (attempt: number, maxRetries: number) => void;
  /** 请求取消回调 */
  onCancel?: () => void;
  /** 请求完成回调（无论成功失败） */
  onFinally?: () => void;
};

/** 默认重试配置 */
const DEFAULT_RETRY_CONFIG = {
  /** 最大重试次数 */
  maxRetries: 3,
  /** 重试间隔（毫秒） */
  retryDelay: 1000,
  /** 重试间隔倍增因子 */
  backoffMultiplier: 2,
};

/**
 * 创建请求状态对象
 */
export function createRequestState(): RequestState {
  return {
    loading: false,
    retryCount: 0,
    cancelled: false,
    abortController: null,
  };
}

/**
 * 取消正在进行的请求
 */
export function cancelRequest(state: RequestState): void {
  if (state.abortController) {
    state.abortController.abort();
    state.abortController = null;
  }
  state.cancelled = true;
  state.loading = false;
}

/**
 * 重置请求状态
 */
export function resetRequestState(state: RequestState): void {
  cancelRequest(state);
  state.retryCount = 0;
  state.cancelled = false;
}

/**
 * 请求后端股票分析接口，支持自动重试和取消。
 * @param {string} symbol 股票代码
 * @param {RequestState} state 请求状态对象
 * @param {RequestCallbacks} callbacks 回调函数
 * @param {Partial<typeof DEFAULT_RETRY_CONFIG>} retryConfig 重试配置
 * @returns {Promise<void>} 无返回值
 */
export async function fetchStockAnalysisWithRetry(
  symbol: string,
  state: RequestState,
  callbacks: RequestCallbacks = {},
  retryConfig: Partial<typeof DEFAULT_RETRY_CONFIG> = {}
): Promise<void> {
  const config = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
  const { onStart, onSuccess, onError, onRetry, onCancel, onFinally } =
    callbacks;

  // 如果有正在进行的请求，先取消
  if (state.loading && state.abortController) {
    cancelRequest(state);
  }

  // 重置状态
  state.cancelled = false;
  state.retryCount = 0;
  state.abortController = new AbortController();
  state.loading = true;

  onStart?.();

  const attemptRequest = async (): Promise<void> => {
    // 检查是否已取消
    if (state.cancelled) {
      onCancel?.();
      return;
    }

    try {
      const response = await fetch(
        `/api/stocks/${encodeURIComponent(symbol)}/analysis?limit=60`,
        {
          signal: state.abortController?.signal ?? null,
          headers: {
            Accept: 'application/json',
          },
        }
      );

      // 检查是否已取消
      if (state.cancelled) {
        onCancel?.();
        return;
      }

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(payload?.message ?? `请求失败 (${response.status})`);
      }

      const data = (await response.json()) as StockAnalysisResponse;
      onSuccess?.(data);
    } catch (error) {
      // 检查是否已取消
      if (
        state.cancelled ||
        (error instanceof DOMException && error.name === 'AbortError')
      ) {
        onCancel?.();
        return;
      }

      // 判断是否需要重试
      const shouldRetry =
        state.retryCount < config.maxRetries && !state.cancelled;

      if (shouldRetry) {
        state.retryCount++;
        onRetry?.(state.retryCount, config.maxRetries);

        // 计算延迟时间（指数退避）
        const delay =
          config.retryDelay *
          Math.pow(config.backoffMultiplier, state.retryCount - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));

        return attemptRequest();
      }

      // 重试次数用尽，返回错误
      const errorMessage = error instanceof Error ? error.message : '查询失败';
      onError?.(new Error(errorMessage));
    }
  };

  await attemptRequest();

  state.loading = false;
  onFinally?.();
}

/**
 * 兼容原有接口的股票分析请求函数。
 * @param {string} symbol 股票代码
 * @returns {Promise<StockAnalysisResponse>} 股票分析结果
 * @deprecated 建议使用 fetchStockAnalysisWithRetry 以获得更好的控制和重试功能
 */
export async function fetchStockAnalysis(
  symbol: string
): Promise<StockAnalysisResponse> {
  const response = await fetch(
    `/api/stocks/${encodeURIComponent(symbol)}/analysis?limit=30`
  );

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(payload?.message ?? '查询失败');
  }

  return (await response.json()) as StockAnalysisResponse;
}
