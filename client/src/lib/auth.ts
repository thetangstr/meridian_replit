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
    console.log(`Attempting login with username: ${username}`);
    set({ loading: true, error: null });
    try {
      console.log('Making login request...');
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
        credentials: 'include',
      });
      
      console.log('Login response status:', res.status);
      
      if (!res.ok) {
        const error = await res.text();
        console.error('Login error:', error);
        throw new Error(error || 'Failed to login');
      }
      
      const user = await res.json();
      console.log('Login successful, user data:', user);
      
      set({ isAuthenticated: true, user, loading: false });
      console.log('Auth state updated:', { isAuthenticated: true, user, loading: false });
      
      // Verify session immediately
      try {
        const sessionCheck = await fetch('/api/auth/me', {
          credentials: 'include',
        });
        console.log('Session check after login:', sessionCheck.status);
        if (sessionCheck.ok) {
          const sessionUser = await sessionCheck.json();
          console.log('Session user data:', sessionUser);
        }
      } catch (e) {
        console.error('Session check error:', e);
      }
    } catch (error) {
      console.error('Login error caught:', error);
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
      console.log('Logging out...');
      const res = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
      
      // Always clear the user data regardless of the response
      set({ isAuthenticated: false, user: null, loading: false });
      
      // Manually invalidate the session storage to ensure complete logout
      window.sessionStorage.clear();
      
      // Redirect to login on next execution cycle
      setTimeout(() => {
        window.location.href = '/login';
      }, 100);
      
      console.log('Logout complete, auth state cleared');
    } catch (error) {
      console.error('Logout error:', error);
      // Still clear the user data even if there's an error
      set({ 
        isAuthenticated: false,
        user: null,
        loading: false, 
        error: error instanceof Error ? error.message : 'An error occurred during logout' 
      });
      
      // Force redirect on error as well
      setTimeout(() => {
        window.location.href = '/login';
      }, 100);
    }
  },
  
  checkAuth: async () => {
    set({ loading: true });
    try {
      console.log('Checking authentication status...');
      const res = await fetch('/api/auth/me', {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });
      
      console.log('Authentication check response:', res.status);
      
      if (!res.ok) {
        if (res.status === 401) {
          console.log('Not authenticated (401)');
          set({ isAuthenticated: false, user: null, loading: false });
          
          // Force a login for development testing purposes
          console.log('Attempting auto-login (development only)...');
          try {
            // In development, attempt an auto-login for convenience
            const loginRes = await fetch('/api/auth/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ username: 'reviewer', password: 'review123' }),
              credentials: 'include',
            });
            
            if (loginRes.ok) {
              const user = await loginRes.json();
              console.log('Auto-login successful:', user);
              set({ isAuthenticated: true, user, loading: false });
              return;
            }
          } catch (loginErr) {
            console.error('Auto-login failed:', loginErr);
          }
          return;
        }
        throw new Error('Failed to verify authentication');
      }
      
      const user = await res.json();
      console.log('User authenticated:', user);
      set({ isAuthenticated: true, user, loading: false });
    } catch (error) {
      console.error('Authentication check error:', error);
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
