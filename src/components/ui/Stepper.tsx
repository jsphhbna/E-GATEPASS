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
      <ol role="list" className="flex items-center justify-between w-full">
        {steps.map((step, index) => {
          const isCompleted = index < currentStepIndex;
          const isCurrent = index === currentStepIndex;
          const isUpcoming = index > currentStepIndex;

          return (
            <li key={step.id} className="relative flex flex-col items-center group flex-1">
              {/* Connecting Line */}
              {index !== steps.length - 1 && (
                <div
                  className={`absolute top-4 sm:top-5 left-1/2 w-full h-[3px] rounded-full -z-10 transition-colors duration-200 motion-reduce:transition-none ${
                    isCompleted ? 'bg-[var(--color-earist-maroon)]' : 'bg-gray-200'
                  }`}
                  aria-hidden="true"
                />
              )}

              <div
                className={`relative flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full border-2 transition-colors duration-200 motion-reduce:transition-none
                  ${isCompleted ? 'border-[var(--color-earist-maroon)] bg-[var(--color-earist-maroon)]' : ''}
                  ${isCurrent ? 'border-[var(--color-earist-red)] bg-[var(--color-earist-red)] ring-4 ring-[var(--color-brand-light)]' : ''}
                  ${isUpcoming ? 'border-gray-300 bg-white' : ''}
                `}
                aria-current={isCurrent ? 'step' : undefined}
              >
                {isCompleted ? (
                  <>
                    <span className="sr-only">completed</span>
                    <Check className="h-4 w-4 sm:h-5 sm:w-5 text-white" strokeWidth={3} aria-hidden="true" />
                  </>
                ) : (
                  <span
                    className={`text-sm sm:text-base font-semibold 
                      ${isCurrent ? 'text-white' : 'text-gray-500'}`}
                  >
                    {index + 1}
                  </span>
                )}
              </div>
              
              <span
                className={`mt-2 sm:mt-3 text-[10px] sm:text-xs text-center px-1 sm:px-0 sm:whitespace-nowrap 
                  ${isCompleted ? 'text-[var(--color-earist-maroon)] font-semibold' : ''}
                  ${isCurrent ? 'text-[var(--color-earist-red)] font-bold' : ''}
                  ${isUpcoming ? 'text-gray-600 font-medium' : ''}
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
