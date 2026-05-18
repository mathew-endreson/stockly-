import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import axios from 'axios';
import Cookies from 'js-cookie';
import type { User, LoginCredentials, RegisterData, SubUserRegisterData, AuthState, AccessibleStock, OnboardingProgress } from '@/types';
import { isDesktopRuntime, isOnline } from '@/shared/platform/platform';

const defaultApiHost = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
const API_URL = import.meta.env.VITE_API_URL || `http://${defaultApiHost}:5000/api`;
const CURRENT_STOCK_STORAGE_KEY = 'currentStockId';
const DESKTOP_AUTH_USER_STORAGE_KEY = 'stockly:desktop-auth-user';

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = Cookies.get('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<User>;
  register: (data: RegisterData) => Promise<User>;
  registerSubUser: (data: SubUserRegisterData) => Promise<User>;
  logout: () => Promise<void>;
  updateUser: (user: Partial<User>) => void;
  clearError: () => void;
  isSubUser: () => boolean;
  canEdit: () => boolean;
  canDelete: () => boolean;
  canManageUsers: () => boolean;
  canManageSales: () => boolean;
  canManageEcommerce: () => boolean;
  canViewExpenses: () => boolean;
  canManageExpenses: () => boolean;
  canApproveExpenses: () => boolean;
  canViewSensitiveExpenses: () => boolean;
  canManageReimbursements: () => boolean;
  canViewAnalytics: () => boolean;
  canViewBalance: () => boolean;
  canViewProductCost: () => boolean;
  // Stock switching
  accessibleStocks: AccessibleStock[];
  currentStockId: string | null;
  switchStock: (stockId: string) => Promise<void>;
  refreshAccessibleStocks: () => Promise<void>;
  // Onboarding
  onboarding: OnboardingProgress | null;
  updateOnboarding: (progress: Partial<OnboardingProgress>) => Promise<void>;
  // Notifications
  unreadNotifications: number;
  setUnreadNotifications: (count: number) => void;
  // Subscription
  checkFeatureAccess: (feature: string) => Promise<{ hasAccess: boolean; requiredPlan?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const readCachedDesktopUser = (): User | null => {
  if (!isDesktopRuntime() || typeof localStorage === 'undefined') return null;
  try {
    const rawUser = localStorage.getItem(DESKTOP_AUTH_USER_STORAGE_KEY);
    if (!rawUser) return null;
    const user = JSON.parse(rawUser) as Partial<User>;
    return typeof user.id === 'string' ? (user as User) : null;
  } catch (error) {
    console.error('Error reading cached desktop user:', error);
    return null;
  }
};

const cacheDesktopUser = (user: User | null) => {
  if (!isDesktopRuntime() || typeof localStorage === 'undefined') return;
  try {
    if (user) {
      localStorage.setItem(DESKTOP_AUTH_USER_STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(DESKTOP_AUTH_USER_STORAGE_KEY);
    }
  } catch (error) {
    console.error('Error caching desktop user:', error);
  }
};

const isAuthRejection = (error: unknown) =>
  axios.isAxiosError(error) &&
  (error.response?.status === 401 || error.response?.status === 403);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: Cookies.get('token') || null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
  });
  
  const [accessibleStocks, setAccessibleStocks] = useState<AccessibleStock[]>([]);
  const [currentStockId, setCurrentStockId] = useState<string | null>(null);
  const [onboarding, setOnboarding] = useState<OnboardingProgress | null>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  const hydrateAuthenticatedUser = (user: User, token: string) => {
    const savedStockId = localStorage.getItem(CURRENT_STOCK_STORAGE_KEY);
    setState({
      user,
      token,
      isAuthenticated: true,
      isLoading: false,
      error: null,
    });
    setAccessibleStocks(user.accessibleStocks || []);
    setOnboarding(user.onboarding || null);
    setCurrentStockId(savedStockId || user.parentId || user.id);
    cacheDesktopUser(user);
  };

  // Check authentication on mount
  useEffect(() => {
    const initAuth = async () => {
      const token = Cookies.get('token');
      if (token) {
        if (isDesktopRuntime() && !isOnline()) {
          const cachedUser = readCachedDesktopUser();
          if (cachedUser) {
            hydrateAuthenticatedUser(cachedUser, token);
            return;
          }
        }

        try {
          const response = await api.get('/auth/me');
          const user = response.data.data.user;
          hydrateAuthenticatedUser(user, token);
          // Load accessible stocks
          refreshAccessibleStocks();
          // Get unread notification count
          fetchUnreadCount();
        } catch (error) {
          const cachedUser = readCachedDesktopUser();
          if (cachedUser && !isAuthRejection(error)) {
            hydrateAuthenticatedUser(cachedUser, token);
            return;
          }

          Cookies.remove('token');
          cacheDesktopUser(null);
          setState({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
            error: 'Session expired. Please login again.',
          });
        }
      } else {
        cacheDesktopUser(null);
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    };

    initAuth();
  }, []);

  useEffect(() => {
    if (!state.isAuthenticated) return;

    let hasSentPresenceLogout = false;
    const sendPresenceLogout = () => {
      if (hasSentPresenceLogout) return;
      hasSentPresenceLogout = true;
      const token = Cookies.get('token');
      if (!token) return;
      try {
        fetch(`${API_URL}/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ reason: 'pagehide' }),
          keepalive: true,
        });
      } catch (error) {
        console.error('Error sending presence logout:', error);
      }
    };

    const handlePageHide = () => sendPresenceLogout();

    window.addEventListener('pagehide', handlePageHide);

    return () => {
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [state.isAuthenticated]);

  const fetchUnreadCount = async () => {
    if (isDesktopRuntime() && !isOnline()) return;

    try {
      const response = await api.get('/notifications/unread-count');
      setUnreadNotifications(response.data.data.count);
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  const refreshAccessibleStocks = async () => {
    if (isDesktopRuntime() && !isOnline()) {
      const cachedUser = readCachedDesktopUser();
      setAccessibleStocks(cachedUser?.accessibleStocks || []);
      return;
    }

    try {
      const response = await api.get('/auth/accessible-stocks');
      const stocks = response.data.data.stocks || [];
      setAccessibleStocks(stocks);
      setState((prev) => {
        if (!prev.user) return prev;
        const user = { ...prev.user, accessibleStocks: stocks };
        cacheDesktopUser(user);
        return { ...prev, user };
      });

      setCurrentStockId((prev) => {
        const userId = state.user?.id;
        if (!userId) return prev;
        const allowedIds = new Set<string>([userId, ...stocks.map((s: AccessibleStock) => s.stockId)]);
        const ownSubscribed = state.user?.ownIsSubscribed ?? state.user?.isSubscribed;
        const preferredShared =
          !ownSubscribed && stocks.length > 0 ? stocks[0].stockId : null;
        const target = preferredShared || prev || userId;
        if (target && allowedIds.has(target)) {
          localStorage.setItem(CURRENT_STOCK_STORAGE_KEY, target);
          return target;
        }
        localStorage.setItem(CURRENT_STOCK_STORAGE_KEY, userId);
        return userId;
      });

      const ownSubscribed = state.user?.ownIsSubscribed ?? state.user?.isSubscribed;
      if (!ownSubscribed && stocks.length > 0) {
        const targetStockId = stocks[0].stockId;
        const current = localStorage.getItem(CURRENT_STOCK_STORAGE_KEY);
        const shouldAutoSwitch =
          (current && current === state.user?.id) ||
          (!current && state.user?.id);
        if (targetStockId && shouldAutoSwitch && current !== targetStockId) {
          const switchResponse = await api.post('/auth/switch-stock', { stockId: targetStockId });
          const { token, user } = switchResponse.data.data;
          Cookies.set('token', token, { expires: 7 });
          setState((prev) => ({
            ...prev,
            user,
            token
          }));
          cacheDesktopUser(user);
          localStorage.setItem(CURRENT_STOCK_STORAGE_KEY, targetStockId);
          setCurrentStockId(targetStockId);
        }
      }
    } catch (error) {
      const cachedUser = readCachedDesktopUser();
      if (cachedUser && !isAuthRejection(error)) {
        setAccessibleStocks(cachedUser.accessibleStocks || []);
        return;
      }
      console.error('Error fetching accessible stocks:', error);
    }
  };

  const login = async (credentials: LoginCredentials): Promise<User> => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));
      const response = await api.post('/auth/login', credentials);
      const { token, user } = response.data.data;

      Cookies.set('token', token, { expires: 7 });
      cacheDesktopUser(user);
      setState({
        user,
        token,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
      setOnboarding(user.onboarding || null);
      setCurrentStockId(user.parentId || user.id);
      localStorage.setItem(CURRENT_STOCK_STORAGE_KEY, user.parentId || user.id);
      refreshAccessibleStocks();
      fetchUnreadCount();
      return user;
    } catch (error: any) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error.response?.data?.message || 'Login failed',
      }));
      throw error;
    }
  };

  const register = async (data: RegisterData): Promise<User> => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));
      const response = await api.post('/auth/register', data);
      const { token, user } = response.data.data;

      Cookies.set('token', token, { expires: 7 });
      cacheDesktopUser(user);
      setState({
        user,
        token,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
      setOnboarding(user.onboarding || null);
      setCurrentStockId(user.id);
      localStorage.setItem(CURRENT_STOCK_STORAGE_KEY, user.id);
      return user;
    } catch (error: any) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error.response?.data?.message || 'Registration failed',
      }));
      throw error;
    }
  };

  const registerSubUser = async (data: SubUserRegisterData): Promise<User> => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));
      const response = await api.post('/auth/register-subuser', data);
      const { token, user } = response.data.data;

      Cookies.set('token', token, { expires: 7 });
      cacheDesktopUser(user);
      setState({
        user,
        token,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
      setCurrentStockId(user.parentId || user.id);
      localStorage.setItem(CURRENT_STOCK_STORAGE_KEY, user.parentId || user.id);
      refreshAccessibleStocks();
      return user;
    } catch (error: any) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error.response?.data?.message || 'Registration failed',
      }));
      throw error;
    }
  };

  const logout = async () => {
    try {
      if (Cookies.get('token')) {
        await api.post('/auth/logout');
      }
    } catch (error) {
      console.error('Error logging out session:', error);
    } finally {
      Cookies.remove('token');
      setState({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
      setAccessibleStocks([]);
      setCurrentStockId(null);
      setOnboarding(null);
      setUnreadNotifications(0);
      localStorage.removeItem(CURRENT_STOCK_STORAGE_KEY);
      cacheDesktopUser(null);
    }
  };

  const updateUser = (userData: Partial<User>) => {
    setState((prev) => {
      const user = prev.user ? { ...prev.user, ...userData } : null;
      if (user) cacheDesktopUser(user);
      return {
        ...prev,
        user,
      };
    });
  };

  const clearError = () => {
    setState((prev) => ({ ...prev, error: null }));
  };

  // Stock switching
  const switchStock = async (stockId: string) => {
    try {
      const response = await api.post('/auth/switch-stock', { stockId });
      const { token, user } = response.data.data;
      
      Cookies.set('token', token, { expires: 7 });
      cacheDesktopUser(user);
      setState((prev) => ({
        ...prev,
        user,
        token,
      }));
      setCurrentStockId(stockId);
      localStorage.setItem(CURRENT_STOCK_STORAGE_KEY, stockId);
    } catch (error: any) {
      console.error('Error switching stock:', error);
      throw error;
    }
  };

  // Onboarding update
  const updateOnboarding = async (progress: Partial<OnboardingProgress>) => {
    try {
      const response = await api.put('/auth/onboarding', progress);
      const updatedOnboarding = response.data.data.onboarding;
      setOnboarding(updatedOnboarding);
      
      // Also update user in state
      setState((prev) => {
        const user = prev.user ? { ...prev.user, onboarding: updatedOnboarding } : null;
        if (user) cacheDesktopUser(user);
        return {
          ...prev,
          user,
        };
      });
    } catch (error) {
      console.error('Error updating onboarding:', error);
    }
  };

  // Check feature access
  const checkFeatureAccess = async (feature: string): Promise<{ hasAccess: boolean; requiredPlan?: string }> => {
    try {
      const response = await api.get(`/subscription/check-feature?feature=${feature}`);
      return response.data.data;
    } catch (error) {
      return { hasAccess: false };
    }
  };

  // Permission helper functions
  const isSubUser = () => {
    if (!state.user) return false;
    if (currentStockId && currentStockId === state.user.id) {
      return false;
    }
    return state.user.role === 'subuser';
  };

  const canEdit = () => {
    if (!state.user) return false;
    if (currentStockId && currentStockId === state.user.id) return true;
    if (state.user.role !== 'subuser') return true;
    return state.user.permissions?.canEdit ?? false;
  };

  const canDelete = () => {
    if (!state.user) return false;
    if (currentStockId && currentStockId === state.user.id) return true;
    if (state.user.role !== 'subuser') return true;
    return state.user.permissions?.canDelete ?? false;
  };

  const canManageUsers = () => {
    if (!state.user) return false;
    if (currentStockId && currentStockId === state.user.id) return true;
    if (state.user.role !== 'subuser') return true;
    return state.user.permissions?.canManageUsers ?? false;
  };

  const canManageSales = () => {
    if (!state.user) return false;
    if (currentStockId && currentStockId === state.user.id) return true;
    if (state.user.role !== 'subuser') return true;
    return state.user.permissions?.canManageSales ?? false;
  };

  const canManageEcommerce = () => {
    if (!state.user) return false;
    if (currentStockId && currentStockId === state.user.id) return true;
    if (state.user.role !== 'subuser') return true;
    return state.user.permissions?.canManageEcommerce ?? false;
  };

  const canViewExpenses = () => {
    if (!state.user) return false;
    if (currentStockId && currentStockId === state.user.id) return true;
    if (state.user.role !== 'subuser') return true;
    return state.user.permissions?.canViewExpenses ?? false;
  };

  const canManageExpenses = () => {
    if (!state.user) return false;
    if (currentStockId && currentStockId === state.user.id) return true;
    if (state.user.role !== 'subuser') return true;
    return state.user.permissions?.canManageExpenses ?? false;
  };

  const canApproveExpenses = () => {
    if (!state.user) return false;
    if (currentStockId && currentStockId === state.user.id) return true;
    if (state.user.role !== 'subuser') return true;
    return state.user.permissions?.canApproveExpenses ?? false;
  };

  const canViewSensitiveExpenses = () => {
    if (!state.user) return false;
    if (currentStockId && currentStockId === state.user.id) return true;
    if (state.user.role !== 'subuser') return true;
    return state.user.permissions?.canViewSensitiveExpenses ?? false;
  };

  const canManageReimbursements = () => {
    if (!state.user) return false;
    if (currentStockId && currentStockId === state.user.id) return true;
    if (state.user.role !== 'subuser') return true;
    return state.user.permissions?.canManageReimbursements ?? false;
  };

  const canViewAnalytics = () => {
    if (!state.user) return false;
    if (currentStockId && currentStockId === state.user.id) return true;
    if (state.user.role !== 'subuser') return true;
    return state.user.permissions?.canViewAnalytics ?? false;
  };

  const canViewBalance = () => {
    if (!state.user) return false;
    if (currentStockId && currentStockId === state.user.id) return true;
    if (state.user.role !== 'subuser') return true;
    if (typeof state.user.permissions?.canViewBalance === 'boolean') {
      return state.user.permissions.canViewBalance;
    }
    return state.user.permissions?.canManageUsers ?? false;
  };

  const canViewProductCost = () => {
    if (!state.user) return false;
    if (currentStockId && currentStockId === state.user.id) return true;
    if (state.user.role !== 'subuser') return true;
    if (typeof state.user.permissions?.canViewProductCost === 'boolean') {
      return state.user.permissions.canViewProductCost;
    }
    return state.user.permissions?.canEdit ?? false;
  };

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        register,
        registerSubUser,
        logout,
        updateUser,
        clearError,
        isSubUser,
        canEdit,
        canDelete,
        canManageUsers,
        canManageSales,
        canManageEcommerce,
        canViewExpenses,
        canManageExpenses,
        canApproveExpenses,
        canViewSensitiveExpenses,
        canManageReimbursements,
        canViewAnalytics,
        canViewBalance,
        canViewProductCost,
        accessibleStocks,
        currentStockId,
        switchStock,
        refreshAccessibleStocks,
        onboarding,
        updateOnboarding,
        unreadNotifications,
        setUnreadNotifications,
        checkFeatureAccess,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export { api };
