import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { api, setStoredToken, removeStoredToken, getStoredToken } from '../api/api';
import { User, UserRole } from '../types';

export const ROLES: Record<string, UserRole> = {
  ADMIN: 'Admin',
  OPERATOR: 'Mission Operator',
  COORDINATOR: 'Ground-Station Coordinator',
  ENGINEER: 'Maintenance Engineer',
  VIEWER: 'Viewer',
};

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  systemHealth: any;
  refreshHealth: () => Promise<void>;
  login: (email: string, password?: string) => Promise<User>;
  register: (userData: any) => Promise<any>;
  logout: () => void;
  hasRole: (...allowedRoles: UserRole[]) => boolean;
  ROLES: Record<string, UserRole>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(getStoredToken());
  const [loading, setLoading] = useState<boolean>(true);
  const [systemHealth, setSystemHealth] = useState<any>(null);

  const fetchHealth = useCallback(async () => {
    try {
      const data = await api.getHealth();
      setSystemHealth(data);
    } catch {
      setSystemHealth({
        status: 'degraded',
      });
    }
  }, []);

  const checkUserSession = useCallback(async () => {
    const currentToken = getStoredToken();
    if (!currentToken) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const res = await api.auth.getMe();
      if (res.success && res.user) {
        setUser(res.user);
      } else {
        removeStoredToken();
        setUser(null);
      }
    } catch (err: any) {
      console.warn('Session verification failed:', err.message);
      removeStoredToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkUserSession();
    fetchHealth();
    const interval = setInterval(fetchHealth, 15000);
    return () => clearInterval(interval);
  }, [checkUserSession, fetchHealth]);

  const login = async (email: string, password?: string): Promise<User> => {
    const res = await api.auth.login({ email, password });
    if (res.success && res.token && res.user) {
      setStoredToken(res.token);
      setToken(res.token);
      setUser(res.user);
      return res.user;
    }
    throw new Error(res.message || 'Login failed');
  };

  const register = async (userData: any): Promise<any> => {
    const res = await api.auth.register(userData);
    if (res.success) {
      return res;
    }
    throw new Error(res.message || 'Registration failed');
  };

  const logout = (): void => {
    removeStoredToken();
    setToken(null);
    setUser(null);
  };

  const hasRole = (...allowedRoles: UserRole[]): boolean => {
    if (!user) return false;
    return allowedRoles.includes(user.role);
  };

  const value: AuthContextType = {
    user,
    token,
    loading,
    systemHealth,
    refreshHealth: fetchHealth,
    login,
    register,
    logout,
    hasRole,
    ROLES,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
