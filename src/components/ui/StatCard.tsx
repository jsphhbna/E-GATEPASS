import { ReactNode } from 'react';
import { Card } from './Card';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  trend?: string;
  trendUp?: boolean;
}

export function StatCard({ title, value, icon, trend, trendUp }: StatCardProps) {
  return (
    <Card className="flex items-center p-6 sm:p-6">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-canvas)] text-[var(--color-earist-maroon)] mr-4">
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium text-[var(--color-text-secondary)]">{title}</p>
        <p className="text-2xl font-bold text-[var(--color-text-primary)]">{value}</p>
        {trend && (
          <p className={`text-xs mt-1 ${trendUp ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
            {trend}
          </p>
        )}
      </div>
    </Card>
  );
}
