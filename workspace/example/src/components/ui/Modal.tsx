import React, { useCallback, useEffect, useId, useMemo, useRef } from 'react';

export type ModalProps = {
  /** Controls whether the modal is rendered and interactive. */
  isOpen: boolean;
  /** Called when the modal requests to close (Esc key / overlay click / close button). */
  onClose: () => void;
  /** Optional title displayed in the modal header; also used for aria-labelledby. */
  title?: React.ReactNode;
  /** Modal content. */
  children?: React.ReactNode;
  /** Whether pressing Escape closes the modal. Defaults to true. */
  closeOnEsc?: boolean;
  /** Whether clicking the overlay closes the modal. Defaults to true. */
  closeOnOverlayClick?: boolean;
  /** Additional className for the modal panel. */
  className?: string;
  /** Additional className for the overlay. */
  overlayClassName?: string;
  /** Additional className for the outer container. */
  containerClassName?: string;
  /** Whether to render a default close button in the header. Defaults to true. */
  showCloseButton?: boolean;
};

/**
 * Modal component with accessible dialog semantics.
 * - Provides role="dialog" and aria-modal="true"
 * - Supports closing with Escape and overlay click (both configurable)
 * - Uses Tailwind CSS classes for styling
 */
const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  closeOnEsc = true,
  closeOnOverlayClick = true,
  className,
  overlayClassName,
  containerClassName,
  showCloseButton = true,
}) => {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);

  const labelledBy = useMemo(() => {
    if (!title) return undefined;
    return titleId;
  }, [title, titleId]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (!closeOnEsc) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        handleClose();
      }
    },
    [closeOnEsc, handleClose, isOpen]
  );

  useEffect(() => {
    if (!isOpen) return;

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, onKeyDown]);

  useEffect(() => {
    if (!isOpen) return;

    const previousActive = document.activeElement as HTMLElement | null;

    const t = window.setTimeout(() => {
      panelRef.current?.focus();
    }, 0);

    return () => {
      window.clearTimeout(t);
      previousActive?.focus?.();
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  const handleOverlayMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!closeOnOverlayClick) return;

      if (e.target === e.currentTarget) {
        e.preventDefault();
        handleClose();
      }
    },
    [closeOnOverlayClick, handleClose]
  );

  if (!isOpen) return null;

  const overlayCls =
    overlayClassName ??
    'fixed inset-0 bg-black/50 backdrop-blur-[1px] transition-opacity';

  const containerCls =
    containerClassName ??
    'fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6';

  const panelCls =
    className ??
    'w-full max-w-lg rounded-lg bg-white shadow-xl ring-1 ring-black/10 focus:outline-none dark:bg-zinc-900 dark:ring-white/10';

  return (
    <div className={containerCls} onMouseDown={handleOverlayMouseDown}>
      <div className={overlayCls} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className={`relative z-10 ${panelCls}`}
      >
        {(title || showCloseButton) && (
          <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
            <div className="min-w-0">
              {title && (
                <h2 id={titleId} className="truncate text-base font-semibold text-zinc-900 dark:text-zinc-50">
                  {title}
                </h2>
              )}
            </div>
            {showCloseButton && (
              <button
                type="button"
                onClick={handleClose}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
                aria-label="Close modal"
              >
                <span aria-hidden="true" className="text-xl leading-none">
                  ×
                </span>
              </button>
            )}
          </div>
        )}

        <div className="px-5 py-4 text-sm text-zinc-700 dark:text-zinc-200">{children}</div>
      </div>
    </div>
  );
};

export default Modal;