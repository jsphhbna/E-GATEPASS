import { ReactNode } from 'react';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className = '' }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center p-8 text-center bg-white rounded-3xl border border-[var(--color-border)] shadow-sm ${className}`.trim()}>
      <div className="mb-4 text-[var(--color-text-muted)]">
        {icon}
      </div>
      <h3 className="text-lg font-bold text-[var(--color-text-primary)] mb-2">{title}</h3>
      <p className="text-sm text-[var(--color-text-secondary)] mb-6 max-w-sm">
        {description}
      </p>
      {action}
    </div>
  );
}
