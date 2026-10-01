export type GatePassStatus = 'issued' | 'pending' | 'inside' | 'exited' | 'expired' | 'rejected';

interface StatusBadgeProps {
  status: GatePassStatus | string;
  className?: string;
}

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  let badgeClasses = '';
  const baseClasses = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize whitespace-nowrap';

  switch (status.toLowerCase()) {
    case 'issued':
      badgeClasses = 'bg-white border border-gray-300 text-gray-700';
      break;
    case 'pending':
      badgeClasses = 'bg-[var(--color-earist-gold)] text-[var(--color-earist-ink)]';
      break;
    case 'inside':
      badgeClasses = 'bg-[var(--color-success)] text-white';
      break;
    case 'rejected':
      badgeClasses = 'bg-[var(--color-earist-red)] text-white';
      break;
    case 'exited':
      badgeClasses = 'bg-slate-200 text-slate-700';
      break;
    case 'expired':
      badgeClasses = 'bg-gray-100 text-gray-500';
      break;
    default:
      badgeClasses = 'bg-gray-100 text-gray-700';
  }

  return (
    <span className={`${baseClasses} ${badgeClasses} ${className}`.trim()}>
      {status}
    </span>
  );
}
