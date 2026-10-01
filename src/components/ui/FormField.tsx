import { ReactNode } from 'react';

interface FormFieldProps {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
  id?: string;
  className?: string;
}

export function FormField({ label, error, hint, children, id, className = '' }: FormFieldProps) {
  return (
    <div className={`space-y-1 ${className}`.trim()}>
      <label htmlFor={id} className="block text-sm font-semibold text-[var(--color-text-primary)]">
        {label}
      </label>
      {children}
      {hint && !error && (
        <p className="text-xs text-[var(--color-text-secondary)]">{hint}</p>
      )}
      {error && (
        <p className="text-xs font-medium text-[var(--color-danger)] flex items-center gap-1 mt-1">
          <span aria-hidden="true">⚠️</span> {error}
        </p>
      )}
    </div>
  );
}
