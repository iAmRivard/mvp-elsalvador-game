import {
  useId,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react';

export interface IconButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'onClick' | 'title'
> {
  label: string;
  icon: ReactNode;
  active?: boolean;
  onClick: () => void;
}

export function IconButton({
  label,
  icon,
  active = false,
  onClick,
  className = '',
  onKeyDown,
  ...buttonProps
}: IconButtonProps) {
  const tooltipId = useId();
  const [tooltipVisible, setTooltipVisible] = useState(false);

  return (
    <button
      {...buttonProps}
      className={`icon-button ${active ? 'icon-button--active' : ''} ${className}`.trim()}
      type="button"
      aria-label={label}
      aria-describedby={tooltipId}
      title={label}
      onClick={onClick}
      onMouseEnter={() => setTooltipVisible(true)}
      onMouseLeave={() => setTooltipVisible(false)}
      onFocus={() => setTooltipVisible(true)}
      onBlur={() => setTooltipVisible(false)}
      onKeyDown={(event) => {
        if (event.key === 'Escape') setTooltipVisible(false);
        onKeyDown?.(event);
      }}
    >
      <span className="icon-button__icon" aria-hidden="true">
        {icon}
      </span>
      <span
        id={tooltipId}
        className="icon-button__tooltip"
        role="tooltip"
        aria-hidden={!tooltipVisible}
        data-visible={tooltipVisible}
      >
        {label}
      </span>
    </button>
  );
}
