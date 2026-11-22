import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Undo2 } from '../../icons';

const KEY_CLASS =
  'flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--text-secondary)] transition-all hover:bg-[var(--glass-bg-hover)] hover:text-[var(--text-primary)] active:scale-90';

/**
 * Compact TV remote: arrow keys around an OK button, plus Back. Sends the
 * given key codes through remote.send_command.
 */
export default function TvRemotePad({ remoteId, keys, callService, t }) {
  const send = (key) => {
    const command = keys?.[key];
    if (!command) return;
    callService('remote', 'send_command', { entity_id: remoteId, command });
  };

  const label = (key, fallback) => {
    const text = t?.(key);
    return text && text !== key ? text : fallback;
  };

  return (
    <div
      data-testid="tv-remote-pad"
      className="flex flex-col items-center gap-3 border-t border-[var(--glass-border)] pt-4"
    >
      <div className="grid grid-cols-3 grid-rows-3 gap-2">
        <span />
        <button
          type="button"
          onClick={() => send('up')}
          className={KEY_CLASS}
          aria-label={label('media.remote.up', 'Up')}
        >
          <ChevronUp className="h-5 w-5" />
        </button>
        <span />
        <button
          type="button"
          onClick={() => send('left')}
          className={KEY_CLASS}
          aria-label={label('media.remote.left', 'Left')}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => send('ok')}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--text-primary)] text-xs font-bold text-[var(--bg-primary)] shadow-lg transition-all active:scale-90"
          aria-label={label('media.remote.ok', 'OK')}
        >
          OK
        </button>
        <button
          type="button"
          onClick={() => send('right')}
          className={KEY_CLASS}
          aria-label={label('media.remote.right', 'Right')}
        >
          <ChevronRight className="h-5 w-5" />
        </button>
        <span />
        <button
          type="button"
          onClick={() => send('down')}
          className={KEY_CLASS}
          aria-label={label('media.remote.down', 'Down')}
        >
          <ChevronDown className="h-5 w-5" />
        </button>
        <span />
      </div>
      <button
        type="button"
        onClick={() => send('back')}
        className="flex min-h-11 items-center gap-2 rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-5 text-sm font-semibold text-[var(--text-secondary)] transition-all hover:bg-[var(--glass-bg-hover)] hover:text-[var(--text-primary)] active:scale-95"
      >
        <Undo2 className="h-4 w-4" aria-hidden="true" />
        {label('shield.back', 'Back')}
      </button>
    </div>
  );
}
