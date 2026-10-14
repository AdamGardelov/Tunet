import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CameraModal from '../modals/CameraModal';

vi.mock('../components/camera/CameraFeed', () => ({
  default: () => <div data-testid="camera-feed" />,
}));

const renderModal = (onClose = vi.fn()) => {
  render(
    <CameraModal
      show
      onClose={onClose}
      entityId="camera.bedroom"
      entity={{ entity_id: 'camera.bedroom', attributes: { friendly_name: 'Bedroom' } }}
      settings={{}}
      t={(key) => key}
    />
  );
  return onClose;
};

describe('CameraModal fullscreen', () => {
  it('offers a fullscreen control and falls back to a viewport takeover', () => {
    renderModal();

    fireEvent.click(screen.getByRole('button', { name: 'Full screen' }));

    expect(screen.getByRole('button', { name: 'Exit full screen' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByRole('dialog')).toHaveClass('fixed', 'inset-0', 'h-[100dvh]');
  });

  it('uses Escape to leave fullscreen before closing the camera', () => {
    const onClose = renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Full screen' }));

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByRole('button', { name: 'Full screen' })).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
