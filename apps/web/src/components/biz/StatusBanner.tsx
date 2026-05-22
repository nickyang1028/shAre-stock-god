import './StatusBanner.scss';

type StatusBannerProps = {
  /** 重试信息 */
  retryInfo?: { current: number; max: number } | null;
  /** 错误信息 */
  errorMessage?: string | null;
  /** 是否显示 loading */
  showLoading?: boolean;
  /** 取消按钮点击回调 */
  onCancel?: () => void;
};

/**
 * 状态横幅组件，用于显示重试信息、错误信息和操作按钮。
 * @param {StatusBannerProps} props 组件属性
 * @returns {JSX.Element | null} 状态横幅视图
 */
export function StatusBanner(props: StatusBannerProps) {
  const {
    retryInfo,
    errorMessage,
    showLoading: loading = false,
    onCancel,
  } = props;

  // 没有内容时不渲染
  if (!retryInfo && !errorMessage) {
    return null;
  }

  // 确定状态类型
  const statusType = retryInfo ? 'retrying' : 'error';

  return (
    <div className={`status-banner ${statusType}`}>
      {loading && <span className="loading-icon" aria-hidden="true" />}

      <span className="status-text">
        {loading && retryInfo && (
          <>
            请求失败，正在重试 ({retryInfo.current}/{retryInfo.max})...
          </>
        )}
        {errorMessage && !loading && <>{errorMessage}</>}
      </span>

      {loading && onCancel && (
        <button
          type="button"
          className="cancel-button"
          onClick={onCancel}
          aria-label="取消请求"
        >
          取消
        </button>
      )}
    </div>
  );
}
