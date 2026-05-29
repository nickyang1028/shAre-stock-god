import type { ReactNode } from 'react';

type NumberFieldProps = {
  /** 标签文本 */
  label: ReactNode;
  /** 当前数值 */
  value: number;
  /** 最小值 */
  min: number;
  /** 最大值 */
  max: number;
  /** 步进 */
  step: number;
  /** 变更回调 */
  onChange: (value: string) => void;
};

/**
 * 数字输入字段组件。
 * @param {NumberFieldProps} props 组件属性
 * @returns {JSX.Element} 数字输入字段
 */
export function NumberField(props: NumberFieldProps) {
  return (
    <label className="number-field">
      <span>{props.label}</span>
      <input
        type="number"
        value={props.value}
        min={props.min}
        max={props.max}
        step={props.step}
        onChange={(event) => props.onChange(event.target.value)}
      />
    </label>
  );
}
