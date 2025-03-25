import { create } from 'zustand';
import { userRoles, type User } from '@shared/schema';

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  isAuthenticated: false,
  user: null,
  loading: true,
  error: null,
  
  login: async (username: string, password: string) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
        credentials: 'include',
      });
      
      if (!res.ok) {
        const error = await res.text();
        throw new Error(error || 'Failed to login');
      }
      
      const user = await res.json();
      set({ isAuthenticated: true, user, loading: false });
    } catch (error) {
      set({ 
        isAuthenticated: false, 
        user: null, 
        loading: false, 
        error: error instanceof Error ? error.message : 'An error occurred during login' 
      });
    }
  },
  
  logout: async () => {
    set({ loading: true });
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
      set({ isAuthenticated: false, user: null, loading: false });
    } catch (error) {
      set({ 
        loading: false, 
        error: error instanceof Error ? error.message : 'An error occurred during logout' 
      });
    }
  },
  
  checkAuth: async () => {
    set({ loading: true });
    try {
      const res = await fetch('/api/auth/me', {
        credentials: 'include',
      });
      
      if (!res.ok) {
        if (res.status === 401) {
          set({ isAuthenticated: false, user: null, loading: false });
          return;
        }
        throw new Error('Failed to verify authentication');
      }
      
      const user = await res.json();
      set({ isAuthenticated: true, user, loading: false });
    } catch (error) {
      set({ 
        isAuthenticated: false, 
        user: null, 
        loading: false, 
        error: error instanceof Error ? error.message : 'An error occurred checking authentication' 
      });
    }
  },
}));

// Hook to check if current user has specific role
export function useHasRole(role: typeof userRoles[number]) {
  const { user } = useAuth();
  return user?.role === role;
}

// Hook to check if current user has any of the specified roles
export function useHasAnyRole(roles: Array<typeof userRoles[number]>) {
  const { user } = useAuth();
  return user ? roles.includes(user.role as any) : false;
}

// Check if user can access internal reports
export function canAccessInternalReports(user: User | null) {
  if (!user) return false;
  return ['admin', 'internal'].includes(user.role);
}

// Check if user can access external reports only
export function canAccessExternalReports(user: User | null) {
  if (!user) return false;
  return ['admin', 'internal', 'external'].includes(user.role);
}

// Check if user can review cars
export function canReviewCars(user: User | null) {
  if (!user) return false;
  return ['admin', 'reviewer'].includes(user.role);
}

// Check if user can access admin settings
export function canAccessAdminSettings(user: User | null) {
  if (!user) return false;
  return user.role === 'admin';
}
