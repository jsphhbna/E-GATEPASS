import { ReactNode } from 'react';

interface DataTableProps {
  children: ReactNode;
  className?: string;
}

export function DataTable({ children, className = '' }: DataTableProps) {
  return (
    <div className={`overflow-x-auto rounded-xl border border-[var(--color-border)] bg-white shadow-sm ${className}`.trim()}>
      <table className="w-full text-left text-sm">
        {children}
      </table>
    </div>
  );
}

export function DataTableHead({ children }: { children: ReactNode }) {
  return (
    <thead className="bg-[var(--color-canvas)] text-xs uppercase text-[var(--color-text-secondary)] border-b border-[var(--color-border)]">
      {children}
    </thead>
  );
}

export function DataTableRow({ children, className = '' }: { children: ReactNode, className?: string }) {
  return (
    <tr className={`border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-canvas)] transition-colors ${className}`.trim()}>
      {children}
    </tr>
  );
}

export function DataTableCell({ children, className = '', isHeader = false }: { children: ReactNode, className?: string, isHeader?: boolean }) {
  const Component = isHeader ? 'th' : 'td';
  return (
    <Component className={`px-4 py-3 ${isHeader ? 'font-bold tracking-wider' : 'text-[var(--color-text-primary)]'} ${className}`.trim()}>
      {children}
    </Component>
  );
}
