import M3Slider from './M3Slider';
import {
  BRIGHTNESS_MAX_POSITION,
  brightnessPctToPosition,
  positionToBrightnessPct,
} from '../../utils/lightSteps';

/**
 * Brightness slider over the allowed steps (1, 5, 10, 20 … 100 %). The steps
 * are evenly spaced on the track, so the fine steps below 10 % are as easy to
 * hit as the rest. Values in and out are percentages.
 */
export default function BrightnessSlider({
  value,
  onChange = undefined,
  onCommit = undefined,
  ...props
}) {
  return (
    <M3Slider
      {...props}
      min={0}
      max={BRIGHTNESS_MAX_POSITION}
      step={1}
      showSteps
      value={brightnessPctToPosition(value)}
      onChange={
        onChange &&
        ((e) => onChange({ target: { value: String(positionToBrightnessPct(e.target.value)) } }))
      }
      onCommit={onCommit && ((position) => onCommit(positionToBrightnessPct(position)))}
    />
  );
}
