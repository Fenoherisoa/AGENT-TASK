import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  MessageSquare,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  Send,
  WifiOff,
  Users,
  Bot,
  User,
  Hash,
  Pin,
  Check,
  CheckCheck,
  FileText,
  Image,
  Video,
  Mic,
  Music,
  MapPin,
  Phone,
  Layers,
  Sparkles,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  ExternalLink,
  Info,
  Flame,
  ShieldCheck,
  Radio,
  Reply,
  Edit2,
  Trash2,
  CornerUpRight,
  Smile,
  X,
  MoreVertical,
  Lock,
  Share2,
  Terminal,
  Clock,
  Eye,
  Repeat,
  Paperclip,
  MessageCircle,
  Compass,
  HelpCircle,
  Sun,
  Moon,
  Link as LinkIcon,
  Download,
  ArrowLeft
} from 'lucide-react';
import {
  TelegramChat,
  TelegramChatRole,
  TelegramConnectionState,
  TelegramMessage,
  TelegramChatFullInfo,
  TelegramInlineButton,
  TelegramReplyKeyboard,
  TelegramReplyKeyboardButton,
  TelegramChatUIState,
  TelegramStructuredControl
} from '../types/task';
import { api } from '../services/api';
import { sseClient } from '../services/sse';

interface TelegramChatsProps {
  chats: TelegramChat[];
  isTelegramConnected: boolean;
  onRefresh: () => void;
  onNavigateToTab: (tab: string) => void;
}

type ChatFilterTab = 'ALL' | 'TASK_SOURCE' | 'GROUPS' | 'DIRECT';

const AVATAR_GRADIENTS = [
  'from-indigo-600 to-purple-600',
  'from-blue-600 to-cyan-600',
  'from-emerald-600 to-teal-600',
  'from-amber-600 to-orange-600',
  'from-rose-600 to-pink-600',
  'from-violet-600 to-fuchsia-600'
];

const REACTION_EMOJIS = ['👍', '❤️', '🔥', '👏', '🎉', '🚀', '👀', '👎', '💡', '💯'];

function getChatAvatarGradient(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}

function getInitials(title: string): string {
  if (!title) return 'TG';
  const clean = title.trim();
  const parts = clean.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return clean.substring(0, 2).toUpperCase();
}

/**
 * ChatAvatar Component with Real Telegram Profile Photo (Requirement 2 & 7)
 */
export const ChatAvatar: React.FC<{
  chat: { id: string; title: string; avatarColor?: string; type?: string };
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}> = ({ chat, size = 'md', className = '' }) => {
  const [imgError, setImgError] = useState(false);
  const sizeMap = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-xl'
  };

  const currentSizeClass = sizeMap[size] || sizeMap.md;

  if (imgError) {
    return (
      <div
        className={`${currentSizeClass} rounded-full bg-gradient-to-tr ${
          chat.avatarColor || getChatAvatarGradient(chat.id)
        } flex items-center justify-center text-white font-bold shadow-sm flex-shrink-0 select-none ${className}`}
      >
        {getInitials(chat.title)}
      </div>
    );
  }

  return (
    <div className={`relative flex-shrink-0 ${className}`}>
      <img
        src={`/api/telegram/chats/${encodeURIComponent(chat.id)}/avatar`}
        alt={chat.title}
        onError={() => setImgError(true)}
        className={`${currentSizeClass} rounded-full object-cover shadow-sm bg-slate-800`}
      />
    </div>
  );
};

function formatMessageTime(isoDate?: string): string {
  if (!isoDate) return '';
  const date = new Date(isoDate);
  if (isNaN(date.getTime())) return '';
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isYesterday) {
    return 'Hier';
  }

  return date.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

function formatTimelineDateHeader(isoDate: string): string {
  const date = new Date(isoDate);
  if (isNaN(date.getTime())) return '';
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) return "Aujourd'hui";

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isYesterday) return 'Hier';

  return date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  });
}

export const TelegramChats: React.FC<TelegramChatsProps> = ({
  chats,
  isTelegramConnected,
  onRefresh,
  onNavigateToTab
}) => {
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [chatFilter, setChatFilter] = useState<ChatFilterTab>('ALL');
  const [searchChatQuery, setSearchChatQuery] = useState('');
  const [searchMessageQuery, setSearchMessageQuery] = useState('');
  const [isSearchMessageOpen, setIsSearchMessageOpen] = useState(false);

  const [messages, setMessages] = useState<TelegramMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [newMessageText, setNewMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Message Interaction States
  const [replyingToMessage, setReplyingToMessage] = useState<TelegramMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<TelegramMessage | null>(null);
  const [activeContextMenuMsgId, setActiveContextMenuMsgId] = useState<string | null>(null);
  const [activeReactionPickerMsgId, setActiveReactionPickerMsgId] = useState<string | null>(null);
  const [forwardModalMessage, setForwardModalMessage] = useState<TelegramMessage | null>(null);
  const [forwardSelectedTargetChatId, setForwardSelectedTargetChatId] = useState<string>('');
  const [isForwarding, setIsForwarding] = useState(false);
  const [activeCallbackKey, setActiveCallbackKey] = useState<string | null>(null);

  // Dynamic Telegram UI State (RFC V6 Bottom Controls)
  const [chatUIState, setChatUIState] = useState<TelegramChatUIState | null>(null);
  const [isLoadingUIState, setIsLoadingUIState] = useState(false);
  const [activeReplyBtnKey, setActiveReplyBtnKey] = useState<string | null>(null);
  const [isAttachmentMenuOpen, setIsAttachmentMenuOpen] = useState(false);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [isBotCommandsMenuOpen, setIsBotCommandsMenuOpen] = useState(false);

  // Theme & Appearance (Telegram Dark / Light)
  const [tgTheme, setTgTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('rfc_tg_theme') as 'dark' | 'light') || 'dark';
  });
  const isDark = tgTheme === 'dark';

  const toggleTheme = () => {
    setTgTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('rfc_tg_theme', next);
      return next;
    });
  };

  // Scroll & Unread Floating Tracking
  const [newMessagesCount, setNewMessagesCount] = useState(0);
  const isNearBottomRef = useRef(true);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);

  // Chat Info Panel & Shared Media Tabs
  const [isChatInfoOpen, setIsChatInfoOpen] = useState(false);
  const [chatFullInfo, setChatFullInfo] = useState<TelegramChatFullInfo | null>(null);
  const [isLoadingChatInfo, setIsLoadingChatInfo] = useState(false);
  const [infoTab, setInfoTab] = useState<'info' | 'media' | 'files' | 'links' | 'members'>('info');

  // In-Chat Search Matches
  const [activeSearchMatchIdx, setActiveSearchMatchIdx] = useState(0);

  // Connection & Diagnostics
  const [telegramStatus, setTelegramStatus] = useState<any>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const timelineContainerRef = useRef<HTMLDivElement>(null);
  const composerInputRef = useRef<HTMLTextAreaElement>(null);

  const fetchStatus = async () => {
    try {
      const data = await api.getTelegramStatus();
      setTelegramStatus(data);
    } catch {}
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 4000);
    return () => clearInterval(interval);
  }, []);

  // Fetch messages when selected chat changes or search changes
  const loadChatMessages = async (chatId: string, search?: string) => {
    setIsLoadingMessages(true);
    try {
      const res = await api.getTelegramMessages(chatId, { limit: 50, search });
      setMessages(res.messages || []);
      setHasMoreMessages(res.hasMore);
      setNewMessagesCount(0);
    } catch {
      setMessages([]);
      setHasMoreMessages(false);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const loadChatFullInfo = async (chatId: string) => {
    setIsLoadingChatInfo(true);
    try {
      const res = await api.getTelegramChatFull(chatId);
      if (res.success && res.info) {
        setChatFullInfo(res.info);
      } else {
        setChatFullInfo(null);
      }
    } catch {
      setChatFullInfo(null);
    } finally {
      setIsLoadingChatInfo(false);
    }
  };

  const loadChatUIState = async (chatId: string) => {
    setIsLoadingUIState(true);
    try {
      const res = await api.getTelegramChatUIState(chatId);
      if (res.success && res.uiState) {
        setChatUIState(res.uiState);
      } else {
        setChatUIState(null);
      }
    } catch {
      setChatUIState(null);
    } finally {
      setIsLoadingUIState(false);
    }
  };

  useEffect(() => {
    if (selectedChatId) {
      loadChatMessages(selectedChatId, searchMessageQuery || undefined);
      loadChatUIState(selectedChatId);
      if (isChatInfoOpen) {
        loadChatFullInfo(selectedChatId);
      }
      setReplyingToMessage(null);
      setEditingMessage(null);
      setActiveContextMenuMsgId(null);
      setActiveReactionPickerMsgId(null);
      setIsAttachmentMenuOpen(false);
      setIsEmojiPickerOpen(false);
      setIsBotCommandsMenuOpen(false);
    } else {
      setMessages([]);
      setChatFullInfo(null);
      setChatUIState(null);
    }
  }, [selectedChatId, searchMessageQuery]);

  // If no chat selected, select the first chat if available
  useEffect(() => {
    if (!selectedChatId && chats.length > 0) {
      setSelectedChatId(chats[0].id);
    }
  }, [chats, selectedChatId]);

  // Structured Workspace State Synchronization for Automation Engine (Requirement 27)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const activeChat = chats.find(c => String(c.id) === String(selectedChatId)) || null;
      const latestMsg = messages.length > 0 ? messages[messages.length - 1] : null;
      (window as any).__TELEGRAM_WORKSPACE_STATE__ = {
        currentChat: activeChat,
        currentMessage: latestMsg,
        latestMessage: latestMsg,
        unreadMessages: chats.reduce((acc, c) => acc + (c.unreadCount || 0), 0),
        messageButtons: {
          replyKeyboard: chatUIState?.replyKeyboard || null,
          botCommands: chatUIState?.botCommands || [],
          latestInlineButtons: latestMsg?.inlineButtons || null
        },
        replyCapability: activeChat?.capabilities?.canReply ?? false,
        sendCapability: activeChat?.capabilities?.canSend ?? false,
        chatType: activeChat?.type || 'unknown',
        chatPermissions: activeChat?.capabilities || null,
        chatId: selectedChatId,
        messageId: latestMsg?.id || null,
        isTelegramConnected
      };
    }
  }, [selectedChatId, messages, chatUIState, chats, isTelegramConnected]);

  // Handle timeline scroll to detect if user is near bottom
  const handleTimelineScroll = () => {
    if (!timelineContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = timelineContainerRef.current;
    const nearBottom = scrollHeight - scrollTop - clientHeight < 80;
    isNearBottomRef.current = nearBottom;
    if (nearBottom) {
      setNewMessagesCount(0);
    }
  };

  // Real-time SSE listeners
  useEffect(() => {
    const unsubNewMsg = sseClient.on('telegram:message:new', (data: { message: TelegramMessage }) => {
      if (data?.message && selectedChatId && String(data.message.chatId) === String(selectedChatId)) {
        setMessages(prev => {
          const exists = prev.some(m => String(m.id) === String(data.message.id));
          if (exists) {
            return prev.map(m => (String(m.id) === String(data.message.id) ? data.message : m));
          }
          return [...prev, data.message];
        });
        loadChatUIState(selectedChatId);

        if (isNearBottomRef.current) {
          requestAnimationFrame(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          });
        } else {
          setNewMessagesCount(prev => prev + 1);
        }
      }
    });

    const unsubUpdMsg = sseClient.on('telegram:message:updated', (data: { message: TelegramMessage }) => {
      if (data?.message && selectedChatId && String(data.message.chatId) === String(selectedChatId)) {
        setMessages(prev =>
          prev.map(m => (String(m.id) === String(data.message.id) ? { ...m, ...data.message } : m))
        );
        loadChatUIState(selectedChatId);
      }
    });

    const unsubDelMsg = sseClient.on('telegram:message:deleted', (data: { chatId: string; messageId: string }) => {
      if (selectedChatId && String(data.chatId) === String(selectedChatId)) {
        setMessages(prev => prev.filter(m => String(m.id) !== String(data.messageId)));
        loadChatUIState(selectedChatId);
      }
    });

    const unsubUIState = sseClient.on('telegram:ui-state:updated', (data: { chatId: string }) => {
      if (selectedChatId && String(data.chatId) === String(selectedChatId)) {
        loadChatUIState(selectedChatId);
      }
    });

    const unsubChats = sseClient.on('telegram:chats', () => {
      onRefresh();
    });

    return () => {
      unsubNewMsg();
      unsubUpdMsg();
      unsubDelMsg();
      unsubUIState();
      unsubChats();
    };
  }, [selectedChatId, onRefresh]);

  // Auto-scroll on initial load or chat change
  useEffect(() => {
    if (isNearBottomRef.current && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  // Load older messages (pagination)
  const handleLoadOlderMessages = async () => {
    if (!selectedChatId || messages.length === 0 || isLoadingOlder) return;
    setIsLoadingOlder(true);
    const oldestId = messages[0].id;
    const prevScrollHeight = timelineContainerRef.current?.scrollHeight || 0;
    const prevScrollTop = timelineContainerRef.current?.scrollTop || 0;

    try {
      const res = await api.getTelegramMessages(selectedChatId, {
        limit: 40,
        offsetId: Number(oldestId) || 0
      });
      if (res.messages && res.messages.length > 0) {
        setMessages(prev => {
          const existingIds = new Set(prev.map(m => String(m.id)));
          const newOlder = res.messages.filter(m => !existingIds.has(String(m.id)));
          return [...newOlder, ...prev];
        });
        setHasMoreMessages(res.hasMore);

        requestAnimationFrame(() => {
          if (timelineContainerRef.current) {
            const newScrollHeight = timelineContainerRef.current.scrollHeight;
            timelineContainerRef.current.scrollTop = prevScrollTop + (newScrollHeight - prevScrollHeight);
          }
        });
      } else {
        setHasMoreMessages(false);
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: `Erreur pagination: ${err.message}` });
    } finally {
      setIsLoadingOlder(false);
    }
  };

  // Close context menus when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setActiveContextMenuMsgId(null);
      setActiveReactionPickerMsgId(null);
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const handleSync = async () => {
    setIsSyncing(true);
    setFeedback(null);
    try {
      const res = await api.syncTelegram();
      setFeedback({
        type: 'success',
        message: `Synchronisation réussie : ${res.chatsDiscovered} conversation(s) trouvée(s).`
      });
      onRefresh();
      await fetchStatus();
      if (selectedChatId) {
        loadChatMessages(selectedChatId);
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: `Erreur lors de la synchronisation : ${err.message}`
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedChatId || !newMessageText.trim() || isSending) return;

    const textToSend = newMessageText.trim();
    setIsSending(true);

    try {
      if (editingMessage) {
        // Edit flow
        const res = await api.editTelegramMessage(selectedChatId, editingMessage.id, textToSend);
        if (res.success) {
          setEditingMessage(null);
          setNewMessageText('');
          setFeedback({ type: 'success', message: 'Message modifié avec succès.' });
        } else {
          setFeedback({ type: 'error', message: res.error || 'Échec de la modification' });
        }
      } else {
        // Send / Reply flow
        const res = await api.sendTelegramMessage(
          selectedChatId,
          textToSend,
          replyingToMessage ? replyingToMessage.id : undefined
        );
        if (res.success) {
          setNewMessageText('');
          setReplyingToMessage(null);
        } else {
          setFeedback({ type: 'error', message: res.error || "Échec de l'envoi du message Telegram." });
        }
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setIsSending(false);
    }
  };

  const handleDeleteMessage = async (msg: TelegramMessage) => {
    if (!selectedChatId) return;
    if (!confirm('Voulez-vous vraiment supprimer ce message Telegram ?')) return;

    try {
      const res = await api.deleteTelegramMessage(selectedChatId, msg.id);
      if (res.success) {
        setMessages(prev => prev.filter(m => String(m.id) !== String(msg.id)));
        setFeedback({ type: 'success', message: 'Message supprimé.' });
      } else {
        setFeedback({ type: 'error', message: res.error || 'Échec suppression' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const handlePinMessage = async (msg: TelegramMessage) => {
    if (!selectedChatId) return;
    const isCurrentlyPinned = !!msg.isPinned;
    try {
      const res = await api.pinTelegramMessage(selectedChatId, msg.id, isCurrentlyPinned, true);
      if (res.success) {
        setFeedback({
          type: 'success',
          message: isCurrentlyPinned ? 'Message détaché.' : 'Message épinglé.'
        });
        setMessages(prev =>
          prev.map(m => (String(m.id) === String(msg.id) ? { ...m, isPinned: !isCurrentlyPinned } : m))
        );
      } else {
        setFeedback({ type: 'error', message: res.error || "Échec de l'épinglage" });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const handleReactMessage = async (msg: TelegramMessage, emoji: string) => {
    if (!selectedChatId) return;
    try {
      const res = await api.reactTelegramMessage(selectedChatId, msg.id, emoji);
      if (!res.success) {
        setFeedback({ type: 'error', message: res.error || "Échec de l'ajout de la réaction" });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setActiveReactionPickerMsgId(null);
    }
  };

  const handleCallbackClick = async (msg: TelegramMessage, btn: TelegramInlineButton, btnKey?: string) => {
    if (!selectedChatId) return;
    if (btnKey) setActiveCallbackKey(btnKey);
    try {
      setFeedback({ type: 'info', message: `Exécution de l'action "${btn.text}"...` });
      const res = await api.clickTelegramCallback(selectedChatId, msg.id, btn.callbackData);
      if (res.success) {
        setFeedback({
          type: 'success',
          message: res.message || `Action "${btn.text}" exécutée avec succès.`
        });
        if (res.url) {
          window.open(res.url, '_blank', 'noopener,noreferrer');
        }
      } else {
        setFeedback({ type: 'error', message: res.error || 'Échec action callback' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      if (btnKey) setActiveCallbackKey(null);
    }
  };

  const handleForwardMessage = async () => {
    if (!selectedChatId || !forwardModalMessage || !forwardSelectedTargetChatId) return;
    setIsForwarding(true);
    try {
      const res = await api.forwardTelegramMessages(selectedChatId, forwardSelectedTargetChatId, [
        forwardModalMessage.id
      ]);
      if (res.success) {
        setFeedback({ type: 'success', message: 'Message transféré avec succès.' });
        setForwardModalMessage(null);
        setForwardSelectedTargetChatId('');
      } else {
        setFeedback({ type: 'error', message: res.error || 'Échec du transfert' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setIsForwarding(false);
    }
  };

  const handleRoleChange = async (chatId: string, role: TelegramChatRole) => {
    try {
      await api.updateTelegramChat(chatId, { role });
      onRefresh();
    } catch {}
  };

  const handleToggleMonitored = async (chat: TelegramChat) => {
    try {
      await api.updateTelegramChat(chat.id, { monitored: !chat.monitored });
      onRefresh();
    } catch {}
  };

  const handleTogglePinned = async (chat: TelegramChat) => {
    try {
      await api.updateTelegramChat(chat.id, { isPinned: !chat.isPinned });
      onRefresh();
    } catch {}
  };

  const handleReplyButtonClick = async (btn: TelegramReplyKeyboardButton, btnKey: string) => {
    if (!selectedChatId) return;
    setActiveReplyBtnKey(btnKey);
    try {
      setFeedback({ type: 'info', message: `Exécution du bouton "${btn.text}"...` });
      const res = await api.clickTelegramReplyButton(selectedChatId, btn.text, btn.type);
      if (res.success) {
        setFeedback({ type: 'success', message: `Bouton "${btn.text}" envoyé avec succès.` });
      } else {
        setFeedback({ type: 'error', message: res.error || "Échec de l'action de bouton" });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setActiveReplyBtnKey(null);
    }
  };

  const handleBotCommandClick = async (cmd: string) => {
    if (!selectedChatId) return;
    try {
      setFeedback({ type: 'info', message: `Envoi de la commande ${cmd}...` });
      const res = await api.sendTelegramBotCommand(selectedChatId, cmd);
      if (res.success) {
        setFeedback({ type: 'success', message: `Commande ${cmd} envoyée au bot.` });
        setIsBotCommandsMenuOpen(false);
      } else {
        setFeedback({ type: 'error', message: res.error || "Échec d'envoi de la commande" });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const handleStartCall = async (type: 'AUDIO' | 'VIDEO') => {
    if (!selectedChatId) return;
    try {
      setFeedback({ type: 'info', message: `Démarrage de l'appel ${type === 'VIDEO' ? 'vidéo' : 'audio'} Telegram...` });
      const res = await api.startTelegramCall(selectedChatId, type);
      if (res.success) {
        setFeedback({ type: 'success', message: `Appel ${type === 'VIDEO' ? 'vidéo' : 'audio'} en cours de connexion...` });
      } else {
        setFeedback({ type: 'error', message: res.error || `Impossible de démarrer l'appel` });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const insertEmoji = (emoji: string) => {
    setNewMessageText(prev => prev + emoji);
    setIsEmojiPickerOpen(false);
    composerInputRef.current?.focus();
  };

  const handleShareContact = async () => {
    if (!selectedChatId) return;
    setIsAttachmentMenuOpen(false);
    try {
      setFeedback({ type: 'info', message: 'Partage du contact au bot Telegram...' });
      const res = await api.clickTelegramReplyButton(selectedChatId, 'Partager mon contact', 'request_phone');
      if (res.success) {
        setFeedback({ type: 'success', message: 'Contact partagé avec succès.' });
      } else {
        setFeedback({ type: 'error', message: res.error || 'Échec du partage de contact' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const handleShareLocation = async () => {
    if (!selectedChatId) return;
    setIsAttachmentMenuOpen(false);
    setNewMessageText(prev => (prev ? `${prev}\n[Position GPS: 48.8566° N, 2.3522° E]` : '[Position GPS: 48.8566° N, 2.3522° E]'));
    composerInputRef.current?.focus();
  };

  const insertTaskTemplate = () => {
    const template = `TASK-${Math.floor(100 + Math.random() * 900)}
PRENOM: Alexandre
NOM: Martin
TEL: +336${Math.floor(10000000 + Math.random() * 90000000)}
PASS: SecurPass${Math.floor(100 + Math.random() * 900)}!
NOTES: Inscription formulaire partenaire`;
    setNewMessageText(template);
    composerInputRef.current?.focus();
  };

  const scrollToMessage = (messageId: string) => {
    const el = document.getElementById(`tg-msg-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-indigo-500', 'bg-indigo-500/10');
      setTimeout(() => {
        el.classList.remove('ring-2', 'ring-indigo-500', 'bg-indigo-500/10');
      }, 2000);
    }
  };

  const selectedChat = chats.find(c => String(c.id) === String(selectedChatId));
  const chatCapabilities = selectedChat?.capabilities;
  const canSendMessages = chatCapabilities ? chatCapabilities.canSend : true;

  // Pinned messages list
  const pinnedMessages = useMemo(() => {
    return messages.filter(m => m.isPinned);
  }, [messages]);

  // In-Chat Search Matches Memo
  const searchMatches = useMemo(() => {
    if (!searchMessageQuery.trim()) return [];
    const q = searchMessageQuery.toLowerCase();
    return messages.filter(m => m.text?.toLowerCase().includes(q));
  }, [messages, searchMessageQuery]);

  const jumpToSearchMatch = (direction: 'next' | 'prev') => {
    if (searchMatches.length === 0) return;
    let nextIdx = direction === 'next' ? activeSearchMatchIdx + 1 : activeSearchMatchIdx - 1;
    if (nextIdx >= searchMatches.length) nextIdx = 0;
    if (nextIdx < 0) nextIdx = searchMatches.length - 1;
    setActiveSearchMatchIdx(nextIdx);
    const targetMsg = searchMatches[nextIdx];
    if (targetMsg) {
      const el = document.getElementById(`tg-msg-${targetMsg.id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-2', 'ring-indigo-500', 'bg-indigo-500/10');
        setTimeout(() => {
          el.classList.remove('ring-2', 'ring-indigo-500', 'bg-indigo-500/10');
        }, 2000);
      }
    }
  };

  // Shared Media in Current Chat
  const sharedPhotosVideos = useMemo(() => {
    return messages.filter(m => m.mediaType === 'photo' || m.mediaType === 'video');
  }, [messages]);

  const sharedFiles = useMemo(() => {
    return messages.filter(m => m.mediaType === 'document' || m.mediaType === 'audio' || m.mediaType === 'voice');
  }, [messages]);

  const sharedLinks = useMemo(() => {
    return messages.filter(m => m.text && (m.text.includes('http://') || m.text.includes('https://') || m.text.includes('t.me/')));
  }, [messages]);

  // Filter chats based on tab and search
  const filteredChats = useMemo(() => {
    return chats.filter(chat => {
      if (chatFilter === 'TASK_SOURCE' && chat.role !== 'TASK_SOURCE' && chat.role !== 'DATA_SOURCE') {
        return false;
      }
      if (chatFilter === 'GROUPS' && chat.type !== 'group' && chat.type !== 'supergroup' && chat.type !== 'channel') {
        return false;
      }
      if (chatFilter === 'DIRECT' && chat.type !== 'private' && chat.type !== 'bot') {
        return false;
      }

      if (searchChatQuery.trim()) {
        const q = searchChatQuery.toLowerCase();
        const matchTitle = chat.title?.toLowerCase().includes(q);
        const matchUsername = chat.username?.toLowerCase().includes(q);
        const matchId = String(chat.id).includes(q);
        return matchTitle || matchUsername || matchId;
      }

      return true;
    });
  }, [chats, chatFilter, searchChatQuery]);

  // Group messages by date for date headers
  const groupedMessages = useMemo(() => {
    const groups: { dateHeader: string; messages: TelegramMessage[] }[] = [];
    let currentDateHeader = '';
    let currentGroup: TelegramMessage[] = [];

    messages.forEach(msg => {
      const header = formatTimelineDateHeader(msg.date);
      if (header !== currentDateHeader) {
        if (currentGroup.length > 0) {
          groups.push({ dateHeader: currentDateHeader, messages: currentGroup });
        }
        currentDateHeader = header;
        currentGroup = [msg];
      } else {
        currentGroup.push(msg);
      }
    });

    if (currentGroup.length > 0) {
      groups.push({ dateHeader: currentDateHeader, messages: currentGroup });
    }

    return groups;
  }, [messages]);

  const getChatTypeIcon = (type: TelegramChat['type']) => {
    switch (type) {
      case 'bot':
        return <Bot className="w-3.5 h-3.5 text-emerald-400" />;
      case 'private':
        return <User className="w-3.5 h-3.5 text-cyan-400" />;
      case 'supergroup':
      case 'group':
        return <Users className="w-3.5 h-3.5 text-indigo-400" />;
      case 'channel':
        return <Hash className="w-3.5 h-3.5 text-amber-400" />;
      default:
        return <MessageSquare className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  const getMediaIcon = (mediaType?: TelegramMessage['mediaType']) => {
    switch (mediaType) {
      case 'photo':
        return <Image className="w-4 h-4 text-emerald-400" />;
      case 'video':
        return <Video className="w-4 h-4 text-indigo-400" />;
      case 'document':
        return <FileText className="w-4 h-4 text-amber-400" />;
      case 'voice':
        return <Mic className="w-4 h-4 text-purple-400" />;
      case 'audio':
        return <Music className="w-4 h-4 text-cyan-400" />;
      case 'location':
        return <MapPin className="w-4 h-4 text-rose-400" />;
      case 'contact':
        return <Phone className="w-4 h-4 text-teal-400" />;
      default:
        return null;
    }
  };

  const connectionState: TelegramConnectionState =
    telegramStatus?.state || (isTelegramConnected ? 'READY' : 'DISCONNECTED');
  const isCurrentlySyncing =
    isSyncing ||
    connectionState === 'LOADING_CHATS' ||
    connectionState === 'SYNCING' ||
    connectionState === 'INITIALIZING_CLIENT' ||
    connectionState === 'AUTHENTICATING' ||
    connectionState === 'CONNECTING';

  const isConnected = connectionState === 'READY' || connectionState === 'CONNECTED';

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] min-h-[640px] space-y-3">
      {/* Top Telegram Workspace Ribbon */}
      <div className="bg-slate-900 border border-slate-800/90 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-md">
        <div className="flex items-center space-x-3.5">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-600 to-blue-500 flex items-center justify-center text-white font-bold shadow-md shadow-indigo-500/20">
              {telegramStatus?.account?.firstName ? (
                telegramStatus.account.firstName[0]
              ) : (
                <MessageSquare className="w-5 h-5" />
              )}
            </div>
            <span
              className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-slate-900 ${
                isConnected
                  ? 'bg-emerald-500 animate-pulse'
                  : isCurrentlySyncing
                  ? 'bg-indigo-400 animate-spin'
                  : 'bg-rose-500'
              }`}
            />
          </div>

          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-white text-sm">
                {telegramStatus?.account
                  ? `${telegramStatus.account.firstName || ''} ${
                      telegramStatus.account.lastName || ''
                    }`.trim() ||
                    telegramStatus.account.username ||
                    'Compte Telegram'
                  : 'Workspace Telegram'}
              </span>
              {telegramStatus?.account?.username && (
                <span className="text-xs text-indigo-400 font-mono">@{telegramStatus.account.username}</span>
              )}
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full uppercase font-bold border ${
                  isConnected
                    ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/30'
                    : isCurrentlySyncing
                    ? 'bg-indigo-950/60 text-indigo-300 border-indigo-500/30'
                    : 'bg-rose-950/60 text-rose-300 border-rose-500/30'
                }`}
              >
                {connectionState}
              </span>
            </div>

            <p className="text-[11px] text-slate-400 font-mono flex items-center space-x-3 mt-0.5">
              <span>{chats.length} conversations synchronisées</span>
              <span>•</span>
              <span>{telegramStatus?.messagesSyncedCount || 0} messages reçus</span>
              {telegramStatus?.lastSyncTime && (
                <>
                  <span>•</span>
                  <span>Dernière synchro: {new Date(telegramStatus.lastSyncTime).toLocaleTimeString()}</span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Top Controls */}
        <div className="flex items-center space-x-2.5">
          {/* Theme Toggle (Dark / Light) */}
          <button
            onClick={toggleTheme}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition shadow-sm"
            title={isDark ? 'Passer en thème Clair' : 'Passer en thème Sombre'}
          >
            {isDark ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-indigo-400" />}
            <span>{isDark ? 'Mode Clair' : 'Mode Sombre'}</span>
          </button>

          <button
            onClick={handleSync}
            disabled={isCurrentlySyncing || !isConnected}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isCurrentlySyncing ? 'animate-spin text-indigo-400' : ''}`} />
            <span>{isCurrentlySyncing ? 'Synchronisation...' : 'Actualiser Dialogues'}</span>
          </button>

          <button
            onClick={() => onNavigateToTab('telegram')}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-xs font-semibold rounded-lg border border-indigo-500/30 transition"
          >
            <Radio className="w-3.5 h-3.5 text-indigo-400" />
            <span>Paramètres Connexion</span>
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 text-xs ${
            feedback.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
              : feedback.type === 'info'
              ? 'bg-indigo-950/40 border-indigo-500/30 text-indigo-300'
              : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
          }`}
        >
          <div className="flex items-center space-x-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            ) : feedback.type === 'info' ? (
              <Info className="w-4 h-4 text-indigo-400 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-200 font-bold px-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Dual-Pane Telegram Layout */}
      <div className="flex-1 flex bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl min-h-0 relative">
        {/* ============================================================== */}
        {/* LEFT COLUMN: CHAT LIST                                         */}
        {/* ============================================================== */}
        <div className={`w-full md:w-80 lg:w-96 flex flex-col border-r border-slate-800 bg-slate-950/90 flex-shrink-0 ${
          selectedChatId ? 'hidden md:flex' : 'flex'
        }`}>
          {/* Filter Tabs */}
          <div className="p-2 border-b border-slate-800 bg-slate-900/50 flex space-x-1">
            {(['ALL', 'TASK_SOURCE', 'GROUPS', 'DIRECT'] as ChatFilterTab[]).map(tab => (
              <button
                key={tab}
                onClick={() => setChatFilter(tab)}
                className={`flex-1 py-1.5 text-[11px] font-semibold rounded-lg transition ${
                  chatFilter === tab
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {tab === 'ALL'
                  ? 'Tous'
                  : tab === 'TASK_SOURCE'
                  ? 'Sources'
                  : tab === 'GROUPS'
                  ? 'Groupes'
                  : 'Directs'}
              </button>
            ))}
          </div>

          {/* Search bar in chat list */}
          <div className="p-2.5 border-b border-slate-800 bg-slate-950">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
              <input
                type="text"
                value={searchChatQuery}
                onChange={e => setSearchChatQuery(e.target.value)}
                placeholder="Rechercher une conversation..."
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              {searchChatQuery && (
                <button
                  onClick={() => setSearchChatQuery('')}
                  className="absolute right-2.5 top-2 text-slate-500 hover:text-slate-300 text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Chat List Scrollable Items */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-900 scrollbar-thin scrollbar-thumb-slate-800">
            {filteredChats.length === 0 ? (
              <div className="p-6 text-center text-slate-500 space-y-2">
                <MessageSquare className="w-8 h-8 mx-auto text-slate-600" />
                <p className="text-xs font-semibold">Aucune conversation trouvée</p>
                <button
                  onClick={handleSync}
                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md text-xs font-semibold border border-slate-700"
                >
                  <RefreshCw className="w-3 h-3" /> Relancer synchro
                </button>
              </div>
            ) : (
              filteredChats.map(chat => {
                const isSelected = String(chat.id) === String(selectedChatId);

                return (
                  <div
                    key={chat.id}
                    onClick={() => setSelectedChatId(chat.id)}
                    className={`px-3.5 py-3 cursor-pointer transition flex items-start space-x-3 select-none ${
                      isSelected
                        ? 'bg-indigo-600/20 border-l-4 border-indigo-500'
                        : 'hover:bg-slate-900/60 border-l-4 border-transparent'
                    }`}
                  >
                    {/* Avatar with Real Photo Support */}
                    <div className="relative flex-shrink-0">
                      <ChatAvatar chat={chat} size="md" />
                      {chat.isPinned && (
                        <div className="absolute -top-1 -left-1 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center text-slate-950 shadow">
                          <Pin className="w-2.5 h-2.5 fill-current" />
                        </div>
                      )}
                    </div>

                    {/* Chat Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <div className="flex items-center space-x-1.5 truncate">
                          <span className="font-semibold text-slate-100 text-xs truncate">{chat.title}</span>
                          {getChatTypeIcon(chat.type)}
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono whitespace-nowrap">
                          {formatMessageTime(chat.lastMessageDate)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-1">
                        <p className="text-[11px] text-slate-400 truncate flex-1">
                          {chat.lastMessage || <span className="text-slate-600 italic">Aucun message</span>}
                        </p>

                        <div className="flex items-center space-x-1 flex-shrink-0">
                          {chat.role === 'TASK_SOURCE' && (
                            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              SOURCE
                            </span>
                          )}
                          {typeof chat.unreadCount === 'number' && chat.unreadCount > 0 && (
                            <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded-full bg-indigo-600 text-white min-w-[18px] text-center">
                              {chat.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ============================================================== */}
        {/* RIGHT COLUMN: ACTIVE CHAT TIMELINE & MESSAGES                  */}
        {/* ============================================================== */}
        <div className={`flex-1 flex flex-col min-w-0 bg-slate-900/90 relative ${
          !selectedChatId ? 'hidden md:flex' : 'flex'
        }`}>
          {!selectedChat ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-500 shadow-xl">
                <MessageSquare className="w-8 h-8" />
              </div>
              <div className="space-y-1 max-w-sm">
                <h3 className="text-base font-bold text-white">Sélectionnez une discussion Telegram</h3>
                <p className="text-xs text-slate-400">
                  Choisissez une conversation pour interagir en direct, gérer les messages et surveiller les tâches.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Chat View Header */}
              <div className="px-4 md:px-5 py-3 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between gap-3 shadow-sm z-10">
                <div
                  className="flex items-center space-x-2.5 min-w-0 cursor-pointer hover:opacity-90 transition"
                  onClick={() => {
                    setIsChatInfoOpen(!isChatInfoOpen);
                    if (!isChatInfoOpen && selectedChatId) {
                      loadChatFullInfo(selectedChatId);
                    }
                  }}
                  title="Afficher les détails de la conversation"
                >
                  {/* Mobile Back Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedChatId(null);
                    }}
                    className="md:hidden p-1.5 -ml-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                    title="Retour à la liste"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>

                  <ChatAvatar chat={selectedChat} size="md" />

                  <div className="min-w-0">
                    <div className="flex items-center space-x-2 truncate">
                      <h3 className="font-bold text-white text-sm truncate">{selectedChat.title}</h3>
                      {selectedChat.username && (
                        <span className="text-xs text-indigo-400 font-mono">@{selectedChat.username}</span>
                      )}
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 uppercase flex items-center gap-1">
                        {getChatTypeIcon(selectedChat.type)}
                        {selectedChat.type}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-mono">
                      ID: {selectedChat.id}
                      {selectedChat.participantsCount
                        ? ` • ${selectedChat.participantsCount} membres`
                        : ''}
                    </p>
                  </div>
                </div>

                {/* Chat Control Actions */}
                <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                  {/* Search inside this chat */}
                  <div className="relative">
                    {isSearchMessageOpen ? (
                      <div className="flex items-center space-x-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-0.5 shadow-md">
                        <Search className="w-3.5 h-3.5 text-slate-400" />
                        <input
                          type="text"
                          value={searchMessageQuery}
                          onChange={e => setSearchMessageQuery(e.target.value)}
                          placeholder="Rechercher..."
                          autoFocus
                          className="w-32 bg-transparent text-xs text-slate-200 focus:outline-none placeholder-slate-500"
                        />
                        {searchMatches.length > 0 && (
                          <span className="text-[10px] text-slate-400 font-mono px-1 whitespace-nowrap">
                            {activeSearchMatchIdx + 1}/{searchMatches.length}
                          </span>
                        )}
                        {searchMatches.length > 0 && (
                          <div className="flex items-center space-x-0.5 border-l border-slate-700 pl-1">
                            <button
                              type="button"
                              onClick={() => jumpToSearchMatch('prev')}
                              className="p-0.5 hover:bg-slate-800 rounded text-slate-300"
                              title="Résultat précédent"
                            >
                              <ChevronUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => jumpToSearchMatch('next')}
                              className="p-0.5 hover:bg-slate-800 rounded text-slate-300"
                              title="Résultat suivant"
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                        <button
                          onClick={() => {
                            setIsSearchMessageOpen(false);
                            setSearchMessageQuery('');
                          }}
                          className="text-xs text-slate-400 hover:text-white px-1 ml-0.5"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setIsSearchMessageOpen(true)}
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 text-xs transition"
                        title="Rechercher des messages"
                      >
                        <Search className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Audio & Video Call buttons for private chats */}
                  {selectedChat.type === 'private' && (
                    <>
                      <button
                        onClick={() => handleStartCall('AUDIO')}
                        className="p-1.5 bg-slate-800 hover:bg-emerald-950/60 text-slate-300 hover:text-emerald-300 rounded-lg border border-slate-700 hover:border-emerald-500/40 text-xs transition flex items-center gap-1"
                        title="Lancer un appel vocal Telegram"
                      >
                        <Phone className="w-4 h-4 text-emerald-400" />
                        <span className="hidden xl:inline text-[11px] font-medium">Appel</span>
                      </button>

                      <button
                        onClick={() => handleStartCall('VIDEO')}
                        className="p-1.5 bg-slate-800 hover:bg-indigo-950/60 text-slate-300 hover:text-indigo-300 rounded-lg border border-slate-700 hover:border-indigo-500/40 text-xs transition flex items-center gap-1"
                        title="Lancer un appel vidéo Telegram"
                      >
                        <Video className="w-4 h-4 text-indigo-400" />
                        <span className="hidden xl:inline text-[11px] font-medium">Vidéo</span>
                      </button>
                    </>
                  )}

                  {/* Pin toggle */}
                  <button
                    onClick={() => handleTogglePinned(selectedChat)}
                    className={`p-1.5 rounded-lg border text-xs transition ${
                      selectedChat.isPinned
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border-slate-700'
                    }`}
                    title={selectedChat.isPinned ? 'Détacher le chat' : 'Épingler en haut'}
                  >
                    <Pin className="w-4 h-4" />
                  </button>

                  {/* Monitoring Toggle */}
                  <button
                    onClick={() => handleToggleMonitored(selectedChat)}
                    className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
                      selectedChat.monitored
                        ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/30'
                        : 'bg-slate-800/80 text-slate-400 border-slate-700'
                    }`}
                  >
                    <Flame className={`w-3.5 h-3.5 ${selectedChat.monitored ? 'text-emerald-400' : 'text-slate-500'}`} />
                    <span>{selectedChat.monitored ? 'Écoute Active' : 'Écoute Off'}</span>
                  </button>

                  {/* Role Selector */}
                  <select
                    value={selectedChat.role}
                    onChange={e => handleRoleChange(selectedChat.id, e.target.value as TelegramChatRole)}
                    className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="TASK_SOURCE">Rôle: Source Tâches</option>
                    <option value="DATA_SOURCE">Rôle: Source Données</option>
                    <option value="RESULT_SOURCE">Rôle: Résultat / Logs</option>
                    <option value="VALIDATION_SOURCE">Rôle: Validation</option>
                    <option value="SUPPORT">Rôle: Support</option>
                    <option value="OTHER">Rôle: Autre</option>
                  </select>

                  {/* Info Toggle */}
                  <button
                    onClick={() => {
                      setIsChatInfoOpen(!isChatInfoOpen);
                      if (!isChatInfoOpen && selectedChatId) {
                        loadChatFullInfo(selectedChatId);
                      }
                    }}
                    className={`p-1.5 rounded-lg border text-xs transition ${
                      isChatInfoOpen
                        ? 'bg-indigo-600 text-white border-indigo-500'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                    }`}
                    title="Informations du chat"
                  >
                    <Info className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => loadChatMessages(selectedChat.id, searchMessageQuery || undefined)}
                    disabled={isLoadingMessages}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 text-xs transition"
                    title="Actualiser messages"
                  >
                    <RefreshCw className={`w-4 h-4 ${isLoadingMessages ? 'animate-spin text-indigo-400' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Pinned Messages Strip (if any) */}
              {pinnedMessages.length > 0 && (
                <div className="bg-indigo-950/60 border-b border-indigo-500/20 px-4 py-2 flex items-center justify-between gap-2 text-xs text-indigo-200">
                  <div
                    className="flex items-center space-x-2 truncate cursor-pointer hover:underline"
                    onClick={() => scrollToMessage(pinnedMessages[pinnedMessages.length - 1].id)}
                  >
                    <Pin className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                    <span className="font-bold text-amber-300">Message épinglé :</span>
                    <span className="truncate text-slate-200">
                      {pinnedMessages[pinnedMessages.length - 1].text || '[Média]'}
                    </span>
                  </div>
                  <span className="text-[10px] text-indigo-300/70 font-mono flex-shrink-0">
                    {pinnedMessages.length} épinglé(s)
                  </span>
                </div>
              )}

              {/* Main Timeline & Optional Info Sidebar */}
              <div className="flex-1 flex overflow-hidden relative">
                {/* Floating Unread Messages Pill */}
                {newMessagesCount > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                      setNewMessagesCount(0);
                    }}
                    className="absolute bottom-4 right-6 z-30 px-3.5 py-1.5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-2xl flex items-center gap-1.5 animate-bounce border border-indigo-400 cursor-pointer"
                  >
                    <span>↓ {newMessagesCount} nouveau{newMessagesCount > 1 ? 'x' : ''}</span>
                  </button>
                )}

                {/* Message Timeline Area */}
                <div
                  ref={timelineContainerRef}
                  onScroll={handleTimelineScroll}
                  className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-800"
                >
                  {isLoadingMessages && messages.length === 0 ? (
                    <div className="py-20 text-center space-y-3">
                      <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin mx-auto" />
                      <p className="text-xs font-semibold text-slate-300">
                        Chargement des messages de {selectedChat.title}...
                      </p>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="py-20 text-center space-y-3">
                      <MessageSquare className="w-8 h-8 text-slate-600 mx-auto" />
                      <p className="text-xs font-semibold text-slate-400">No messages in this chat.</p>
                      <p className="text-[11px] text-slate-500">
                        Envoyez un message ci-dessous ou insérez un modèle de tâche RFC.
                      </p>
                    </div>
                  ) : (
                    <>
                      {hasMoreMessages && (
                        <div className="text-center pb-2">
                          <button
                            onClick={handleLoadOlderMessages}
                            disabled={isLoadingOlder}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 rounded-full text-[11px] font-semibold border border-slate-700 transition shadow-sm"
                          >
                            {isLoadingOlder && <RefreshCw className="w-3 h-3 animate-spin text-indigo-400" />}
                            <span>{isLoadingOlder ? 'Chargement...' : 'Charger les messages plus anciens'}</span>
                          </button>
                        </div>
                      )}

                      {groupedMessages.map((group, gIdx) => (
                        <div key={gIdx} className="space-y-3">
                          {/* Date Divider */}
                          <div className="flex items-center justify-center my-3">
                            <span className="px-3 py-0.5 rounded-full bg-slate-800/90 text-slate-400 text-[10px] font-semibold uppercase tracking-wider border border-slate-700/60 shadow-sm">
                              {group.dateHeader}
                            </span>
                          </div>

                          {/* Messages in Group */}
                          {group.messages.map(msg => {
                            const isOut = msg.isOutgoing;
                            const hasMedia = !!msg.mediaType;
                            const isService = !!msg.serviceAction;

                            // Render Service Message Capsule
                            if (isService && msg.serviceAction) {
                              return (
                                <div key={msg.id} id={`tg-msg-${msg.id}`} className="flex justify-center my-2">
                                  <div className="px-3.5 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-[11px] text-slate-300 font-mono flex items-center space-x-1.5 shadow-sm">
                                    <Pin className="w-3 h-3 text-amber-400" />
                                    <span>{msg.serviceAction.text}</span>
                                    <span className="text-[9px] text-slate-500">
                                      {formatMessageTime(msg.date)}
                                    </span>
                                  </div>
                                </div>
                              );
                            }

                            // Render Standard Message Bubble
                            return (
                              <div
                                key={msg.id}
                                id={`tg-msg-${msg.id}`}
                                className={`group relative flex flex-col ${
                                  isOut ? 'items-end' : 'items-start'
                                } max-w-full transition-all duration-300`}
                              >
                                <div
                                  className={`relative rounded-2xl px-4 py-2.5 max-w-[85%] md:max-w-[70%] space-y-1.5 shadow-md ${
                                    isOut
                                      ? 'bg-indigo-600 text-white rounded-br-none'
                                      : 'bg-slate-800 text-slate-100 rounded-bl-none border border-slate-700/60'
                                  }`}
                                >
                                  {/* Forward Header */}
                                  {msg.forwardInfo && (
                                    <div className="flex items-center space-x-1 text-[10px] text-indigo-300 font-mono italic pb-0.5 border-b border-white/10">
                                      <CornerUpRight className="w-3 h-3" />
                                      <span>Transféré de {msg.forwardInfo.fromName || 'Canal'}</span>
                                    </div>
                                  )}

                                  {/* Sender header if incoming in group */}
                                  {!isOut && msg.senderName && (
                                    <div className="flex items-center space-x-1.5 text-[11px] font-bold text-indigo-400">
                                      <span>{msg.senderName}</span>
                                      {msg.senderUsername && (
                                        <span className="text-[10px] text-slate-400 font-normal">
                                          @{msg.senderUsername}
                                        </span>
                                      )}
                                    </div>
                                  )}

                                  {/* Reply Reference Box (clickable) */}
                                  {msg.replyToMessageId && (
                                    <div
                                      onClick={() => scrollToMessage(msg.replyToMessageId!)}
                                      className="p-1.5 px-2 rounded bg-black/20 border-l-2 border-indigo-300 text-[11px] text-slate-200 cursor-pointer hover:bg-black/30 transition truncate"
                                      title="Aller au message original"
                                    >
                                      <div className="font-bold text-[10px] text-indigo-300 flex items-center gap-1">
                                        <Reply className="w-2.5 h-2.5" />
                                        Réponse au message #{msg.replyToMessageId}
                                      </div>
                                    </div>
                                  )}

                                  {/* Real Media Rendering (Photos, Videos, Audio/Voice, Documents) */}
                                  {hasMedia && (
                                    <div className="space-y-1.5 pt-0.5">
                                      {msg.mediaType === 'photo' && (
                                        <div className="rounded-xl overflow-hidden max-w-sm border border-black/20 bg-black/30">
                                          <img
                                            src={`/api/telegram/chats/${encodeURIComponent(selectedChat.id)}/messages/${encodeURIComponent(msg.id)}/media`}
                                            alt="Photo Telegram"
                                            loading="lazy"
                                            className="w-full max-h-72 object-contain hover:scale-[1.01] transition cursor-pointer"
                                            onError={(e) => {
                                              (e.target as HTMLElement).style.display = 'none';
                                            }}
                                          />
                                        </div>
                                      )}
                                      {msg.mediaType === 'video' && (
                                        <div className="rounded-xl overflow-hidden max-w-sm border border-black/20 bg-black/40">
                                          <video
                                            src={`/api/telegram/chats/${encodeURIComponent(selectedChat.id)}/messages/${encodeURIComponent(msg.id)}/media`}
                                            controls
                                            className="w-full max-h-72 rounded-lg"
                                          />
                                        </div>
                                      )}
                                      {(msg.mediaType === 'voice' || msg.mediaType === 'audio') && (
                                        <div className="rounded-xl p-2 bg-black/25 border border-white/10 flex items-center space-x-2 max-w-xs">
                                          <Mic className="w-4 h-4 text-indigo-300 flex-shrink-0" />
                                          <audio
                                            src={`/api/telegram/chats/${encodeURIComponent(selectedChat.id)}/messages/${encodeURIComponent(msg.id)}/media`}
                                            controls
                                            className="w-full h-7 text-xs"
                                          />
                                        </div>
                                      )}
                                      {msg.mediaType === 'document' && (
                                        <a
                                          href={`/api/telegram/chats/${encodeURIComponent(selectedChat.id)}/messages/${encodeURIComponent(msg.id)}/media`}
                                          download
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="flex items-center space-x-2.5 p-2 rounded-xl bg-black/25 border border-white/10 hover:bg-black/40 transition group"
                                        >
                                          <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-300">
                                            <FileText className="w-4 h-4" />
                                          </div>
                                          <div className="min-w-0 flex-1">
                                            <p className="text-[11px] font-semibold text-slate-100 truncate group-hover:text-indigo-200">
                                              Document #{msg.id}
                                            </p>
                                            <span className="text-[9px] text-slate-400 font-mono">Télécharger fichier</span>
                                          </div>
                                          <Download className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-200 flex-shrink-0" />
                                        </a>
                                      )}
                                      {msg.mediaType !== 'photo' && msg.mediaType !== 'video' && msg.mediaType !== 'voice' && msg.mediaType !== 'audio' && msg.mediaType !== 'document' && (
                                        <div className="flex items-center space-x-2 py-1 px-2 rounded bg-black/20 text-xs">
                                          {getMediaIcon(msg.mediaType)}
                                          <span className="capitalize font-medium text-slate-200">
                                            [{msg.mediaType || 'Média'}]
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {/* Text Body */}
                                  {msg.text && (
                                    <div className="text-xs whitespace-pre-wrap leading-relaxed break-words font-sans">
                                      {msg.text}
                                    </div>
                                  )}

                                  {/* Real Inline Keyboard Buttons */}
                                  {msg.inlineButtons && msg.inlineButtons.length > 0 && (
                                    <div className="pt-2 space-y-1.5">
                                      {msg.inlineButtons.map((row, rIdx) => (
                                        <div key={rIdx} className="flex flex-wrap gap-1.5">
                                          {row.map((btn, bIdx) => {
                                            const btnKey = `${msg.id}_${rIdx}_${bIdx}`;
                                            const isCurrentExecuting = activeCallbackKey === btnKey;

                                            if (btn.type === 'url' && btn.url) {
                                              return (
                                                <a
                                                  key={bIdx}
                                                  href={btn.url}
                                                  target="_blank"
                                                  rel="noreferrer"
                                                  className="flex-1 min-w-[80px] py-1.5 px-2.5 bg-black/25 hover:bg-black/40 text-slate-100 rounded-lg text-[11px] font-semibold text-center border border-white/10 transition flex items-center justify-center gap-1 shadow-sm"
                                                >
                                                  <span>{btn.text}</span>
                                                  <ExternalLink className="w-3 h-3 text-slate-400" />
                                                </a>
                                              );
                                            }

                                            if (btn.type === 'web_app' && btn.webAppUrl) {
                                              return (
                                                <a
                                                  key={bIdx}
                                                  href={btn.webAppUrl}
                                                  target="_blank"
                                                  rel="noreferrer"
                                                  className="flex-1 min-w-[80px] py-1.5 px-2.5 bg-indigo-950/40 hover:bg-indigo-900/60 text-indigo-200 rounded-lg text-[11px] font-semibold text-center border border-indigo-500/30 transition flex items-center justify-center gap-1 shadow-sm"
                                                >
                                                  <span>{btn.text}</span>
                                                  <ExternalLink className="w-3 h-3 text-indigo-400" />
                                                </a>
                                              );
                                            }

                                            if (btn.type === 'switch_inline') {
                                              return (
                                                <button
                                                  key={bIdx}
                                                  type="button"
                                                  onClick={() => setNewMessageText(btn.callbackData || '')}
                                                  className="flex-1 min-w-[80px] py-1.5 px-2.5 bg-black/25 hover:bg-black/40 text-slate-100 rounded-lg text-[11px] font-semibold text-center border border-white/10 transition flex items-center justify-center gap-1 shadow-sm active:scale-95"
                                                >
                                                  <span>{btn.text}</span>
                                                </button>
                                              );
                                            }

                                            return (
                                              <button
                                                key={bIdx}
                                                type="button"
                                                disabled={isCurrentExecuting}
                                                onClick={() => handleCallbackClick(msg, btn, btnKey)}
                                                className={`flex-1 min-w-[80px] py-1.5 px-2.5 bg-black/25 hover:bg-black/40 text-slate-100 rounded-lg text-[11px] font-semibold text-center border border-white/10 transition flex items-center justify-center gap-1 shadow-sm active:scale-95 ${
                                                  isCurrentExecuting ? 'opacity-60 cursor-wait' : ''
                                                }`}
                                              >
                                                {isCurrentExecuting ? (
                                                  <RefreshCw className="w-3 h-3 animate-spin text-indigo-400" />
                                                ) : null}
                                                <span>{btn.text}</span>
                                              </button>
                                            );
                                          })}
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {/* Task Ingestion Callout Card */}
                                  {msg.isTaskDetected && (
                                    <div className="mt-2 p-2.5 rounded-xl bg-amber-950/60 border border-amber-500/40 text-amber-200 text-[11px] space-y-1.5 shadow-inner">
                                      <div className="flex items-center justify-between gap-1 font-bold text-amber-300 font-mono">
                                        <span className="flex items-center gap-1">
                                          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                                          TÂCHE DÉTECTÉE #{msg.detectedTaskId || 'INGÉRÉE'}
                                        </span>
                                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                          PARSÉE
                                        </span>
                                      </div>
                                      <p className="text-amber-200/80 text-[10px]">
                                        Cette instruction Telegram a été analysée et ajoutée à la file d'attente
                                        des tâches d'automatisation.
                                      </p>
                                      <button
                                        onClick={() => onNavigateToTab('tasks')}
                                        className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-amber-300 hover:text-white underline"
                                      >
                                        Ouvrir dans la file d'attente →
                                      </button>
                                    </div>
                                  )}

                                  {/* Message Footer: Time + Views + Checkmarks */}
                                  <div
                                    className={`flex items-center justify-end space-x-1.5 text-[10px] pt-0.5 ${
                                      isOut ? 'text-indigo-200' : 'text-slate-400'
                                    }`}
                                  >
                                    {msg.isPinned && <Pin className="w-2.5 h-2.5 text-amber-400 fill-current" />}
                                    {msg.isEdited && <span className="italic text-[9px]">modifié</span>}
                                    {typeof msg.views === 'number' && (
                                      <span className="flex items-center gap-0.5 text-[9px]">
                                        <Eye className="w-2.5 h-2.5" />
                                        {msg.views}
                                      </span>
                                    )}
                                    <span>{formatMessageTime(msg.date)}</span>
                                    {isOut && <CheckCheck className="w-3 h-3 text-indigo-200" />}
                                  </div>

                                  {/* Reactions Counter Bar */}
                                  {msg.reactions && msg.reactions.length > 0 && (
                                    <div className="flex flex-wrap gap-1 pt-1">
                                      {msg.reactions.map((r, rIdx) => (
                                        <button
                                          key={rIdx}
                                          type="button"
                                          onClick={() => handleReactMessage(msg, r.emoticon)}
                                          className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs transition border ${
                                            r.chosen
                                              ? 'bg-indigo-600/50 border-indigo-400 text-white font-bold'
                                              : 'bg-black/25 border-white/10 text-slate-300 hover:bg-black/40'
                                          }`}
                                        >
                                          <span>{r.emoticon}</span>
                                          <span className="text-[10px] font-mono">{r.count}</span>
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                {/* Floating Action Buttons on Hover */}
                                <div
                                  className={`opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-1 mt-1 px-1 text-slate-400 text-xs`}
                                >
                                  {/* Quick Reaction Button */}
                                  {msg.canReact !== false && (
                                    <div className="relative">
                                      <button
                                        type="button"
                                        onClick={e => {
                                          e.stopPropagation();
                                          setActiveReactionPickerMsgId(
                                            activeReactionPickerMsgId === msg.id ? null : msg.id
                                          );
                                          setActiveContextMenuMsgId(null);
                                        }}
                                        className="p-1 rounded hover:bg-slate-800 hover:text-white transition"
                                        title="Ajouter une réaction"
                                      >
                                        <Smile className="w-3.5 h-3.5" />
                                      </button>

                                      {/* Reaction Picker Popup */}
                                      {activeReactionPickerMsgId === msg.id && (
                                        <div
                                          onClick={e => e.stopPropagation()}
                                          className={`absolute ${
                                            isOut ? 'right-0' : 'left-0'
                                          } bottom-7 bg-slate-900 border border-slate-700 rounded-full px-2 py-1 shadow-2xl z-30 flex items-center space-x-1`}
                                        >
                                          {REACTION_EMOJIS.map(emoji => (
                                            <button
                                              key={emoji}
                                              onClick={() => handleReactMessage(msg, emoji)}
                                              className="p-1 hover:scale-125 transition transform text-sm"
                                            >
                                              {emoji}
                                            </button>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {/* Reply button */}
                                  {msg.canReply !== false && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setReplyingToMessage(msg);
                                        setEditingMessage(null);
                                        composerInputRef.current?.focus();
                                      }}
                                      className="p-1 rounded hover:bg-slate-800 hover:text-white transition"
                                      title="Répondre"
                                    >
                                      <Reply className="w-3.5 h-3.5" />
                                    </button>
                                  )}

                                  {/* Edit button */}
                                  {msg.canEdit && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingMessage(msg);
                                        setReplyingToMessage(null);
                                        setNewMessageText(msg.text || '');
                                        composerInputRef.current?.focus();
                                      }}
                                      className="p-1 rounded hover:bg-slate-800 hover:text-white transition"
                                      title="Modifier le message"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}

                                  {/* Pin button */}
                                  {msg.canPin !== false && (
                                    <button
                                      type="button"
                                      onClick={() => handlePinMessage(msg)}
                                      className="p-1 rounded hover:bg-slate-800 hover:text-white transition"
                                      title={msg.isPinned ? 'Détacher' : 'Épingler'}
                                    >
                                      <Pin className="w-3.5 h-3.5" />
                                    </button>
                                  )}

                                  {/* Forward button */}
                                  {msg.canForward !== false && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setForwardModalMessage(msg);
                                      }}
                                      className="p-1 rounded hover:bg-slate-800 hover:text-white transition"
                                      title="Transférer"
                                    >
                                      <Share2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}

                                  {/* Delete button */}
                                  {msg.canDelete && (
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteMessage(msg)}
                                      className="p-1 rounded hover:bg-rose-900/50 hover:text-rose-400 transition"
                                      title="Supprimer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </>
                  )}
                </div>

                {/* Right Chat Information Panel with Tabs */}
                {isChatInfoOpen && (
                  <div className="w-80 border-l border-slate-800 bg-slate-950 p-3.5 flex flex-col space-y-3 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800">
                    <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                      <h4 className="font-bold text-white text-xs uppercase tracking-wider font-mono">
                        Détails Conversation
                      </h4>
                      <button
                        onClick={() => setIsChatInfoOpen(false)}
                        className="text-slate-400 hover:text-white text-xs p-1"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="text-center space-y-1.5 py-1">
                      <ChatAvatar chat={selectedChat} size="xl" className="mx-auto" />
                      <div>
                        <h3 className="font-bold text-white text-sm truncate">{selectedChat.title}</h3>
                        {selectedChat.username && (
                          <p className="text-xs text-indigo-400 font-mono">@{selectedChat.username}</p>
                        )}
                        <p className="text-[10px] text-slate-500 font-mono">
                          ID: {selectedChat.id} {selectedChat.participantsCount ? `• ${selectedChat.participantsCount} membres` : ''}
                        </p>
                      </div>
                    </div>

                    {/* Drawer Navigation Tabs */}
                    <div className="flex rounded-lg bg-slate-900 p-0.5 text-[11px] font-semibold border border-slate-800">
                      <button
                        type="button"
                        onClick={() => setInfoTab('info')}
                        className={`flex-1 py-1 text-center rounded-md transition ${
                          infoTab === 'info' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Infos
                      </button>
                      <button
                        type="button"
                        onClick={() => setInfoTab('media')}
                        className={`flex-1 py-1 text-center rounded-md transition ${
                          infoTab === 'media' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Médias ({sharedPhotosVideos.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setInfoTab('files')}
                        className={`flex-1 py-1 text-center rounded-md transition ${
                          infoTab === 'files' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Fichiers ({sharedFiles.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setInfoTab('links')}
                        className={`flex-1 py-1 text-center rounded-md transition ${
                          infoTab === 'links' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Liens ({sharedLinks.length})
                      </button>
                    </div>

                    {/* Tab 1: General Info & Bot Commands */}
                    {infoTab === 'info' && (
                      <div className="space-y-3">
                        {/* About / Description */}
                        {(chatFullInfo?.about || selectedChat.about) && (
                          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-2.5 space-y-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase font-mono">
                              Description
                            </span>
                            <p className="text-xs text-slate-200 whitespace-pre-wrap leading-relaxed">
                              {chatFullInfo?.about || selectedChat.about}
                            </p>
                          </div>
                        )}

                        {/* Bot Commands List (if bot) */}
                        {chatFullInfo?.botCommands && chatFullInfo.botCommands.length > 0 && (
                          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-2.5 space-y-2">
                            <span className="text-[10px] font-bold text-emerald-400 uppercase font-mono flex items-center gap-1">
                              <Terminal className="w-3 h-3" />
                              Commandes Bot Disponibles
                            </span>
                            <div className="space-y-1 max-h-48 overflow-y-auto">
                              {chatFullInfo.botCommands.map((cmd, idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => {
                                    setNewMessageText(cmd.command);
                                    composerInputRef.current?.focus();
                                  }}
                                  className="w-full text-left p-1.5 rounded hover:bg-slate-800 transition flex items-center justify-between text-xs group"
                                >
                                  <span className="font-mono font-bold text-indigo-300 group-hover:text-indigo-200">
                                    {cmd.command}
                                  </span>
                                  <span className="text-[10px] text-slate-400 truncate max-w-[110px]">
                                    {cmd.description}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Capabilities Summary */}
                        {chatCapabilities && (
                          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-2.5 space-y-2">
                            <span className="text-[10px] font-bold text-indigo-400 uppercase font-mono flex items-center gap-1">
                              <ShieldCheck className="w-3 h-3" />
                              Permissions Telegram Réelles
                            </span>
                            <div className="grid grid-cols-2 gap-1.5 text-[11px] font-mono">
                              <div className="flex items-center space-x-1.5 text-slate-300">
                                {chatCapabilities.canSend ? (
                                  <Check className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <X className="w-3 h-3 text-rose-400" />
                                )}
                                <span>Publier</span>
                              </div>
                              <div className="flex items-center space-x-1.5 text-slate-300">
                                {chatCapabilities.canReply ? (
                                  <Check className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <X className="w-3 h-3 text-rose-400" />
                                )}
                                <span>Répondre</span>
                              </div>
                              <div className="flex items-center space-x-1.5 text-slate-300">
                                {chatCapabilities.canPin ? (
                                  <Check className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <X className="w-3 h-3 text-rose-400" />
                                )}
                                <span>Épingler</span>
                              </div>
                              <div className="flex items-center space-x-1.5 text-slate-300">
                                {chatCapabilities.isAdmin ? (
                                  <Check className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <X className="w-3 h-3 text-slate-500" />
                                )}
                                <span>Admin</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Tab 2: Shared Photos & Videos */}
                    {infoTab === 'media' && (
                      <div className="space-y-2">
                        {sharedPhotosVideos.length === 0 ? (
                          <div className="py-8 text-center text-slate-500 text-xs">
                            <Image className="w-6 h-6 mx-auto mb-1 opacity-50" />
                            Aucun média partagé dans ce chat
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-2">
                            {sharedPhotosVideos.map(m => (
                              <div
                                key={m.id}
                                onClick={() => scrollToMessage(m.id)}
                                className="p-2 bg-slate-900 border border-slate-800 rounded-lg cursor-pointer hover:border-indigo-500/50 transition space-y-1"
                              >
                                <div className="h-16 rounded bg-slate-800/80 flex items-center justify-center text-indigo-400">
                                  {m.mediaType === 'video' ? <Video className="w-6 h-6" /> : <Image className="w-6 h-6" />}
                                </div>
                                <p className="text-[10px] text-slate-400 truncate">{m.text || `Média #${m.id}`}</p>
                                <span className="text-[9px] text-slate-500 font-mono">{formatMessageTime(m.date)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Tab 3: Shared Files & Audios */}
                    {infoTab === 'files' && (
                      <div className="space-y-2">
                        {sharedFiles.length === 0 ? (
                          <div className="py-8 text-center text-slate-500 text-xs">
                            <FileText className="w-6 h-6 mx-auto mb-1 opacity-50" />
                            Aucun document partagé
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            {sharedFiles.map(m => (
                              <div
                                key={m.id}
                                onClick={() => scrollToMessage(m.id)}
                                className="p-2 bg-slate-900 border border-slate-800 rounded-lg cursor-pointer hover:border-indigo-500/50 transition flex items-center justify-between gap-2"
                              >
                                <div className="flex items-center space-x-2 truncate">
                                  <FileText className="w-4 h-4 text-amber-400 flex-shrink-0" />
                                  <div className="min-w-0">
                                    <p className="text-xs text-slate-200 truncate">{m.text || `Document #${m.id}`}</p>
                                    <span className="text-[9px] text-slate-500 font-mono">{formatMessageTime(m.date)}</span>
                                  </div>
                                </div>
                                <Download className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Tab 4: Shared Web Links */}
                    {infoTab === 'links' && (
                      <div className="space-y-2">
                        {sharedLinks.length === 0 ? (
                          <div className="py-8 text-center text-slate-500 text-xs">
                            <LinkIcon className="w-6 h-6 mx-auto mb-1 opacity-50" />
                            Aucun lien partagé
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            {sharedLinks.map(m => (
                              <div
                                key={m.id}
                                onClick={() => scrollToMessage(m.id)}
                                className="p-2 bg-slate-900 border border-slate-800 rounded-lg cursor-pointer hover:border-indigo-500/50 transition space-y-1"
                              >
                                <div className="flex items-center space-x-1.5 text-indigo-400 text-xs">
                                  <LinkIcon className="w-3 h-3 flex-shrink-0" />
                                  <span className="truncate font-mono">{m.text}</span>
                                </div>
                                <div className="flex items-center justify-between text-[9px] text-slate-500 font-mono">
                                  <span>{m.senderName || 'Message'}</span>
                                  <span>{formatMessageTime(m.date)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Persistent Bottom Chat Control Bar (RFC V6) */}
              <div className="border-t border-slate-800/90 bg-slate-950/95 backdrop-blur-md p-3 space-y-2.5 relative">
                {/* Reply Indicator Preview Bar */}
                {replyingToMessage && (
                  <div className="px-3 py-1.5 rounded-xl bg-indigo-950/70 border border-indigo-500/40 flex items-center justify-between gap-2 text-xs shadow-inner">
                    <div className="flex items-center space-x-2 truncate">
                      <Reply className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                      <span className="font-bold text-indigo-300">
                        En réponse à {replyingToMessage.senderName || 'Message'} :
                      </span>
                      <span className="text-slate-300 truncate">
                        {replyingToMessage.text || '[Média]'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReplyingToMessage(null)}
                      className="text-slate-400 hover:text-white p-0.5 rounded transition"
                      title="Annuler réponse"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Edit Mode Indicator Bar */}
                {editingMessage && (
                  <div className="px-3 py-1.5 rounded-xl bg-amber-950/70 border border-amber-500/40 flex items-center justify-between gap-2 text-xs shadow-inner">
                    <div className="flex items-center space-x-2 truncate">
                      <Edit2 className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                      <span className="font-bold text-amber-300">Modification du message :</span>
                      <span className="text-slate-300 truncate">{editingMessage.text}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingMessage(null);
                        setNewMessageText('');
                      }}
                      className="text-slate-400 hover:text-white p-0.5 rounded transition"
                      title="Annuler modification"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Channel Linked Discussion Banner */}
                {chatUIState?.hasDiscussion && chatUIState.discussionChatId && (
                  <div className="p-2 rounded-xl bg-indigo-950/40 border border-indigo-500/30 flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 text-indigo-300 font-mono text-[11px]">
                      <MessageCircle className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                      <span>Ce canal dispose d'un groupe de discussion lié.</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (chatUIState.discussionChatId) {
                          setSelectedChatId(chatUIState.discussionChatId);
                        }
                      }}
                      className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-[11px] transition shadow flex items-center gap-1"
                    >
                      <span>Ouvrir discussion</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                )}

                {/* Dynamic Real Bot Reply Keyboard (Multi-Row Grid) */}
                {chatUIState?.replyKeyboard && chatUIState.replyKeyboard.rows && chatUIState.replyKeyboard.rows.length > 0 && (
                  <div className="space-y-1.5 p-2 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl">
                    <div className="flex items-center justify-between px-1 text-[10px] text-slate-400 font-mono uppercase tracking-wider">
                      <span className="flex items-center gap-1">
                        <Terminal className="w-3 h-3 text-indigo-400" />
                        Clavier Bot Telegram Interactif
                      </span>
                      {chatUIState.replyKeyboard.placeholder && (
                        <span className="italic text-slate-500">
                          {chatUIState.replyKeyboard.placeholder}
                        </span>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      {chatUIState.replyKeyboard.rows.map((row, rIdx) => (
                        <div key={rIdx} className="flex flex-wrap gap-1.5">
                          {row.map((btn, cIdx) => {
                            const btnKey = `reply-${rIdx}-${cIdx}-${btn.text}`;
                            const isExecuting = activeReplyBtnKey === btnKey;

                            if (btn.type === 'web_app' && btn.webAppUrl) {
                              return (
                                <a
                                  key={cIdx}
                                  href={btn.webAppUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex-1 min-w-[120px] py-2 px-3 bg-slate-800/90 hover:bg-slate-700/90 text-indigo-200 rounded-xl text-xs font-semibold text-center border border-indigo-500/30 transition flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
                                >
                                  <span>{btn.text}</span>
                                  <ExternalLink className="w-3 h-3 text-indigo-400" />
                                </a>
                              );
                            }

                            return (
                              <button
                                key={cIdx}
                                type="button"
                                disabled={isExecuting}
                                onClick={() => handleReplyButtonClick(btn, btnKey)}
                                className={`flex-1 min-w-[120px] py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-xl text-xs font-semibold text-center border border-slate-700/70 transition flex items-center justify-center gap-1.5 shadow-sm active:scale-95 ${
                                  isExecuting ? 'opacity-60 cursor-wait' : ''
                                }`}
                              >
                                {isExecuting ? (
                                  <RefreshCw className="w-3 h-3 animate-spin text-indigo-400" />
                                ) : btn.type === 'request_phone' ? (
                                  <Phone className="w-3 h-3 text-emerald-400" />
                                ) : btn.type === 'request_location' ? (
                                  <MapPin className="w-3 h-3 text-amber-400" />
                                ) : null}
                                <span>{btn.text}</span>
                              </button>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Bot Commands Quick Pill Bar (if bot has commands) */}
                {((chatUIState?.botCommands && chatUIState.botCommands.length > 0) ||
                  (chatFullInfo?.botCommands && chatFullInfo.botCommands.length > 0)) && (
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-slate-800">
                    <button
                      type="button"
                      onClick={() => setIsBotCommandsMenuOpen(!isBotCommandsMenuOpen)}
                      className={`px-2 py-1 rounded-lg text-xs font-mono font-bold flex items-center gap-1 transition flex-shrink-0 border ${
                        isBotCommandsMenuOpen
                          ? 'bg-indigo-600 border-indigo-400 text-white'
                          : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-indigo-300'
                      }`}
                    >
                      <Terminal className="w-3 h-3" />
                      <span>/ Menu</span>
                      {isBotCommandsMenuOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>

                    {(chatUIState?.botCommands || chatFullInfo?.botCommands || []).slice(0, 4).map((cmd, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleBotCommandClick(cmd.command)}
                        className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-300 hover:text-white text-xs font-mono transition flex-shrink-0 shadow-sm flex items-center gap-1 active:scale-95"
                        title={cmd.description}
                      >
                        <span className="font-bold text-indigo-400">{cmd.command}</span>
                        {cmd.description && (
                          <span className="text-[10px] text-slate-500 max-w-[90px] truncate">
                            {cmd.description}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {/* Bot Commands Menu Full Dropdown Popup */}
                {isBotCommandsMenuOpen && (
                  <div className="absolute bottom-16 left-3 z-40 bg-slate-900 border border-slate-700 rounded-2xl p-2.5 max-w-sm w-80 shadow-2xl space-y-1.5">
                    <div className="flex items-center justify-between px-1 pb-1 border-b border-slate-800 text-[11px] font-bold text-slate-300 uppercase font-mono">
                      <span className="flex items-center gap-1">
                        <Terminal className="w-3 h-3 text-indigo-400" />
                        Commandes Bot Telegram
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsBotCommandsMenuOpen(false)}
                        className="text-slate-400 hover:text-white"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-1 scrollbar-thin scrollbar-thumb-slate-800">
                      {(chatUIState?.botCommands || chatFullInfo?.botCommands || []).map((cmd, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleBotCommandClick(cmd.command)}
                          className="w-full text-left p-2 rounded-xl hover:bg-slate-800 transition flex items-center justify-between text-xs group"
                        >
                          <div>
                            <span className="font-mono font-bold text-indigo-400 group-hover:text-indigo-300 block">
                              {cmd.command}
                            </span>
                            <span className="text-[10px] text-slate-400 block">
                              {cmd.description}
                            </span>
                          </div>
                          <ArrowRight className="w-3 h-3 text-slate-500 group-hover:text-indigo-400 opacity-0 group-hover:opacity-100 transition" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Attachment Menu Popup */}
                {isAttachmentMenuOpen && (
                  <div className="absolute bottom-16 left-3 z-40 bg-slate-900 border border-slate-700 rounded-2xl p-2 max-w-xs w-64 shadow-2xl space-y-1">
                    <div className="flex items-center justify-between px-2 py-1 border-b border-slate-800 text-[10px] font-bold text-slate-400 uppercase font-mono">
                      <span>Actions & Pièces jointes</span>
                      <button
                        type="button"
                        onClick={() => setIsAttachmentMenuOpen(false)}
                        className="text-slate-400 hover:text-white"
                      >
                        ✕
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAttachmentMenuOpen(false);
                        insertTaskTemplate();
                      }}
                      className="w-full text-left p-2 rounded-xl hover:bg-slate-800 text-xs text-slate-200 hover:text-white transition flex items-center gap-2.5"
                    >
                      <Sparkles className="w-4 h-4 text-indigo-400" />
                      <div>
                        <span className="font-semibold block text-slate-100">Modèle Tâche RFC</span>
                        <span className="text-[10px] text-slate-400 block">Insérer le format de tâche dans le champ</span>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={handleShareContact}
                      className="w-full text-left p-2 rounded-xl hover:bg-slate-800 text-xs text-slate-200 hover:text-white transition flex items-center gap-2.5"
                    >
                      <Phone className="w-4 h-4 text-emerald-400" />
                      <div>
                        <span className="font-semibold block text-slate-100">Partager Contact</span>
                        <span className="text-[10px] text-slate-400 block">Envoyer carte contact au bot</span>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={handleShareLocation}
                      className="w-full text-left p-2 rounded-xl hover:bg-slate-800 text-xs text-slate-200 hover:text-white transition flex items-center gap-2.5"
                    >
                      <MapPin className="w-4 h-4 text-amber-400" />
                      <div>
                        <span className="font-semibold block text-slate-100">Partager Localisation</span>
                        <span className="text-[10px] text-slate-400 block">Insérer balise GPS</span>
                      </div>
                    </button>
                  </div>
                )}

                {/* Emoji Quick Picker Popup */}
                {isEmojiPickerOpen && (
                  <div className="absolute bottom-16 left-12 z-40 bg-slate-900 border border-slate-700 rounded-2xl p-2.5 shadow-2xl">
                    <div className="flex items-center justify-between px-1 pb-1.5 border-b border-slate-800 text-[10px] font-bold text-slate-400 font-mono">
                      <span>Émojis rapides</span>
                      <button
                        type="button"
                        onClick={() => setIsEmojiPickerOpen(false)}
                        className="text-slate-400 hover:text-white ml-3"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="grid grid-cols-6 gap-1.5 pt-2">
                      {['👍', '❤️', '🔥', '👏', '🎉', '🚀', '👀', '👎', '💡', '💯', '✅', '⚠️', '❌', '⚡', '🎯', '🤖', '💼', '📌'].map(emoji => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => insertEmoji(emoji)}
                          className="p-1.5 hover:bg-slate-800 rounded-lg text-lg hover:scale-125 transition transform text-center"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Check if publishing is allowed in this chat */}
                {!canSendMessages ? (
                  <div className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800 text-center text-xs text-slate-400 flex items-center justify-center space-x-2 shadow-inner">
                    <Lock className="w-4 h-4 text-slate-500" />
                    <span>
                      {selectedChat.type === 'channel'
                        ? 'Ce canal est en diffusion directe (seuls les administrateurs peuvent publier).'
                        : "Vous n'avez pas les permissions d'écriture dans cette discussion Telegram."}
                    </span>
                  </div>
                ) : (
                  <form onSubmit={handleSendMessage} className="flex items-end space-x-2">
                    <div className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl px-3 py-2 focus-within:border-indigo-500 transition shadow-inner">
                      <textarea
                        ref={composerInputRef}
                        value={newMessageText}
                        onChange={e => setNewMessageText(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage();
                          }
                        }}
                        placeholder={`Écrire un message à ${selectedChat.title} (Entrée pour envoyer)...`}
                        rows={2}
                        className="w-full bg-transparent text-xs text-slate-200 placeholder-slate-500 focus:outline-none resize-none font-mono"
                      />

                      {/* Input Quick Bar: Attachment + Emoji + Template Shortcuts */}
                      <div className="flex items-center justify-between pt-1.5 border-t border-slate-800/70 text-[11px]">
                        <div className="flex items-center space-x-1.5">
                          {/* Attachment Button */}
                          <button
                            type="button"
                            onClick={() => {
                              setIsAttachmentMenuOpen(!isAttachmentMenuOpen);
                              setIsEmojiPickerOpen(false);
                            }}
                            className={`p-1 rounded-lg transition ${
                              isAttachmentMenuOpen
                                ? 'bg-indigo-600 text-white'
                                : 'text-slate-400 hover:text-white hover:bg-slate-800'
                            }`}
                            title="Joindre / Actions rapides"
                          >
                            <Paperclip className="w-3.5 h-3.5" />
                          </button>

                          {/* Emoji Button */}
                          <button
                            type="button"
                            onClick={() => {
                              setIsEmojiPickerOpen(!isEmojiPickerOpen);
                              setIsAttachmentMenuOpen(false);
                            }}
                            className={`p-1 rounded-lg transition ${
                              isEmojiPickerOpen
                                ? 'bg-indigo-600 text-white'
                                : 'text-slate-400 hover:text-white hover:bg-slate-800'
                            }`}
                            title="Insérer un émoji"
                          >
                            <Smile className="w-3.5 h-3.5" />
                          </button>

                          {/* Quick Template Pill */}
                          <button
                            type="button"
                            onClick={insertTaskTemplate}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-300 font-mono text-[10px] transition border border-slate-700"
                          >
                            <Sparkles className="w-3 h-3 text-indigo-400" />
                            <span>+ Modèle Tâche RFC</span>
                          </button>
                        </div>

                        <span className="text-[10px] text-slate-500 font-mono">
                          Maj + Entrée pour nouvelle ligne
                        </span>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isSending || !newMessageText.trim()}
                      className="p-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-2xl shadow-lg shadow-indigo-500/20 transition flex items-center justify-center active:scale-95"
                      title={editingMessage ? 'Enregistrer modifications' : 'Envoyer le message'}
                    >
                      <Send className={`w-4 h-4 ${isSending ? 'animate-pulse' : ''}`} />
                    </button>
                  </form>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Forward Modal */}
      {forwardModalMessage && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Share2 className="w-4 h-4 text-indigo-400" />
                Transférer le message
              </h3>
              <button
                onClick={() => setForwardModalMessage(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300">
              <span className="font-bold text-indigo-400 block mb-1">Aperçu du contenu :</span>
              <p className="truncate italic">{forwardModalMessage.text || '[Média]'}</p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300">
                Sélectionner la conversation de destination :
              </label>
              <select
                value={forwardSelectedTargetChatId}
                onChange={e => setForwardSelectedTargetChatId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
              >
                <option value="">-- Choisir une conversation --</option>
                {chats
                  .filter(c => String(c.id) !== String(selectedChatId))
                  .map(c => (
                    <option key={c.id} value={c.id}>
                      {c.title} ({c.type})
                    </option>
                  ))}
              </select>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                onClick={() => setForwardModalMessage(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
              >
                Annuler
              </button>
              <button
                onClick={handleForwardMessage}
                disabled={!forwardSelectedTargetChatId || isForwarding}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition flex items-center gap-1.5"
              >
                <Share2 className="w-3.5 h-3.5" />
                {isForwarding ? 'Transfert en cours...' : 'Transférer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
