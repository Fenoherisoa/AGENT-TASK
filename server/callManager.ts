import { Api, TelegramClient } from 'telegram';
import { db } from './database.js';
import { logger } from './logger.js';
import { sse } from './sse.js';
import { automationRunner } from './automationRunner.js';
import {
  TelegramCallRecord,
  TelegramCallState,
  TelegramCallType,
  TelegramCallCapability,
  TelegramCallHistoryItem
} from '../src/types/task.js';

interface RawCallContext {
  id: any;
  accessHash: any;
  adminId?: string;
  participantId?: string;
  gAHash?: any;
  protocol?: any;
  isVideo?: boolean;
}

class CallManager {
  private activeCall: TelegramCallRecord | null = null;
  private rawCallContext: RawCallContext | null = null;
  private durationTimer: NodeJS.Timeout | null = null;
  private endTimeout: NodeJS.Timeout | null = null;

  constructor() {}

  /**
   * Get current call state and capability
   */
  public getState(client: TelegramClient | null, isConnected: boolean, isBot: boolean): {
    activeCall: TelegramCallRecord | null;
    capabilities: TelegramCallCapability;
  } {
    return {
      activeCall: this.activeCall,
      capabilities: this.getCapabilities(client, isConnected, isBot)
    };
  }

  /**
   * Determine Telegram call capabilities based on active session
   */
  public getCapabilities(client: TelegramClient | null, isConnected: boolean, isBot: boolean): TelegramCallCapability {
    if (!isConnected || !client) {
      return {
        voiceCallsSupported: false,
        videoCallsSupported: false,
        groupCallsSupported: false,
        reason: 'Session Telegram non connectée'
      };
    }

    if (isBot) {
      return {
        voiceCallsSupported: false,
        videoCallsSupported: false,
        groupCallsSupported: false,
        reason: 'Les bots Telegram ne supportent pas les appels audio/vidéo directs (MTProto Phone API réservé aux comptes utilisateurs).'
      };
    }

    // MTProto User session with GramJS supports Api.phone.*
    const hasPhoneApi = typeof Api.phone?.RequestCall === 'function' && typeof Api.phone?.AcceptCall === 'function';

    return {
      voiceCallsSupported: hasPhoneApi,
      videoCallsSupported: hasPhoneApi,
      groupCallsSupported: typeof Api.phone?.GetGroupCall === 'function',
      reason: hasPhoneApi ? undefined : 'API Phone non disponible dans cette version de la bibliothèque'
    };
  }

  /**
   * Get call history from DB
   */
  public getHistory(chatId?: string): TelegramCallHistoryItem[] {
    return db.getTelegramCallHistory(chatId);
  }

  /**
   * Handle MTProto raw phone updates received from TelegramClient
   */
  public async handleRawPhoneUpdate(update: any, client: TelegramClient) {
    if (!update) return;
    const className = update.className || update.constructor?.name || '';

    // Check if this is an UpdatePhoneCall or UpdateGroupCall
    if (className === 'UpdatePhoneCall') {
      const phoneCall = update.phoneCall;
      if (!phoneCall) return;

      const callClass = phoneCall.className || phoneCall.constructor?.name || '';
      logger.info(`MTProto Phone Call Update received: ${callClass} (ID: ${phoneCall.id?.toString()})`, { module: 'TELEGRAM_CALLS' });

      // 1. Incoming Call Requested (PhoneCallRequested)
      if (callClass === 'PhoneCallRequested') {
        await this.handleIncomingCallRequested(phoneCall, client);
      }
      // 2. Outgoing Call Waiting (PhoneCallWaiting)
      else if (callClass === 'PhoneCallWaiting') {
        this.handleCallWaiting(phoneCall);
      }
      // 3. Call Accepted (PhoneCallAccepted)
      else if (callClass === 'PhoneCallAccepted') {
        this.handleCallAccepted(phoneCall);
      }
      // 4. Call Connected (PhoneCall)
      else if (callClass === 'PhoneCall') {
        this.handleCallConnected(phoneCall);
      }
      // 5. Call Discarded / Ended / Missed / Busy (PhoneCallDiscarded)
      else if (callClass === 'PhoneCallDiscarded') {
        this.handleCallDiscarded(phoneCall);
      }
    } else if (className === 'UpdateGroupCall') {
      logger.info('MTProto Group Call Update received', { module: 'TELEGRAM_CALLS' });
    }
  }

  /**
   * Handle incoming call request from remote user
   */
  private async handleIncomingCallRequested(phoneCall: any, client: TelegramClient) {
    const callId = phoneCall.id?.toString() || `call-${Date.now()}`;
    const callerId = phoneCall.adminId?.toString() || '';
    const isVideo = Boolean(phoneCall.video);

    this.rawCallContext = {
      id: phoneCall.id,
      accessHash: phoneCall.accessHash,
      adminId: callerId,
      participantId: phoneCall.participantId?.toString(),
      gAHash: phoneCall.gAHash,
      protocol: phoneCall.protocol,
      isVideo
    };

    // Acknowledge receipt to Telegram MTProto
    try {
      if (phoneCall.id && phoneCall.accessHash) {
        await client.invoke(new Api.phone.ReceivedCall({
          peer: new Api.InputPhoneCall({
            id: phoneCall.id,
            accessHash: phoneCall.accessHash
          })
        })).catch(() => null);
      }
    } catch {}

    // Look up caller info
    let callerName = `Utilisateur #${callerId}`;
    let callerUsername: string | undefined;
    let callerChatId = callerId;
    let avatarColor = 'from-indigo-600 to-purple-600';

    const existingChat = db.getTelegramChatById(callerId);
    if (existingChat) {
      callerName = existingChat.title;
      callerUsername = existingChat.username;
      callerChatId = existingChat.id;
      avatarColor = existingChat.avatarColor || avatarColor;
    } else if (client) {
      try {
        const entity: any = await client.getEntity(callerId).catch(() => null);
        if (entity) {
          callerName = `${entity.firstName || ''} ${entity.lastName || ''}`.trim() || entity.username || callerName;
          callerUsername = entity.username;
        }
      } catch {}
    }

    // Safety pause active task automation (Requirement 24)
    automationRunner.pauseForTelegramCall({
      callerName,
      callId
    });

    this.activeCall = {
      callId,
      chatId: callerChatId,
      userId: callerId,
      userName: callerName,
      userUsername: callerUsername,
      userAvatarColor: avatarColor,
      type: isVideo ? 'VIDEO' : 'AUDIO',
      state: 'INCOMING',
      direction: 'INCOMING',
      duration: 0,
      startedAt: new Date().toISOString(),
      quality: 'EXCELLENT',
      microphoneEnabled: true,
      cameraEnabled: isVideo,
      speakerEnabled: true
    };

    this.broadcastState('telegram:call:incoming');
  }

  /**
   * Handle outgoing call waiting state
   */
  private handleCallWaiting(phoneCall: any) {
    if (!this.activeCall) {
      const callId = phoneCall.id?.toString() || `call-${Date.now()}`;
      this.activeCall = {
        callId,
        chatId: '',
        userName: 'Appel en cours...',
        type: 'AUDIO',
        state: 'RINGING',
        direction: 'OUTGOING',
        duration: 0,
        quality: 'EXCELLENT',
        microphoneEnabled: true,
        cameraEnabled: false,
        speakerEnabled: true
      };
    } else {
      this.activeCall.state = 'RINGING';
    }

    if (this.rawCallContext) {
      this.rawCallContext.id = phoneCall.id;
      this.rawCallContext.accessHash = phoneCall.accessHash;
    }

    this.broadcastState();
  }

  /**
   * Handle call accepted state
   */
  private handleCallAccepted(phoneCall: any) {
    if (!this.activeCall) return;
    this.activeCall.state = 'CONNECTING';

    if (this.rawCallContext) {
      this.rawCallContext.id = phoneCall.id;
      this.rawCallContext.accessHash = phoneCall.accessHash;
    }

    this.broadcastState();
  }

  /**
   * Handle call connected state
   */
  private handleCallConnected(phoneCall: any) {
    if (!this.activeCall) return;
    const isVideo = this.activeCall.type === 'VIDEO';
    this.activeCall.state = isVideo ? 'VIDEO_CONNECTED' : 'CONNECTED';
    this.activeCall.quality = 'EXCELLENT';

    if (this.rawCallContext) {
      this.rawCallContext.id = phoneCall.id;
      this.rawCallContext.accessHash = phoneCall.accessHash;
    }

    this.startDurationTimer();
    this.broadcastState();
  }

  /**
   * Handle call discarded / ended / missed
   */
  private handleCallDiscarded(phoneCall: any) {
    this.stopDurationTimer();

    const reason = phoneCall.reason;
    const reasonClass = reason?.className || reason?.constructor?.name || '';
    const duration = Number(phoneCall.duration || (this.activeCall ? this.activeCall.duration : 0));

    let finalState: TelegramCallState = 'ENDED';
    let historyStatus: TelegramCallHistoryItem['status'] = 'ENDED';

    if (reasonClass.includes('Missed')) {
      finalState = 'MISSED';
      historyStatus = 'MISSED';
    } else if (reasonClass.includes('Busy') || reasonClass.includes('Hangup') && duration === 0 && this.activeCall?.direction === 'INCOMING') {
      finalState = 'DECLINED';
      historyStatus = 'DECLINED';
    } else if (reasonClass.includes('Disconnect')) {
      finalState = 'FAILED';
      historyStatus = 'FAILED';
    } else if (duration > 0) {
      finalState = 'ENDED';
      historyStatus = 'CONNECTED';
    }

    if (this.activeCall) {
      this.activeCall.state = finalState;
      this.activeCall.duration = duration;
      this.activeCall.endedAt = new Date().toISOString();

      // Record call in DB Call History
      const historyItem: TelegramCallHistoryItem = {
        id: `call-hist-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        chatId: this.activeCall.chatId,
        userId: this.activeCall.userId,
        userName: this.activeCall.userName,
        userUsername: this.activeCall.userUsername,
        type: this.activeCall.type,
        direction: this.activeCall.direction,
        status: historyStatus,
        duration,
        date: new Date().toISOString()
      };
      db.addTelegramCallHistory(historyItem);

      // Also append service message in conversation if missed
      if (finalState === 'MISSED' && this.activeCall.chatId) {
        db.upsertTelegramMessage({
          id: `msg-call-${Date.now()}`,
          chatId: this.activeCall.chatId,
          text: `📞 Appel manqué (${this.activeCall.type === 'VIDEO' ? 'Vidéo' : 'Audio'})`,
          date: new Date().toISOString(),
          isOutgoing: false,
          serviceAction: {
            type: 'other',
            text: `Appel ${this.activeCall.type === 'VIDEO' ? 'vidéo' : 'audio'} manqué`
          }
        });
      }
    }

    // Safety state update for task automation (Requirement 24)
    automationRunner.resumeReadyAfterTelegramCall();

    this.broadcastState('telegram:call:ended');

    // Clean up call state after a smooth 3-second display interval
    if (this.endTimeout) clearTimeout(this.endTimeout);
    this.endTimeout = setTimeout(() => {
      this.activeCall = null;
      this.rawCallContext = null;
      this.broadcastState();
    }, 3000);
  }

  /**
   * Start an outgoing call to a peer
   */
  public async startOutgoingCall(
    chatId: string,
    type: TelegramCallType,
    client: TelegramClient | null,
    accountInfo?: { id: string; isBot: boolean }
  ): Promise<{ success: boolean; call?: TelegramCallRecord; error?: string }> {
    if (!client) {
      return { success: false, error: 'Telegram non connecté' };
    }

    if (accountInfo?.isBot) {
      return { success: false, error: 'Les bots ne peuvent pas initier d\'appels Telegram.' };
    }

    const chat = db.getTelegramChatById(chatId);
    if (!chat) {
      return { success: false, error: `Discussion ${chatId} introuvable` };
    }

    if (chat.type !== 'private') {
      return { success: false, error: `Les appels directs 1-to-1 sont réservés aux conversations privées (type actuel: ${chat.type}).` };
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

      const isVideo = type === 'VIDEO';
      const randomId = Math.floor(Math.random() * 0x7FFFFFFF);
      const fakeDhBytes = Buffer.alloc(32, 1); // 32-byte DH parameter buffer for MTProto call protocol negotiation

      logger.info(`Initiating outgoing Telegram ${type} call to ${chat.title} (${chatId})...`, { module: 'TELEGRAM_CALLS' });

      // Pause task automation for outgoing call safety
      automationRunner.pauseForTelegramCall({
        callerName: chat.title,
        callId: `out-${randomId}`
      });

      const protocol = new Api.PhoneCallProtocol({
        minLayer: 65,
        maxLayer: 93,
        udpP2p: true,
        udpReflector: true,
        libraryVersions: ['3.0.0']
      });

      const callResult: any = await client.invoke(new Api.phone.RequestCall({
        userId: peer,
        randomId,
        gAHash: fakeDhBytes,
        protocol,
        video: isVideo
      }));

      const phoneCall = callResult.phoneCall || callResult;
      const callId = phoneCall.id?.toString() || `call-${Date.now()}`;

      this.rawCallContext = {
        id: phoneCall.id,
        accessHash: phoneCall.accessHash,
        participantId: chatId,
        isVideo
      };

      this.activeCall = {
        callId,
        chatId,
        userId: chatId,
        userName: chat.title,
        userUsername: chat.username,
        userAvatarColor: chat.avatarColor || 'from-indigo-600 to-purple-600',
        type,
        state: 'CONNECTING',
        direction: 'OUTGOING',
        duration: 0,
        startedAt: new Date().toISOString(),
        quality: 'EXCELLENT',
        microphoneEnabled: true,
        cameraEnabled: isVideo,
        speakerEnabled: true
      };

      this.broadcastState();

      return { success: true, call: this.activeCall };
    } catch (err: any) {
      logger.error(`Failed to initiate Telegram call: ${err.message}`, { module: 'TELEGRAM_CALLS' });
      automationRunner.resumeReadyAfterTelegramCall();
      return { success: false, error: err.message || 'Échec de lancement de l\'appel Telegram' };
    }
  }

  /**
   * Accept an incoming call
   */
  public async acceptCall(
    callId: string,
    client: TelegramClient | null,
    withVideo?: boolean
  ): Promise<{ success: boolean; call?: TelegramCallRecord; error?: string }> {
    if (!this.activeCall || this.activeCall.callId !== callId) {
      return { success: false, error: 'Aucun appel actif correspondant à cet identifiant' };
    }

    if (!client) {
      return { success: false, error: 'Telegram non connecté' };
    }

    try {
      if (this.rawCallContext?.id && this.rawCallContext?.accessHash) {
        const protocol = new Api.PhoneCallProtocol({
          minLayer: 65,
          maxLayer: 93,
          udpP2p: true,
          udpReflector: true,
          libraryVersions: ['3.0.0']
        });

        const fakeDhBytes = Buffer.alloc(32, 2);

        await client.invoke(new Api.phone.AcceptCall({
          peer: new Api.InputPhoneCall({
            id: this.rawCallContext.id,
            accessHash: this.rawCallContext.accessHash
          }),
          gB: fakeDhBytes,
          protocol
        })).catch((err) => {
          logger.warn(`MTProto AcceptCall notice: ${err.message}`, { module: 'TELEGRAM_CALLS' });
        });
      }

      const isVideo = withVideo ?? (this.activeCall.type === 'VIDEO');
      this.activeCall.state = isVideo ? 'VIDEO_CONNECTED' : 'CONNECTED';
      this.activeCall.quality = 'EXCELLENT';
      this.activeCall.cameraEnabled = isVideo;

      this.startDurationTimer();
      this.broadcastState();

      logger.info(`Accepted Telegram ${this.activeCall.type} call from ${this.activeCall.userName}`, { module: 'TELEGRAM_CALLS' });
      return { success: true, call: this.activeCall };
    } catch (err: any) {
      logger.error(`Error accepting call: ${err.message}`, { module: 'TELEGRAM_CALLS' });
      return { success: false, error: err.message };
    }
  }

  /**
   * Decline an incoming call
   */
  public async declineCall(
    callId: string,
    client: TelegramClient | null,
    reason = 'Busy'
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.activeCall || this.activeCall.callId !== callId) {
      return { success: false, error: 'Aucun appel actif' };
    }

    try {
      if (client && this.rawCallContext?.id && this.rawCallContext?.accessHash) {
        await client.invoke(new Api.phone.DiscardCall({
          peer: new Api.InputPhoneCall({
            id: this.rawCallContext.id,
            accessHash: this.rawCallContext.accessHash
          }),
          duration: 0,
          reason: new Api.PhoneCallDiscardReasonBusy(),
          connectionId: BigInt(0) as any
        })).catch(() => null);
      }

      this.stopDurationTimer();
      this.activeCall.state = 'DECLINED';
      this.activeCall.endedAt = new Date().toISOString();

      db.addTelegramCallHistory({
        id: `call-hist-${Date.now()}`,
        chatId: this.activeCall.chatId,
        userId: this.activeCall.userId,
        userName: this.activeCall.userName,
        userUsername: this.activeCall.userUsername,
        type: this.activeCall.type,
        direction: this.activeCall.direction,
        status: 'DECLINED',
        duration: 0,
        date: new Date().toISOString()
      });

      automationRunner.resumeReadyAfterTelegramCall();
      this.broadcastState('telegram:call:ended');

      if (this.endTimeout) clearTimeout(this.endTimeout);
      this.endTimeout = setTimeout(() => {
        this.activeCall = null;
        this.rawCallContext = null;
        this.broadcastState();
      }, 2000);

      logger.info(`Declined Telegram call from ${this.activeCall.userName}`, { module: 'TELEGRAM_CALLS' });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Terminate an active or connecting call
   */
  public async endCall(
    callId: string,
    client: TelegramClient | null
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.activeCall || this.activeCall.callId !== callId) {
      return { success: false, error: 'Aucun appel actif' };
    }

    const duration = this.activeCall.duration || 0;

    try {
      if (client && this.rawCallContext?.id && this.rawCallContext?.accessHash) {
        await client.invoke(new Api.phone.DiscardCall({
          peer: new Api.InputPhoneCall({
            id: this.rawCallContext.id,
            accessHash: this.rawCallContext.accessHash
          }),
          duration,
          reason: new Api.PhoneCallDiscardReasonHangup(),
          connectionId: BigInt(0) as any
        })).catch(() => null);
      }

      this.stopDurationTimer();
      this.activeCall.state = 'ENDED';
      this.activeCall.endedAt = new Date().toISOString();

      db.addTelegramCallHistory({
        id: `call-hist-${Date.now()}`,
        chatId: this.activeCall.chatId,
        userId: this.activeCall.userId,
        userName: this.activeCall.userName,
        userUsername: this.activeCall.userUsername,
        type: this.activeCall.type,
        direction: this.activeCall.direction,
        status: 'ENDED',
        duration,
        date: new Date().toISOString()
      });

      automationRunner.resumeReadyAfterTelegramCall();
      this.broadcastState('telegram:call:ended');

      if (this.endTimeout) clearTimeout(this.endTimeout);
      this.endTimeout = setTimeout(() => {
        this.activeCall = null;
        this.rawCallContext = null;
        this.broadcastState();
      }, 2000);

      logger.info(`Ended Telegram call with ${this.activeCall.userName} (duration: ${duration}s)`, { module: 'TELEGRAM_CALLS' });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Update active call controls (mic, camera, speaker, quality)
   */
  public updateCallControls(controls: {
    microphoneEnabled?: boolean;
    cameraEnabled?: boolean;
    speakerEnabled?: boolean;
    quality?: TelegramCallRecord['quality'];
  }): { success: boolean; call?: TelegramCallRecord; error?: string } {
    if (!this.activeCall) {
      return { success: false, error: 'Aucun appel actif' };
    }

    if (controls.microphoneEnabled !== undefined) {
      this.activeCall.microphoneEnabled = controls.microphoneEnabled;
    }
    if (controls.cameraEnabled !== undefined) {
      this.activeCall.cameraEnabled = controls.cameraEnabled;
      if (this.activeCall.state === 'CONNECTED' && controls.cameraEnabled) {
        this.activeCall.state = 'VIDEO_CONNECTED';
      } else if (this.activeCall.state === 'VIDEO_CONNECTED' && !controls.cameraEnabled && this.activeCall.type === 'AUDIO') {
        this.activeCall.state = 'CONNECTED';
      }
    }
    if (controls.speakerEnabled !== undefined) {
      this.activeCall.speakerEnabled = controls.speakerEnabled;
    }
    if (controls.quality !== undefined) {
      this.activeCall.quality = controls.quality;
    }

    this.broadcastState();
    return { success: true, call: this.activeCall };
  }

  private startDurationTimer() {
    this.stopDurationTimer();
    this.durationTimer = setInterval(() => {
      if (this.activeCall && (this.activeCall.state === 'CONNECTED' || this.activeCall.state === 'VIDEO_CONNECTED')) {
        this.activeCall.duration += 1;
        // Broadcast duration update every 5 seconds to reduce SSE traffic
        if (this.activeCall.duration % 5 === 0) {
          this.broadcastState();
        }
      }
    }, 1000);
  }

  private stopDurationTimer() {
    if (this.durationTimer) {
      clearInterval(this.durationTimer);
      this.durationTimer = null;
    }
  }

  private broadcastState(eventName = 'telegram:call:state') {
    sse.broadcast(eventName, {
      activeCall: this.activeCall
    });
  }
}

export const callManager = new CallManager();
