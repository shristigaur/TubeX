'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import {
  UserProfile,
  AuthResponse,
  login as apiLogin,
  signup as apiSignup,
  getMe as apiGetMe,
  ApiError,
} from '@/lib/api';

const SESSION_STORAGE_TOKEN_KEY = 'tubex_access_token';

export interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  authError: string | null;
  login: (email: string, password: string) => Promise<AuthResponse>;
  signup: (name: string, email: string, password: string) => Promise<AuthResponse>;
  logout: () => void;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Prevent duplicate concurrent login or signup submissions
  const isSubmittingRef = useRef<boolean>(false);

  // Clear authentication state and remove token from sessionStorage
  const logout = useCallback(() => {
    try {
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(SESSION_STORAGE_TOKEN_KEY);
      }
    } catch {
      // Ignore sessionStorage access errors (e.g. storage disabled by browser)
    }
    setToken(null);
    setUser(null);
    setAuthError(null);
  }, []);

  const clearAuthError = useCallback(() => {
    setAuthError(null);
  }, []);

  // Hydrate authentication state on initial client mount
  useEffect(() => {
    let isCancelled = false;

    const restoreSession = async () => {
      let savedToken: string | null = null;
      try {
        if (typeof window !== 'undefined') {
          savedToken = sessionStorage.getItem(SESSION_STORAGE_TOKEN_KEY);
        }
      } catch {
        savedToken = null;
      }

      if (!savedToken) {
        if (!isCancelled) {
          setIsLoading(false);
        }
        return;
      }

      try {
        const response = await apiGetMe(savedToken);
        if (!isCancelled) {
          setToken(savedToken);
          setUser(response.data.user);
          setAuthError(null);
        }
      } catch (err: unknown) {
        if (isCancelled) return;

        if (err instanceof ApiError) {
          // If the token is invalid (401) or the user record is gone (404), purge the token
          if (err.statusCode === 401 || err.statusCode === 404) {
            try {
              if (typeof window !== 'undefined') {
                sessionStorage.removeItem(SESSION_STORAGE_TOKEN_KEY);
              }
            } catch {
              // Ignore sessionStorage errors
            }
            setToken(null);
            setUser(null);
          } else {
            // For temporary network or server errors (5xx, status 0), do not purge the token
            setAuthError(err.message);
          }
        } else {
          setAuthError('Unable to verify existing session. Please check your connection.');
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    restoreSession();

    return () => {
      isCancelled = true;
    };
  }, []);

  const login = useCallback(
    async (email: string, password: string): Promise<AuthResponse> => {
      if (isSubmittingRef.current) {
        throw new Error('An authentication request is already in progress.');
      }
      isSubmittingRef.current = true;
      setAuthError(null);

      try {
        const normalizedEmail = email.trim().toLowerCase();
        // Password is raw; never trimmed or transformed
        const response = await apiLogin({ email: normalizedEmail, password });

        const receivedToken = response.data.accessToken;
        const receivedUser = response.data.user;

        try {
          if (typeof window !== 'undefined') {
            sessionStorage.setItem(SESSION_STORAGE_TOKEN_KEY, receivedToken);
          }
        } catch {
          // Non-fatal if sessionStorage is blocked
        }

        setToken(receivedToken);
        setUser(receivedUser);

        return response;
      } catch (err: unknown) {
        const message =
          err instanceof ApiError
            ? err.message
            : 'An unexpected error occurred during login.';
        setAuthError(message);
        throw err;
      } finally {
        isSubmittingRef.current = false;
      }
    },
    []
  );

  const signup = useCallback(
    async (name: string, email: string, password: string): Promise<AuthResponse> => {
      if (isSubmittingRef.current) {
        throw new Error('An authentication request is already in progress.');
      }
      isSubmittingRef.current = true;
      setAuthError(null);

      try {
        const normalizedName = name.trim();
        const normalizedEmail = email.trim().toLowerCase();
        // Password is raw; never trimmed or transformed
        const response = await apiSignup({
          name: normalizedName,
          email: normalizedEmail,
          password,
        });

        // The TubeX backend returns { user, accessToken } on successful signup
        const receivedToken = response.data.accessToken;
        const receivedUser = response.data.user;

        if (receivedToken) {
          try {
            if (typeof window !== 'undefined') {
              sessionStorage.setItem(SESSION_STORAGE_TOKEN_KEY, receivedToken);
            }
          } catch {
            // Non-fatal if sessionStorage is blocked
          }
          setToken(receivedToken);
          setUser(receivedUser);
        }

        return response;
      } catch (err: unknown) {
        const message =
          err instanceof ApiError
            ? err.message
            : 'An unexpected error occurred during signup.';
        setAuthError(message);
        throw err;
      } finally {
        isSubmittingRef.current = false;
      }
    },
    []
  );

  const value: AuthContextType = {
    user,
    token,
    isAuthenticated: Boolean(token && user),
    isLoading,
    authError,
    login,
    signup,
    logout,
    clearAuthError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider.');
  }
  return context;
}
