import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { getTvRemote } from '../utils/tvRemote';
import MediaPage from '../components/pages/MediaPage';

const samsungEntities = {
  'media_player.samsung_tv': {
    entity_id: 'media_player.samsung_tv',
    state: 'on',
    attributes: { friendly_name: 'Samsung TV', device_class: 'tv', supported_features: 24381 },
  },
  'remote.samsung_tv': {
    entity_id: 'remote.samsung_tv',
    state: 'on',
    attributes: { friendly_name: 'Samsung TV' },
  },
};

describe('getTvRemote', () => {
  it('pairs a Samsung TV with its remote and Samsung key codes', () => {
    const remote = getTvRemote('media_player.samsung_tv', samsungEntities);
    expect(remote.remoteId).toBe('remote.samsung_tv');
    expect(remote.keys.ok).toBe('KEY_ENTER');
    expect(remote.keys.up).toBe('KEY_UP');
  });

  it('uses DPAD codes for other TVs', () => {
    const entities = {
      'media_player.shield': { entity_id: 'media_player.shield', state: 'on', attributes: {} },
      'remote.shield': { entity_id: 'remote.shield', state: 'on', attributes: {} },
    };
    expect(getTvRemote('media_player.shield', entities).keys.ok).toBe('DPAD_CENTER');
  });

  it('returns null without a matching remote', () => {
    expect(getTvRemote('media_player.kitchen', samsungEntities)).toBeNull();
    expect(
      getTvRemote('media_player.samsung_tv', {
        ...samsungEntities,
        'remote.samsung_tv': { ...samsungEntities['remote.samsung_tv'], state: 'unavailable' },
      })
    ).toBeNull();
  });
});

describe('MediaPage TV remote', () => {
  const renderPage = (entities) => {
    const callService = vi.fn();
    render(
      <MediaPage
        pageId="media"
        entities={entities}
        conn={null}
        pageSettings={{ media: { activeId: 'media_player.samsung_tv' } }}
        editMode={false}
        isSonosActive={() => false}
        activeMediaId={null}
        setActiveMediaId={vi.fn()}
        getA={(id, attr, fallback = null) => entities[id]?.attributes?.[attr] ?? fallback}
        getEntityImageUrl={(v) => v || null}
        callService={callService}
        savePageSetting={vi.fn()}
        formatDuration={(v) => String(v ?? 0)}
        t={(key) => key}
      />
    );
    return callService;
  };

  it('sends Samsung key codes from the D-pad', () => {
    const callService = renderPage(samsungEntities);
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(callService).toHaveBeenCalledWith('remote', 'send_command', {
      entity_id: 'remote.samsung_tv',
      command: 'KEY_ENTER',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Left' }));
    expect(callService).toHaveBeenLastCalledWith('remote', 'send_command', {
      entity_id: 'remote.samsung_tv',
      command: 'KEY_LEFT',
    });
  });

  it('hides the D-pad when the TV is off', () => {
    renderPage({
      ...samsungEntities,
      'media_player.samsung_tv': { ...samsungEntities['media_player.samsung_tv'], state: 'off' },
    });
    expect(screen.queryByTestId('tv-remote-pad')).toBeNull();
  });
});
