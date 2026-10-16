import { memo, useEffect, useState } from 'react';
import { Check, Plane, X } from '../../icons';
import useActionFeedback from '../../hooks/useActionFeedback';
import ActionFeedbackIndicator from './ActionFeedbackIndicator';

const CONFIRM_TIMEOUT_MS = 5000;

/**
 * @typedef {object} AwayModeProps
 * @property {string} [entityId]
 * @property {any} [entity]
 * @property {(domain: string, service: string, data?: object) => any} [callService]
 * @property {(key: string) => string} t
 */
const useAwayToggle = (entityId, entity, callService) => {
  const { getStatus, runAction } = useActionFeedback();
  const domain = entityId ? entityId.split('.')[0] : null;
  const isOn = entity?.state === 'on';
  const unavailable = !entity || entity.state === 'unavailable' || entity.state === 'unknown';
  const setAway = (next) => {
    if (!entityId || unavailable || typeof callService !== 'function') return;
    runAction('away', () =>
      callService(domain, next ? 'turn_on' : 'turn_off', { entity_id: entityId })
    );
  };
  return { isOn, unavailable, status: getStatus('away'), setAway };
};

/**
 * Header chip for away mode. Turning it on asks for a quick confirmation,
 * since it pauses automations across the house; turning it off is one tap.
 */
/** @param {AwayModeProps} props */
function AwayModeChipView({ entityId, entity, callService, t }) {
  const { isOn, unavailable, status, setAway } = useAwayToggle(entityId, entity, callService);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!confirming) return undefined;
    const timer = setTimeout(() => setConfirming(false), CONFIRM_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [confirming]);

  useEffect(() => {
    if (isOn) setConfirming(false);
  }, [isOn]);

  if (!entityId) return null;

  if (confirming) {
    return (
      <div
        className="flex items-center gap-1 rounded-full border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] p-1 pl-3"
        role="group"
        aria-label={t('away.confirmTitle')}
        data-testid="away-mode-confirm"
      >
        <span className="text-xs font-semibold text-[var(--status-warning-fg)]">
          {t('away.confirmTitle')}
        </span>
        <button
          type="button"
          onClick={() => {
            setConfirming(false);
            setAway(true);
          }}
          className="flex h-9 items-center gap-1 rounded-full bg-[var(--status-warning-fg)] px-3 text-xs font-semibold text-[var(--bg-primary)] active:scale-95"
        >
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
          {t('away.turnOn')}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          aria-label={t('common.cancel')}
          className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--text-secondary)] hover:bg-[var(--glass-bg-hover)]"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => (isOn ? setAway(false) : setConfirming(true))}
      disabled={unavailable || status === 'pending'}
      aria-pressed={isOn}
      aria-label={isOn ? t('away.turnOffLabel') : t('away.turnOnLabel')}
      data-testid="away-mode-chip"
      className={`flex min-h-11 items-center gap-2 rounded-full border px-3.5 text-sm font-semibold transition-all active:scale-95 disabled:opacity-50 ${
        isOn
          ? 'border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-fg)]'
          : 'border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--text-secondary)] hover:bg-[var(--glass-bg-hover)] hover:text-[var(--text-primary)]'
      }`}
    >
      {status === 'idle' ? (
        <Plane className="h-4 w-4" aria-hidden="true" />
      ) : (
        <ActionFeedbackIndicator status={status} className="h-4 w-4" />
      )}
      <span>{t('away.label')}</span>
      {isOn && <span className="sr-only">{t('common.on')}</span>}
    </button>
  );
}

export const AwayModeChip = memo(AwayModeChipView);

/** Full-width reminder shown on every page while away mode is on. */
/** @param {AwayModeProps} props */
function AwayModeBannerView({ entityId, entity, callService, t }) {
  const { isOn, status, setAway } = useAwayToggle(entityId, entity, callService);
  if (!entityId || !isOn) return null;

  return (
    <div
      role="status"
      data-testid="away-mode-banner"
      className="mb-4 flex items-center gap-3 rounded-2xl border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-4 py-3"
    >
      <Plane className="h-5 w-5 shrink-0 text-[var(--status-warning-fg)]" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[var(--text-primary)]">{t('away.bannerTitle')}</p>
        <p className="text-xs text-[var(--text-secondary)]">{t('away.bannerSubtitle')}</p>
      </div>
      <button
        type="button"
        onClick={() => setAway(false)}
        disabled={status === 'pending'}
        className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border border-[var(--status-warning-border)] px-3 text-sm font-semibold text-[var(--status-warning-fg)] hover:bg-[var(--glass-bg-hover)] active:scale-95 disabled:opacity-50"
      >
        {status !== 'idle' && <ActionFeedbackIndicator status={status} className="h-4 w-4" />}
        {t('away.turnOff')}
      </button>
    </div>
  );
}

export const AwayModeBanner = memo(AwayModeBannerView);
