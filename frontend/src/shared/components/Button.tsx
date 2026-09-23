import { SpinnerGap } from '@phosphor-icons/react';
import { forwardRef, type ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = 'secondary',
      size = 'md',
      loading = false,
      className = '',
      children,
      disabled,
      ...props
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        className={`button button-${variant} button-${size} ${className}`.trim()}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? <SpinnerGap className="spin" size={17} aria-hidden="true" /> : null}
        {children}
      </button>
    );
  },
);
