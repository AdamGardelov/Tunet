import { ActionButtonCard } from '../../components';
import { getSettings } from '../helpers';

export function renderActionButtonCard(
  cardId,
  dragProps,
  getControls,
  cardStyle,
  settingsKey,
  ctx
) {
  const { entities, editMode, cardSettings, callService } = ctx;
  const settings = getSettings(cardSettings, settingsKey, cardId);
  return (
    <ActionButtonCard
      cardId={cardId}
      settings={settings}
      entities={entities}
      callService={callService}
      dragProps={dragProps}
      controls={getControls(cardId)}
      cardStyle={cardStyle}
      editMode={editMode}
    />
  );
}
