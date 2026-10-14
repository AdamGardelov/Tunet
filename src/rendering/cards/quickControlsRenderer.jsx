import { QuickControlsCard } from '../../components';
import { getSettings } from '../helpers';

export function renderQuickControlsCard(
  cardId,
  dragProps,
  getControls,
  cardStyle,
  settingsKey,
  ctx
) {
  const { entities, editMode, cardSettings, callService, t } = ctx;
  const settings = getSettings(cardSettings, settingsKey, cardId);
  return (
    <QuickControlsCard
      cardId={cardId}
      settings={settings}
      entities={entities}
      callService={callService}
      dragProps={dragProps}
      controls={getControls(cardId)}
      cardStyle={cardStyle}
      editMode={editMode}
      t={t}
    />
  );
}
