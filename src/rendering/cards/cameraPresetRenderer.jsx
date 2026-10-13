import { CameraPresetCard } from '../../components';
import { getSettings } from '../helpers';

export function renderCameraPresetCard(
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
    <CameraPresetCard
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
