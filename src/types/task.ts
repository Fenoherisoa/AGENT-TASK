export type TaskStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'WAITING_MANUAL_ACTION'
  | 'COMPLETED'
  | 'FAILED'
  | 'SKIPPED';

export type TelegramChatRole =
  | 'TASK_SOURCE'
  | 'DATA_SOURCE'
  | 'RESULT_SOURCE'
  | 'VALIDATION_SOURCE'
  | 'SUPPORT'
  | 'OTHER';

export type TelegramConnectionState =
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'AUTHENTICATING'
  | 'INITIALIZING_CLIENT'
  | 'LOADING_CHATS'
  | 'SYNCING'
  | 'READY'
  | 'CONNECTED'
  | 'RECONNECTING'
  | 'ERROR';

export type WorkflowStepType =
  | 'OPEN'
  | 'NAVIGATE'
  | 'CLICK'
  | 'TYPE'
  | 'SELECT'
  | 'WAIT'
  | 'WAIT_FOR_ELEMENT'
  | 'READ_ALLOWED_DATA'
  | 'SWITCH_CHAT'
  | 'VALIDATE'
  | 'MANUAL_CHECKPOINT'
  | 'COMPLETE';

export type AutomationState =
  | 'IDLE'
  | 'STARTING'
  | 'RUNNING'
  | 'WAITING_MANUAL'
  | 'PAUSED'
  | 'COMPLETING'
  | 'COMPLETED'
  | 'FAILED'
  | 'STOPPED';

export type PhoneReservationStatus =
  | 'AVAILABLE'
  | 'RESERVED'
  | 'RELEASED'
  | 'EXPIRED';

export interface TelegramCapabilities {
  canReply: boolean;
  canSend: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canForward: boolean;
  canPin: boolean;
  canReact: boolean;
  canInvite: boolean;
  canManageTopics: boolean;
  isChannel: boolean;
  isGroup: boolean;
  isSupergroup: boolean;
  isPrivate: boolean;
  isBot: boolean;
  isServiceChat: boolean;
  isAdmin: boolean;
}

export interface TelegramInlineButton {
  text: string;
  type: 'callback' | 'url' | 'web_app' | 'switch_inline' | 'buy' | 'other';
  url?: string;
  callbackData?: string;
  webAppUrl?: string;
  samePeer?: boolean;
}

export interface TelegramNormalizedButton {
  label: string;
  type: 'text' | 'callback' | 'url' | 'web_app' | 'request_phone' | 'request_location' | 'request_poll' | 'switch_inline' | 'command' | 'other';
  actionId: string;
  payload?: string;
  url?: string;
  webAppUrl?: string;
  samePeer?: boolean;
}

export interface TelegramParsedKeyboard {
  chatId: string;
  messageId?: string;
  type: 'REPLY_KEYBOARD' | 'INLINE_KEYBOARD' | 'COMMAND_MENU' | 'NONE';
  rows: TelegramNormalizedButton[][];
  resize?: boolean;
  singleUse?: boolean;
  selective?: boolean;
  placeholder?: string;
  updatedAt: string;
}

export interface TelegramReplyKeyboardButton {
  text: string;
  type: 'text' | 'request_phone' | 'request_location' | 'request_poll' | 'web_app';
  webAppUrl?: string;
}

export interface TelegramReplyKeyboard {
  rows: TelegramReplyKeyboardButton[][];
  resize?: boolean;
  singleUse?: boolean;
  selective?: boolean;
  placeholder?: string;
  sourceMessageId?: string;
}

export interface TelegramBotMenuButton {
  type: 'commands' | 'web_app' | 'default';
  text?: string;
  url?: string;
}

export interface TelegramStructuredControl {
  id: string;
  type: 'reply_button' | 'inline_button' | 'command' | 'web_app' | 'url' | 'discussion' | 'phone_request' | 'location_request';
  label: string;
  sourceMessageId?: string;
  callbackDataAvailable: boolean;
  url?: string;
  command?: string;
  payload?: string;
  enabled: boolean;
  visible: boolean;
  row?: number;
  col?: number;
}

export interface TelegramChatUIState {
  chatId: string;
  chatType: TelegramChat['type'];
  title: string;
  canSend: boolean;
  canReply: boolean;
  canAttach: boolean;
  isReadOnly: boolean;
  isChannel: boolean;
  hasDiscussion: boolean;
  discussionChatId?: string;
  replyKeyboard?: TelegramReplyKeyboard;
  parsedKeyboard?: TelegramParsedKeyboard;
  botCommands?: TelegramBotCommand[];
  botMenuButton?: TelegramBotMenuButton;
  botHasOpenInterface?: boolean;
  openButtonVisible?: boolean;
  openButtonType?: string;
  openButtonAction?: string;
  activeInlineButtons?: Array<{
    messageId: string;
    rows: TelegramInlineButton[][];
  }>;
  structuredControls: TelegramStructuredControl[];
  updatedAt: string;
}

export interface TelegramReaction {
  emoticon: string;
  count: number;
  chosen?: boolean;
}

export interface TelegramBotCommand {
  command: string;
  description: string;
}

export interface TelegramForwardInfo {
  fromName?: string;
  fromId?: string;
  isChannel?: boolean;
  date?: string;
  originalMessageId?: string;
}

export interface TelegramServiceAction {
  type: 'pin' | 'joined' | 'left' | 'title_changed' | 'photo_changed' | 'group_created' | 'topic_created' | 'other';
  text: string;
  pinnedMessageId?: string;
}

export interface TelegramChatFullInfo {
  id: string;
  title: string;
  username?: string;
  type: 'channel' | 'supergroup' | 'group' | 'private' | 'bot';
  about?: string;
  participantsCount?: number;
  onlineCount?: number;
  admins?: Array<{ id: string; name: string; username?: string; role?: string; isOwner?: boolean }>;
  members?: Array<{ id: string; name: string; username?: string; status?: string }>;
  pinnedMessage?: TelegramMessage;
  capabilities: TelegramCapabilities;
  botCommands?: TelegramBotCommand[];
  availableReactions?: string[];
  linkedDiscussionChatId?: string;
  sharedMediaCounts?: {
    photos?: number;
    videos?: number;
    files?: number;
    links?: number;
    audio?: number;
  };
}

export interface TelegramChat {
  id: string; // Chat ID as string
  title: string;
  username?: string;
  type: 'channel' | 'supergroup' | 'group' | 'private' | 'bot';
  about?: string;
  lastMessage?: string;
  lastMessageDate?: string;
  unreadCount?: number;
  participantsCount?: number;
  isPinned?: boolean;
  isMuted?: boolean;
  avatarColor?: string;
  role: TelegramChatRole;
  monitored: boolean;
  messageCount: number;
  capabilities?: TelegramCapabilities;
  updatedAt: string;
}

export type TelegramCallState =
  | 'NONE'
  | 'INCOMING'
  | 'RINGING'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'VIDEO_CONNECTED'
  | 'ENDING'
  | 'ENDED'
  | 'MISSED'
  | 'FAILED'
  | 'DECLINED';

export type TelegramCallType = 'AUDIO' | 'VIDEO';

export interface TelegramCallRecord {
  callId: string;
  chatId: string;
  userId?: string;
  userName: string;
  userUsername?: string;
  userAvatarColor?: string;
  type: TelegramCallType;
  state: TelegramCallState;
  direction: 'INCOMING' | 'OUTGOING';
  duration: number; // in seconds
  startedAt?: string;
  endedAt?: string;
  quality?: 'EXCELLENT' | 'GOOD' | 'POOR' | 'RECONNECTING';
  error?: string;
  microphoneEnabled?: boolean;
  cameraEnabled?: boolean;
  speakerEnabled?: boolean;
}

export interface TelegramCallCapability {
  voiceCallsSupported: boolean;
  videoCallsSupported: boolean;
  groupCallsSupported: boolean;
  reason?: string;
}

export interface TelegramCallHistoryItem {
  id: string;
  chatId: string;
  userId?: string;
  userName: string;
  userUsername?: string;
  type: TelegramCallType;
  direction: 'INCOMING' | 'OUTGOING';
  status: 'CONNECTED' | 'MISSED' | 'DECLINED' | 'FAILED' | 'ENDED';
  duration: number;
  date: string;
}

export interface TelegramMessage {
  id: string; // Telegram message ID as string
  chatId: string;
  senderId?: string;
  senderName?: string;
  senderUsername?: string;
  text: string;
  date: string; // ISO format
  isOutgoing: boolean;
  mediaType?: 'photo' | 'video' | 'document' | 'audio' | 'voice' | 'sticker' | 'contact' | 'location';
  mediaCaption?: string;
  mediaUrl?: string;
  fileName?: string;
  fileSize?: string;
  replyToMessageId?: string;
  replyToText?: string;
  replyToSender?: string;
  replyCount?: number;
  threadId?: string;
  forwardInfo?: TelegramForwardInfo;
  serviceAction?: TelegramServiceAction;
  inlineButtons?: TelegramInlineButton[][];
  reactions?: TelegramReaction[];
  views?: number;
  forwards?: number;
  isEdited?: boolean;
  editDate?: string;
  isPinned?: boolean;
  canReply?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  canPin?: boolean;
  canReact?: boolean;
  canForward?: boolean;
  isTaskDetected?: boolean;
  detectedTaskId?: string;
  unread?: boolean;
}

export interface Task {
  id: string;
  telegramChatId: string;
  telegramMessageId: string;
  telegramMessageDate?: string;
  telegramChatTitle?: string;
  sourceType: 'TELEGRAM';
  telegramTaskId: string;
  firstName: string;
  lastName: string;
  password: string;
  phone?: string;
  status: TaskStatus;
  notes?: string;
  rawTelegramMessage?: string;
  errorMessage?: string;
  attemptCount: number;
  lastError?: string;
  workflowId?: string;
  currentStepIndex?: number;
  startedAt?: string;
  completedAt?: string;
  failedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskEvent {
  id: string;
  taskId?: string;
  workflowId?: string;
  eventType:
    | 'CREATED'
    | 'STARTED'
    | 'STEP_STARTED'
    | 'STEP_COMPLETED'
    | 'MANUAL_WAIT'
    | 'MANUAL_RESUMED'
    | 'COMPLETED'
    | 'FAILED'
    | 'SKIPPED'
    | 'PHONE_ASSIGNED'
    | 'PHONE_RELEASED'
    | 'NOTE_ADDED'
    | 'RETRIED'
    | 'RECOVERY'
    | 'TELEGRAM_CONNECTED'
    | 'TELEGRAM_DISCONNECTED'
    | 'CHAT_DISCOVERED'
    | 'WORKFLOW_ACTIVATED';
  details: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface WorkflowStep {
  id: string;
  type: WorkflowStepType;
  name: string;
  target?: string;
  parameters?: Record<string, any>;
  timeoutSeconds: number;
  retryCount: number;
  condition?: string;
  manualCheckpoint?: boolean;
  manualInstructions?: string;
  enabled: boolean;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  version: number;
  enabled: boolean;
  sourceChats: string[]; // List of telegramChatId
  targetUrl?: string;
  steps: WorkflowStep[];
  completionRules?: {
    autoNext?: boolean;
    notifyTelegramChatId?: string;
    timeoutSeconds?: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowVersion {
  id: string;
  workflowId: string;
  version: number;
  name: string;
  steps: WorkflowStep[];
  createdAt: string;
}

export interface PhoneReservation {
  id: string;
  taskId: string;
  phone: string;
  provider: 'MOCK_POOL' | 'TELEGRAM_BOT' | 'EXTERNAL_API';
  status: PhoneReservationStatus;
  reservedAt: string;
  releasedAt?: string;
  expiresAt?: string;
}

export interface AutomationRun {
  id: string;
  taskId: string;
  workflowId: string;
  status: AutomationState;
  currentStepIndex: number;
  totalSteps: number;
  startedAt: string;
  completedAt?: string;
  elapsedMs: number;
  lastAction?: string;
  lastError?: string;
  manualCheckpointRequired?: boolean;
  manualInstructions?: string;
  checkpointData?: Record<string, any>;
  logs: string[];
}

export interface RecorderState {
  isRecording: boolean;
  startedAt?: string;
  sourceChats: string[];
  workflowName: string;
  recordedEvents: Array<{
    id: string;
    type: WorkflowStepType;
    name: string;
    target?: string;
    parameters?: Record<string, any>;
    timestamp: string;
  }>;
}

export interface AppSettings {
  telegramBotToken: string;
  telegramApiId?: string;
  telegramApiHash?: string;
  telegramSession?: string;
  telegramChatId: string;
  targetUrl?: string;
  autoStart: boolean;
  autoSelectNext: boolean;
  maxRetries: number;
  stepTimeoutSeconds: number;
  pauseOnError: boolean;
  browserEnabled: boolean;
  browserHeadless: boolean;
  browserTimeoutSeconds: number;
  logRedaction: boolean;
  theme: 'dark' | 'light' | 'system';
  customParserPattern?: string;
  phoneProviderMode: 'mock' | 'telegram_bot';
  phoneBotToken?: string;
}

export interface SystemStatus {
  telegramState: TelegramConnectionState;
  telegramUsername?: string;
  telegramChatCount: number;
  databaseConnected: boolean;
  automationState: AutomationState;
  activeTaskId?: string;
  activeWorkflowId?: string;
  browserReady: boolean;
  phoneProviderReady: boolean;
  queueLength: number;
  pendingCount: number;
  inProgressCount: number;
  waitingManualCount: number;
  completedCount: number;
  failedCount: number;
  skippedCount: number;
  targetUrl?: string;
  uptimeSeconds: number;
  interruptedTasksCount: number;
}

export interface TestResult {
  id: string;
  name: string;
  passed: boolean;
  durationMs: number;
  message: string;
  details?: string;
}

export interface SystemTestReport {
  timestamp: string;
  allPassed: boolean;
  summary: string;
  tests: TestResult[];
}
