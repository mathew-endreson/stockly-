import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  Check,
  Trash2,
  UserPlus,
  ShoppingCart,
  AlertTriangle,
  Info,
  X,
  Store,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { notificationsAPI, authAPI, actionCenterAPI } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import type { Notification, ActionItem } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

const LOCAL_TIP_PREFIX = 'local-tip-';
const LOCAL_PRIORITY_PREFIX = 'local-priority-';
const TIP_CHECK_INTERVAL_MS = 60000;
const TIP_INTERVAL_MS = 5 * 60 * 1000;
const NOTIFICATIONS_REFRESH_INTERVAL_MS = 20000;
const TIP_LAST_SHOWN_KEY = 'stockly:last-tip-notification-at';
const TIP_ROTATION_KEY = 'stockly:tip-notification-rotation';
const TIP_SHOWN_IDS_KEY = 'stockly:tip-notification-shown-ids';

interface TipDefinition {
  id: string;
  message: string;
  actionLink?: string;
}

const isLocalTipNotification = (notificationId: string) =>
  notificationId.startsWith(LOCAL_TIP_PREFIX);
const isLocalPriorityNotification = (notificationId: string) =>
  notificationId.startsWith(LOCAL_PRIORITY_PREFIX);
const isSyntheticNotification = (notificationId: string) =>
  isLocalTipNotification(notificationId) || isLocalPriorityNotification(notificationId);

const NotificationsPanel: React.FC = () => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const navigate = useNavigate();
  const { setUnreadNotifications, refreshAccessibleStocks, canManageEcommerce } = useAuth();
  const canManageEcommerceAccess = canManageEcommerce();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const unreadCount = notifications.filter((notification) => !notification.isRead).length;
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedInvitation, setSelectedInvitation] = useState<Notification | null>(null);

  useEffect(() => {
    setUnreadNotifications(unreadCount);
  }, [setUnreadNotifications, unreadCount]);

  const buildPriorityActionLink = useCallback((action: ActionItem) => {
    const baseLink = String(action.actionLink || '/dashboard').trim();
    const [path, queryString] = baseLink.split('?');
    const params = new URLSearchParams(queryString || '');

    if (path.startsWith('/dashboard/inventory')) {
      if (action.productId && !params.has('highlightProductId')) {
        params.set('highlightProductId', action.productId);
      }
      if (!params.has('highlightPriority')) {
        params.set('highlightPriority', action.priority);
      }
    }

    if (path.startsWith('/dashboard/ecommerce')) {
      if (action.saleId && !params.has('highlightSaleId')) {
        params.set('highlightSaleId', action.saleId);
      }
      if (!params.has('highlightPriority')) {
        params.set('highlightPriority', action.priority);
      }
    }

    const nextQuery = params.toString();
    return nextQuery ? `${path}?${nextQuery}` : path;
  }, []);

  const localizePriorityTitle = useCallback((action: ActionItem) => {
    const rawTitle = String(action.title || '').trim();

    const urgentOutOfStockMatch = rawTitle.match(
      /^urgent\s*:\s*(.+?)\s+is\s+out\s+of\s+stock$/i
    );
    if (urgentOutOfStockMatch) {
      return isRTL
        ? `عاجل: ${urgentOutOfStockMatch[1].trim()} نفد من المخزون`
        : `URGENT: ${urgentOutOfStockMatch[1].trim()} is out of stock`;
    }

    const outOfStockMatch = rawTitle.match(/^(.+?)\s+is\s+out\s+of\s+stock$/i);
    if (outOfStockMatch) {
      return isRTL
        ? `عاجل: ${outOfStockMatch[1].trim()} نفد من المخزون`
        : `URGENT: ${outOfStockMatch[1].trim()} is out of stock`;
    }

    const pendingMatch = rawTitle.match(/^Order\s*#(.+)\s+needs\s+shipping$/i);
    if (pendingMatch) {
      return t('actionCenter.pendingShipmentTitle', 'Order #{{order}} needs shipping', {
        order: pendingMatch[1],
      });
    }

    const lowStockMatch = rawTitle.match(/^(.+)\s+is\s+running\s+low$/i);
    if (lowStockMatch) {
      return t('actionCenter.lowStockTitle', '{{product}} is running low', {
        product: lowStockMatch[1],
      });
    }

    const lowStockReverseMatch = rawTitle.match(/^is\s+running\s+low\s+(.+)$/i);
    if (lowStockReverseMatch) {
      return t('actionCenter.lowStockTitle', '{{product}} is running low', {
        product: lowStockReverseMatch[1],
      });
    }

    const lowStockArabicPrefixMatch = rawTitle.match(/^منخفض\s+في\s+المخزون\s+(.+)$/i);
    if (lowStockArabicPrefixMatch) {
      return t('actionCenter.lowStockTitle', '{{product}} is running low', {
        product: lowStockArabicPrefixMatch[1].trim(),
      });
    }

    if (action.type === 'low_stock' && action.productName) {
      return t('actionCenter.lowStockTitle', '{{product}} is running low', {
        product: action.productName,
      });
    }

    return rawTitle;
  }, [isRTL, t]);

  const localizePriorityMessage = useCallback((action: ActionItem) => {
    const rawDescription = String(action.description || '').trim();

    if (/^restock\s+immediately\s+to\s+avoid\s+lost\s+sales\.?$/i.test(rawDescription)) {
      return isRTL
        ? 'أعد التخزين فوراً لتجنب فقدان المبيعات'
        : 'Restock immediately to avoid lost sales';
    }

    const unitsLeftMatch = rawDescription.match(/^Only\s+(\d+(?:\.\d+)?)\s+units?\s+left\.?$/i);
    if (unitsLeftMatch) {
      return isRTL
        ? `لم يتبق سوى ${unitsLeftMatch[1]} وحدات`
        : `Only ${unitsLeftMatch[1]} units left`;
    }

    const unitsRemainingMatch = rawDescription.match(
      /^Only\s+(\d+(?:\.\d+)?)\s+units?\s+remaining\.?$/i
    );
    if (unitsRemainingMatch) {
      return isRTL
        ? `لم يتبق سوى ${unitsRemainingMatch[1]} وحدات`
        : `Only ${unitsRemainingMatch[1]} units left`;
    }

    const stockMatch = rawDescription.match(
      /^Only\s+(\d+(?:\.\d+)?)\s+units?\s+remaining\.\s+Minimum\s+required:\s+(\d+(?:\.\d+)?)$/i
    );
    if (stockMatch) {
      return t(
        'actionCenter.lowStockDescription',
        'Only {{remaining}} units remaining. Minimum required: {{minimum}}',
        {
          remaining: stockMatch[1],
          minimum: stockMatch[2],
        }
      );
    }

    const itemsForMatch = rawDescription.match(/^(\d+)\s+items?\s+for\s+(.+)$/i);
    if (itemsForMatch) {
      return t('actionCenter.itemsForDescription', '{{count}} items for {{customer}}', {
        count: Number(itemsForMatch[1]),
        customer: itemsForMatch[2],
      });
    }

    const itemsForReverseMatch = rawDescription.match(/^items?\s+for\s+(.+)\s+(\d+)$/i);
    if (itemsForReverseMatch) {
      return t('actionCenter.itemsForDescription', '{{count}} items for {{customer}}', {
        count: Number(itemsForReverseMatch[2]),
        customer: itemsForReverseMatch[1],
      });
    }

    return rawDescription;
  }, [isRTL, t]);

  const tipDefinitions = useMemo<TipDefinition[]>(
    () => [
      {
        id: 'barcode-scanning',
        message: t(
          'tips.barcodeScanning.description',
          'Use the barcode scanner to quickly add products, update stock, or record sales in seconds.'
        ),
        actionLink: '/dashboard/inventory?action=scan',
      },
      {
        id: 'low-stock-alerts',
        message: t(
          'tips.lowStockAlerts.description',
          'Configure minimum quantities for each product to get notified when stock runs low.'
        ),
        actionLink: '/dashboard/inventory',
      },
      {
        id: 'profit-tracking',
        message: t(
          'tips.profitTracking.description',
          'Add cost information to products to see real profit margins and identify your most profitable items.'
        ),
        actionLink: '/dashboard/analytics',
      },
      {
        id: 'team-collaboration',
        message: t(
          'tips.teamCollaboration.description',
          'Add team members with different permission levels to help manage your inventory together.'
        ),
        actionLink: '/dashboard/users',
      },
      {
        id: 'quick-sell',
        message: t(
          'tips.quickSell.description',
          'Record sales directly from the inventory page without navigating to the sales section.'
        ),
        actionLink: '/dashboard/inventory',
      },
      {
        id: 'whatsapp-integration',
        message: t(
          'tips.whatsapp.description',
          'Send order updates to customers via WhatsApp for a better customer experience.'
        ),
        actionLink: '/dashboard/ecommerce',
      },
      {
        id: 'categories',
        message: t(
          'tips.categories.description',
          'Group products into categories for better organization and easier reporting.'
        ),
        actionLink: '/dashboard/inventory?action=add',
      },
      {
        id: 'export-data',
        message: t(
          'tips.exportData.description',
          'Export your inventory to CSV for backup, accounting, or analysis in other tools.'
        ),
        actionLink: '/dashboard/inventory',
      },
    ],
    [t]
  );

  const maybePushTipNotification = useCallback(() => {
    if (typeof window === 'undefined' || tipDefinitions.length === 0) {
      return;
    }

    const now = Date.now();
    const lastShownAt = Number(window.localStorage.getItem(TIP_LAST_SHOWN_KEY) || '0');
    if (now - lastShownAt < TIP_INTERVAL_MS) {
      return;
    }

    const rotationIndex = Number(window.localStorage.getItem(TIP_ROTATION_KEY) || '0');
    const shownTipsRaw = window.localStorage.getItem(TIP_SHOWN_IDS_KEY) || '[]';
    let shownTipIds: string[] = [];
    try {
      const parsed = JSON.parse(shownTipsRaw);
      shownTipIds = Array.isArray(parsed) ? parsed.map((value) => String(value)) : [];
    } catch {
      shownTipIds = [];
    }

    const shownSet = new Set(shownTipIds);
    if (shownSet.size >= tipDefinitions.length) {
      return;
    }

    let tip: TipDefinition | null = null;
    for (let offset = 0; offset < tipDefinitions.length; offset += 1) {
      const candidate = tipDefinitions[(rotationIndex + offset) % tipDefinitions.length];
      if (!shownSet.has(candidate.id)) {
        tip = candidate;
        break;
      }
    }

    if (!tip) {
      return;
    }

    setNotifications((prev) => {
      const hasUnreadTip = prev.some(
        (notification) =>
          notification._id.startsWith(LOCAL_TIP_PREFIX) && !notification.isRead
      );

      if (hasUnreadTip) {
        return prev;
      }

      const nextTipNotification: Notification = {
        _id: `${LOCAL_TIP_PREFIX}${tip.id}-${now}`,
        user: 'local',
        type: 'system',
        title: t('tips.title', 'Pro Tip'),
        message: tip.message,
        isRead: false,
        createdAt: new Date(now).toISOString(),
        data: {
          tipId: tip.id,
          actionLink: tip.actionLink,
        },
      };

      return [nextTipNotification, ...prev].slice(0, 50);
    });

    window.localStorage.setItem(TIP_LAST_SHOWN_KEY, String(now));
    window.localStorage.setItem(TIP_ROTATION_KEY, String(rotationIndex + 1));
    window.localStorage.setItem(
      TIP_SHOWN_IDS_KEY,
      JSON.stringify([...shownSet, tip.id])
    );
  }, [t, tipDefinitions]);

  useEffect(() => {
    maybePushTipNotification();
    const interval = window.setInterval(maybePushTipNotification, TIP_CHECK_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [maybePushTipNotification]);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const [serverResponse, prioritiesResponse] = await Promise.all([
        notificationsAPI.getNotifications(1, 20),
        actionCenterAPI.getTodayPriorities().catch(() => null),
      ]);

      const serverNotifications = serverResponse.data.notifications || [];
      const priorityActions = prioritiesResponse?.data?.priorities || [];
      const filteredPriorities = priorityActions.filter((action) => {
        if (!canManageEcommerceAccess) {
          if (action.type === 'pending_shipment') return false;
          if (action.actionLink?.startsWith('/dashboard/ecommerce')) return false;
        }
        return true;
      });
      const generatedPriorityNotifications: Notification[] = filteredPriorities.map((action) => ({
        _id: `${LOCAL_PRIORITY_PREFIX}${action.id}`,
        user: 'local',
        type: action.priority === 'high' ? 'alert' : 'system',
        title: localizePriorityTitle(action),
        message: localizePriorityMessage(action),
        isRead: false,
        createdAt: new Date().toISOString(),
        data: {
          actionLink: buildPriorityActionLink(action),
          priority: action.priority,
          actionType: action.type,
          productId: action.productId,
          saleId: action.saleId,
        },
      }));

      setNotifications((prev) => {
        const previousById = new Map(prev.map((notification) => [notification._id, notification]));

        const localTips = prev.filter((notification) => isLocalTipNotification(notification._id));
        const priorityNotifications = generatedPriorityNotifications.map((notification) => {
          const previous = previousById.get(notification._id);
          if (!previous) return notification;
          return {
            ...notification,
            isRead: previous.isRead,
            createdAt: previous.createdAt,
          };
        });

        const merged = [...localTips, ...priorityNotifications, ...serverNotifications];
        const deduped: Notification[] = [];
        const seenIds = new Set<string>();
        merged.forEach((notification) => {
          if (seenIds.has(notification._id)) return;
          seenIds.add(notification._id);
          deduped.push(notification);
        });
        return deduped;
      });
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [
    buildPriorityActionLink,
    canManageEcommerceAccess,
    localizePriorityMessage,
    localizePriorityTitle
  ]);

  useEffect(() => {
    void fetchNotifications();

    const refresh = () => {
      void fetchNotifications();
    };
    const interval = window.setInterval(refresh, NOTIFICATIONS_REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [fetchNotifications]);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) return;
    void fetchNotifications();
  };

  const deleteNotification = async (notificationId: string) => {
    const notification = notifications.find((entry) => entry._id === notificationId);
    const wasUnreadServerNotification =
      !!notification && !notification.isRead && !isSyntheticNotification(notificationId);

    setNotifications((prev) =>
      prev.filter((entry) => entry._id !== notificationId)
    );

    if (wasUnreadServerNotification) {
      setUnreadNotifications(Math.max(0, unreadCount - 1));
    }

    if (isSyntheticNotification(notificationId)) {
      return;
    }

    try {
      await notificationsAPI.deleteNotification(notificationId);
    } catch (error) {
      console.error('Error deleting notification:', error);
      if (wasUnreadServerNotification) {
        setUnreadNotifications(unreadCount);
      }
      await fetchNotifications();
    }
  };

  const clearAllNotifications = async () => {
    if (notifications.length === 0) {
      return;
    }

    const notificationsToClear = [...notifications];
    const serverNotificationIds = notificationsToClear
      .filter((notification) => !isSyntheticNotification(notification._id))
      .map((notification) => notification._id);

    setNotifications([]);
    setUnreadNotifications(0);

    if (serverNotificationIds.length === 0) {
      return;
    }

    try {
      await Promise.all(
        serverNotificationIds.map((notificationId) =>
          notificationsAPI.deleteNotification(notificationId)
        )
      );
    } catch (error) {
      console.error('Error clearing notifications:', error);
      await fetchNotifications();
    }
  };

  const markNotificationAsRead = async (notification: Notification) => {
    if (notification.isRead || isSyntheticNotification(notification._id)) {
      return;
    }

    setNotifications((prev) =>
      prev.map((entry) =>
        entry._id === notification._id ? { ...entry, isRead: true } : entry
      )
    );
    setUnreadNotifications(Math.max(0, unreadCount - 1));

    try {
      await notificationsAPI.markAsRead(notification._id);
    } catch (error) {
      console.error('Error marking notification as read:', error);
      await fetchNotifications();
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (notification.type === 'invitation' && notification.data?.invitationToken) {
      setOpen(false);
      setSelectedInvitation(notification);
      await markNotificationAsRead(notification);
      return;
    }
    
    await deleteNotification(notification._id);

    if (notification.data?.actionLink) {
      navigate(notification.data.actionLink);
      setOpen(false);
    }
  };

  const handleInvitationResponse = async (
    accept: boolean,
    invitationOverride?: Notification
  ) => {
    const invitation = invitationOverride || selectedInvitation;
    if (!invitation?.data?.invitationToken) return;
    const invitationId = invitation._id;
    const invitationToken = invitation.data.invitationToken;
    const wasUnread = !invitation.isRead;

    try {
      await authAPI.respondToInvitation(invitationToken, accept);

      // Refresh accessible stocks
      await refreshAccessibleStocks();

      setNotifications((prev) =>
        prev.filter((entry) => entry._id !== invitationId)
      );
      if (wasUnread) {
        setUnreadNotifications(Math.max(0, unreadCount - 1));
      }
      setSelectedInvitation((current) =>
        current?._id === invitationId ? null : current
      );
    } catch (error) {
      const err = error as {
        response?: {
          status?: number;
          data?: { code?: string; message?: string };
        };
      };
      const status = err.response?.status;
      const code = err.response?.data?.code;
      const message = String(err.response?.data?.message || '').toLowerCase();
      const isStaleInvitation =
        status === 404 ||
        status === 410 ||
        code === 'INVITATION_STALE_CLEANED' ||
        message.includes('expired') ||
        message.includes('already processed') ||
        message.includes('invitation not found') ||
        message.includes('invalid');

      if (isStaleInvitation) {
        setNotifications((prev) =>
          prev.filter((entry) => entry._id !== invitationId)
        );
        if (wasUnread) {
          setUnreadNotifications(Math.max(0, unreadCount - 1));
        }
        setSelectedInvitation((current) =>
          current?._id === invitationId ? null : current
        );
        return;
      }

      console.error('Error responding to invitation:', error);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'invitation':
        return <UserPlus className="w-4 h-4 text-blue-500" />;
      case 'sale':
        return <ShoppingCart className="w-4 h-4 text-green-500" />;
      case 'alert':
        return <AlertTriangle className="w-4 h-4 text-orange-500" />;
      default:
        return <Info className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const selectedInvitationRole =
    selectedInvitation?.data?.extra?.role ||
    selectedInvitation?.data?.role ||
    'viewer';

  return (
    <>
      <DropdownMenu open={open} onOpenChange={handleOpenChange}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="relative h-9 w-9 sm:h-10 sm:w-10">
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <Badge
                variant="destructive"
                className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[min(20rem,calc(100vw-1rem))]">
          <DropdownMenuLabel className="flex items-center justify-between">
            <span>{t('notifications.title', 'Notifications')}</span>
            <div className="flex items-center gap-1">
              {notifications.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void clearAllNotifications()}
                  className="h-auto py-1 px-2 text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  {t('notifications.clearAll', 'Clear all')}
                </Button>
              )}
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          <ScrollArea className="h-[300px]">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Bell className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p>{t('notifications.empty', 'No notifications yet')}</p>
              </div>
            ) : (
              <div className="space-y-1">
                <AnimatePresence>
                  {notifications.map((notification) => (
                    <motion.div
                      key={notification._id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <DropdownMenuItem
                        className={`flex items-start gap-3 p-3 cursor-pointer ${
                          !notification.isRead ? 'bg-primary/5' : ''
                        }`}
                        onSelect={(event) => {
                          if (notification.type === 'invitation') {
                            event.preventDefault();
                          }
                        }}
                        onClick={() => void handleNotificationClick(notification)}
                      >
                        <div className="mt-0.5">{getNotificationIcon(notification.type)}</div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{notification.title}</p>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {notification.message}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(notification.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex flex-col gap-1">
                          {!notification.isRead && (
                            <div className="w-2 h-2 bg-primary rounded-full" />
                          )}
                          {notification.type === 'invitation' && notification.data?.invitationToken && (
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-emerald-600 hover:text-emerald-700"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleInvitationResponse(true, notification);
                                }}
                              >
                                <Check className="w-3 h-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-red-500 hover:text-red-600"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleInvitationResponse(false, notification);
                                }}
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              void deleteNotification(notification._id);
                            }}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </DropdownMenuItem>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </ScrollArea>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Invitation Response Dialog */}
      <Dialog open={!!selectedInvitation} onOpenChange={() => setSelectedInvitation(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-blue-500" />
              {t('invitations.teamInvitation', 'Team Invitation')}
            </DialogTitle>
            <DialogDescription>
              {selectedInvitation?.message}
            </DialogDescription>
          </DialogHeader>
          
          <div className="bg-muted rounded-lg p-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                <Store className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">{selectedInvitation?.data?.stockName}</p>
                <p className="text-sm text-muted-foreground">
                  {t('invitations.invitedBy', 'Invited by')} {selectedInvitation?.data?.invitedBy}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t('team.roleLabel', 'Role')}: {selectedInvitationRole}
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => handleInvitationResponse(false)}
            >
              <X className="w-4 h-4 mr-2" />
              {t('common.decline', 'Decline')}
            </Button>
            <Button
              className="flex-1"
              onClick={() => handleInvitationResponse(true)}
            >
              <Check className="w-4 h-4 mr-2" />
              {t('common.accept', 'Accept')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default NotificationsPanel;
