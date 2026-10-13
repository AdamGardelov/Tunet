import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useProfiles } from '../hooks/useProfiles';

vi.mock('../services/profileApi', () => ({
  fetchProfiles: vi.fn(),
  fetchProfile: vi.fn(),
  createProfile: vi.fn(),
  updateProfile: vi.fn(),
  deleteProfile: vi.fn(),
}));

vi.mock('../hooks/useSettingsSync', () => ({
  useSettingsSync: vi.fn(() => ({
    enabled: true,
    setEnabled: vi.fn(),
    status: 'idle',
    error: '',
    lastSyncedAt: null,
    deviceId: 'device-test',
    currentRevision: null,
    knownDevices: [],
    publishing: false,
    syncNow: vi.fn(),
    loadCurrentFromServer: vi.fn(),
    publishCurrentToDevices: vi.fn(),
    refreshKnownDevices: vi.fn(),
  })),
}));

vi.mock('../services/snapshot', () => ({
  collectSnapshot: vi.fn(),
  applySnapshot: vi.fn(),
  isValidSnapshot: vi.fn(),
}));

import { fetchProfiles, fetchProfile, createProfile, updateProfile } from '../services/profileApi';
import { collectSnapshot, applySnapshot, isValidSnapshot } from '../services/snapshot';
import { useSettingsSync } from '../hooks/useSettingsSync';

describe('useProfiles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    fetchProfiles.mockResolvedValue([]);
    fetchProfile.mockResolvedValue(null);
    collectSnapshot.mockReturnValue({ version: 1, layout: {}, appearance: {} });
    isValidSnapshot.mockReturnValue(true);
  });

  it('does not prefetch profiles when disabled', () => {
    renderHook(() =>
      useProfiles({ haUser: { id: 'user-1' }, contextSetters: {}, prefetchProfiles: false })
    );

    expect(fetchProfiles).not.toHaveBeenCalled();
    expect(useSettingsSync).toHaveBeenCalledWith({
      haUserId: 'user-1',
      contextSettersRef: expect.objectContaining({ current: {} }),
      autoBootstrap: false,
    });
  });

  it('saveProfile sends validated snapshot payload and prepends saved profile', async () => {
    const savedProfile = { id: 'p1', name: 'Home', data: { version: 1 } };
    createProfile.mockResolvedValue(savedProfile);

    const { result } = renderHook(() =>
      useProfiles({ haUser: { id: 'user-1' }, contextSetters: {} })
    );

    await waitFor(() => expect(fetchProfiles).toHaveBeenCalledWith('user-1'));

    await act(async () => {
      await result.current.saveProfile('Home', 'Tablet');
    });

    expect(collectSnapshot).toHaveBeenCalled();
    expect(isValidSnapshot).toHaveBeenCalledWith({ version: 1, layout: {}, appearance: {} });
    expect(createProfile).toHaveBeenCalledWith({
      ha_user_id: 'user-1',
      name: 'Home',
      device_label: 'Tablet',
      shared: true,
      data: { version: 1, layout: {}, appearance: {} },
    });
    expect(result.current.profiles[0]).toEqual(savedProfile);
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('saveProfile fails fast when snapshot is invalid and does not call API', async () => {
    isValidSnapshot.mockReturnValue(false);

    const { result } = renderHook(() =>
      useProfiles({ haUser: { id: 'user-1' }, contextSetters: {} })
    );

    await waitFor(() => expect(fetchProfiles).toHaveBeenCalledWith('user-1'));

    let thrownError = null;
    await act(async () => {
      try {
        await result.current.saveProfile('Home');
      } catch (error) {
        thrownError = error;
      }
    });

    expect(thrownError).toBeTruthy();
    expect(thrownError.message).toBe('Invalid snapshot data');

    expect(createProfile).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(result.current.error).toBe('Invalid snapshot data');
    });
    expect(result.current.loading).toBe(false);
  });

  it('overwriteProfile validates snapshot before API call', async () => {
    updateProfile.mockResolvedValue({ id: 'p1', name: 'Updated' });

    const { result } = renderHook(() =>
      useProfiles({ haUser: { id: 'user-1' }, contextSetters: {} })
    );

    await waitFor(() => expect(fetchProfiles).toHaveBeenCalledWith('user-1'));

    await act(async () => {
      await result.current.overwriteProfile('p1', 'Updated');
    });

    expect(isValidSnapshot).toHaveBeenCalled();
    expect(updateProfile).toHaveBeenCalledWith('p1', {
      ha_user_id: 'user-1',
      name: 'Updated',
      data: { version: 1, layout: {}, appearance: {} },
    });
  });

  it('editProfile updates metadata without sending snapshot data', async () => {
    updateProfile.mockResolvedValue({ id: 'p1', name: 'Renamed', device_label: 'Wall Tablet' });

    const { result } = renderHook(() =>
      useProfiles({ haUser: { id: 'user-1' }, contextSetters: {} })
    );

    await waitFor(() => expect(fetchProfiles).toHaveBeenCalledWith('user-1'));

    await act(async () => {
      await result.current.editProfile('p1', 'Renamed', 'Wall Tablet');
    });

    expect(updateProfile).toHaveBeenCalledWith('p1', {
      ha_user_id: 'user-1',
      name: 'Renamed',
      device_label: 'Wall Tablet',
    });
  });

  it('follows a shared profile and stores the selection locally', async () => {
    const profile = {
      id: 'mobile-profile',
      ha_user_id: 'user-1',
      name: 'Mobil',
      updated_at: '2026-10-13T08:00:00.000Z',
      data: {
        version: 1,
        layout: { pagesConfig: { pages: ['home'], header: [], home: ['light.bed'] } },
        appearance: {},
      },
    };
    fetchProfiles.mockResolvedValue([profile]);

    const { result } = renderHook(() =>
      useProfiles({
        haUser: { id: 'user-1' },
        contextSetters: {},
        prefetchProfiles: false,
      })
    );

    act(() => result.current.followProfile(profile));

    expect(applySnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ version: 1, appearance: {} }),
      {}
    );
    expect(result.current.activeProfileId).toBe('mobile-profile');
    expect(localStorage.getItem('tunet_active_profile_id')).toBe('mobile-profile');

    act(() => result.current.stopFollowingProfile());

    expect(result.current.activeProfileId).toBe('');
    expect(localStorage.getItem('tunet_active_profile_id')).toBeNull();
  });

  it('publishes dashboard edits to the followed profile', async () => {
    const initialSnapshot = { version: 1, layout: {}, appearance: {} };
    const changedSnapshot = {
      version: 1,
      layout: { pagesConfig: { pages: ['home'], header: [], home: ['camera.presets'] } },
      appearance: {},
    };
    const profile = {
      id: 'mobile-profile',
      ha_user_id: 'user-1',
      name: 'Mobil',
      updated_at: '2026-10-13T08:00:00.000Z',
      data: initialSnapshot,
    };
    localStorage.setItem('tunet_active_profile_id', profile.id);
    fetchProfiles.mockResolvedValue([profile]);
    fetchProfile.mockResolvedValue(profile);
    updateProfile.mockResolvedValue({
      ...profile,
      updated_at: '2026-10-13T08:01:00.000Z',
      data: changedSnapshot,
    });

    const { result } = renderHook(() =>
      useProfiles({ haUser: { id: 'user-1' }, contextSetters: {} })
    );

    await waitFor(() => expect(result.current.profileSyncStatus).toBe('synced'));
    collectSnapshot.mockReturnValue(changedSnapshot);

    act(() => globalThis.window.dispatchEvent(new Event('tunet:edit-done')));

    await waitFor(() =>
      expect(updateProfile).toHaveBeenCalledWith('mobile-profile', {
        ha_user_id: 'user-1',
        data: changedSnapshot,
      })
    );
  });
});
