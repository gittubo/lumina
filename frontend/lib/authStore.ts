import { create } from 'zustand';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  token: string | null;
  isHydrated: boolean;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
  hydrate: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isHydrated: false,

  setAuth: (user, token) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('lumina_token', token);
      localStorage.setItem('lumina_user', JSON.stringify(user));
    }
    set({ user, token });
  },

  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('lumina_token');
      localStorage.removeItem('lumina_user');
    }
    set({ user: null, token: null });
  },

  // Reads persisted auth from localStorage once on the client.
  // Called from a top-level effect since Next.js server-renders first.
  hydrate: () => {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem('lumina_token');
    const userRaw = localStorage.getItem('lumina_user');
    if (token && userRaw) {
      try {
        const user = JSON.parse(userRaw) as User;
        set({ user, token, isHydrated: true });
        return;
      } catch {
        // fall through to clear bad state below
      }
    }
    set({ isHydrated: true });
  },
}));
