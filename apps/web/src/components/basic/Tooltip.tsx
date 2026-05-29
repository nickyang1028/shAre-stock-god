import type { ReactNode } from 'react';
import './Tooltip.scss';

type TooltipProps = {
  /** 需要展示说明的术语 */
  label: ReactNode;
  /** 说明内容 */
  content: string;
};

/**
 * 术语说明 Tooltip 组件。
 * @param {TooltipProps} props 组件属性
 * @returns {JSX.Element} 术语说明视图
 */
export function Tooltip(props: TooltipProps) {
  return (
    <span className="tooltip-term">
      <span className="tooltip-label">{props.label}</span>
      <span className="tooltip-trigger" tabIndex={0} aria-label={`${String(props.label)}说明`}>
        !
        <span className="tooltip-content" role="tooltip">
          {props.content}
        </span>
      </span>
    </span>
  );
}
