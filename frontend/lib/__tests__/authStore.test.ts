import { useAuthStore } from '../authStore';

const sampleUser = { id: 'user_1', email: 'ada@example.com', name: 'Ada', avatar: null };

// jsdom (the test environment) provides a real, working localStorage, so
// these tests exercise the actual persistence behavior rather than mocking
// it away.
beforeEach(() => {
  localStorage.clear();
  useAuthStore.setState({ user: null, token: null, isHydrated: false });
});

describe('setAuth', () => {
  it('updates store state and persists to localStorage', () => {
    useAuthStore.getState().setAuth(sampleUser, 'a-token');

    expect(useAuthStore.getState().user).toEqual(sampleUser);
    expect(useAuthStore.getState().token).toBe('a-token');
    expect(localStorage.getItem('lumina_token')).toBe('a-token');
    expect(JSON.parse(localStorage.getItem('lumina_user')!)).toEqual(sampleUser);
  });
});

describe('logout', () => {
  it('clears store state and removes persisted auth', () => {
    useAuthStore.getState().setAuth(sampleUser, 'a-token');

    useAuthStore.getState().logout();

    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().token).toBeNull();
    expect(localStorage.getItem('lumina_token')).toBeNull();
    expect(localStorage.getItem('lumina_user')).toBeNull();
  });
});

describe('hydrate', () => {
  it('restores user and token from localStorage and marks hydrated', () => {
    localStorage.setItem('lumina_token', 'persisted-token');
    localStorage.setItem('lumina_user', JSON.stringify(sampleUser));

    useAuthStore.getState().hydrate();

    expect(useAuthStore.getState().token).toBe('persisted-token');
    expect(useAuthStore.getState().user).toEqual(sampleUser);
    expect(useAuthStore.getState().isHydrated).toBe(true);
  });

  it('marks hydrated with no user/token when localStorage is empty (logged-out visitor)', () => {
    useAuthStore.getState().hydrate();

    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().isHydrated).toBe(true);
  });

  it('marks hydrated without crashing when the persisted user is corrupted JSON', () => {
    localStorage.setItem('lumina_token', 'persisted-token');
    localStorage.setItem('lumina_user', 'not-valid-json{');

    useAuthStore.getState().hydrate();

    expect(useAuthStore.getState().isHydrated).toBe(true);
    expect(useAuthStore.getState().user).toBeNull();
  });
});
