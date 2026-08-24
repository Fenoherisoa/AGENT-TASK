import { TelegramClient, Api } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { NewMessage, NewMessageEvent } from 'telegram/events/index.js';
import { db } from './database.js';
import { logger, redactSecret } from './logger.js';
import { taskParser } from './taskParser.js';
import { sse } from './sse.js';
import { automationRunner } from './automationRunner.js';
import { callManager } from './callManager.js';
import { TelegramConnectionState, TelegramChat, TelegramMessage, TelegramCapabilities, TelegramInlineButton, TelegramReaction, TelegramForwardInfo, TelegramServiceAction, TelegramChatFullInfo, TelegramBotCommand, TelegramReplyKeyboard, TelegramParsedKeyboard, TelegramChatUIState, TelegramStructuredControl, TelegramBotMenuButton } from '../src/types/task.js';
import { telegramUIParser, telegramKeyboardParser } from './telegramUIParser.js';

const AVATAR_GRADIENTS = [
  'from-indigo-600 to-purple-600',
  'from-blue-600 to-cyan-600',
  'from-emerald-600 to-teal-600',
  'from-amber-600 to-orange-600',
  'from-rose-600 to-pink-600',
  'from-violet-600 to-fuchsia-600'
];

function getAvatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}

function resolveMediaType(msg: any): TelegramMessage['mediaType'] | undefined {
  if (!msg) return undefined;
  if (msg.photo) return 'photo';
  if (msg.video) return 'video';
  if (msg.voice) return 'voice';
  if (msg.audio) return 'audio';
  if (msg.document) return 'document';
  if (msg.sticker) return 'sticker';
  if (msg.contact) return 'contact';
  if (msg.geo) return 'location';
  return undefined;
}

export function extractInlineButtons(replyMarkup: any): TelegramInlineButton[][] | undefined {
  if (!replyMarkup) return undefined;
  const rows: any[] = replyMarkup.rows || [];
  if (!Array.isArray(rows) || rows.length === 0) return undefined;

  const result: TelegramInlineButton[][] = [];
  for (const row of rows) {
    const buttons: any[] = row.buttons || [];
    const rowButtons: TelegramInlineButton[] = [];
    for (const btn of buttons) {
      if (!btn) continue;
      let type: TelegramInlineButton['type'] = 'other';
      let url: string | undefined;
      let callbackData: string | undefined;
      let webAppUrl: string | undefined;
      let samePeer: boolean | undefined;

      if (btn.url) {
        type = 'url';
        url = btn.url;
      } else if (btn.webApp || btn.app) {
        type = 'web_app';
        webAppUrl = btn.webApp?.url || btn.app?.url || btn.url;
      } else if (btn.data !== undefined) {
        type = 'callback';
        if (Buffer.isBuffer(btn.data)) {
          callbackData = btn.data.toString('base64');
        } else {
          callbackData = Buffer.from(String(btn.data)).toString('base64');
        }
      } else if (btn.query !== undefined) {
        type = 'switch_inline';
        samePeer = Boolean(btn.samePeer);
        callbackData = btn.query;
      } else if (btn.buy) {
        type = 'buy';
      }

      rowButtons.push({
        text: btn.text || 'Action',
        type,
        url,
        callbackData,
        webAppUrl,
        samePeer
      });
    }
    if (rowButtons.length > 0) {
      result.push(rowButtons);
    }
  }

  return result.length > 0 ? result : undefined;
}

export function extractServiceAction(action: any): TelegramServiceAction | undefined {
  if (!action) return undefined;
  const className = action.className || action.constructor?.name || '';
  if (className.includes('MessageActionPinMessage') || action.pinnedMessageId) {
    return { type: 'pin', text: 'A épinglé un message', pinnedMessageId: String(action.pinnedMessageId || '') };
  }
  if (className.includes('MessageActionChatAddUser') || className.includes('MessageActionChatJoinedByLink')) {
    return { type: 'joined', text: 'A rejoint le groupe' };
  }
  if (className.includes('MessageActionChatDeleteUser')) {
    return { type: 'left', text: 'A quitté le groupe' };
  }
  if (className.includes('MessageActionChatEditTitle')) {
    return { type: 'title_changed', text: `Titre du groupe modifié : ${action.title || ''}` };
  }
  if (className.includes('MessageActionChatEditPhoto')) {
    return { type: 'photo_changed', text: 'Photo du groupe mise à jour' };
  }
  if (className.includes('MessageActionChatCreate')) {
    return { type: 'group_created', text: 'Groupe créé' };
  }
  if (className.includes('MessageActionTopicCreate')) {
    return { type: 'topic_created', text: `Topic créé : ${action.title || ''}` };
  }
  return undefined;
}

export function extractForwardInfo(fwdFrom: any): TelegramForwardInfo | undefined {
  if (!fwdFrom) return undefined;
  let fromName: string | undefined = fwdFrom.fromName;
  let fromId: string | undefined;
  if (fwdFrom.fromId) {
    fromId = fwdFrom.fromId.userId?.toString() || fwdFrom.fromId.channelId?.toString() || fwdFrom.fromId.chatId?.toString();
  }
  return {
    fromName,
    fromId,
    isChannel: Boolean(fwdFrom.channelPost),
    date: fwdFrom.date ? new Date(fwdFrom.date * 1000).toISOString() : undefined,
    originalMessageId: fwdFrom.channelPost ? String(fwdFrom.channelPost) : undefined
  };
}

export function extractReactions(reactions: any): TelegramReaction[] | undefined {
  if (!reactions || !Array.isArray(reactions.results)) return undefined;
  const list: TelegramReaction[] = [];
  for (const r of reactions.results) {
    const emoticon = r.reaction?.emoticon || r.reaction?.documentId?.toString() || '👍';
    list.push({
      emoticon,
      count: r.count || 1,
      chosen: Boolean(r.chosenOrder !== undefined && r.chosenOrder !== null)
    });
  }
  return list.length > 0 ? list : undefined;
}

export function computeChatCapabilities(chatType: TelegramChat['type'], entity: any, currentUserId?: string): TelegramCapabilities {
  const isChannel = chatType === 'channel';
  const isSupergroup = chatType === 'supergroup';
  const isGroup = chatType === 'group';
  const isBot = chatType === 'bot';
  const isPrivate = chatType === 'private';
  const isServiceChat = entity?.id?.toString() === '777000' || entity?.id?.toString() === '42777';

  let isAdmin = false;
  let canSend = true;
  let canReply = true;
  let canPin = true;
  let canDelete = false;
  let canEdit = true;
  let canForward = true;
  let canReact = true;
  let canInvite = true;
  let canManageTopics = false;

  if (isPrivate || isBot) {
    canSend = true;
    canReply = true;
    canPin = true;
    canDelete = true;
    canEdit = true;
    canForward = !entity?.noforwards;
    canReact = !isBot;
    canInvite = false;
    isAdmin = false;
  } else if (isChannel) {
    isAdmin = Boolean(entity?.creator || entity?.adminRights);
    canSend = Boolean(entity?.creator || (entity?.adminRights && entity?.adminRights?.postMessages !== false));
    canReply = Boolean(entity?.linkedChatId || isAdmin);
    canPin = Boolean(entity?.creator || (entity?.adminRights && entity?.adminRights?.pinMessages !== false));
    canDelete = isAdmin;
    canEdit = Boolean(entity?.creator || (entity?.adminRights && entity?.adminRights?.editMessages !== false));
    canForward = !entity?.noforwards;
    canReact = true;
    canInvite = Boolean(isAdmin && entity?.adminRights?.inviteUsers !== false);
  } else if (isGroup || isSupergroup) {
    isAdmin = Boolean(entity?.creator || entity?.adminRights);
    const banned = entity?.defaultBannedRights;
    canSend = Boolean(entity?.creator || !banned?.sendMessages);
    canReply = canSend;
    canPin = Boolean(entity?.creator || isAdmin || !banned?.pinMessages);
    canDelete = isAdmin;
    canEdit = true;
    canForward = !entity?.noforwards;
    canReact = true;
    canInvite = Boolean(entity?.creator || isAdmin || !banned?.inviteUsers);
    canManageTopics = Boolean(entity?.forum && (isAdmin || entity?.adminRights?.manageTopics));
  }

  if (isServiceChat) {
    canSend = false;
    canReply = false;
    canEdit = false;
    canDelete = false;
    canPin = false;
  }

  return {
    canReply,
    canSend,
    canEdit,
    canDelete,
    canForward,
    canPin,
    canReact,
    canInvite,
    canManageTopics,
    isChannel,
    isGroup,
    isSupergroup,
    isPrivate,
    isBot,
    isServiceChat,
    isAdmin
  };
}

export function normalizeTelegramMessage(
  m: any,
  chatId: string,
  chatCapabilities: TelegramCapabilities,
  currentUserId?: string
): TelegramMessage {
  const msgText = m.message || '';
  const parsed = msgText ? taskParser.parse(msgText) : null;
  const isTask = !!(parsed && parsed.success);
  const isOutgoing = Boolean(m.out);
  const serviceAction = extractServiceAction(m.action);
  const forwardInfo = extractForwardInfo(m.fwdFrom);
  const inlineButtons = extractInlineButtons(m.replyMarkup);
  const reactions = extractReactions(m.reactions);

  let senderName: string | undefined;
  let senderUsername: string | undefined;
  if (m.sender) {
    senderName = `${m.sender.firstName || ''} ${m.sender.lastName || ''}`.trim() || m.sender.username || (m.sender.title ? m.sender.title : undefined);
    senderUsername = m.sender.username;
  }

  const isService = Boolean(serviceAction);

  // Message capabilities
  const canReply = chatCapabilities.canReply && !isService;
  const canEdit = isOutgoing && !isService && (chatCapabilities.isPrivate || chatCapabilities.canSend);
  const canDelete = isOutgoing || chatCapabilities.canDelete;
  const canPin = chatCapabilities.canPin && !isService;
  const canForward = chatCapabilities.canForward && !m.noforwards;
  const canReact = chatCapabilities.canReact && !isService;

  return {
    id: String(m.id),
    chatId: String(chatId),
    senderId: m.senderId?.toString() || m.fromId?.userId?.toString() || m.fromId?.channelId?.toString(),
    senderName,
    senderUsername,
    text: msgText,
    date: m.date ? new Date(m.date * 1000).toISOString() : new Date().toISOString(),
    isOutgoing,
    mediaType: resolveMediaType(m),
    replyToMessageId: m.replyToMsgId?.toString() || m.replyTo?.replyToMsgId?.toString(),
    replyCount: m.replies?.replies,
    threadId: m.replyTo?.forumTopic ? String(m.replyTo?.replyToMsgId) : undefined,
    forwardInfo,
    serviceAction,
    inlineButtons,
    reactions,
    views: typeof m.views === 'number' ? m.views : undefined,
    forwards: typeof m.forwards === 'number' ? m.forwards : undefined,
    isEdited: Boolean(m.editDate),
    editDate: m.editDate ? new Date(m.editDate * 1000).toISOString() : undefined,
    isPinned: Boolean(m.pinned),
    canReply,
    canEdit,
    canDelete,
    canPin,
    canReact,
    canForward,
    isTaskDetected: isTask,
    detectedTaskId: parsed?.task?.telegramTaskId,
    unread: !isOutgoing && !m.read
  };
}

export interface TelegramSyncResult {
  success: boolean;
  tasksImported: number;
  chatsDiscovered: number;
  errors: string[];
}

export interface TelegramAccountInfo {
  id?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  isBot: boolean;
}

export class TelegramConnectionManager {
  private lastUpdateId = 0;
  private state: TelegramConnectionState = 'DISCONNECTED';
  private diagnosticState: string | null = null;
  private pollingTimer: NodeJS.Timeout | null = null;
  private isPolling = false;
  private isSyncing = false;
  private accountInfo: TelegramAccountInfo | null = null;
  private lastError: string | null = null;
  private lastSyncTime: string | null = null;
  private messagesSyncedCount = 0;

  // Real MTProto Client for User Accounts
  private userClient: TelegramClient | null = null;
  private isClientInitialized = false;

  // Active UI Controls & Keyboards Cache per Chat
  private chatReplyKeyboards: Map<string, TelegramReplyKeyboard | null> = new Map();
  private chatParsedKeyboards: Map<string, TelegramParsedKeyboard | null> = new Map();
  private chatBotCommands: Map<string, TelegramBotCommand[]> = new Map();
  private chatBotMenuButtons: Map<string, TelegramBotMenuButton | null> = new Map();
  private chatLinkedDiscussions: Map<string, string> = new Map();

  // Avatar & Media Cache (TTL 1hr for avatars, 6hrs for message media)
  private avatarCache: Map<string, { buffer: Buffer; mimeType: string; timestamp: number }> = new Map();
  private mediaCache: Map<string, { buffer: Buffer; mimeType: string; fileName?: string; timestamp: number }> = new Map();

  // Temporary state for interactive Phone + Code login
  private tempAuth: {
    client: TelegramClient;
    apiId: string;
    apiHash: string;
    phoneNumber: string;
    phoneCodeHash: string;
    isCodeViaApp?: boolean;
  } | null = null;

  constructor() {
    // Auto-connect if credentials exist in database
    setTimeout(() => {
      this.initConnection();
    }, 800);
  }

  private isValidSessionString(sessionStr: string): boolean {
    if (!sessionStr || typeof sessionStr !== 'string') return false;
    const clean = sessionStr.trim().replace(/^['"]|['"]$/g, '');
    if (clean.length < 10) return false;
    try {
      new StringSession(clean);
      return true;
    } catch {
      return false;
    }
  }

  private async initConnection() {
    const settings = db.getSettings();
    if (settings.telegramSession && settings.telegramSession.trim().length > 0) {
      if (this.isValidSessionString(settings.telegramSession)) {
        await this.connectUserSession({
          apiId: settings.telegramApiId || '',
          apiHash: settings.telegramApiHash || '',
          sessionString: settings.telegramSession
        });
      } else {
        logger.warn('Saved Telegram session string is invalid or expired. Resetting session credentials.', { module: 'TELEGRAM' });
        db.updateSettings({ telegramSession: '' });
        this.state = 'DISCONNECTED';
        this.lastError = 'Session Telegram précédente invalide. Veuillez renseigner une nouvelle Session String GramJS.';
        sse.broadcast('telegram:status', this.getConnectionState());
      }
    } else if (settings.telegramBotToken && settings.telegramBotToken.trim().length > 0) {
      await this.connectBot(settings.telegramBotToken);
    } else {
      this.state = 'DISCONNECTED';
    }
  }

  public getConnectionState() {
    const chats = db.getTelegramChats();
    return {
      state: this.state,
      diagnosticState: this.diagnosticState || undefined,
      accountType: this.accountInfo ? (this.accountInfo.isBot ? 'BOT' : 'USER_SESSION') : 'NONE',
      username: this.accountInfo?.username,
      accountName: `${this.accountInfo?.firstName || ''} ${this.accountInfo?.lastName || ''}`.trim() || this.accountInfo?.username,
      accountId: this.accountInfo?.id,
      error: this.lastError || undefined,
      chatCount: chats.length,
      monitoredChatCount: chats.filter(c => c.monitored).length,
      lastSyncTime: this.lastSyncTime || undefined,
      messagesSyncedCount: this.messagesSyncedCount,
      isLoadingChats: this.state === 'LOADING_CHATS' || this.state === 'SYNCING'
    };
  }

  /**
   * Send login code to a user's Telegram phone number (Interactive Auth Flow)
   */
  public async sendLoginCode(params: {
    apiId: string;
    apiHash: string;
    phoneNumber: string;
  }): Promise<{ success: boolean; phoneCodeHash?: string; isCodeViaApp?: boolean; message: string; error?: string }> {
    const apiIdNum = parseInt(params.apiId?.trim() || '0', 10);
    const apiHashClean = params.apiHash?.trim() || '';
    const phoneNumberClean = params.phoneNumber?.trim() || '';

    if (!apiIdNum || !apiHashClean) {
      return {
        success: false,
        message: 'API ID et API Hash requis',
        error: 'Veuillez saisir votre API ID et API Hash (obtenus sur https://my.telegram.org).'
      };
    }

    if (!phoneNumberClean || phoneNumberClean.length < 5) {
      return {
        success: false,
        message: 'Numéro de téléphone invalide',
        error: 'Veuillez saisir votre numéro au format international (ex: +33612345678).'
      };
    }

    this.state = 'CONNECTING';
    this.lastError = null;
    sse.broadcast('telegram:status', this.getConnectionState());

    try {
      if (this.tempAuth?.client) {
        try {
          await this.tempAuth.client.disconnect();
        } catch {}
        this.tempAuth = null;
      }

      const tempClient = new TelegramClient(new StringSession(''), apiIdNum, apiHashClean, {
        connectionRetries: 5,
        retryDelay: 2000,
        useWSS: false
      });

      await tempClient.connect();

      const sendResult = await tempClient.sendCode({
        apiId: apiIdNum,
        apiHash: apiHashClean
      }, phoneNumberClean);

      this.tempAuth = {
        client: tempClient,
        apiId: String(apiIdNum),
        apiHash: apiHashClean,
        phoneNumber: phoneNumberClean,
        phoneCodeHash: sendResult.phoneCodeHash,
        isCodeViaApp: sendResult.isCodeViaApp
      };

      this.state = 'AUTHENTICATING';
      sse.broadcast('telegram:status', this.getConnectionState());

      logger.info(`Telegram login code dispatched to ${phoneNumberClean} (via ${sendResult.isCodeViaApp ? 'App' : 'SMS'})`, { module: 'TELEGRAM' });

      return {
        success: true,
        phoneCodeHash: sendResult.phoneCodeHash,
        isCodeViaApp: sendResult.isCodeViaApp,
        message: sendResult.isCodeViaApp
          ? 'Code de vérification envoyé sur votre application Telegram !'
          : `Code de vérification envoyé par SMS au ${phoneNumberClean}.`
      };
    } catch (err: any) {
      this.state = 'ERROR';
      this.lastError = `Échec de l'envoi du code: ${err.message}`;
      logger.error(`Failed to send Telegram login code: ${err.message}`, { module: 'TELEGRAM' });
      sse.broadcast('telegram:status', this.getConnectionState());
      return {
        success: false,
        message: "Échec de l'envoi du code Telegram",
        error: err.message || "Impossible d'envoyer le code de vérification Telegram"
      };
    }
  }

  /**
   * Verify login code and complete authentication
   */
  public async verifyLoginCode(params: {
    phoneCode: string;
    password?: string;
  }): Promise<{ success: boolean; message: string; requires2FA?: boolean; sessionString?: string; error?: string }> {
    if (!this.tempAuth || !this.tempAuth.client) {
      return {
        success: false,
        message: "Aucune session d'authentification en cours",
        error: 'Veuillez d\'abord demander l\'envoi d\'un code de connexion.'
      };
    }

    const { client, apiId, apiHash, phoneNumber, phoneCodeHash } = this.tempAuth;
    const phoneCodeClean = (params.phoneCode || '').trim().replace(/\D/g, '');

    if (!phoneCodeClean) {
      return {
        success: false,
        message: 'Code requis',
        error: 'Veuillez saisir le code reçu par Telegram ou SMS.'
      };
    }

    try {
      this.state = 'AUTHENTICATING';
      sse.broadcast('telegram:status', this.getConnectionState());

      try {
        await client.invoke(new Api.auth.SignIn({
          phoneNumber,
          phoneCodeHash,
          phoneCode: phoneCodeClean
        }));
      } catch (signInErr: any) {
        if (signInErr.errorMessage === 'SESSION_PASSWORD_NEEDED') {
          if (!params.password) {
            return {
              success: false,
              requires2FA: true,
              message: 'Mot de passe 2FA requis pour ce compte Telegram.'
            };
          }

          // Sign in with 2FA password
          await client.signInWithPassword({
            apiId: parseInt(apiId, 10),
            apiHash
          }, {
            password: async () => params.password || '',
            onError: (err) => { throw err; }
          });
        } else {
          throw signInErr;
        }
      }

      const isAuthorized = await client.isUserAuthorized();
      if (!isAuthorized) {
        throw new Error('Échec d\'autorisation après la validation du code.');
      }

      const sessionString = (client.session.save() as unknown as string) || '';

      // Disconnect previous main user client if exists
      if (this.userClient && this.userClient !== client) {
        try {
          await this.userClient.disconnect();
        } catch {}
      }

      this.userClient = client;
      this.isClientInitialized = true;
      this.tempAuth = null;
      this.lastError = null;

      // Save credentials into database
      db.updateSettings({
        telegramApiId: apiId,
        telegramApiHash: apiHash,
        telegramSession: sessionString,
        telegramBotToken: ''
      });

      // Retrieve User Profile Info
      const me = (await this.userClient.getMe()) as Api.User;
      this.accountInfo = {
        id: me.id?.toString() || `user-${Date.now().toString().slice(-4)}`,
        username: me.username || undefined,
        firstName: me.firstName || undefined,
        lastName: me.lastName || undefined,
        phone: me.phone || undefined,
        isBot: !!me.bot
      };

      db.addTaskEvent(
        undefined,
        'TELEGRAM_CONNECTED',
        `Compte Telegram connecté avec succès : ${this.accountInfo.username ? '@' + this.accountInfo.username : this.accountInfo.firstName || 'Opérateur'}`
      );

      this.registerUserMessageListener();

      this.state = 'LOADING_CHATS';
      sse.broadcast('telegram:status', this.getConnectionState());

      const syncResult = await this.fetchRealUserDialogs();

      this.state = 'READY';
      sse.broadcast('telegram:status', this.getConnectionState());
      sse.broadcast('telegram:chats', { chats: db.getTelegramChats() });

      return {
        success: true,
        message: `Compte Telegram connecté avec succès (${syncResult.chatsDiscovered} discussions trouvées) !`,
        sessionString
      };
    } catch (err: any) {
      this.state = 'ERROR';
      this.lastError = `Erreur de validation: ${err.message}`;
      logger.error(`Telegram code verification failed: ${err.message}`, { module: 'TELEGRAM' });
      sse.broadcast('telegram:status', this.getConnectionState());
      return {
        success: false,
        message: 'Erreur lors de la validation du code',
        error: err.message || 'Code invalide ou expiré'
      };
    }
  }

  /**
   * Connect using Telegram User Account / Session String (MTProto GramJS)
   */
  public async connectUserSession(params: {
    apiId: string;
    apiHash: string;
    sessionString: string;
  }): Promise<{ success: boolean; message: string; error?: string }> {
    const rawSession = (params.sessionString || '').trim().replace(/^['"]|['"]$/g, '');

    if (!rawSession || rawSession.length < 10) {
      this.state = 'ERROR';
      this.lastError = 'Session string Telegram manquante ou invalide';
      sse.broadcast('telegram:status', this.getConnectionState());
      return {
        success: false,
        message: 'Session invalide',
        error: this.lastError
      };
    }

    // Step 1: CONNECTING
    this.state = 'CONNECTING';
    this.diagnosticState = null;
    this.lastError = null;
    sse.broadcast('telegram:status', this.getConnectionState());

    try {
      // Step 2: AUTHENTICATING
      this.state = 'AUTHENTICATING';
      sse.broadcast('telegram:status', this.getConnectionState());

      // Safe secret redaction in logs - Never log API hash or session string
      logger.info('Authenticating Telegram User Session via MTProto...', { module: 'TELEGRAM' });

      let stringSession: StringSession;
      try {
        stringSession = new StringSession(rawSession);
      } catch (sessErr: any) {
        this.state = 'ERROR';
        this.lastError = 'Format de Session String GramJS invalide. Les sessions GramJS débutent par le caractère "1" et sont générées via TelegramClient.session.save(). Utilisez la connexion par numéro de téléphone ci-dessus pour vous connecter facilement.';
        sse.broadcast('telegram:status', this.getConnectionState());
        return {
          success: false,
          message: 'Format de session invalide',
          error: this.lastError
        };
      }

      const apiIdNum = parseInt(params.apiId?.trim() || '0', 10) || 0;
      const apiHashClean = (params.apiHash || '').trim();

      // Disconnect previous client if any
      if (this.userClient) {
        try {
          await this.userClient.disconnect();
        } catch {}
        this.userClient = null;
      }

      // Step 3: INITIALIZING_CLIENT
      this.state = 'INITIALIZING_CLIENT';
      sse.broadcast('telegram:status', this.getConnectionState());

      this.userClient = new TelegramClient(stringSession, apiIdNum, apiHashClean, {
        connectionRetries: 5,
        retryDelay: 2000,
        useWSS: false
      });

      await this.userClient.connect();

      const isAuthorized = await this.userClient.isUserAuthorized();
      if (!isAuthorized) {
        this.state = 'ERROR';
        this.lastError = 'Session Telegram non autorisée ou expirée (veuillez régénérer votre session string ou vous connecter par téléphone)';
        this.isClientInitialized = false;
        sse.broadcast('telegram:status', this.getConnectionState());
        return {
          success: false,
          message: 'Session non autorisée',
          error: this.lastError
        };
      }

      // Retrieve User Profile Info
      const me = (await this.userClient.getMe()) as Api.User;
      this.accountInfo = {
        id: me.id?.toString() || `user-${Date.now().toString().slice(-4)}`,
        username: me.username || undefined,
        firstName: me.firstName || undefined,
        lastName: me.lastName || undefined,
        phone: me.phone || undefined,
        isBot: !!me.bot
      };

      this.isClientInitialized = true;
      this.lastError = null;

      // Save user session credentials locally
      db.updateSettings({
        telegramApiId: params.apiId,
        telegramApiHash: params.apiHash,
        telegramSession: rawSession,
        telegramBotToken: '' // Clear bot token when user session is active
      });

      db.addTaskEvent(
        undefined,
        'TELEGRAM_CONNECTED',
        `Session Utilisateur Telegram connectée : ${this.accountInfo.username ? '@' + this.accountInfo.username : this.accountInfo.firstName || 'Opérateur'}`
      );

      // Register Real-time Incoming Message Handler
      this.registerUserMessageListener();

      // Step 4: LOADING_CHATS (Automatic Synchronization)
      this.state = 'LOADING_CHATS';
      sse.broadcast('telegram:status', this.getConnectionState());

      const syncResult = await this.fetchRealUserDialogs();

      // Step 5: READY
      this.state = 'READY';
      this.diagnosticState = null;
      sse.broadcast('telegram:status', this.getConnectionState());
      sse.broadcast('telegram:chats', { chats: db.getTelegramChats() });

      return {
        success: true,
        message: `Compte Telegram connecté avec succès (${syncResult.chatsDiscovered} discussions synchronisées)`
      };
    } catch (err: any) {
      this.state = 'ERROR';
      this.isClientInitialized = false;
      this.lastError = `Échec de connexion Telegram: ${err.message}`;
      logger.error(`Telegram user session connection failed: ${err.message}`, { module: 'TELEGRAM' });
      sse.broadcast('telegram:status', this.getConnectionState());
      return {
        success: false,
        message: 'Erreur session Telegram',
        error: this.lastError
      };
    }
  }

  /**
   * Fetch real dialogs/chats directly from the Telegram MTProto client
   */
  public async fetchRealUserDialogs(): Promise<TelegramSyncResult> {
    if (!this.userClient || !this.isClientInitialized) {
      return {
        success: false,
        tasksImported: 0,
        chatsDiscovered: 0,
        errors: ['CLIENT_NOT_INITIALIZED: Le client Telegram MTProto n\'est pas encore prêt']
      };
    }

    this.isSyncing = true;
    this.state = 'LOADING_CHATS';
    sse.broadcast('telegram:status', this.getConnectionState());

    logger.info('Telegram authenticated: YES', { module: 'TELEGRAM' });
    logger.info('Telegram connection state: READY', { module: 'TELEGRAM' });
    logger.info('Dialog fetch started', { module: 'TELEGRAM' });

    let privateChats = 0;
    let groups = 0;
    let channels = 0;
    let bots = 0;
    let dialogsSaved = 0;
    const errors: string[] = [];

    try {
      // Retrieve real dialogs from MTProto
      const dialogs = await this.userClient.getDialogs({ limit: 100 });

      logger.info(`Dialogs fetched: ${dialogs.length}`, { module: 'TELEGRAM' });

      for (const dialog of dialogs) {
        try {
          const entity = dialog.entity as any;
          const rawId = dialog.id?.toString() || entity?.id?.toString();
          if (!rawId) continue;

          // Resolve chat type
          let chatType: TelegramChat['type'] = 'group';
          if (dialog.isUser) {
            if (entity?.bot) {
              chatType = 'bot';
              bots++;
            } else {
              chatType = 'private';
              privateChats++;
            }
          } else if (dialog.isChannel) {
            if (entity?.megagroup) {
              chatType = 'supergroup';
              groups++;
            } else {
              chatType = 'channel';
              channels++;
            }
          } else if (dialog.isGroup) {
            chatType = 'group';
            groups++;
          } else {
            chatType = 'group';
            groups++;
          }

          // Resolve title
          const title =
            dialog.title ||
            dialog.name ||
            entity?.title ||
            `${entity?.firstName || ''} ${entity?.lastName || ''}`.trim() ||
            (entity?.username ? `@${entity.username}` : `Discussion ${rawId}`);

          // Resolve username
          const username = entity?.username || (entity?.usernames && entity.usernames[0]?.username) || undefined;

          // Resolve last message
          const lastMessageText = dialog.message?.message
            ? dialog.message.message.length > 80
              ? dialog.message.message.substring(0, 77) + '...'
              : dialog.message.message
            : dialog.message
            ? '[Média / Fichier]'
            : undefined;

          const lastMessageDate = dialog.date
            ? new Date(dialog.date * 1000).toISOString()
            : new Date().toISOString();

          const unreadCount = typeof dialog.unreadCount === 'number' ? dialog.unreadCount : 0;
          const participantsCount = entity?.participantsCount || undefined;
          const isPinned = !!(dialog.pinned || (dialog as any).isPinned);
          const capabilities = computeChatCapabilities(chatType, entity, this.accountInfo?.id);

          // Check if chat existed before
          const existed = db.getTelegramChatById(rawId);

          db.upsertTelegramChat({
            id: rawId,
            title,
            username,
            type: chatType,
            about: entity?.about || entity?.description,
            lastMessage: lastMessageText,
            lastMessageDate,
            unreadCount,
            participantsCount,
            isPinned,
            capabilities,
            avatarColor: getAvatarColor(rawId),
            monitored: existed ? existed.monitored : true,
            role: existed ? existed.role : 'TASK_SOURCE'
          });

          // Also save latest message into telegram_messages cache
          if (dialog.message) {
            const m = dialog.message as any;
            const normMsg = normalizeTelegramMessage(m, rawId, capabilities, this.accountInfo?.id);
            db.upsertTelegramMessage(normMsg);
          }

          dialogsSaved++;
        } catch (dialogErr: any) {
          errors.push(`Erreur parsing dialog: ${dialogErr.message}`);
        }
      }

      logger.info(`Private chats: ${privateChats}`, { module: 'TELEGRAM' });
      logger.info(`Groups: ${groups}`, { module: 'TELEGRAM' });
      logger.info(`Channels: ${channels}`, { module: 'TELEGRAM' });
      logger.info(`Bots: ${bots}`, { module: 'TELEGRAM' });
      logger.info(`Dialogs saved: ${dialogsSaved}`, { module: 'TELEGRAM' });

      this.lastSyncTime = new Date().toISOString();

      if (dialogsSaved === 0 && dialogs.length === 0) {
        // Zero dialogs received from MTProto
        this.diagnosticState = 'TELEGRAM_DIALOG_DISCOVERY_FAILED';
        logger.warn('TELEGRAM_DIALOG_DISCOVERY_FAILED: 0 dialogs returned by Telegram MTProto API', {
          module: 'TELEGRAM'
        });
      } else {
        this.diagnosticState = null;
      }

      this.state = 'READY';
      this.isSyncing = false;
      sse.broadcast('telegram:status', this.getConnectionState());
      sse.broadcast('telegram:chats', { chats: db.getTelegramChats() });

      return {
        success: true,
        tasksImported: 0,
        chatsDiscovered: dialogsSaved,
        errors
      };
    } catch (err: any) {
      this.state = 'ERROR';
      this.diagnosticState = 'TELEGRAM_DIALOG_DISCOVERY_FAILED';
      this.lastError = `Échec de récupération des dialogues: ${err.message}`;
      this.isSyncing = false;
      logger.error(`Failed to fetch real dialogs: ${err.message}`, err, { module: 'TELEGRAM' });
      sse.broadcast('telegram:status', this.getConnectionState());
      return {
        success: false,
        tasksImported: 0,
        chatsDiscovered: 0,
        errors: [err.message]
      };
    }
  }

  /**
   * Fetch chat messages from MTProto user client or local database
   */
  public async fetchChatMessages(
    chatId: string,
    limit = 50,
    offsetId = 0,
    search?: string
  ): Promise<{ success: boolean; messages: TelegramMessage[]; hasMore: boolean; error?: string }> {
    if (!chatId) {
      return { success: false, messages: [], hasMore: false, error: 'Chat ID requis' };
    }

    if (this.userClient && this.isClientInitialized) {
      try {
        const entity = await this.userClient.getInputEntity(chatId).catch(() => chatId);
        const rawMessages = await this.userClient.getMessages(entity, {
          limit,
          offsetId: offsetId ? Number(offsetId) : undefined,
          search: search || undefined
        });

        const chatObj = db.getTelegramChatById(chatId);
        const capabilities = chatObj?.capabilities || computeChatCapabilities(chatObj?.type || 'group', entity, this.accountInfo?.id);

        const normalized: TelegramMessage[] = [];
        for (const msg of rawMessages) {
          if (!msg || typeof (msg as any).id === 'undefined') continue;
          const m = msg as any;
          const telegramMsg = normalizeTelegramMessage(m, chatId, capabilities, this.accountInfo?.id);
          normalized.push(telegramMsg);

          // Check if message contains Reply Keyboard markup or Remove Keyboard instruction
          if (m.replyMarkup && !this.chatReplyKeyboards.has(chatId)) {
            const parsed = telegramKeyboardParser.parseMarkup(m.replyMarkup, chatId, String(m.id));
            if (parsed.isRemove) {
              this.chatReplyKeyboards.set(chatId, null);
              this.chatParsedKeyboards.set(chatId, null);
            } else if (parsed.replyKeyboard) {
              const kb = telegramKeyboardParser.toReplyKeyboardModel(parsed.replyKeyboard);
              this.chatReplyKeyboards.set(chatId, kb);
              this.chatParsedKeyboards.set(chatId, parsed.replyKeyboard);
            }
          }

          // Auto-ingest task if chat is monitored and task not yet in db
          if (telegramMsg.isTaskDetected && telegramMsg.detectedTaskId) {
            const monitoredChatIds = db.getMonitoredChatIds();
            const isMonitored = monitoredChatIds.length === 0 || monitoredChatIds.includes(String(chatId));
            if (isMonitored) {
              const existing = db.getTaskByTelegramId(telegramMsg.detectedTaskId);
              if (!existing) {
                const parsed = taskParser.parse(telegramMsg.text);
                if (parsed.success && parsed.task) {
                  const newTask = db.createTask({
                    telegramTaskId: parsed.task.telegramTaskId,
                    firstName: parsed.task.firstName,
                    lastName: parsed.task.lastName,
                    password: parsed.task.password,
                    phone: parsed.task.phone,
                    notes: parsed.task.notes,
                    telegramChatId: String(chatId),
                    telegramMessageId: String(m.id),
                    telegramMessageDate: telegramMsg.date,
                    telegramChatTitle: chatObj?.title || `Chat ${chatId}`,
                    sourceType: 'TELEGRAM',
                    rawTelegramMessage: telegramMsg.text,
                    status: 'PENDING'
                  });
                  sse.broadcast('task:created', { task: newTask });
                  sse.broadcast('tasks:updated', { tasks: db.getTasks() });
                }
              }
            }
          }
        }

        db.upsertTelegramMessages(normalized);

        // If loading older messages (offsetId > 0), return newly fetched older slice
        if (offsetId > 0) {
          normalized.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
          return {
            success: true,
            messages: normalized,
            hasMore: rawMessages.length >= limit
          };
        }

        const cached = db.getTelegramMessages(chatId, limit, undefined, search);
        return {
          success: true,
          messages: cached,
          hasMore: rawMessages.length >= limit
        };
      } catch (err: any) {
        logger.warn(`Could not fetch messages via MTProto for chat ${chatId}: ${err.message}`, { module: 'TELEGRAM' });
      }
    }

    // Fallback to local database cache
    const cached = db.getTelegramMessages(chatId, limit, undefined, search);
    return {
      success: true,
      messages: cached,
      hasMore: false
    };
  }

  /**
   * Register real-time MTProto event listener for incoming messages, edits, deletes, and unread state
   */
  private registerUserMessageListener() {
    if (!this.userClient) return;

    try {
      // 1. New Message Listener
      this.userClient.addEventHandler(async (event: NewMessageEvent) => {
        const msg = event.message as any;
        if (!msg) return;

        this.messagesSyncedCount++;
        const rawChatId = msg.chatId?.toString() || msg.peerId?.toString() || '';
        const msgText = msg.message || '';
        const msgId = String(msg.id || Date.now());

        // Parse Task if message contains structured instructions
        const parsed = msgText ? taskParser.parse(msgText) : null;
        const isTask = !!(parsed && parsed.success);

        let senderName: string | undefined;
        let senderUsername: string | undefined;
        try {
          if (msg.sender) {
            senderName = `${msg.sender.firstName || ''} ${msg.sender.lastName || ''}`.trim() || msg.sender.username || (msg.sender.title ? msg.sender.title : undefined);
            senderUsername = msg.sender.username;
          }
        } catch {}

        let existingChat = rawChatId ? db.getTelegramChatById(rawChatId) : undefined;

        // Auto-discover previously unknown chat if message received
        if (!existingChat && rawChatId && this.userClient && this.isClientInitialized) {
          try {
            const peer = msg.peerId || msg.chatId || rawChatId;
            const entity: any = await this.userClient.getEntity(peer).catch(() => null);
            if (entity) {
              const entClassName = entity.className || entity.constructor?.name || '';
              let chatType: TelegramChat['type'] = 'private';
              let chatTitle = 'Chat Telegram';
              let chatUsername = entity.username;

              if (entClassName.includes('Channel')) {
                chatType = entity.broadcast ? 'channel' : 'supergroup';
                chatTitle = entity.title || 'Canal Telegram';
              } else if (entClassName.includes('Chat')) {
                chatType = 'group';
                chatTitle = entity.title || 'Groupe Telegram';
              } else if (entClassName.includes('User')) {
                chatType = entity.bot ? 'bot' : 'private';
                chatTitle = `${entity.firstName || ''} ${entity.lastName || ''}`.trim() || entity.username || 'Contact Telegram';
              }

              const caps = computeChatCapabilities(chatType, entity, this.accountInfo?.id);
              existingChat = db.upsertTelegramChat({
                id: rawChatId,
                title: chatTitle,
                type: chatType,
                username: chatUsername,
                role: 'TASK_SOURCE',
                monitored: true,
                capabilities: caps,
                lastMessage: msgText ? (msgText.length > 80 ? msgText.substring(0, 77) + '...' : msgText) : '[Média]',
                lastMessageDate: new Date().toISOString(),
                unreadCount: msg.out ? 0 : 1
              });
              sse.broadcast('telegram:chats', { chats: db.getTelegramChats() });
            }
          } catch (discoverErr: any) {
            logger.debug(`Could not auto-discover entity for ${rawChatId}: ${discoverErr.message}`, { module: 'TELEGRAM' });
          }
        }

        const capabilities = existingChat?.capabilities || computeChatCapabilities(existingChat?.type || 'group', null, this.accountInfo?.id);
        const normalizedMsg = normalizeTelegramMessage(msg, rawChatId, capabilities, this.accountInfo?.id);

        // Detect dynamic Reply Keyboard changes
        if (msg.replyMarkup) {
          const parsed = telegramKeyboardParser.parseMarkup(msg.replyMarkup, rawChatId, msgId);
          if (parsed.isRemove) {
            this.chatReplyKeyboards.set(rawChatId, null);
            this.chatParsedKeyboards.set(rawChatId, null);
            sse.broadcast('telegram:ui-state:updated', { chatId: rawChatId });
          } else if (parsed.replyKeyboard) {
            const kb = telegramKeyboardParser.toReplyKeyboardModel(parsed.replyKeyboard);
            this.chatReplyKeyboards.set(rawChatId, kb);
            this.chatParsedKeyboards.set(rawChatId, parsed.replyKeyboard);
            sse.broadcast('telegram:ui-state:updated', { chatId: rawChatId });
          }
        }

        // Save message to database
        db.upsertTelegramMessage(normalizedMsg);
        sse.broadcast('telegram:message:new', { message: normalizedMsg });

        // Update chat activity in local database
        if (rawChatId) {
          const chatInDb = db.getTelegramChatById(rawChatId);
          if (chatInDb) {
            db.upsertTelegramChat({
              id: rawChatId,
              title: chatInDb.title,
              lastMessage: msgText ? (msgText.length > 80 ? msgText.substring(0, 77) + '...' : msgText) : '[Média]',
              lastMessageDate: new Date().toISOString(),
              unreadCount: (chatInDb.unreadCount || 0) + (msg.out ? 0 : 1)
            });
            sse.broadcast('telegram:chats', { chats: db.getTelegramChats() });
          }
        }

        // Ingest task if chat is monitored
        if (isTask && parsed?.task) {
          const monitoredChatIds = db.getMonitoredChatIds();
          const isMonitored = monitoredChatIds.length === 0 || monitoredChatIds.includes(rawChatId);

          if (isMonitored) {
            const t = parsed.task;
            const existing = db.getTaskByTelegramId(t.telegramTaskId);
            if (!existing) {
              const chatObj = db.getTelegramChatById(rawChatId);
              const newTask = db.createTask({
                telegramTaskId: t.telegramTaskId,
                firstName: t.firstName,
                lastName: t.lastName,
                password: t.password,
                phone: t.phone,
                notes: t.notes,
                telegramChatId: rawChatId,
                telegramMessageId: msgId,
                telegramMessageDate: msg.date ? new Date(msg.date * 1000).toISOString() : new Date().toISOString(),
                telegramChatTitle: chatObj?.title || `Chat ${rawChatId}`,
                sourceType: 'TELEGRAM',
                rawTelegramMessage: msgText,
                status: 'PENDING'
              });

              logger.info(`New Task automatically imported from Telegram MTProto: #${newTask.telegramTaskId}`, {
                module: 'TELEGRAM',
                taskId: newTask.id
              });

              sse.broadcast('task:created', { task: newTask });
              sse.broadcast('tasks:updated', { tasks: db.getTasks() });

              // Auto-start if configured
              const settings = db.getSettings();
              if (settings.autoStart) {
                automationRunner.startTask(newTask.id);
              }
            }
          }
        }
      }, new NewMessage({}));

      // 2. Generic Raw MTProto Updates Listener (Edits, Deletes, Pinned, Read history)
      this.userClient.addEventHandler(async (update: any) => {
        if (!update) return;
        const className = update.className || update.constructor?.name || '';

        // MTProto Real Phone Call Updates (Requirement 8 & 9)
        if (className === 'UpdatePhoneCall' || className === 'UpdateGroupCall' || className === 'UpdateGroupCallParticipants') {
          if (this.userClient) {
            callManager.handleRawPhoneUpdate(update, this.userClient);
          }
        }

        // Message Edited
        else if (className === 'UpdateEditMessage' || className === 'UpdateEditChannelMessage') {
          const m = update.message;
          if (m && m.id) {
            const rawChatId = m.chatId?.toString() || m.peerId?.toString() || '';
            const existingChat = rawChatId ? db.getTelegramChatById(rawChatId) : undefined;
            const capabilities = existingChat?.capabilities || computeChatCapabilities(existingChat?.type || 'group', null, this.accountInfo?.id);
            const normMsg = normalizeTelegramMessage(m, rawChatId, capabilities, this.accountInfo?.id);
            db.upsertTelegramMessage(normMsg);
            sse.broadcast('telegram:message:updated', { message: normMsg });
          }
        }

        // Messages Deleted
        else if (className === 'UpdateDeleteMessages' || className === 'UpdateDeleteChannelMessages') {
          const messagesToDelete: any[] = update.messages || [];
          const channelId = update.channelId?.toString();
          for (const msgIdNum of messagesToDelete) {
            const msgId = String(msgIdNum);
            if (channelId) {
              db.deleteTelegramMessage(channelId, msgId);
              sse.broadcast('telegram:message:deleted', { chatId: channelId, messageId: msgId });
            } else {
              // Find matching message in database
              const allChats = db.getTelegramChats();
              for (const chat of allChats) {
                const found = db.getTelegramMessageById(chat.id, msgId);
                if (found) {
                  db.deleteTelegramMessage(chat.id, msgId);
                  sse.broadcast('telegram:message:deleted', { chatId: chat.id, messageId: msgId });
                }
              }
            }
          }
        }

        // Pinned Message Updated
        else if (className === 'UpdatePinnedMessages' || className === 'UpdatePinnedChannelMessages') {
          const rawChatId = update.chatId?.toString() || update.channelId?.toString() || '';
          if (rawChatId) {
            const messagesToPin: any[] = update.messages || [update.pinned];
            for (const pId of messagesToPin) {
              if (pId) {
                db.setTelegramMessagePinned(rawChatId, String(pId), !update.unpin);
              }
            }
            sse.broadcast('telegram:ui-state:updated', { chatId: rawChatId });
          }
        }

        // Read History Inbox (Unread count updated)
        else if (className === 'UpdateReadHistoryInbox' || className === 'UpdateReadChannelInbox') {
          const rawChatId = update.peer?.channelId?.toString() || update.peer?.chatId?.toString() || update.peer?.userId?.toString() || '';
          if (rawChatId) {
            const chatInDb = db.getTelegramChatById(rawChatId);
            if (chatInDb) {
              const maxId = update.maxId || 0;
              const unreadCount = update.stillUnreadCount !== undefined ? update.stillUnreadCount : 0;
              db.upsertTelegramChat({
                id: rawChatId,
                title: chatInDb.title,
                unreadCount: Math.max(0, unreadCount)
              });
              sse.broadcast('telegram:chats', { chats: db.getTelegramChats() });
            }
          }
        }
      });
    } catch (err: any) {
      logger.warn(`Could not attach MTProto event handler: ${err.message}`, { module: 'TELEGRAM' });
    }
  }

  /**
   * Fetch chat avatar binary via MTProto
   */
  public async getChatAvatar(chatId: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
    if (!chatId) return null;

    // Check in-memory cache (TTL: 1 hour)
    const cached = this.avatarCache.get(chatId);
    if (cached && Date.now() - cached.timestamp < 3600_000) {
      return { buffer: cached.buffer, mimeType: cached.mimeType };
    }

    if (!this.userClient || !this.isClientInitialized) {
      return null;
    }

    try {
      let peer: any = chatId;
      if (/^-?\d+$/.test(chatId)) {
        try {
          peer = BigInt(chatId);
        } catch {
          peer = chatId;
        }
      }
      const entity = await this.userClient.getEntity(peer);
      if (!entity) return null;

      const photoBuffer: any = await this.userClient.downloadProfilePhoto(entity, {
        isBig: false
      });

      if (photoBuffer && Buffer.isBuffer(photoBuffer) && photoBuffer.length > 0) {
        const item = {
          buffer: photoBuffer,
          mimeType: 'image/jpeg',
          timestamp: Date.now()
        };
        this.avatarCache.set(chatId, item);
        return { buffer: item.buffer, mimeType: item.mimeType };
      }
      return null;
    } catch (err: any) {
      logger.debug(`Could not download avatar for ${chatId}: ${err.message}`, { module: 'TELEGRAM' });
      return null;
    }
  }

  /**
   * Fetch message media binary via MTProto (photo, voice, video, document, sticker)
   */
  public async getMessageMedia(chatId: string, messageId: string): Promise<{ buffer: Buffer; mimeType: string; fileName?: string } | null> {
    if (!chatId || !messageId) return null;
    const cacheKey = `${chatId}_${messageId}`;
    const cached = this.mediaCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 3600_000 * 6) {
      return cached;
    }

    if (!this.userClient || !this.isClientInitialized) {
      return null;
    }

    try {
      let peer: any = chatId;
      if (/^-?\d+$/.test(chatId)) {
        try {
          peer = BigInt(chatId);
        } catch {
          peer = chatId;
        }
      }
      const msgNum = Number(messageId);
      if (!msgNum) return null;

      const rawMessages = await this.userClient.getMessages(peer, { ids: [msgNum] });
      const msg = rawMessages && rawMessages[0];
      if (!msg || !msg.media) return null;

      const mediaBuffer: any = await this.userClient.downloadMedia(msg, {});
      if (mediaBuffer && Buffer.isBuffer(mediaBuffer) && mediaBuffer.length > 0) {
        let mimeType = 'application/octet-stream';
        let fileName: string | undefined;

        if (msg.photo) {
          mimeType = 'image/jpeg';
        } else if (msg.document) {
          mimeType = (msg.document as any).mimeType || 'application/octet-stream';
          const attr = (msg.document as any).attributes?.find((a: any) => a.fileName);
          if (attr) fileName = attr.fileName;
        } else if (msg.voice) {
          mimeType = 'audio/ogg';
        } else if (msg.audio) {
          mimeType = 'audio/mpeg';
        } else if (msg.video) {
          mimeType = 'video/mp4';
        }

        const item = {
          buffer: mediaBuffer,
          mimeType,
          fileName,
          timestamp: Date.now()
        };
        this.mediaCache.set(cacheKey, item);
        return item;
      }
      return null;
    } catch (err: any) {
      logger.debug(`Could not download media for message ${messageId} in ${chatId}: ${err.message}`, { module: 'TELEGRAM' });
      return null;
    }
  }

  /**
   * Connect using Telegram Bot Token (HTTP API Fallback)
   */
  public async connectBot(token: string): Promise<{ success: boolean; message: string; error?: string }> {
    if (!token || !token.includes(':')) {
      this.state = 'ERROR';
      this.lastError = 'Format de token Telegram Bot invalide (attendu: 123456:ABC-DEF...)';
      sse.broadcast('telegram:status', this.getConnectionState());
      return {
        success: false,
        message: 'Token invalide',
        error: this.lastError
      };
    }

    this.state = 'CONNECTING';
    this.diagnosticState = null;
    this.lastError = null;
    sse.broadcast('telegram:status', this.getConnectionState());

    try {
      this.state = 'AUTHENTICATING';
      sse.broadcast('telegram:status', this.getConnectionState());

      logger.info(`Connecting to Telegram Bot API (${redactSecret(token)})`, { module: 'TELEGRAM' });

      const response = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
        signal: AbortSignal.timeout(8000)
      });
      const data = await response.json();

      if (data.ok && data.result) {
        this.accountInfo = {
          id: String(data.result.id),
          username: data.result.username,
          firstName: data.result.first_name,
          lastName: data.result.last_name,
          isBot: true
        };
        this.state = 'READY';
        this.lastError = null;

        // Persist token in settings
        db.updateSettings({
          telegramBotToken: token,
          telegramSession: '' // Clear user session when switching to bot
        });
        db.addTaskEvent(undefined, 'TELEGRAM_CONNECTED', `Bot Telegram connecté : @${data.result.username}`);

        // Start background watcher for bot updates
        this.startBotPolling();

        sse.broadcast('telegram:status', this.getConnectionState());
        return {
          success: true,
          message: `Connecté avec succès au Bot @${data.result.username}`
        };
      } else {
        this.state = 'ERROR';
        this.lastError = data.description || 'Authentification Telegram refusée';
        sse.broadcast('telegram:status', this.getConnectionState());
        return {
          success: false,
          message: 'Erreur d\'authentification',
          error: this.lastError
        };
      }
    } catch (err: any) {
      this.state = 'ERROR';
      this.lastError = `Échec de connexion réseau Telegram: ${err.message}`;
      sse.broadcast('telegram:status', this.getConnectionState());
      return {
        success: false,
        message: 'Erreur réseau',
        error: this.lastError
      };
    }
  }

  /**
   * Disconnect from Telegram
   */
  public async disconnect(): Promise<{ success: boolean; message: string }> {
    this.stopBotPolling();
    if (this.userClient) {
      try {
        await this.userClient.disconnect();
      } catch {}
      this.userClient = null;
    }
    this.isClientInitialized = false;
    this.state = 'DISCONNECTED';
    this.accountInfo = null;
    this.lastError = null;
    this.diagnosticState = null;
    db.addTaskEvent(undefined, 'TELEGRAM_DISCONNECTED', 'Compte Telegram déconnecté par l\'opérateur.');
    sse.broadcast('telegram:status', this.getConnectionState());
    return { success: true, message: 'Telegram déconnecté' };
  }

  /**
   * Reconnect to Telegram
   */
  public async reconnect(): Promise<{ success: boolean; message: string; error?: string }> {
    this.stopBotPolling();
    this.state = 'RECONNECTING';
    sse.broadcast('telegram:status', this.getConnectionState());

    const settings = db.getSettings();
    if (settings.telegramSession && settings.telegramSession.trim().length > 0) {
      return this.connectUserSession({
        apiId: settings.telegramApiId || '',
        apiHash: settings.telegramApiHash || '',
        sessionString: settings.telegramSession
      });
    } else if (settings.telegramBotToken && settings.telegramBotToken.trim().length > 0) {
      return this.connectBot(settings.telegramBotToken);
    }
    this.state = 'DISCONNECTED';
    sse.broadcast('telegram:status', this.getConnectionState());
    return { success: false, message: 'Aucun identifiant sauvegardé', error: 'NOT_CONFIGURED' };
  }

  /**
   * Primary Refresh / Sync Dialogs and Messages (POST /api/telegram/sync)
   */
  public async syncDialogsAndMessages(): Promise<TelegramSyncResult> {
    if (this.userClient && this.isClientInitialized) {
      return this.fetchRealUserDialogs();
    } else if (db.getSettings().telegramBotToken) {
      return this.pollBotUpdates();
    } else {
      return {
        success: false,
        tasksImported: 0,
        chatsDiscovered: 0,
        errors: ['TELEGRAM_NOT_CONNECTED: Aucun compte Telegram actif']
      };
    }
  }

  /**
   * Background bot polling for Bot API
   */
  private startBotPolling() {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
    }

    this.pollBotUpdates();

    this.pollingTimer = setInterval(() => {
      this.pollBotUpdates();
    }, 4000);
  }

  private stopBotPolling() {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
    this.isPolling = false;
  }

  public async pollBotUpdates(): Promise<TelegramSyncResult> {
    const settings = db.getSettings();
    const token = settings.telegramBotToken;

    if (!token) {
      return {
        success: false,
        tasksImported: 0,
        chatsDiscovered: 0,
        errors: ['NOT_CONFIGURED: Token Bot Telegram non configuré']
      };
    }

    if (this.isPolling) {
      return { success: true, tasksImported: 0, chatsDiscovered: 0, errors: [] };
    }

    this.isPolling = true;
    const errors: string[] = [];
    let tasksImported = 0;
    let chatsDiscovered = 0;

    try {
      const url = `https://api.telegram.org/bot${token}/getUpdates?offset=${this.lastUpdateId + 1}&limit=30`;
      const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
      const data = await response.json();

      if (!data.ok) {
        this.state = 'ERROR';
        this.lastError = data.description || 'getUpdates error';
        sse.broadcast('telegram:status', this.getConnectionState());
        return {
          success: false,
          tasksImported: 0,
          chatsDiscovered: 0,
          errors: [data.description || 'Telegram getUpdates failed']
        };
      }

      const updates: any[] = data.result || [];
      this.lastSyncTime = new Date().toISOString();

      for (const update of updates) {
        if (update.update_id > this.lastUpdateId) {
          this.lastUpdateId = update.update_id;
        }

        const msg = update.message || update.channel_post || update.edited_message;
        if (!msg) continue;

        this.messagesSyncedCount++;
        const chatId = String(msg.chat?.id || '');
        const msgId = String(msg.message_id || Date.now());
        const msgText = msg.text || '';
        const parsed = msgText ? taskParser.parse(msgText) : null;
        const isTask = !!(parsed && parsed.success);

        // 0. Save into telegram_messages
        if (chatId) {
          const normMsg: TelegramMessage = {
            id: msgId,
            chatId,
            senderId: msg.from ? String(msg.from.id) : undefined,
            senderName: msg.from ? `${msg.from.first_name || ''} ${msg.from.last_name || ''}`.trim() || msg.from.username : undefined,
            senderUsername: msg.from?.username,
            text: msgText,
            date: new Date((msg.date || Date.now() / 1000) * 1000).toISOString(),
            isOutgoing: false,
            isTaskDetected: isTask,
            detectedTaskId: parsed?.task?.telegramTaskId,
            unread: true
          };
          db.upsertTelegramMessage(normMsg);
          sse.broadcast('telegram:message:new', { message: normMsg });
          // Detect dynamic Reply Keyboard changes in Bot updates
          if (msg.reply_markup) {
            const parsed = telegramKeyboardParser.parseMarkup(msg.reply_markup, chatId, msgId);
            if (parsed.isRemove) {
              this.chatReplyKeyboards.set(chatId, null);
              this.chatParsedKeyboards.set(chatId, null);
              sse.broadcast('telegram:ui-state:updated', { chatId });
            } else if (parsed.replyKeyboard) {
              const kb = telegramKeyboardParser.toReplyKeyboardModel(parsed.replyKeyboard);
              this.chatReplyKeyboards.set(chatId, kb);
              this.chatParsedKeyboards.set(chatId, parsed.replyKeyboard);
              sse.broadcast('telegram:ui-state:updated', { chatId });
            }
          }
        }

        // 1. Dynamic Chat Discovery
        if (msg.chat) {
          const chatTitle =
            msg.chat.title ||
            `${msg.chat.first_name || ''} ${msg.chat.last_name || ''}`.trim() ||
            `Chat ${chatId}`;
          const chatType = msg.chat.type || 'group';
          const username = msg.chat.username;

          const existingChat = db.getTelegramChatById(chatId);
          if (!existingChat) {
            chatsDiscovered++;
            db.addTaskEvent(undefined, 'CHAT_DISCOVERED', `Nouvelle conversation découverte : "${chatTitle}" (ID: ${chatId})`);
          }

          db.upsertTelegramChat({
            id: chatId,
            title: chatTitle,
            username,
            type: chatType,
            avatarColor: getAvatarColor(chatId),
            lastMessage: msgText
              ? msgText.length > 60
                ? msgText.substring(0, 57) + '...'
                : msgText
              : '[Média/Fichier]',
            lastMessageDate: new Date((msg.date || Date.now() / 1000) * 1000).toISOString()
          });
        }

        // 2. Task Detection
        if (msg.text) {
          const text = msg.text.trim();
          const chatId = String(msg.chat?.id || '');

          const monitoredChatIds = db.getMonitoredChatIds();
          const isMonitored = monitoredChatIds.length === 0 || monitoredChatIds.includes(chatId);

          if (isMonitored) {
            const parsed = taskParser.parse(text);
            if (parsed.success && parsed.task) {
              const t = parsed.task;
              const existing = db.getTaskByTelegramId(t.telegramTaskId);
              if (!existing) {
                const newTask = db.createTask({
                  telegramTaskId: t.telegramTaskId,
                  firstName: t.firstName,
                  lastName: t.lastName,
                  password: t.password,
                  phone: t.phone,
                  notes: t.notes,
                  telegramChatId: chatId,
                  telegramMessageId: String(msg.message_id),
                  telegramMessageDate: new Date((msg.date || Date.now() / 1000) * 1000).toISOString(),
                  telegramChatTitle: msg.chat?.title || `Chat ${chatId}`,
                  sourceType: 'TELEGRAM',
                  rawTelegramMessage: text,
                  status: 'PENDING'
                });

                tasksImported++;
                logger.info(`New Task automatically imported from Telegram Bot: #${newTask.telegramTaskId}`, {
                  module: 'TELEGRAM',
                  taskId: newTask.id
                });

                sse.broadcast('task:created', { task: newTask });
                sse.broadcast('tasks:updated', { tasks: db.getTasks() });

                if (settings.autoStart) {
                  automationRunner.startTask(newTask.id);
                }
              }
            }
          }
        }
      }

      if (chatsDiscovered > 0) {
        sse.broadcast('telegram:chats', { chats: db.getTelegramChats() });
      }

      sse.broadcast('telegram:status', this.getConnectionState());

      return {
        success: true,
        tasksImported,
        chatsDiscovered,
        errors
      };
    } catch (err: any) {
      errors.push(`Telegram sync error: ${err.message}`);
      return {
        success: false,
        tasksImported,
        chatsDiscovered,
        errors
      };
    } finally {
      this.isPolling = false;
    }
  }

  /**
   * Ingest Telegram task message with strict Telegram provenance
   */
  public ingestRawMessage(text: string, chatId: string, messageId: string): { success: boolean; task?: any; error?: string } {
    if (!chatId || !messageId) {
      return { success: false, error: 'TASK_REJECTED: Telegram origin missing. chatId and messageId required.' };
    }

    const parseResult = taskParser.parse(text);
    if (!parseResult.success || !parseResult.task) {
      return { success: false, error: parseResult.error || 'Impossible d\'extraire les champs de la tâche' };
    }

    const t = parseResult.task;
    const existing = db.getTaskByTelegramId(t.telegramTaskId);
    if (existing) {
      return { success: false, error: `La tâche #${t.telegramTaskId} existe déjà dans la file d'attente.` };
    }

    const chatObj = db.getTelegramChatById(chatId);
    const created = db.createTask({
      telegramTaskId: t.telegramTaskId,
      firstName: t.firstName,
      lastName: t.lastName,
      password: t.password,
      phone: t.phone,
      notes: t.notes,
      telegramChatId: chatId,
      telegramMessageId: messageId,
      telegramMessageDate: new Date().toISOString(),
      telegramChatTitle: chatObj?.title || `Chat ${chatId}`,
      sourceType: 'TELEGRAM',
      rawTelegramMessage: text,
      status: 'PENDING'
    });

    sse.broadcast('task:created', { task: created });
    sse.broadcast('tasks:updated', { tasks: db.getTasks() });

    const settings = db.getSettings();
    if (settings.autoStart) {
      automationRunner.startTask(created.id);
    }

    return { success: true, task: created };
  }

  /**
   * Send a Telegram message via either User Client or Bot API (with optional replyToMsgId)
   */
  public async sendMessage(chatId: string, message: string, replyToMsgId?: string): Promise<{ success: boolean; message?: TelegramMessage; error?: string }> {
    if (!chatId || !message) return { success: false, error: 'Chat ID et message requis' };
    const now = new Date().toISOString();

    if (this.userClient && this.isClientInitialized) {
      try {
        const peer = await this.userClient.getInputEntity(chatId).catch(() => chatId);
        const options: any = { message };
        if (replyToMsgId) {
          options.replyTo = parseInt(replyToMsgId, 10);
        }

        const sent: any = await this.userClient.sendMessage(peer, options);
        logger.info(`Message sent to chat ${chatId} via User MTProto Client (Reply: ${replyToMsgId || 'none'})`, { module: 'TELEGRAM' });

        const chatObj = db.getTelegramChatById(chatId);
        const capabilities = chatObj?.capabilities || computeChatCapabilities(chatObj?.type || 'group', null, this.accountInfo?.id);
        const normMsg = normalizeTelegramMessage(sent, chatId, capabilities, this.accountInfo?.id);

        db.upsertTelegramMessage(normMsg);
        sse.broadcast('telegram:message:new', { message: normMsg });

        if (chatObj) {
          db.upsertTelegramChat({
            id: chatId,
            title: chatObj.title,
            lastMessage: message.length > 80 ? message.substring(0, 77) + '...' : message,
            lastMessageDate: now
          });
          sse.broadcast('telegram:chats', { chats: db.getTelegramChats() });
        }

        return { success: true, message: normMsg };
      } catch (err: any) {
        logger.error(`Failed to send message via MTProto: ${err.message}`, err, { module: 'TELEGRAM' });
        return { success: false, error: err.message };
      }
    }

    const token = db.getSettings().telegramBotToken;
    if (!token) return { success: false, error: 'Telegram non connecté' };

    try {
      const bodyPayload: any = {
        chat_id: chatId,
        text: message
      };
      if (replyToMsgId) {
        bodyPayload.reply_parameters = { message_id: parseInt(replyToMsgId, 10) };
      }

      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload)
      });
      const data = await response.json();
      if (data.ok && data.result) {
        const msgId = String(data.result.message_id || Date.now());
        const normMsg: TelegramMessage = {
          id: msgId,
          chatId: String(chatId),
          senderName: 'Bot',
          text: message,
          date: now,
          isOutgoing: true,
          replyToMessageId: replyToMsgId ? String(replyToMsgId) : undefined,
          unread: false
        };
        db.upsertTelegramMessage(normMsg);
        sse.broadcast('telegram:message:new', { message: normMsg });

        const existing = db.getTelegramChatById(chatId);
        if (existing) {
          db.upsertTelegramChat({
            id: chatId,
            title: existing.title,
            lastMessage: message.length > 80 ? message.substring(0, 77) + '...' : message,
            lastMessageDate: now
          });
          sse.broadcast('telegram:chats', { chats: db.getTelegramChats() });
        }
        return { success: true, message: normMsg };
      }
      return { success: false, error: data.description || 'Échec d\'envoi Bot API' };
    } catch (err: any) {
      logger.error(`Failed to send message via Bot API: ${err.message}`, err, { module: 'TELEGRAM' });
      return { success: false, error: err.message };
    }
  }

  /**
   * Real message edit
   */
  public async editMessage(chatId: string, messageId: string, text: string): Promise<{ success: boolean; message?: TelegramMessage; error?: string }> {
    if (!chatId || !messageId || !text) return { success: false, error: 'Paramètres manquants' };

    if (this.userClient && this.isClientInitialized) {
      try {
        const peer = await this.userClient.getInputEntity(chatId).catch(() => chatId);
        const edited: any = await this.userClient.editMessage(peer, {
          message: parseInt(messageId, 10),
          text
        });

        const chatObj = db.getTelegramChatById(chatId);
        const capabilities = chatObj?.capabilities || computeChatCapabilities(chatObj?.type || 'group', null, this.accountInfo?.id);
        const normMsg = normalizeTelegramMessage(edited, chatId, capabilities, this.accountInfo?.id);

        db.upsertTelegramMessage(normMsg);
        sse.broadcast('telegram:message:updated', { message: normMsg });
        return { success: true, message: normMsg };
      } catch (err: any) {
        logger.error(`Failed to edit message via MTProto: ${err.message}`, err, { module: 'TELEGRAM' });
        return { success: false, error: err.message };
      }
    }

    const token = db.getSettings().telegramBotToken;
    if (token) {
      try {
        const response = await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            message_id: parseInt(messageId, 10),
            text
          })
        });
        const data = await response.json();
        if (data.ok) {
          const updated = db.updateTelegramMessageText(chatId, messageId, text);
          if (updated) {
            sse.broadcast('telegram:message:updated', { message: updated });
            return { success: true, message: updated };
          }
          return { success: true };
        }
        return { success: false, error: data.description || 'Échec édition Bot API' };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }

    return { success: false, error: 'Client Telegram non connecté' };
  }

  /**
   * Real message delete
   */
  public async deleteMessage(chatId: string, messageId: string): Promise<{ success: boolean; error?: string }> {
    if (!chatId || !messageId) return { success: false, error: 'Paramètres manquants' };

    if (this.userClient && this.isClientInitialized) {
      try {
        const peer = await this.userClient.getInputEntity(chatId).catch(() => chatId);
        await this.userClient.deleteMessages(peer, [parseInt(messageId, 10)], { revoke: true });

        db.deleteTelegramMessage(chatId, messageId);
        sse.broadcast('telegram:message:deleted', { chatId, messageId });
        return { success: true };
      } catch (err: any) {
        logger.error(`Failed to delete message via MTProto: ${err.message}`, err, { module: 'TELEGRAM' });
        return { success: false, error: err.message };
      }
    }

    const token = db.getSettings().telegramBotToken;
    if (token) {
      try {
        const response = await fetch(`https://api.telegram.org/bot${token}/deleteMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            message_id: parseInt(messageId, 10)
          })
        });
        const data = await response.json();
        if (data.ok) {
          db.deleteTelegramMessage(chatId, messageId);
          sse.broadcast('telegram:message:deleted', { chatId, messageId });
          return { success: true };
        }
        return { success: false, error: data.description || 'Échec suppression Bot API' };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }

    return { success: false, error: 'Client Telegram non connecté' };
  }

  /**
   * Real message pin/unpin
   */
  public async pinMessage(chatId: string, messageId: string, unpin = false, notify = false): Promise<{ success: boolean; error?: string }> {
    if (!chatId || !messageId) return { success: false, error: 'Paramètres manquants' };

    if (this.userClient && this.isClientInitialized) {
      try {
        const peer = await this.userClient.getInputEntity(chatId).catch(() => chatId);
        const msgIdNum = parseInt(messageId, 10);
        if (unpin) {
          if ((this.userClient as any).unpinMessage) {
            await (this.userClient as any).unpinMessage(peer, msgIdNum);
          } else {
            await this.userClient.invoke(
              new Api.messages.UpdatePinnedMessage({
                peer,
                id: msgIdNum,
                unpin: true
              })
            );
          }
        } else {
          await this.userClient.pinMessage(peer, msgIdNum, { notify: !!notify });
        }

        const updated = db.setTelegramMessagePinned(chatId, messageId, !unpin);
        if (updated) {
          sse.broadcast('telegram:message:updated', { message: updated });
        }
        return { success: true };
      } catch (err: any) {
        logger.error(`Failed to pin/unpin message via MTProto: ${err.message}`, err, { module: 'TELEGRAM' });
        return { success: false, error: err.message };
      }
    }

    const token = db.getSettings().telegramBotToken;
    if (token) {
      try {
        const endpoint = unpin ? 'unpinChatMessage' : 'pinChatMessage';
        const response = await fetch(`https://api.telegram.org/bot${token}/${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            message_id: parseInt(messageId, 10),
            disable_notification: !notify
          })
        });
        const data = await response.json();
        if (data.ok) {
          const updated = db.setTelegramMessagePinned(chatId, messageId, !unpin);
          if (updated) {
            sse.broadcast('telegram:message:updated', { message: updated });
          }
          return { success: true };
        }
        return { success: false, error: data.description || 'Échec épinglage Bot API' };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }

    return { success: false, error: 'Client Telegram non connecté' };
  }

  /**
   * Real message reaction
   */
  public async sendReaction(chatId: string, messageId: string, reaction: string): Promise<{ success: boolean; message?: TelegramMessage; error?: string }> {
    if (!chatId || !messageId) return { success: false, error: 'Paramètres manquants' };

    if (this.userClient && this.isClientInitialized) {
      try {
        const peer = await this.userClient.getInputEntity(chatId).catch(() => chatId);
        await this.userClient.invoke(
          new Api.messages.SendReaction({
            peer,
            msgId: parseInt(messageId, 10),
            reaction: reaction ? [new Api.ReactionEmoji({ emoticon: reaction })] : []
          })
        );

        const updated = db.updateTelegramMessageReactions(chatId, messageId, reaction);
        if (updated) {
          sse.broadcast('telegram:message:updated', { message: updated });
        }
        return { success: true, message: updated };
      } catch (err: any) {
        logger.error(`Failed to send reaction via MTProto: ${err.message}`, err, { module: 'TELEGRAM' });
        return { success: false, error: err.message };
      }
    }

    const updated = db.updateTelegramMessageReactions(chatId, messageId, reaction);
    if (updated) {
      sse.broadcast('telegram:message:updated', { message: updated });
    }
    return { success: true, message: updated };
  }

  /**
   * Real click callback inline button
   */
  public async clickCallbackButton(chatId: string, messageId: string, callbackData?: string): Promise<{ success: boolean; message?: string; alert?: boolean; url?: string; error?: string }> {
    if (!chatId || !messageId) return { success: false, error: 'Paramètres manquants' };

    if (this.userClient && this.isClientInitialized) {
      try {
        const peer = await this.userClient.getInputEntity(chatId).catch(() => chatId);
        const msgIdNum = parseInt(messageId, 10);
        if (isNaN(msgIdNum) || msgIdNum <= 0) {
          return { success: false, error: 'Identifiant de message Telegram invalide' };
        }

        let dataBuffer: Buffer;
        if (callbackData) {
          try {
            // First check if it's base64 encoded data
            const base64Buf = Buffer.from(callbackData, 'base64');
            if (base64Buf.length > 0 && base64Buf.toString('base64') === callbackData) {
              dataBuffer = base64Buf;
            } else if (/^[0-9a-fA-F]+$/.test(callbackData) && callbackData.length % 2 === 0 && callbackData.length >= 8) {
              dataBuffer = Buffer.from(callbackData, 'hex');
            } else {
              dataBuffer = Buffer.from(callbackData, 'utf-8');
            }
          } catch {
            dataBuffer = Buffer.from(callbackData, 'utf-8');
          }
        } else {
          dataBuffer = Buffer.alloc(0);
        }

        const res: any = await this.userClient.invoke(
          new Api.messages.GetBotCallbackAnswer({
            peer,
            msgId: msgIdNum,
            data: dataBuffer
          })
        );

        logger.info(`Callback button clicked for message #${messageId}: ${res?.message || 'OK'}`, { module: 'TELEGRAM' });

        return {
          success: true,
          message: res?.message || 'Action exécutée avec succès',
          alert: !!res?.alert,
          url: res?.url
        };
      } catch (err: any) {
        const errMsg = err?.message || String(err);
        if (errMsg.includes('BOT_RESPONSE_TIMEOUT')) {
          logger.warn(`Callback button for message #${messageId}: bot response timed out (action sent to bot).`, { module: 'TELEGRAM' });
          return {
            success: true,
            message: "L'action a été transmise au bot (délai de confirmation dépassé)."
          };
        }
        if (errMsg.includes('MESSAGE_ID_INVALID') || errMsg.includes('MSG_ID_INVALID')) {
          logger.warn(`Callback button for message #${messageId}: message ID is no longer valid on Telegram.`, { module: 'TELEGRAM' });
          return {
            success: false,
            error: "Le message ou bouton n'est plus actif sur les serveurs Telegram."
          };
        }
        if (errMsg.includes('DATA_INVALID') || errMsg.includes('BUTTON_DATA_INVALID')) {
          logger.warn(`Callback button for message #${messageId}: button data expired or invalid.`, { module: 'TELEGRAM' });
          return {
            success: false,
            error: "Les données du bouton ont expiré."
          };
        }
        logger.warn(`Callback button click issue via MTProto: ${errMsg}`, { module: 'TELEGRAM' });
        return { success: false, error: errMsg };
      }
    }

    return { success: false, error: 'Action callback nécessite une session utilisateur active' };
  }

  /**
   * Real message forward
   */
  public async forwardMessages(fromChatId: string, toChatId: string, messageIds: string[]): Promise<{ success: boolean; error?: string }> {
    if (!fromChatId || !toChatId || !messageIds?.length) {
      return { success: false, error: 'Paramètres de transfert invalides' };
    }

    if (this.userClient && this.isClientInitialized) {
      try {
        const toPeer = await this.userClient.getInputEntity(toChatId).catch(() => toChatId);
        const fromPeer = await this.userClient.getInputEntity(fromChatId).catch(() => fromChatId);
        await this.userClient.forwardMessages(toPeer, {
          messages: messageIds.map(id => parseInt(id, 10)),
          fromPeer
        });
        return { success: true };
      } catch (err: any) {
        logger.error(`Failed to forward messages via MTProto: ${err.message}`, err, { module: 'TELEGRAM' });
        return { success: false, error: err.message };
      }
    }

    return { success: false, error: 'Transfert nécessite une session utilisateur active' };
  }

  /**
   * Full chat information (About, Participants, Admins, Capabilities, Bot Commands)
   */
  public async getChatFullInfo(chatId: string): Promise<{ success: boolean; info?: TelegramChatFullInfo; error?: string }> {
    if (!chatId) return { success: false, error: 'Chat ID requis' };

    const dbChat = db.getTelegramChatById(chatId);
    if (!dbChat) {
      return { success: false, error: 'Conversation introuvable' };
    }

    const capabilities = dbChat.capabilities || computeChatCapabilities(dbChat.type, null, this.accountInfo?.id);

    const fullInfo: TelegramChatFullInfo = {
      id: dbChat.id,
      title: dbChat.title,
      username: dbChat.username,
      type: dbChat.type,
      about: dbChat.about,
      participantsCount: dbChat.participantsCount,
      capabilities,
      botCommands: []
    };

    if (this.userClient && this.isClientInitialized) {
      try {
        const entity: any = await this.userClient.getInputEntity(chatId).catch(() => chatId);
        const full: any = await this.userClient.invoke(
          dbChat.type === 'channel' || dbChat.type === 'supergroup'
            ? new Api.channels.GetFullChannel({ channel: entity })
            : dbChat.type === 'private' || dbChat.type === 'bot'
            ? new Api.users.GetFullUser({ id: entity })
            : new Api.messages.GetFullChat({ chatId: entity })
        ).catch(() => null);

        if (full) {
          const fullChat = full.fullChat || full.fullUser || full;
          fullInfo.about = fullChat.about || fullChat.description || dbChat.about;
          fullInfo.participantsCount = fullChat.participantsCount || fullChat.subscribers || dbChat.participantsCount;
          fullInfo.onlineCount = fullChat.onlineCount;

          if (fullChat.pinnedMsgId) {
            const pinnedMsg = db.getTelegramMessageById(chatId, String(fullChat.pinnedMsgId));
            if (pinnedMsg) fullInfo.pinnedMessage = pinnedMsg;
          }

          if (fullChat.botInfo?.commands) {
            fullInfo.botCommands = fullChat.botInfo.commands.map((c: any) => ({
              command: `/${c.command}`,
              description: c.description
            }));
          }

          if (fullChat.participants?.participants) {
            fullInfo.members = fullChat.participants.participants.map((p: any) => ({
              id: String(p.userId || p.id),
              name: `User ${p.userId || p.id}`,
              status: p.className || 'Membre'
            }));
          }
        }
      } catch (err: any) {
        logger.warn(`Could not fetch full MTProto chat info for ${chatId}: ${err.message}`, { module: 'TELEGRAM' });
      }
    }

    return { success: true, info: fullInfo };
  }

  /**
   * Real dynamic Telegram Chat UI State (reply keyboard, bot commands, channel discussion, structured controls)
   */
  public async getChatUIState(chatId: string): Promise<{ success: boolean; uiState?: TelegramChatUIState; error?: string }> {
    if (!chatId) return { success: false, error: 'Chat ID requis' };

    const dbChat = db.getTelegramChatById(chatId);
    if (!dbChat) {
      return { success: false, error: 'Conversation introuvable' };
    }

    const messages = db.getTelegramMessages(chatId, 30);
    let replyKeyboard = this.chatReplyKeyboards.get(chatId) ?? null;
    let botCommands = this.chatBotCommands.get(chatId);
    let botMenuButton = this.chatBotMenuButtons.get(chatId);
    let linkedDiscussionChatId = this.chatLinkedDiscussions.get(chatId);

    // If bot and commands/menuButton not cached, fetch from MTProto
    if (dbChat.type === 'bot' && this.userClient && this.isClientInitialized) {
      if (!botCommands || botCommands.length === 0 || botMenuButton === undefined) {
        try {
          const peer = await this.userClient.getInputEntity(chatId).catch(() => chatId);
          const full: any = await this.userClient.invoke(new Api.users.GetFullUser({ id: peer })).catch(() => null);
          if (full?.fullUser?.botInfo?.commands && (!botCommands || botCommands.length === 0)) {
            botCommands = full.fullUser.botInfo.commands.map((c: any) => ({
              command: `/${c.command}`,
              description: c.description
            }));
            this.chatBotCommands.set(chatId, botCommands);
          }

          if (botMenuButton === undefined) {
            // Check if full user has menuButton or if MTProto GetBotMenuButton is available
            try {
              const menuRes: any = await this.userClient.invoke(new Api.bots.GetBotMenuButton({ userId: peer })).catch(() => null);
              if (menuRes) {
                if (menuRes.className === 'BotMenuButton' || menuRes.url) {
                  botMenuButton = {
                    type: 'web_app',
                    text: menuRes.text || 'Ouvrir Bot',
                    url: menuRes.url
                  };
                } else if (menuRes.className === 'BotMenuButtonCommands') {
                  botMenuButton = {
                    type: 'commands',
                    text: 'Menu'
                  };
                } else if (menuRes.className === 'BotMenuButtonDefault') {
                  botMenuButton = {
                    type: 'default'
                  };
                }
              }
            } catch {
              // fallback gracefully
            }

            if (!botMenuButton) {
              // Inspect messages for web_app / start app buttons
              for (const m of messages) {
                if (m.inlineButtons) {
                  for (const r of m.inlineButtons) {
                    for (const b of r) {
                      if (b.type === 'web_app' && b.webAppUrl) {
                        botMenuButton = {
                          type: 'web_app',
                          text: b.text || 'Ouvrir WebApp',
                          url: b.webAppUrl
                        };
                        break;
                      }
                    }
                    if (botMenuButton) break;
                  }
                }
                if (botMenuButton) break;
              }
            }

            this.chatBotMenuButtons.set(chatId, botMenuButton || null);
          }
        } catch (err: any) {
          logger.debug(`Could not fetch bot information for ${chatId}: ${err.message}`, { module: 'TELEGRAM' });
        }
      }
    }

    // If channel and linkedDiscussion not cached, check full channel
    if (dbChat.type === 'channel' && !linkedDiscussionChatId && this.userClient && this.isClientInitialized) {
      try {
        const peer = await this.userClient.getInputEntity(chatId).catch(() => chatId);
        const full: any = await this.userClient.invoke(new Api.channels.GetFullChannel({ channel: peer })).catch(() => null);
        if (full?.fullChat?.linkedChatId) {
          linkedDiscussionChatId = String(full.fullChat.linkedChatId);
          this.chatLinkedDiscussions.set(chatId, linkedDiscussionChatId);
        }
      } catch (err: any) {
        logger.debug(`Could not fetch linked discussion for ${chatId}: ${err.message}`, { module: 'TELEGRAM' });
      }
    }

    let parsedKeyboard = this.chatParsedKeyboards.get(chatId) ?? null;

    const uiState = telegramUIParser.parseChatUIState(dbChat, messages, {
      replyKeyboard,
      parsedKeyboard,
      botCommands,
      botMenuButton: botMenuButton || undefined,
      linkedDiscussionChatId
    });

    return { success: true, uiState };
  }

  /**
   * Automation Engine Structured Workspace State (Requirement 13 & 27)
   */
  public getWorkspaceState(chatId?: string): any {
    const chats = db.getTelegramChats();
    const activeChat = chatId ? db.getTelegramChatById(chatId) : (chats.length > 0 ? chats[0] : null);
    const targetChatId = activeChat ? activeChat.id : chatId;
    const messages = targetChatId ? db.getTelegramMessages(targetChatId, 20) : [];
    const latestMsg = messages.length > 0 ? messages[messages.length - 1] : null;
    const replyKb = targetChatId ? (this.chatReplyKeyboards.get(targetChatId) || null) : null;
    const parsedKb = targetChatId ? (this.chatParsedKeyboards.get(targetChatId) || null) : null;
    const botCmds = targetChatId ? (this.chatBotCommands.get(targetChatId) || []) : [];
    const botMenuBtn = targetChatId ? (this.chatBotMenuButtons.get(targetChatId) || null) : null;

    // Detect persistent bot open interface (RFC 2.3)
    const isBot = activeChat?.type === 'bot';
    let botHasOpenInterface = false;
    let openButtonType: string | null = null;
    let openButtonAction: string | null = null;

    if (isBot) {
      if (botMenuBtn && (botMenuBtn.url || botMenuBtn.type === 'web_app')) {
        botHasOpenInterface = true;
        openButtonType = botMenuBtn.type;
        openButtonAction = botMenuBtn.url || null;
      } else {
        // Search in messages for web_app / start app button
        for (const m of messages) {
          if (m.inlineButtons) {
            for (const row of m.inlineButtons) {
              for (const btn of row) {
                if (btn.type === 'web_app' && btn.webAppUrl) {
                  botHasOpenInterface = true;
                  openButtonType = 'web_app';
                  openButtonAction = btn.webAppUrl;
                  break;
                }
              }
              if (botHasOpenInterface) break;
            }
          }
          if (botHasOpenInterface) break;
        }

        if (!botHasOpenInterface && replyKb?.rows) {
          for (const row of replyKb.rows) {
            for (const btn of row) {
              if (btn.type === 'web_app' && btn.webAppUrl) {
                botHasOpenInterface = true;
                openButtonType = 'web_app';
                openButtonAction = btn.webAppUrl;
                break;
              }
            }
            if (botHasOpenInterface) break;
          }
        }
      }
    }

    const openButtonVisible = botHasOpenInterface;
    const currentBotChatId = isBot && targetChatId ? targetChatId : null;

    return {
      currentChat: activeChat,
      currentMessage: latestMsg,
      latestMessage: latestMsg,
      unreadMessages: chats.reduce((acc, c) => acc + (c.unreadCount || 0), 0),
      botHasOpenInterface,
      openButtonVisible,
      openButtonType,
      openButtonAction,
      currentBotChatId,
      messageButtons: {
        replyKeyboard: replyKb,
        parsedKeyboard: parsedKb,
        botCommands: botCmds,
        botMenuButton: botMenuBtn,
        latestInlineButtons: latestMsg?.inlineButtons || null
      },
      keyboardState: parsedKb || (replyKb ? {
        chatId: targetChatId,
        type: 'REPLY_KEYBOARD',
        rows: replyKb.rows.map(r => r.map(b => ({ label: b.text, type: b.type, actionId: b.text, payload: b.text }))),
        resize: replyKb.resize,
        singleUse: replyKb.singleUse,
        placeholder: replyKb.placeholder
      } : {
        chatId: targetChatId,
        type: 'NONE',
        rows: []
      }),
      replyCapability: activeChat?.capabilities?.canReply ?? false,
      sendCapability: activeChat?.capabilities?.canSend ?? false,
      chatType: activeChat?.type || 'unknown',
      chatPermissions: activeChat?.capabilities || null,
      chatId: targetChatId,
      messageId: latestMsg?.id || null,
      isTelegramConnected: this.state === 'READY' || this.state === 'CONNECTED'
    };
  }

  /**
   * Execute Reply Keyboard Button click
   */
  public async sendReplyButton(
    chatId: string,
    buttonText: string,
    actionType?: string
  ): Promise<{ success: boolean; message?: TelegramMessage; error?: string }> {
    if (!chatId || !buttonText) return { success: false, error: 'Chat ID et libellé de bouton requis' };

    logger.info(`Executing Reply Keyboard action "${buttonText}" (type: ${actionType || 'text'}) in chat ${chatId}`, {
      module: 'TELEGRAM'
    });

    if (actionType === 'request_phone') {
      const phone = this.accountInfo?.phone || '+33600000000';
      if (this.userClient && this.isClientInitialized) {
        try {
          const peer = await this.userClient.getInputEntity(chatId).catch(() => chatId);
          const contact = new Api.InputMediaContact({
            phoneNumber: phone,
            firstName: this.accountInfo?.firstName || 'User',
            lastName: this.accountInfo?.lastName || '',
            vcard: ''
          });
          const res: any = await this.userClient.invoke(
            new Api.messages.SendMedia({
              peer,
              media: contact,
              message: ''
            })
          );
          const chatObj = db.getTelegramChatById(chatId);
          const capabilities = chatObj?.capabilities || computeChatCapabilities(chatObj?.type || 'bot', null, this.accountInfo?.id);
          const normMsg = normalizeTelegramMessage(res, chatId, capabilities, this.accountInfo?.id);
          db.upsertTelegramMessage(normMsg);
          sse.broadcast('telegram:message:new', { message: normMsg });
          return { success: true, message: normMsg };
        } catch (err: any) {
          logger.error(`Failed to send phone contact via MTProto: ${err.message}`, err, { module: 'TELEGRAM' });
          return { success: false, error: err.message };
        }
      }
    }

    // Default: sends button text as message to the Telegram bot/chat
    return this.sendMessage(chatId, buttonText);
  }

  /**
   * Send Bot Command (e.g. /start, /help, /tasks)
   */
  public async sendBotCommand(
    chatId: string,
    command: string
  ): Promise<{ success: boolean; message?: TelegramMessage; error?: string }> {
    if (!chatId || !command) return { success: false, error: 'Chat ID et commande requis' };
    const cleanCmd = command.trim().startsWith('/') ? command.trim() : `/${command.trim()}`;
    return this.sendMessage(chatId, cleanCmd);
  }

  /**
   * Telegram Real Call Operations (Requirement 1, 9, 15)
   */
  public getCallState() {
    return callManager.getState(this.userClient, this.isClientInitialized, this.accountInfo?.isBot || false);
  }

  public getCallHistory(chatId?: string) {
    return callManager.getHistory(chatId);
  }

  public async startCall(chatId: string, type: 'AUDIO' | 'VIDEO') {
    return callManager.startOutgoingCall(
      chatId,
      type,
      this.userClient,
      this.accountInfo ? { id: this.accountInfo.id, isBot: this.accountInfo.isBot } : undefined
    );
  }

  public async acceptCall(callId: string, withVideo?: boolean) {
    return callManager.acceptCall(callId, this.userClient, withVideo);
  }

  public async declineCall(callId: string, reason?: string) {
    return callManager.declineCall(callId, this.userClient, reason);
  }

  public async endCall(callId: string) {
    return callManager.endCall(callId, this.userClient);
  }

  public updateCallControls(controls: any) {
    return callManager.updateCallControls(controls);
  }
}

export const telegramService = new TelegramConnectionManager();
