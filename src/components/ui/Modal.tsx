import { ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, AlertTriangle } from 'lucide-react';
import { Button } from './Button';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
  preventClose?: boolean;
  size?: 'sm' | 'md' | 'lg';
  hideTitleRow?: boolean;
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
};

export function Modal({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  className = '', 
  preventClose = false,
  size = 'md',
  hideTitleRow = false,
  description
}: ModalProps) {
  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !preventClose && !open && onClose()}>
      <Dialog.Portal>
        {/* Backdrop */}
        <Dialog.Overlay 
          className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-[6px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-150" 
          style={{ 
            // Optional tint
            backgroundColor: 'rgba(26, 0, 0, 0.6)' 
          }}
        />
        {/* Content wrapper for centering */}
        <div className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto p-4 sm:p-6" style={{ height: '100dvh' }}>
          <Dialog.Content 
            className={`relative flex w-full max-h-[90dvh] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:duration-120 data-[state=open]:duration-180 ${sizeClasses[size]} ${className}`}
            onPointerDownOutside={(e) => {
              if (preventClose) e.preventDefault();
            }}
            onEscapeKeyDown={(e) => {
              if (preventClose) e.preventDefault();
            }}
          >
            {/* Title Row */}
            {!hideTitleRow && (
              <div className="flex shrink-0 items-center justify-between border-b border-[var(--color-border)] p-4 sm:p-6">
                <Dialog.Title className="text-xl font-bold text-[var(--color-text-primary)]">
                  {title}
                </Dialog.Title>
                {description && (
                  <Dialog.Description className="sr-only">
                    {description}
                  </Dialog.Description>
                )}
                {!preventClose && (
                  <Dialog.Close asChild>
                    <button
                      className="rounded-full p-2 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-canvas)] hover:text-[var(--color-earist-maroon)] focus:outline-none focus:ring-2 focus:ring-[var(--color-earist-maroon)]"
                      aria-label="Close modal"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </Dialog.Close>
                )}
              </div>
            )}
            
            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
              {children}
            </div>
            
            {/* Hidden description for accessibility if no visible description exists */}
            <Dialog.Description className="sr-only">
              Dialog content
            </Dialog.Description>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description: ReactNode;
  onConfirm: () => void | Promise<void>;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  loading?: boolean;
}

export function ConfirmModal({
  isOpen,
  onClose,
  title,
  description,
  onConfirm,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDestructive = false,
  loading = false,
}: ConfirmModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm" hideTitleRow preventClose={loading}>
      <div className="flex flex-col items-center text-center pt-2">
        <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-full ${isDestructive ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'}`}>
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h2 className="mb-2 text-xl font-bold text-[var(--color-text-primary)]">{title}</h2>
        <div className="mb-6 text-sm text-[var(--color-text-secondary)]">{description}</div>
        
        <div className="flex w-full flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={loading}
            className="w-full sm:w-auto"
            autoFocus
          >
            {cancelText}
          </Button>
          <Button
            type="button"
            variant={isDestructive ? 'destructive' : 'primary'}
            onClick={onConfirm}
            loading={loading}
            className="w-full sm:w-auto"
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
