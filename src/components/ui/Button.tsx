import { ButtonHTMLAttributes, forwardRef, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive' | 'destructive-outline' | 'success';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'primary', size = 'md', icon, children, disabled, ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center gap-2 font-semibold transition-colors rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)] disabled:opacity-50 disabled:cursor-not-allowed';
    
    const sizeStyles = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2.5 text-sm',
      lg: 'px-6 py-3 text-base',
    };

    const variantStyles = {
      primary: 'bg-[var(--color-earist-red)] text-white hover:bg-[var(--color-brand-dark)]',
      secondary: 'bg-white border-2 border-[var(--color-earist-maroon)] text-[var(--color-earist-maroon)] hover:bg-[var(--color-canvas)]',
      ghost: 'bg-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-earist-maroon)] hover:bg-[var(--color-brand-light)]',
      destructive: 'bg-[var(--color-earist-red)] text-white hover:bg-red-700',
      'destructive-outline': 'bg-white border-2 border-[var(--color-earist-red)] text-[var(--color-earist-red)] hover:bg-red-50',
      success: 'bg-[var(--color-success)] text-white hover:bg-green-700',
    };

    return (
      <button
        ref={ref}
        disabled={disabled}
        className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`.trim()}
        {...props}
      >
        {icon && <span className="flex-shrink-0">{icon}</span>}
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';
