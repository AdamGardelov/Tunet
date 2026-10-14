import { useCallback, useEffect, useId, useRef } from 'react';
import { normalizeModalOverlayStyle } from './modalStyles';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
const PRIORITY_FOCUS_SELECTOR =
  '[data-autofocus], [autofocus], input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), select:not([disabled]), [contenteditable="true"]';

/**
 * Shared accessible modal shell with dialog semantics and focus management.
 * Keep visual styling in each modal by passing overlay/panel classes and styles.
 * @param {Object} props
 * @param {boolean} props.open
 * @param {(e?: any) => void} props.onClose
 * @param {(e?: any) => void} [props.onEscape]
 * @param {string} [props.titleId]
 * @param {string} [props.describedBy]
 * @param {string} [props.overlayClassName]
 * @param {Object} [props.overlayStyle]
 * @param {string} [props.panelClassName]
 * @param {Object} [props.panelStyle]
 * @param {Object|Function} [props.panelElementRef]
 * @param {Function} props.children
 */
export default function AccessibleModalShell({
  open,
  onClose,
  onEscape,
  titleId,
  describedBy,
  overlayClassName,
  overlayStyle,
  panelClassName,
  panelStyle,
  panelElementRef,
  children,
}) {
  const fallbackTitleId = useId().replace(/:/g, '');
  const resolvedTitleId = titleId || `modal-title-${fallbackTitleId}`;
  const panelRef = useRef(null);
  const previousActiveRef = useRef(null);
  const wasOpenRef = useRef(false);
  const onCloseRef = useRef(onClose);
  const onEscapeRef = useRef(onEscape);

  const assignPanelRef = useCallback(
    (node) => {
      panelRef.current = node;
      if (typeof panelElementRef === 'function') {
        panelElementRef(node);
      } else if (panelElementRef && typeof panelElementRef === 'object') {
        panelElementRef.current = node;
      }
    },
    [panelElementRef]
  );

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    onEscapeRef.current = onEscape;
  }, [onEscape]);

  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false;
      return undefined;
    }

    const openedNow = !wasOpenRef.current;
    wasOpenRef.current = true;
    if (openedNow) {
      previousActiveRef.current = document.activeElement;
    }

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const panel = panelRef.current;
    if (openedNow && panel) {
      const focusables = Array.from(panel.querySelectorAll(FOCUSABLE_SELECTOR));
      const priorityTarget = panel.querySelector(PRIORITY_FOCUS_SELECTOR);
      const nonCloseTarget = focusables.find((el) => !el.classList.contains('modal-close'));
      const target = priorityTarget || nonCloseTarget || focusables[0] || panel;
      if (target instanceof HTMLElement) target.focus();
    }

    const handleKeyDown = (event) => {
      if (!panelRef.current) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        (onEscapeRef.current || onCloseRef.current)?.(event);
        return;
      }
      if (event.key !== 'Tab') return;

      const focusables = panelRef.current.querySelectorAll(FOCUSABLE_SELECTOR);
      if (!focusables.length) {
        event.preventDefault();
        panelRef.current.focus();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        if (last instanceof HTMLElement) last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        if (first instanceof HTMLElement) first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prevOverflow;
      const previous = previousActiveRef.current;
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, [open]);

  if (!open) return null;

  const resolvedOverlayStyle = normalizeModalOverlayStyle(overlayStyle);

  return (
    <div className={overlayClassName} style={resolvedOverlayStyle} onClick={onClose}>
      <div
        ref={assignPanelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={resolvedTitleId}
        aria-describedby={describedBy}
        className={panelClassName}
        style={panelStyle}
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        {children(resolvedTitleId)}
      </div>
    </div>
  );
}
