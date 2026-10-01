import { Check } from 'lucide-react';

interface Step {
  id: string;
  title: string;
}

interface StepperProps {
  steps: Step[];
  currentStepIndex: number;
  className?: string;
}

export function Stepper({ steps, currentStepIndex, className = '' }: StepperProps) {
  return (
    <nav aria-label="Progress" className={className}>
      <ol role="list" className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isCompleted = index < currentStepIndex;
          const isCurrent = index === currentStepIndex;
          const isUpcoming = index > currentStepIndex;

          return (
            <li key={step.id} className="relative flex flex-col items-center group flex-1">
              {/* Connecting Line */}
              {index !== steps.length - 1 && (
                <div
                  className={`absolute top-4 left-1/2 w-full h-[2px] -z-10 ${
                    isCompleted ? 'bg-[var(--color-earist-maroon)]' : 'bg-gray-200'
                  }`}
                  aria-hidden="true"
                />
              )}

              <div
                className={`relative flex h-8 w-8 items-center justify-center rounded-full border-2 bg-white transition-colors
                  ${isCompleted ? 'border-[var(--color-earist-maroon)] bg-[var(--color-earist-maroon)]' : ''}
                  ${isCurrent ? 'border-[var(--color-earist-red)] ring-4 ring-[var(--color-brand-light)]' : ''}
                  ${isUpcoming ? 'border-gray-300' : ''}
                `}
                aria-current={isCurrent ? 'step' : undefined}
              >
                {isCompleted ? (
                  <Check className="h-5 w-5 text-white" aria-hidden="true" />
                ) : (
                  <span
                    className={`text-sm font-semibold 
                      ${isCurrent ? 'text-[var(--color-earist-red)]' : 'text-gray-400'}`}
                  >
                    {index + 1}
                  </span>
                )}
              </div>
              
              <span
                className={`mt-3 text-xs font-semibold whitespace-nowrap hidden sm:block
                  ${isCompleted ? 'text-[var(--color-earist-maroon)]' : ''}
                  ${isCurrent ? 'text-[var(--color-earist-red)]' : ''}
                  ${isUpcoming ? 'text-gray-400' : ''}
                `}
              >
                {step.title}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
