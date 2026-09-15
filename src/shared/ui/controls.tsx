import { RotateCcw, X } from 'lucide-react';
import {
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type ReactNode,
  type Ref,
  type RefObject,
} from 'react';
export function Button({
  children,
  variant = 'secondary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  ref?: Ref<HTMLButtonElement>;
}) {
  return (
    <button className={`button button-${variant} ${className}`} {...props}>
      {children}
    </button>
  );
}
export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'purple' | 'green' | 'blue' | 'amber';
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
export function EmptyState({
  title,
  children,
  onReset,
}: {
  title: string;
  children?: ReactNode;
  onReset?: () => void;
}) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      {onReset && (
        <Button onClick={onReset}>
          <RotateCcw size={16} />
          검색·필터 초기화
        </Button>
      )}
      {children}
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
  returnFocusRef,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  returnFocusRef?: RefObject<HTMLElement | null>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current!;
    const previousFocus =
      document.activeElement instanceof HTMLElement && !dialog.contains(document.activeElement)
        ? document.activeElement
        : null;
    dialog.showModal();
    dialog.querySelector<HTMLElement>('input:not([type="hidden"]), textarea, select')?.focus();
    return () => {
      dialog.close();
      const canFocusPrevious =
        previousFocus?.isConnected &&
        previousFocus.getClientRects().length &&
        getComputedStyle(previousFocus).visibility !== 'hidden';
      const target = canFocusPrevious ? previousFocus : returnFocusRef?.current;
      if (target?.getClientRects().length) target.focus();
    };
  }, [returnFocusRef]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className={`modal ${wide ? 'modal-wide' : ''}`}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return;
        const controls = [
          ...event.currentTarget.querySelectorAll<HTMLElement>(
            'button, input, select, textarea, a[href], [tabindex]',
          ),
        ].filter(
          (element) =>
            element.tabIndex >= 0 &&
            !element.matches(':disabled') &&
            element.getClientRects().length > 0,
        );
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        if (
          e.target === e.currentTarget &&
          (e.clientX < rect.left ||
            e.clientX > rect.right ||
            e.clientY < rect.top ||
            e.clientY > rect.bottom)
        )
          onClose();
      }}
    >
      <div className="modal-header">
        <h2 id={titleId}>{title}</h2>
        <Button variant="ghost" onClick={onClose} aria-label="닫기">
          <X size={19} />
        </Button>
      </div>
      {children}
    </dialog>
  );
}
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function Progress({ value, label }: { value: number; label: string }) {
  return (
    <div
      className="progress"
      role="progressbar"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span style={{ width: '100%', transform: `scaleX(${value / 100})` }} />
    </div>
  );
}
