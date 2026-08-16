import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  ReactNode,
} from 'react';
import { setAuthTokenGetter } from '@workspace/api-client-react';
import type { UserProfile } from '@workspace/api-client-react';

// ---------------------------------------------------------------------------
// JWT helpers (no library needed — just base64-decode the payload)
// ---------------------------------------------------------------------------

function parseJwtPayload(token: string): { exp?: number } | null {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join(''),
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/** Returns true when the token expires within the next `bufferMs` ms (or already expired). */
function isTokenExpiredSoon(token: string, bufferMs = 60_000): boolean {
  const payload = parseJwtPayload(token);
  if (!payload?.exp) return true;
  return payload.exp * 1000 - Date.now() < bufferMs;
}

// ---------------------------------------------------------------------------
// Token refresh (singleton promise to prevent concurrent refreshes)
// ---------------------------------------------------------------------------

let _refreshPromise: Promise<string | null> | null = null;

async function doRefresh(): Promise<string | null> {
  if (_refreshPromise) return _refreshPromise;

  _refreshPromise = (async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) return null;

      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!res.ok) {
        // Refresh token is invalid / expired — clear storage
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        return null;
      }

      const data = await res.json();
      const newToken: string = data.accessToken;
      localStorage.setItem('accessToken', newToken);
      return newToken;
    } finally {
      _refreshPromise = null;
    }
  })();

  return _refreshPromise;
}

/**
 * Smart token getter registered with the generated API client.
 * Proactively refreshes the access token when it is about to expire.
 */
async function getValidToken(): Promise<string | null> {
  const token = localStorage.getItem('accessToken');

  if (!token) {
    // Try to get a fresh token using the refresh token
    return doRefresh();
  }

  if (isTokenExpiredSoon(token)) {
    return doRefresh();
  }

  return token;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface AuthContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: UserProfile | null) => void;
  login: (accessToken: string, refreshToken: string, user: UserProfile) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const initialised = useRef(false);

  // Register the smart token getter once so all generated API hooks use it
  useEffect(() => {
    setAuthTokenGetter(getValidToken);
    return () => setAuthTokenGetter(null);
  }, []);

  // On mount: restore session from stored tokens
  useEffect(() => {
    if (initialised.current) return;
    initialised.current = true;

    (async () => {
      try {
        const token = await getValidToken();
        if (!token) {
          setIsLoading(false);
          return;
        }

        // The API exposes the authenticated profile at /api/profile.
        // Using /api/my/profile here returned 404 during a full-page reload,
        // which made the app clear valid tokens and redirect admins to "/".
        const res = await fetch('/api/profile', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const profile: UserProfile = await res.json();
          setUser(profile);
        } else {
          // Profile fetch failed even after refresh — clear session
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
        }
      } catch {
        // Network error — stay unauthenticated but don't clear tokens
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = (accessToken: string, refreshToken: string, userData: UserProfile) => {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    setUser(userData);
  };

  const logout = () => {
    const refreshToken = localStorage.getItem('refreshToken');
    // Fire-and-forget revoke
    if (refreshToken) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      }).catch(() => {});
    }
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        setUser,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
