import { ReactNode, useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
  preventClose?: boolean;
}

export function Modal({ isOpen, onClose, title, children, className = '', preventClose = false }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal();
        document.body.style.overflow = 'hidden';
      }
    } else {
      if (dialog.open) {
        dialog.close();
        document.body.style.overflow = 'unset';
      }
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (preventClose) return;
    if (e.target === dialogRef.current) {
      onClose();
    }
  };

  const handleEscape = (e: React.KeyboardEvent<HTMLDialogElement>) => {
    if (preventClose) {
      e.preventDefault();
    } else {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      onKeyDown={handleEscape}
      className={`backdrop:bg-black/60 backdrop:backdrop-blur-sm bg-transparent w-full max-w-lg p-4 m-auto ${className}`.trim()}
    >
      <div className="bg-white rounded-3xl shadow-xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-6 border-b border-[var(--color-border)]">
          <h2 className="text-xl font-bold text-[var(--color-text-primary)]">{title}</h2>
          {!preventClose && (
            <button
              onClick={onClose}
              className="text-[var(--color-text-secondary)] hover:text-[var(--color-earist-maroon)] transition-colors rounded-full p-1 hover:bg-[var(--color-canvas)] focus:outline-none focus:ring-2 focus:ring-[var(--color-earist-maroon)]"
              aria-label="Close modal"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
        <div className="p-6 overflow-y-auto">
          {children}
        </div>
      </div>
    </dialog>
  );
}
