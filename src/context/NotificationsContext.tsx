import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { notificationsAPI, authAPI } from '@/services/api';
import type { Notification, AccessibleStock } from '@/types';
import { useAuth } from './AuthContext';

interface NotificationsContextType {
  notifications: Notification[];
  unreadCount: number;
  accessibleStocks: AccessibleStock[];
  currentStock: AccessibleStock | null;
  isLoading: boolean;
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  acceptInvitation: (id: string) => Promise<void>;
  declineInvitation: (id: string) => Promise<void>;
  fetchAccessibleStocks: () => Promise<void>;
  switchStock: (stockId: string) => Promise<void>;
  refreshNotifications: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

export const NotificationsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const {
    user,
    updateUser,
    isAuthenticated,
    currentStockId,
    switchStock: switchAuthStock,
  } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [accessibleStocks, setAccessibleStocks] = useState<AccessibleStock[]>([]);
  const [currentStock, setCurrentStock] = useState<AccessibleStock | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const response = await notificationsAPI.getNotifications();
      const nextNotifications = response.data.notifications || [];
      setNotifications(nextNotifications);
      setUnreadCount(nextNotifications.filter((notification) => !notification.isRead).length);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  }, []);

  const fetchAccessibleStocks = useCallback(async () => {
    try {
      const response = await authAPI.getAccessibleStocks();
      const stocks = response.data.stocks || [];
      setAccessibleStocks(stocks);
    } catch (error) {
      console.error('Error fetching accessible stocks:', error);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setNotifications([]);
      setUnreadCount(0);
      setAccessibleStocks([]);
      setCurrentStock(null);
      return;
    }

    void fetchNotifications();
    void fetchAccessibleStocks();
  }, [isAuthenticated, fetchNotifications, fetchAccessibleStocks]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const interval = window.setInterval(() => {
      void fetchNotifications();
    }, 30000);

    return () => window.clearInterval(interval);
  }, [isAuthenticated, fetchNotifications]);

  useEffect(() => {
    if (user?.accessibleStocks && user.accessibleStocks.length > 0) {
      setAccessibleStocks(user.accessibleStocks);
    }
  }, [user?.accessibleStocks]);

  useEffect(() => {
    if (accessibleStocks.length === 0) {
      setCurrentStock(null);
      return;
    }

    const activeStock =
      accessibleStocks.find((stock) => stock.stockId === currentStockId) || accessibleStocks[0];
    setCurrentStock(activeStock);
  }, [accessibleStocks, currentStockId]);

  const markAsRead = useCallback(async (id: string) => {
    try {
      const target = notifications.find((notification) => notification._id === id);
      await notificationsAPI.markAsRead(id);
      setNotifications((prev) =>
        prev.map((notification) =>
          notification._id === id ? { ...notification, isRead: true } : notification
        )
      );
      if (target && !target.isRead) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }, [notifications]);

  const markAllAsRead = useCallback(async () => {
    try {
      await notificationsAPI.markAllAsRead();
      setNotifications((prev) => prev.map((notification) => ({ ...notification, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  }, []);

  const deleteNotification = useCallback(async (id: string) => {
    try {
      const deletedNotification = notifications.find((notification) => notification._id === id);
      await notificationsAPI.deleteNotification(id);
      setNotifications((prev) => prev.filter((notification) => notification._id !== id));
      if (deletedNotification && !deletedNotification.isRead) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  }, [notifications]);

  const acceptInvitation = useCallback(async (id: string) => {
    setIsLoading(true);
    try {
      const invitation = notifications.find((notification) => notification._id === id);
      const invitationToken = invitation?.data?.invitationToken;
      if (!invitationToken) {
        throw new Error('Invitation token is missing');
      }

      await authAPI.respondToInvitation(invitationToken, true);
      const meResponse = await authAPI.getMe();
      updateUser(meResponse.data.user);

      await Promise.all([fetchAccessibleStocks(), fetchNotifications()]);
    } catch (error) {
      console.error('Error accepting invitation:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [notifications, updateUser, fetchAccessibleStocks, fetchNotifications]);

  const declineInvitation = useCallback(async (id: string) => {
    try {
      const invitation = notifications.find((notification) => notification._id === id);
      const invitationToken = invitation?.data?.invitationToken;
      if (!invitationToken) {
        throw new Error('Invitation token is missing');
      }

      await authAPI.respondToInvitation(invitationToken, false);
      await fetchNotifications();
    } catch (error) {
      console.error('Error declining invitation:', error);
      throw error;
    }
  }, [notifications, fetchNotifications]);

  const switchStock = useCallback(async (stockId: string) => {
    setIsLoading(true);
    try {
      await switchAuthStock(stockId);
      await Promise.all([fetchAccessibleStocks(), fetchNotifications()]);
    } catch (error) {
      console.error('Error switching stock:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [switchAuthStock, fetchAccessibleStocks, fetchNotifications]);

  const refreshNotifications = useCallback(async () => {
    await fetchNotifications();
  }, [fetchNotifications]);

  return (
    <NotificationsContext.Provider
      value={{
        notifications,
        unreadCount,
        accessibleStocks,
        currentStock,
        isLoading,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        acceptInvitation,
        declineInvitation,
        fetchAccessibleStocks,
        switchStock,
        refreshNotifications,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationsContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationsProvider');
  }
  return context;
};
