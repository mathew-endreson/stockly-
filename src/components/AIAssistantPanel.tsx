import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bot,
  File,
  FileImage,
  Loader2,
  Paperclip,
  Send,
  ShieldCheck,
  ShieldX,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { assistantAPI, type AssistantChatMessage } from '@/services/api';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { getWorkspacePlanId, hasPlanFeature } from '@/lib/subscriptionPlans';

type UIMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  senderName?: string;
  attachment?: {
    name: string;
    mimeType: string;
    size: number;
    isImage: boolean;
    previewUrl?: string;
  };
};

type PendingAttachment = {
  file: File;
  name: string;
  mimeType: string;
  size: number;
  isImage: boolean;
  previewUrl?: string;
};

type AiUsageState = {
  plan: string;
  ai: {
    enabled: boolean;
    dailyWords: number | null;
    dailyFiles: number | null;
    wordsUsed: number;
    filesUsed: number;
    wordsRemaining: number | null;
    filesRemaining: number | null;
  };
};

const MAX_STORED_MESSAGES = 80;
const MAX_ANALYZE_FILE_BYTES = 5 * 1024 * 1024;
const AI_LIMIT_STORAGE_KEY = 'stockly_ai_daily_limit';
const AI_WRITE_MODE_STORAGE_KEY = 'stockly_ai_write_mode';

type AssistantCopy = {
  botName: string;
  title: string;
  subtitle: string;
  welcome: string;
  promptLowStock: string;
  promptSalesWeek: string;
  you: string;
  noReply: string;
  fileTooLarge: string;
  clearChat: string;
  analyzingFile: string;
  thinking: string;
  aiUsage: string;
  loading: string;
  unlimitedAi: string;
  wordsLeft: string;
  filesLeft: string;
  aiNotAvailable: string;
  actionsEnabled: string;
  actionsDisabled: string;
  attachFile: string;
  placeholder: string;
};

const ASSISTANT_COPY: Record<'en' | 'ar' | 'fr', AssistantCopy> = {
  en: {
    botName: 'Stockly AI',
    title: 'AI Assistant',
    subtitle: 'Your smart business coach',
    welcome: 'I can help across the whole app: inventory, sales, invoices, clients, distributors, purchases, expenses, surveillance, notifications, analytics, and business strategy. Enable Actions mode to let me restock, sell, update data, and create draft invoices directly!\n\nAnything I can help with?',
    promptLowStock: 'Create an invoice',
    promptSalesWeek: 'Surveillance overview',
    you: 'You',
    noReply: 'No reply returned.',
    fileTooLarge: 'File is too large. Maximum size is 5MB.',
    clearChat: 'Clear chat',
    analyzingFile: 'Analyzing file...',
    thinking: 'Thinking...',
    aiUsage: 'AI usage',
    loading: 'Loading',
    unlimitedAi: 'Unlimited',
    wordsLeft: '{{count}} words left',
    filesLeft: '{{count}} files left',
    aiNotAvailable: 'Not available on your plan',
    actionsEnabled: 'Actions enabled',
    actionsDisabled: 'Safe mode: read-only',
    attachFile: 'Attach file',
    placeholder: 'Ask about any tab or workflow...',
  },
  ar: {
    botName: 'Stockly AI',
    title: 'المساعد الذكي',
    subtitle: 'مدربك الذكي للأعمال',
    welcome: 'يمكنني مساعدتك في إدارة المخزون، تتبع المبيعات، تحسين الأرباح، إنشاء الفواتير، إدارة الموظفين وتقديم نصائح عملية. فعّل وضع الإجراءات للسماح لي بإعادة التزويد والبيع وتحديث البيانات مباشرة!\n\nهل هناك شيء يمكنني مساعدتك فيه؟',
    promptLowStock: 'اعرض المنتجات منخفضة المخزون',
    promptSalesWeek: 'ملخص المبيعات لهذا الأسبوع',
    you: 'أنت',
    noReply: 'لم يتم استلام رد.',
    fileTooLarge: 'الملف كبير جدًا. الحد الأقصى 5MB.',
    clearChat: 'مسح المحادثة',
    analyzingFile: 'جارٍ تحليل الملف...',
    thinking: 'جارٍ التفكير...',
    aiUsage: 'استخدام الذكاء الاصطناعي',
    loading: 'جارٍ التحميل',
    unlimitedAi: 'غير محدود',
    wordsLeft: 'متبقي {{count}} كلمة',
    filesLeft: 'متبقي {{count}} ملف',
    aiNotAvailable: 'غير متاح في خطتك',
    actionsEnabled: 'الإجراءات مفعلة',
    actionsDisabled: 'الوضع الآمن: قراءة فقط',
    attachFile: 'إرفاق ملف',
    placeholder: 'اسأل عن المخزون والمبيعات...',
  },
  fr: {
    botName: 'Stockly AI',
    title: 'Assistant IA',
    subtitle: 'Votre coach business intelligent',
    welcome: 'Je peux aider sur toute l app: inventaire, ventes, factures, clients, distributeurs, achats, depenses, surveillance, notifications, analytics et strategie business. Activez le mode Actions pour que je puisse reapprovisionner, vendre, modifier les donnees et creer des factures brouillon directement!\n\nComment puis-je vous aider?',
    promptLowStock: 'Creer une facture',
    promptSalesWeek: 'Apercu surveillance',
    you: 'Vous',
    noReply: 'Aucune reponse retournee.',
    fileTooLarge: 'Le fichier est trop volumineux. Taille maximale: 5MB.',
    clearChat: 'Effacer la discussion',
    analyzingFile: 'Analyse du fichier...',
    thinking: 'Reflexion...',
    aiUsage: "Utilisation de l'IA",
    loading: 'Chargement',
    unlimitedAi: 'Illimite',
    wordsLeft: '{{count}} mots restants',
    filesLeft: '{{count}} fichiers restants',
    aiNotAvailable: 'Non disponible avec votre forfait',
    actionsEnabled: 'Actions activees',
    actionsDisabled: 'Mode securise: lecture seule',
    attachFile: 'Joindre un fichier',
    placeholder: 'Posez une question sur tout onglet...',
  },
};

const getGatewayTimeoutMessage = (language: 'en' | 'ar' | 'fr') => {
  if (language === 'fr') {
    return "Le fournisseur IA a pris trop de temps a repondre. Reessayez dans un instant.";
  }

  if (language === 'ar') {
    return 'The AI provider took too long to respond. Please try again in a moment.';
  }

  return 'The AI provider took too long to respond. Please try again in a moment.';
};

const renderMessageContent = (content: string) => {
  const lines = String(content || '').split('\n');

  return lines.map((line, lineIndex) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g).filter((part) => part.length > 0);

    return (
      <React.Fragment key={`line-${lineIndex}`}>
        {parts.map((part, partIndex) => {
          const match = part.match(/^\*\*([^*]+)\*\*$/);
          if (match) {
            return <strong key={`part-${lineIndex}-${partIndex}`}>{match[1]}</strong>;
          }
          return <React.Fragment key={`part-${lineIndex}-${partIndex}`}>{part}</React.Fragment>;
        })}
        {lineIndex < lines.length - 1 ? <br /> : null}
      </React.Fragment>
    );
  });
};

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const raw = String(reader.result || '');
      const payload = raw.includes(',') ? raw.split(',')[1] : raw;
      resolve(payload || '');
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });

const formatAttachmentSize = (bytes: number) => {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const buildPlanAwareWelcome = (
  language: 'en' | 'ar' | 'fr',
  options: {
    canUseInvoicing: boolean;
    canUseDistributors: boolean;
    canUseExpenses: boolean;
    canUseSurveillance: boolean;
  }
) => {
  if (language === 'ar') {
    const areas = [
      'إدارة المخزون',
      'المبيعات',
      options.canUseInvoicing ? 'الفواتير' : null,
      'العملاء',
      options.canUseDistributors ? 'الموزعين' : null,
      options.canUseExpenses ? 'المصاريف' : null,
      options.canUseSurveillance ? 'المراقبة' : null,
      'التحليلات',
    ].filter(Boolean).join('، ');

    return `يمكنني مساعدتك في ${areas} وتقديم نصائح عملية لنشاطك. فعّل وضع الإجراءات للسماح لي بإعادة التزويد والبيع وتحديث البيانات مباشرة!\n\nهل هناك شيء يمكنني مساعدتك فيه؟`;
  }

  if (language === 'fr') {
    const areas = [
      'inventaire',
      'ventes',
      options.canUseInvoicing ? 'factures' : null,
      'clients',
      options.canUseDistributors ? 'distributeurs' : null,
      options.canUseExpenses ? 'depenses' : null,
      options.canUseSurveillance ? 'surveillance' : null,
      'analytics',
      'strategie business',
    ].filter(Boolean).join(', ');

    return `Je peux aider sur ${areas}. Activez le mode Actions pour que je puisse reapprovisionner, vendre et modifier les donnees directement.\n\nComment puis-je vous aider?`;
  }

  const areas = [
    'inventory',
    'sales',
    options.canUseInvoicing ? 'invoices' : null,
    'clients',
    options.canUseDistributors ? 'distributors' : null,
    options.canUseExpenses ? 'expenses' : null,
    options.canUseSurveillance ? 'surveillance' : null,
    'notifications',
    'analytics',
    'business strategy',
  ].filter(Boolean).join(', ');

  return `I can help across ${areas}. Enable Actions mode to let me restock, sell, update data, and create drafts directly!\n\nAnything I can help with?`;
};

const normalizeContextSnippet = (value: string, maxChars = 140) => {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars - 3).trimEnd()}...`;
};

const collectRealtimeContextSnippets = () => {
  if (typeof document === 'undefined') return [] as string[];

  const snippets: string[] = [];

  const headingNodes = Array.from(
    document.querySelectorAll('main h1, main h2, main h3')
  ).slice(0, 8);
  for (const node of headingNodes) {
    const text = normalizeContextSnippet(node.textContent || '', 120);
    if (text) snippets.push(`heading:${text}`);
  }

  const taggedNodes = Array.from(document.querySelectorAll('[data-ai-context]')).slice(0, 8);
  for (const node of taggedNodes) {
    const text = normalizeContextSnippet(node.textContent || '', 120);
    if (text) snippets.push(`ui:${text}`);
  }

  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search || '');
    const queryPairs: string[] = [];
    for (const [key, value] of params.entries()) {
      if (queryPairs.length >= 6) break;
      const normalizedKey = normalizeContextSnippet(key, 32);
      const normalizedValue = normalizeContextSnippet(value, 48);
      if (!normalizedKey || !normalizedValue) continue;
      queryPairs.push(`${normalizedKey}=${normalizedValue}`);
    }
    if (queryPairs.length > 0) {
      snippets.push(`query:${queryPairs.join(', ')}`);
    }
  }

  return Array.from(new Set(snippets)).slice(0, 12);
};

const revokeBlobUrl = (value?: string) => {
  const url = String(value || '');
  if (!url.startsWith('blob:')) return;
  URL.revokeObjectURL(url);
};

const revokeMessageAttachmentPreviews = (messageList: UIMessage[]) => {
  for (const message of messageList) {
    revokeBlobUrl(message.attachment?.previewUrl);
  }
};

const AIAssistantPanel: React.FC = () => {
  const { t } = useTranslation();
  const { language, isRTL } = useLanguage();
  const { user } = useAuth();
  const workspacePlan = getWorkspacePlanId(user);
  const canUseInvoicing = hasPlanFeature(workspacePlan, 'invoicing');
  const canUseDistributors = hasPlanFeature(workspacePlan, 'distributors');
  const canUseExpenses = hasPlanFeature(workspacePlan, 'expenses');
  const canUseSurveillance = hasPlanFeature(workspacePlan, 'surveillance');
  const assistantCopy = useMemo<AssistantCopy>(
    () => ASSISTANT_COPY[language] || ASSISTANT_COPY.en,
    [language]
  );
  const assistantName = assistantCopy.botName;
  const welcomeText = useMemo(
    () =>
      buildPlanAwareWelcome(language, {
        canUseInvoicing,
        canUseDistributors,
        canUseExpenses,
        canUseSurveillance,
      }),
    [canUseDistributors, canUseExpenses, canUseInvoicing, canUseSurveillance, language]
  );
  const welcomeMessage = useMemo<UIMessage>(
    () => ({
      id: 'assistant-welcome',
      role: 'assistant',
      senderName: assistantName,
      content: welcomeText
    }),
    [assistantName, welcomeText]
  );

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [analyzingAttachment, setAnalyzingAttachment] = useState(false);
  const [aiLimited, setAiLimited] = useState(false);
  const [aiUsage, setAiUsage] = useState<AiUsageState | null>(null);
  const [aiUsageLoading, setAiUsageLoading] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<PendingAttachment | null>(null);
  const [messages, setMessages] = useState<UIMessage[]>(() => [welcomeMessage]);
  const [allowWrite, setAllowWrite] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(AI_WRITE_MODE_STORAGE_KEY) === 'true';
  });

  const endRef = useRef<HTMLDivElement | null>(null);
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);
  const isBusy = loading || analyzingAttachment;
  const aiEnabled = aiUsage?.ai?.enabled ?? true;
  const wordsLimitActive =
    aiUsage?.ai?.dailyWords !== null && typeof aiUsage?.ai?.dailyWords === 'number';
  const filesLimitActive =
    aiUsage?.ai?.dailyFiles !== null && typeof aiUsage?.ai?.dailyFiles === 'number';
  const wordsBlocked =
    aiEnabled && wordsLimitActive && (aiUsage?.ai?.wordsRemaining ?? 0) <= 0;
  const filesBlocked =
    aiEnabled && filesLimitActive && (aiUsage?.ai?.filesRemaining ?? 0) <= 0;
  const chatLocked = !aiEnabled || wordsBlocked;

  const getTodayKey = () => new Date().toISOString().slice(0, 10);

  const clearPendingAttachment = useCallback(() => {
    setPendingAttachment((previous) => {
      if (previous?.previewUrl) {
        URL.revokeObjectURL(previous.previewUrl);
      }
      return null;
    });
  }, []);

  useEffect(
    () => () => {
      if (pendingAttachment?.previewUrl) {
        URL.revokeObjectURL(pendingAttachment.previewUrl);
      }
    },
    [pendingAttachment?.previewUrl]
  );

  const quickPrompts = useMemo(
    () => [
      canUseInvoicing ? assistantCopy.promptLowStock : language === 'ar' ? 'اعرض المنتجات منخفضة المخزون' : language === 'fr' ? 'Voir les produits en stock faible' : 'Show low stock items',
      canUseSurveillance ? assistantCopy.promptSalesWeek : language === 'ar' ? 'ملخص المبيعات لهذا الأسبوع' : language === 'fr' ? 'Resume des ventes de la semaine' : 'Sales summary for this week',
    ],
    [assistantCopy.promptLowStock, assistantCopy.promptSalesWeek, canUseInvoicing, canUseSurveillance, language]
  );

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  useEffect(() => {
    setMessages((previous) => {
      revokeMessageAttachmentPreviews(previous);
      return [welcomeMessage];
    });
  }, [welcomeMessage]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(AI_LIMIT_STORAGE_KEY);
    setAiLimited(stored === getTodayKey());
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(AI_WRITE_MODE_STORAGE_KEY, allowWrite ? 'true' : 'false');
  }, [allowWrite]);

  const markAiLimitReached = useCallback((message: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `assistant-limit-${Date.now()}`,
        role: 'assistant',
        content: message,
        senderName: assistantName
      }
    ]);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(AI_LIMIT_STORAGE_KEY, getTodayKey());
    }
    setAiLimited(true);
    clearPendingAttachment();
    if (open) {
      window.setTimeout(() => {
        setOpen(false);
      }, 900);
    }
  }, [assistantName, clearPendingAttachment, open]);

  useEffect(() => {
    if (!chatLocked) return;
    clearPendingAttachment();
  }, [chatLocked, clearPendingAttachment]);

  const refreshAiUsage = useCallback(async () => {
    setAiUsageLoading(true);
    try {
      const response = await assistantAPI.getUsage();
      if (response?.data) {
        setAiUsage(response.data);
        const usage = response.data.ai;
        const unlimited = usage.enabled && usage.dailyWords === null && usage.dailyFiles === null;
        const wordsBlocked =
          typeof usage.wordsRemaining === 'number' ? usage.wordsRemaining <= 0 : false;
        const shouldLimit = usage.enabled ? !unlimited && wordsBlocked : true;

        if (typeof window !== 'undefined') {
          if (shouldLimit) {
            window.localStorage.setItem(AI_LIMIT_STORAGE_KEY, getTodayKey());
          } else {
            window.localStorage.removeItem(AI_LIMIT_STORAGE_KEY);
          }
        }
        setAiLimited(shouldLimit);
      }
    } catch {
      // Ignore usage fetch errors.
    } finally {
      setAiUsageLoading(false);
    }
  }, []);

  const lastSharedSignatureRef = useRef<string>('');

  const buildSharedSignature = (messages: AssistantChatMessage[]) =>
    messages
      .map((message) => `${message.role}:${message.senderName || ''}:${message.content}`)
      .join('|');

  const loadSharedChat = useCallback(async () => {
    try {
      const response = await assistantAPI.getSharedChat();
      const sharedMessages = response?.data?.messages || [];
      const signature = buildSharedSignature(sharedMessages);
      if (signature && signature === lastSharedSignatureRef.current) {
        return;
      }
      lastSharedSignatureRef.current = signature;
      if (sharedMessages.length === 0) {
        setMessages([welcomeMessage]);
        return;
      }
      setMessages(
        sharedMessages.map((message, index) => ({
          id: `shared-${index}-${Date.now()}`,
          role: message.role,
          content: message.content,
          senderName: message.senderName
        }))
      );
    } catch {
      // Ignore shared chat fetch errors.
    }
  }, [welcomeMessage]);

  const persistSharedChat = useCallback(async (nextMessages: UIMessage[]) => {
    try {
      const payload = toSharedMessages(nextMessages);
      lastSharedSignatureRef.current = buildSharedSignature(payload);
      await assistantAPI.saveSharedChat(payload);
    } catch {
      // Ignore shared chat save errors.
    }
  }, []);

  const clearSharedChat = useCallback(async () => {
    try {
      await assistantAPI.clearSharedChat();
    } catch {
      // Ignore shared chat clear errors.
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void refreshAiUsage();
    void loadSharedChat();
  }, [open, refreshAiUsage, loadSharedChat]);

  useEffect(() => {
    if (!open) return undefined;
    const interval = window.setInterval(() => {
      if (!isBusy) {
        void loadSharedChat();
        void refreshAiUsage();
      }
    }, 5000);
    return () => window.clearInterval(interval);
  }, [isBusy, loadSharedChat, open, refreshAiUsage]);

  const toApiMessages = (list: UIMessage[]): AssistantChatMessage[] =>
    list
      .filter((message) => message.role === 'user' || message.role === 'assistant')
      .slice(-10)
      .map((message) => ({
        role: message.role,
        content: message.content
      }));

  const toSharedMessages = (list: UIMessage[]): AssistantChatMessage[] =>
    list
      .filter((message) => message.role === 'user' || message.role === 'assistant')
      .filter((message) => message.id !== 'assistant-welcome' && message.id !== 'assistant-welcome-reset')
      .slice(-MAX_STORED_MESSAGES)
      .map((message) => ({
        role: message.role,
        content: message.content,
        senderName: message.senderName
      }));

  const sendMessage = async (preset?: string) => {
    const text = (preset ?? input).trim();
    const attachment = pendingAttachment;
    if ((!text && !attachment) || isBusy || chatLocked) return;
    const messagePreviewUrl = attachment?.isImage ? URL.createObjectURL(attachment.file) : undefined;

    const userMessage: UIMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      senderName: user?.name || user?.email || assistantCopy.you,
      ...(attachment
        ? {
            attachment: {
              name: attachment.name,
              mimeType: attachment.mimeType,
              size: attachment.size,
              isImage: attachment.isImage,
              previewUrl: messagePreviewUrl
            }
          }
        : {})
    };

    setMessages((prev) => {
      const nextMessages = [...prev, userMessage];
      void persistSharedChat(nextMessages);
      return nextMessages;
    });
    setInput('');
    if (attachment) {
      // Clear pending preview immediately once the message is sent.
      clearPendingAttachment();
      setAnalyzingAttachment(true);
    } else {
      setLoading(true);
    }

    try {
      const pagePath = typeof window !== 'undefined' ? window.location.pathname : undefined;
      const pageUrl =
        typeof window !== 'undefined'
          ? `${window.location.pathname}${window.location.search}${window.location.hash}`
          : undefined;
      const pageTitle = typeof document !== 'undefined' ? document.title : undefined;
      const contextSnippets = collectRealtimeContextSnippets();

      const response = attachment
        ? await assistantAPI.analyze({
            fileName: attachment.name,
            mimeType: attachment.mimeType,
            contentBase64: await fileToBase64(attachment.file),
            language,
            question: text || undefined
          })
        : await assistantAPI.chat({
            messages: toApiMessages([...messages, userMessage]),
            language,
            allowWrite,
            context: {
              page: pagePath,
              url: pageUrl,
              title: pageTitle,
              snippets: contextSnippets
            }
          });

      const reply = response?.data?.reply?.trim() || assistantCopy.noReply;
      if (!attachment && typeof response?.data?.writeEnabled === 'boolean') {
        setAllowWrite(response.data.writeEnabled);
      }

      setMessages((prev) => {
        const nextMessages: UIMessage[] = [
          ...prev,
          {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: reply,
            senderName: assistantName
          }
        ];
        void persistSharedChat(nextMessages);
        return nextMessages;
      });
      } catch (error) {
        const apiError = error as {
          response?: { status?: number; data?: { message?: string; error?: string } };
          message?: string;
        };
        const isGatewayTimeout =
          apiError?.response?.status === 504 ||
          /status code 504|gateway timeout/i.test(String(apiError?.message || ''));
        const message = isGatewayTimeout
          ? getGatewayTimeoutMessage(language)
          : apiError?.response?.data?.message ||
            apiError?.response?.data?.error ||
            apiError?.message ||
            t('errors.serverError', 'Server error. Please try again later.');

        if (apiError?.response?.status === 403 && /daily ai|ai access/i.test(message)) {
        if (/file limit/i.test(message)) {
          setAiUsage((prev) =>
            prev
              ? {
                  ...prev,
                  ai: {
                    ...prev.ai,
                    filesRemaining: 0
                  }
                }
              : prev
          );
        } else {
          setAiUsage((prev) =>
            prev
              ? {
                  ...prev,
                  ai: {
                    ...prev.ai,
                    wordsRemaining: 0
                  }
                }
              : prev
          );
          markAiLimitReached(message);
        }
      } else {
        setMessages((prev) => {
          const nextMessages: UIMessage[] = [
            ...prev,
            {
              id: `assistant-error-${Date.now()}`,
              role: 'assistant',
              content: message,
              senderName: assistantName
            }
          ];
          void persistSharedChat(nextMessages);
          return nextMessages;
        });
      }
    } finally {
      void refreshAiUsage();
      if (attachment) {
        setAnalyzingAttachment(false);
      } else {
        setLoading(false);
      }
    }
  };

  const handleAttachmentChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file || isBusy) return;

      if (file.size > MAX_ANALYZE_FILE_BYTES) {
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-file-too-large-${Date.now()}`,
          role: 'assistant',
          content: assistantCopy.fileTooLarge,
          senderName: assistantName
        }
      ]);
      return;
    }

    const isImage = file.type.startsWith('image/');
    const previewUrl = isImage ? URL.createObjectURL(file) : undefined;

    setPendingAttachment((previous) => {
      if (previous?.previewUrl) {
        URL.revokeObjectURL(previous.previewUrl);
      }
      return {
        file,
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        isImage,
        previewUrl
      };
    });
  };

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  };

  return (
    <>
      {open && (
        <div
          className={`fixed z-40 h-[min(62vh,500px)] w-[min(92vw,350px)] rounded-none border border-[#7283FB]/45 dark:border-[#6F6F6F] bg-gradient-to-b from-white via-[#001EF4]/6 to-[#001EF4]/10 dark:from-[#333333] dark:via-[#333333] dark:to-[#333333] shadow-[0_14px_40px_rgba(114,131,251,0.20)] backdrop-blur-sm flex flex-col overflow-hidden ${
            isRTL ? 'left-3 sm:left-6' : 'right-3 sm:right-6'
          } bottom-[3.9rem] sm:bottom-[4.3rem]`}
          dir={isRTL ? 'rtl' : 'ltr'}
        >
          <div className="border-b border-[#7283FB]/35 dark:border-[#6F6F6F] bg-gradient-to-r from-[#001EF4]/70 via-[#001EF4]/50 to-[#001EF4]/70 dark:from-[#333333] dark:via-[#333333] dark:to-[#333333] px-3 py-2.5 space-y-1 text-white">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-full bg-gradient-to-br from-[#001EF4] to-[#001EF4] text-white shadow-sm flex items-center justify-center">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold leading-tight text-white">
                    {assistantCopy.title}
                  </p>
                  <p className="text-[11px] text-white/80">
                    {assistantCopy.subtitle}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-white hover:bg-white/15 hover:text-white dark:hover:bg-white/20"
                  onClick={() => {
                    clearPendingAttachment();
                    setMessages((previous) => {
                      revokeMessageAttachmentPreviews(previous);
                      return [{ ...welcomeMessage, id: 'assistant-welcome-reset' }];
                    });
                    void clearSharedChat();
                  }}
                  aria-label={assistantCopy.clearChat}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-white hover:bg-white/15 hover:text-white dark:hover:bg-white/20"
                  onClick={() => setOpen(false)}
                  aria-label={t('common.close', 'Close')}
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-gradient-to-b from-transparent via-white/35 to-white/55 dark:from-[#333333] dark:via-[#333333] dark:to-[#333333]">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`w-fit max-w-[88%] rounded-none px-3 py-2 text-[13px] leading-5 whitespace-pre-wrap border ${
                    message.role === 'user'
                      ? 'bg-gradient-to-r from-[#001EF4] to-[#001EF4] text-white border-transparent shadow-sm'
                      : 'bg-white/95 text-slate-800 border-[#7283FB]/40 dark:bg-[#5E5E5E] dark:text-slate-100 dark:border-[#808080]'
                  }`}
                >
                  {message.senderName ? (
                    <p
                      className={`text-[10px] uppercase tracking-wide mb-1 ${
                        message.role === 'user' ? 'text-white/80 text-right' : 'text-slate-500 dark:text-slate-300/80'
                      }`}
                    >
                      {message.senderName}
                    </p>
                  ) : null}
                  {message.attachment && (
                    <div
                      className={`rounded-none border p-2 mb-1.5 ${
                        message.role === 'user'
                          ? 'border-white/35 bg-white/10'
                          : 'border-[#7283FB]/35 bg-[#7283FB]/12 dark:border-[#808080] dark:bg-[#5E5E5E]'
                      }`}
                    >
                      {message.attachment.isImage && message.attachment.previewUrl ? (
                        <img
                          src={message.attachment.previewUrl}
                          alt={message.attachment.name}
                          className="max-h-44 w-full rounded-none object-cover"
                        />
                      ) : (
                        <div className="flex items-center gap-2">
                          {message.attachment.isImage ? (
                            <FileImage className="w-4 h-4 shrink-0" />
                          ) : (
                            <File className="w-4 h-4 shrink-0" />
                          )}
                          <div className="min-w-0">
                            <p className="truncate text-[12px] font-medium">{message.attachment.name}</p>
                            <p className="text-[11px] opacity-80">
                              {formatAttachmentSize(message.attachment.size)}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {message.content ? <div>{renderMessageContent(message.content)}</div> : null}
                </div>
              </div>
            ))}
            {(loading || analyzingAttachment) && (
              <div className="flex justify-start">
                <div className="bg-white/95 text-slate-700 border border-[#7283FB]/40 dark:bg-[#5E5E5E] dark:text-slate-100 dark:border-[#808080] max-w-[88%] rounded-none px-3 py-2 text-[13px] flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#7283FB]" />
                  <span>
                    {analyzingAttachment
                      ? assistantCopy.analyzingFile
                      : assistantCopy.thinking}
                  </span>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div className="border-t border-[#7283FB]/35 dark:border-[#6F6F6F] bg-white/85 dark:bg-[#333333] backdrop-blur-sm p-3 space-y-2.5">
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {quickPrompts.map((prompt) => (
                <Button
                  key={prompt}
                  variant="outline"
                  size="sm"
                  onClick={() => void sendMessage(prompt)}
                  disabled={isBusy || aiLimited}
                  className="text-[11px] px-2.5 h-7 rounded-none whitespace-nowrap shrink-0 border-[#7283FB]/40 dark:border-[#808080] bg-white/90 dark:bg-[#5E5E5E] dark:text-slate-100 hover:bg-[#7283FB]/12 dark:hover:bg-[#6A6A6A]"
                >
                  {prompt}
                </Button>
              ))}
            </div>

            <div className="flex items-center justify-between rounded-none border border-[#7283FB]/35 dark:border-[#808080] bg-white/90 dark:bg-[#5E5E5E] px-2.5 py-1.5 text-[11px] text-muted-foreground">
              <span className="font-medium text-foreground">
                {assistantCopy.aiUsage}
              </span>
              {aiUsageLoading ? (
                <span className="inline-flex items-center gap-1 text-[#7283FB] dark:text-[#7283FB]">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {assistantCopy.loading}
                </span>
              ) : aiUsage?.ai?.enabled ? (
                aiUsage.ai.dailyWords === null && aiUsage.ai.dailyFiles === null ? (
                  <span className="text-[#7283FB] dark:text-[#7283FB] font-medium">
                    {assistantCopy.unlimitedAi}
                  </span>
                ) : (
                  <span className="text-foreground">
                    {assistantCopy.wordsLeft.replace(
                      '{{count}}',
                      String(wordsLimitActive ? Math.max(0, aiUsage.ai.wordsRemaining ?? 0) : 0)
                    )}
                    {filesLimitActive
                      ? ` | ${assistantCopy.filesLeft.replace('{{count}}', String(Math.max(0, aiUsage.ai.filesRemaining ?? 0)))}`
                      : ''}
                  </span>
                )
              ) : (
                <span className="text-amber-600 font-medium">
                  {assistantCopy.aiNotAvailable}
                </span>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 rounded-none border border-[#7283FB]/35 dark:border-[#808080] bg-white/90 dark:bg-[#5E5E5E] px-2.5 py-1.5 text-[11px] text-muted-foreground">
              <div className="flex items-center gap-2">
                {allowWrite ? (
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                ) : (
                  <ShieldX className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                )}
                <span>{allowWrite ? assistantCopy.actionsEnabled : assistantCopy.actionsDisabled}</span>
              </div>
              <Switch
                checked={allowWrite}
                onCheckedChange={setAllowWrite}
                disabled={isBusy || chatLocked}
                aria-label={allowWrite ? assistantCopy.actionsEnabled : assistantCopy.actionsDisabled}
              />
            </div>

            {pendingAttachment && (
              <div className="flex items-center justify-between gap-2 rounded-none border border-[#7283FB]/40 dark:border-[#808080] bg-[#7283FB]/12 dark:bg-[#5E5E5E] px-2.5 py-1.5">
                <div className="flex min-w-0 items-center gap-2">
                  {pendingAttachment.isImage && pendingAttachment.previewUrl ? (
                    <img
                      src={pendingAttachment.previewUrl}
                      alt={pendingAttachment.name}
                      className="h-10 w-10 shrink-0 rounded-none border border-[#7283FB]/40 dark:border-[#7283FB]/50 object-cover"
                    />
                  ) : (
                    <div className="h-10 w-10 shrink-0 rounded-none border border-[#7283FB]/40 dark:border-[#808080] bg-white/80 dark:bg-[#5E5E5E] flex items-center justify-center">
                      <File className="w-4 h-4 text-[#7283FB] dark:text-[#7283FB]" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-medium text-[#7283FB] dark:text-[#7283FB]">
                      {pendingAttachment.name}
                    </p>
                    <p className="text-[10px] text-[#7283FB]">
                      {formatAttachmentSize(pendingAttachment.size)}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0 text-[#7283FB] dark:text-[#7283FB] hover:bg-[#7283FB]/12 dark:hover:bg-[#6A6A6A]"
                  onClick={clearPendingAttachment}
                  disabled={isBusy}
                  aria-label={t('common.close', 'Close')}
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}

            <input
              ref={attachmentInputRef}
              type="file"
              className="hidden"
              accept="image/*,.txt,.csv,.json,.md,.markdown,.log,.xml,.yml,.yaml,.pdf"
              onChange={handleAttachmentChange}
            />

            <div className="flex items-end gap-2">
              <div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 rounded-full border-slate-300 dark:border-[#808080] bg-white/95 dark:bg-[#5E5E5E] dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-[#6A6A6A]"
                  onClick={() => attachmentInputRef.current?.click()}
                  disabled={isBusy || chatLocked || filesBlocked}
                  title={assistantCopy.attachFile}
                  aria-label={assistantCopy.attachFile}
                >
                  <Paperclip className="w-4 h-4" />
                </Button>
              </div>

              <Textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleInputKeyDown}
                placeholder={assistantCopy.placeholder}
                className="min-h-[42px] max-h-[100px] rounded-none text-sm leading-5 py-2 resize-none border-slate-300/80 dark:border-[#808080] bg-white/95 dark:bg-[#5E5E5E] dark:text-slate-100 focus-visible:ring-[#001EF4]/30"
                dir={isRTL ? 'rtl' : 'ltr'}
                disabled={chatLocked}
              />
              <Button
                onClick={() => void sendMessage()}
                disabled={(!input.trim() && !pendingAttachment) || isBusy || chatLocked}
                className="h-9 w-9 p-0 rounded-full shrink-0 bg-gradient-to-r from-[#001EF4] to-[#001EF4] hover:from-[#001EF4] hover:to-[#001EF4] text-white"
              >
                {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </div>
      )}

      <Button
        size="icon"
        aria-label={assistantCopy.title}
        title={assistantCopy.title}
        onClick={() => setOpen((prev) => !prev)}
        className={`fixed z-40 h-10 w-10 rounded-full shadow-lg hover:shadow-xl transition-all bg-[#0A1DF5] hover:bg-[#0A1DF5]/90 text-white ${
          isRTL ? 'left-3 sm:left-6' : 'right-3 sm:right-6'
        } bottom-3 sm:bottom-6`}
      >
        <Sparkles className="w-4 h-4" />
      </Button>
    </>
  );
};

export default AIAssistantPanel;


