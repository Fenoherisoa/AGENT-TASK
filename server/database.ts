import fs from 'fs';
import path from 'path';
import {
  Task,
  TaskEvent,
  TaskStatus,
  TelegramChat,
  TelegramMessage,
  Workflow,
  WorkflowVersion,
  PhoneReservation,
  AutomationRun,
  AppSettings,
  TelegramCallHistoryItem
} from '../src/types/task.js';
import { logger } from './logger.js';

interface DatabaseSchema {
  tasks: Task[];
  task_events: TaskEvent[];
  telegram_chats: TelegramChat[];
  telegram_messages: TelegramMessage[];
  telegram_calls: TelegramCallHistoryItem[];
  workflows: Workflow[];
  workflow_versions: WorkflowVersion[];
  phone_reservations: PhoneReservation[];
  automation_runs: AutomationRun[];
  settings: AppSettings;
}

const DATA_DIR = path.resolve(process.cwd(), '.data');
const DB_FILE = path.join(DATA_DIR, 'local_tasks_db.json');

const DEFAULT_SETTINGS: AppSettings = {
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
  telegramApiId: process.env.TELEGRAM_API_ID || '',
  telegramApiHash: process.env.TELEGRAM_API_HASH || '',
  telegramSession: process.env.TELEGRAM_SESSION || '',
  telegramChatId: process.env.TELEGRAM_CHAT_ID || '',
  targetUrl: process.env.TARGET_URL || '',
  autoStart: false,
  autoSelectNext: true,
  maxRetries: 3,
  stepTimeoutSeconds: 30,
  pauseOnError: true,
  browserEnabled: true,
  browserHeadless: false,
  browserTimeoutSeconds: 45,
  logRedaction: true,
  theme: 'dark',
  phoneProviderMode: 'mock',
  phoneBotToken: process.env.PHONE_PROVIDER_BOT_TOKEN || ''
};

class LocalDatabase {
  private data: DatabaseSchema = {
    tasks: [],
    task_events: [],
    telegram_chats: [],
    telegram_messages: [],
    workflows: [],
    workflow_versions: [],
    phone_reservations: [],
    automation_runs: [],
    telegram_calls: [],
    settings: { ...DEFAULT_SETTINGS }
  };
  private isLoaded = false;

  constructor() {
    this.init();
  }

  private init() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      if (fs.existsSync(DB_FILE)) {
        const fileContent = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(fileContent);
        
        // Filter out any mock, demo, sample, or non-Telegram tasks
        const loadedTasks: Task[] = Array.isArray(parsed.tasks) ? parsed.tasks : [];
        const validTelegramTasks: Task[] = loadedTasks.filter(t => {
          const hasChatId = Boolean(t.telegramChatId && String(t.telegramChatId).trim().length > 0);
          const hasMsgId = Boolean(t.telegramMessageId && String(t.telegramMessageId).trim().length > 0);
          const isNotDemo = !t.id?.startsWith('mock-') && 
                            !t.id?.startsWith('demo-') && 
                            !t.telegramTaskId?.startsWith('MANUAL-') && 
                            !t.telegramTaskId?.startsWith('TEST-') &&
                            t.firstName !== 'Jean' && 
                            t.lastName !== 'Dupont';
          const isTelegramSource = (t.sourceType === 'TELEGRAM' || !t.sourceType) && hasChatId && hasMsgId;
          return isTelegramSource && isNotDemo;
        }).map(t => ({
          ...t,
          sourceType: 'TELEGRAM' as const
        }));

        const validTaskIds = new Set(validTelegramTasks.map(t => t.id));
        const loadedEvents: TaskEvent[] = Array.isArray(parsed.task_events) ? parsed.task_events : [];
        const validEvents = loadedEvents.filter(e => !e.taskId || validTaskIds.has(e.taskId));

        this.data = {
          tasks: validTelegramTasks,
          task_events: validEvents,
          telegram_chats: Array.isArray(parsed.telegram_chats) ? parsed.telegram_chats : [],
          telegram_messages: Array.isArray(parsed.telegram_messages) ? parsed.telegram_messages : [],
          telegram_calls: Array.isArray(parsed.telegram_calls) ? parsed.telegram_calls : [],
          workflows: Array.isArray(parsed.workflows) ? parsed.workflows : [],
          workflow_versions: Array.isArray(parsed.workflow_versions) ? parsed.workflow_versions : [],
          phone_reservations: Array.isArray(parsed.phone_reservations) ? parsed.phone_reservations : [],
          automation_runs: Array.isArray(parsed.automation_runs) ? parsed.automation_runs : [],
          settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) }
        };
        this.isLoaded = true;
        this.save();
        logger.info(`Loaded database: ${this.data.tasks.length} real Telegram tasks, ${this.data.telegram_chats.length} chats, ${this.data.telegram_messages.length} messages.`);
      } else {
        // Fresh production database - strict empty tasks array
        this.data.tasks = [];
        this.data.task_events = [];
        this.save();
        this.isLoaded = true;
        logger.info('Initialized fresh SQLite/JSON database with 0 tasks (tasks = EMPTY).');
      }
    } catch (err: any) {
      logger.error('Failed to initialize local database', err);
      this.isLoaded = true;
    }
  }

  private save() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err: any) {
      logger.error('Error saving local database to disk', err);
    }
  }

  // ----------------------------------------------------
  // Task Operations (STRICT TELEGRAM PROVENANCE ONLY)
  // ----------------------------------------------------

  public getTasks(statusFilter?: TaskStatus): Task[] {
    if (statusFilter) {
      return this.data.tasks.filter(t => t.status === statusFilter && t.sourceType === 'TELEGRAM');
    }
    return this.data.tasks.filter(t => t.sourceType === 'TELEGRAM');
  }

  public getTaskById(id: string): Task | undefined {
    return this.data.tasks.find(t => t.id === id && t.sourceType === 'TELEGRAM');
  }

  public getTaskByTelegramId(telegramTaskId: string): Task | undefined {
    return this.data.tasks.find(t => t.telegramTaskId === telegramTaskId);
  }

  public getTaskByChatAndMessageId(chatId: string, messageId: string): Task | undefined {
    return this.data.tasks.find(
      t => String(t.telegramChatId) === String(chatId) && String(t.telegramMessageId) === String(messageId)
    );
  }

  public createTask(taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'attemptCount'>): Task {
    // 1. Validate Telegram Provenance
    if (!taskData.telegramChatId || !taskData.telegramMessageId || taskData.sourceType !== 'TELEGRAM') {
      logger.error('TASK_REJECTED: Telegram origin missing', {
        telegramChatId: taskData.telegramChatId,
        telegramMessageId: taskData.telegramMessageId,
        sourceType: taskData.sourceType
      });
      throw new Error('TASK_REJECTED: Telegram origin missing.');
    }

    // 2. Duplicate Prevention by telegramChatId + telegramMessageId
    const existingByMsg = this.getTaskByChatAndMessageId(taskData.telegramChatId, taskData.telegramMessageId);
    if (existingByMsg) {
      logger.warn(`Duplicate task rejected: Telegram chat ${taskData.telegramChatId} message ${taskData.telegramMessageId} already processed as task #${existingByMsg.telegramTaskId}`);
      throw new Error(`TASK_REJECTED: Telegram message ${taskData.telegramMessageId} in chat ${taskData.telegramChatId} already processed.`);
    }

    // 3. Duplicate Prevention by telegramTaskId if provided
    if (taskData.telegramTaskId) {
      const existingById = this.getTaskByTelegramId(taskData.telegramTaskId);
      if (existingById) {
        logger.warn(`Duplicate task ID rejected: #${taskData.telegramTaskId} already exists.`);
        throw new Error(`TASK_REJECTED: Task #${taskData.telegramTaskId} already exists.`);
      }
    }

    const id = `task-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const newTask: Task = {
      ...taskData,
      id,
      sourceType: 'TELEGRAM',
      telegramChatId: String(taskData.telegramChatId),
      telegramMessageId: String(taskData.telegramMessageId),
      telegramMessageDate: taskData.telegramMessageDate || now,
      attemptCount: 0,
      createdAt: now,
      updatedAt: now
    };

    this.data.tasks.unshift(newTask);
    this.addTaskEvent(
      id,
      'CREATED',
      `Tâche #${newTask.telegramTaskId} (Telegram Chat: ${newTask.telegramChatTitle || newTask.telegramChatId}, Msg: ${newTask.telegramMessageId}) enregistrée`,
      {
        telegramChatId: newTask.telegramChatId,
        telegramMessageId: newTask.telegramMessageId,
        sourceType: 'TELEGRAM'
      }
    );
    this.save();
    return newTask;
  }

  public updateTask(id: string, updates: Partial<Omit<Task, 'id' | 'createdAt'>>): Task | undefined {
    const index = this.data.tasks.findIndex(t => t.id === id);
    if (index === -1) return undefined;

    const current = this.data.tasks[index];
    const updated: Task = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    this.data.tasks[index] = updated;
    this.save();
    return updated;
  }

  public deleteTask(id: string): boolean {
    const prevLen = this.data.tasks.length;
    this.data.tasks = this.data.tasks.filter(t => t.id !== id);
    this.data.task_events = this.data.task_events.filter(e => e.taskId !== id);
    this.save();
    return this.data.tasks.length < prevLen;
  }

  // ----------------------------------------------------
  // Task Events (Audit Log)
  // ----------------------------------------------------

  public addTaskEvent(
    taskId: string | undefined,
    eventType: TaskEvent['eventType'],
    details: string,
    metadata?: Record<string, any>,
    workflowId?: string
  ): TaskEvent {
    const event: TaskEvent = {
      id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      taskId,
      workflowId,
      eventType,
      details,
      timestamp: new Date().toISOString(),
      metadata
    };

    this.data.task_events.unshift(event);
    if (this.data.task_events.length > 1000) {
      this.data.task_events = this.data.task_events.slice(0, 1000);
    }
    this.save();
    return event;
  }

  public getTaskEvents(taskId?: string): TaskEvent[] {
    if (taskId) {
      return this.data.task_events.filter(e => e.taskId === taskId);
    }
    return [...this.data.task_events];
  }

  // ----------------------------------------------------
  // Telegram Chats & Messages Manager
  // ----------------------------------------------------

  public getTelegramChats(): TelegramChat[] {
    return [...this.data.telegram_chats].sort((a, b) => {
      // Pinned chats first
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      // Then most recently active
      const dateA = a.lastMessageDate ? new Date(a.lastMessageDate).getTime() : 0;
      const dateB = b.lastMessageDate ? new Date(b.lastMessageDate).getTime() : 0;
      return dateB - dateA;
    });
  }

  public getTelegramChatById(chatId: string): TelegramChat | undefined {
    return this.data.telegram_chats.find(c => String(c.id) === String(chatId));
  }

  public upsertTelegramChat(chatData: Partial<TelegramChat> & { id: string; title: string }): TelegramChat {
    const index = this.data.telegram_chats.findIndex(c => String(c.id) === String(chatData.id));
    const now = new Date().toISOString();

    if (index >= 0) {
      const existing = this.data.telegram_chats[index];
      const updated: TelegramChat = {
        ...existing,
        ...chatData,
        messageCount: (existing.messageCount || 0) + (chatData.messageCount !== undefined ? 0 : 1),
        updatedAt: now
      };
      this.data.telegram_chats[index] = updated;
      this.save();
      return updated;
    } else {
      const newChat: TelegramChat = {
        id: String(chatData.id),
        title: chatData.title,
        username: chatData.username,
        type: chatData.type || 'group',
        lastMessage: chatData.lastMessage,
        lastMessageDate: chatData.lastMessageDate || now,
        unreadCount: chatData.unreadCount || 0,
        participantsCount: chatData.participantsCount,
        isPinned: !!chatData.isPinned,
        isMuted: !!chatData.isMuted,
        avatarColor: chatData.avatarColor,
        role: chatData.role || 'TASK_SOURCE',
        monitored: chatData.monitored !== undefined ? chatData.monitored : true,
        messageCount: 1,
        updatedAt: now
      };
      this.data.telegram_chats.push(newChat);
      this.addTaskEvent(undefined, 'CHAT_DISCOVERED', `Nouveau chat Telegram détecté : ${newChat.title} (ID: ${newChat.id})`);
      this.save();
      return newChat;
    }
  }

  public updateTelegramChatRole(chatId: string, role: TelegramChat['role'], monitored?: boolean): TelegramChat | undefined {
    const chat = this.getTelegramChatById(chatId);
    if (!chat) return undefined;

    chat.role = role;
    if (monitored !== undefined) {
      chat.monitored = monitored;
    }
    chat.updatedAt = new Date().toISOString();
    this.save();
    return chat;
  }

  public getMonitoredChatIds(): string[] {
    return this.data.telegram_chats
      .filter(c => c.monitored && (c.role === 'TASK_SOURCE' || c.role === 'DATA_SOURCE'))
      .map(c => String(c.id));
  }

  // ----------------------------------------------------
  // Telegram Messages
  // ----------------------------------------------------

  public getTelegramMessages(chatId: string, limit = 50, beforeMessageId?: string, search?: string): TelegramMessage[] {
    let list = this.data.telegram_messages.filter(m => String(m.chatId) === String(chatId));

    if (search && search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(m => m.text?.toLowerCase().includes(q) || m.senderName?.toLowerCase().includes(q));
    }

    // Sort chronologically ascending for timeline
    list.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (beforeMessageId) {
      const idx = list.findIndex(m => String(m.id) === String(beforeMessageId));
      if (idx > 0) {
        list = list.slice(0, idx);
      }
    }

    if (limit && list.length > limit) {
      list = list.slice(list.length - limit);
    }

    return list;
  }

  public getTelegramMessageById(chatId: string, messageId: string): TelegramMessage | undefined {
    return this.data.telegram_messages.find(
      m => String(m.chatId) === String(chatId) && String(m.id) === String(messageId)
    );
  }

  public upsertTelegramMessage(msg: TelegramMessage): TelegramMessage {
    const index = this.data.telegram_messages.findIndex(
      m => String(m.chatId) === String(msg.chatId) && String(m.id) === String(msg.id)
    );

    if (index >= 0) {
      const existing = this.data.telegram_messages[index];
      const updated = { ...existing, ...msg };
      this.data.telegram_messages[index] = updated;
      this.save();
      return updated;
    } else {
      this.data.telegram_messages.push(msg);
      // Keep message buffer reasonably bounded to 5000 messages per instance
      if (this.data.telegram_messages.length > 5000) {
        this.data.telegram_messages = this.data.telegram_messages.slice(-5000);
      }
      this.save();
      return msg;
    }
  }

  public upsertTelegramMessages(msgs: TelegramMessage[]): number {
    let addedOrUpdated = 0;
    for (const msg of msgs) {
      const index = this.data.telegram_messages.findIndex(
        m => String(m.chatId) === String(msg.chatId) && String(m.id) === String(msg.id)
      );
      if (index >= 0) {
        this.data.telegram_messages[index] = { ...this.data.telegram_messages[index], ...msg };
      } else {
        this.data.telegram_messages.push(msg);
      }
      addedOrUpdated++;
    }

    if (this.data.telegram_messages.length > 5000) {
      this.data.telegram_messages = this.data.telegram_messages.slice(-5000);
    }

    this.save();
    return addedOrUpdated;
  }

  public deleteTelegramMessage(chatId: string, messageId: string): boolean {
    const prevLen = this.data.telegram_messages.length;
    this.data.telegram_messages = this.data.telegram_messages.filter(
      m => !(String(m.chatId) === String(chatId) && String(m.id) === String(messageId))
    );
    this.save();
    return this.data.telegram_messages.length < prevLen;
  }

  public updateTelegramMessageText(chatId: string, messageId: string, newText: string): TelegramMessage | undefined {
    const msg = this.getTelegramMessageById(chatId, messageId);
    if (!msg) return undefined;
    msg.text = newText;
    msg.isEdited = true;
    msg.editDate = new Date().toISOString();
    this.save();
    return msg;
  }

  public setTelegramMessagePinned(chatId: string, messageId: string, isPinned: boolean): TelegramMessage | undefined {
    const msg = this.getTelegramMessageById(chatId, messageId);
    if (!msg) return undefined;
    msg.isPinned = isPinned;
    this.save();
    return msg;
  }

  public updateTelegramMessageReactions(chatId: string, messageId: string, reaction: string): TelegramMessage | undefined {
    const msg = this.getTelegramMessageById(chatId, messageId);
    if (!msg) return undefined;
    if (!msg.reactions) msg.reactions = [];

    const existingIdx = msg.reactions.findIndex(r => r.emoticon === reaction);
    if (existingIdx >= 0) {
      if (msg.reactions[existingIdx].chosen) {
        msg.reactions[existingIdx].chosen = false;
        msg.reactions[existingIdx].count = Math.max(0, msg.reactions[existingIdx].count - 1);
        if (msg.reactions[existingIdx].count === 0) {
          msg.reactions.splice(existingIdx, 1);
        }
      } else {
        msg.reactions[existingIdx].chosen = true;
        msg.reactions[existingIdx].count += 1;
      }
    } else {
      msg.reactions.push({ emoticon: reaction, count: 1, chosen: true });
    }
    this.save();
    return msg;
  }

  // ----------------------------------------------------
  // Telegram Call History
  // ----------------------------------------------------

  public getTelegramCallHistory(chatId?: string): TelegramCallHistoryItem[] {
    if (chatId) {
      return this.data.telegram_calls.filter(c => String(c.chatId) === String(chatId));
    }
    return [...this.data.telegram_calls].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  public addTelegramCallHistory(item: TelegramCallHistoryItem): TelegramCallHistoryItem {
    this.data.telegram_calls.unshift(item);
    if (this.data.telegram_calls.length > 500) {
      this.data.telegram_calls = this.data.telegram_calls.slice(0, 500);
    }
    this.save();
    return item;
  }

  public clearTelegramCallHistory(): void {
    this.data.telegram_calls = [];
    this.save();
  }

  // ----------------------------------------------------
  // Workflows & Workflow Builder
  // ----------------------------------------------------

  public getWorkflows(): Workflow[] {
    return [...this.data.workflows];
  }

  public getWorkflowById(id: string): Workflow | undefined {
    return this.data.workflows.find(w => w.id === id);
  }

  public getActiveWorkflowForChat(chatId?: string): Workflow | undefined {
    const enabledWorkflows = this.data.workflows.filter(w => w.enabled);
    if (!enabledWorkflows.length) return undefined;

    if (chatId) {
      const matching = enabledWorkflows.find(w => w.sourceChats && w.sourceChats.includes(String(chatId)));
      if (matching) return matching;
    }

    return enabledWorkflows[0];
  }

  public createWorkflow(workflowData: Omit<Workflow, 'id' | 'createdAt' | 'updatedAt' | 'version'>): Workflow {
    const id = `wf-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();
    const newWorkflow: Workflow = {
      ...workflowData,
      id,
      version: 1,
      createdAt: now,
      updatedAt: now
    };

    this.data.workflows.push(newWorkflow);

    // Save initial version snapshot
    this.data.workflow_versions.push({
      id: `ver-${Date.now()}`,
      workflowId: id,
      version: 1,
      name: newWorkflow.name,
      steps: [...newWorkflow.steps],
      createdAt: now
    });

    this.addTaskEvent(undefined, 'WORKFLOW_ACTIVATED', `Nouveau workflow créé : "${newWorkflow.name}" (v1)`, undefined, id);
    this.save();
    return newWorkflow;
  }

  public updateWorkflow(id: string, updates: Partial<Omit<Workflow, 'id' | 'createdAt'>>): Workflow | undefined {
    const index = this.data.workflows.findIndex(w => w.id === id);
    if (index === -1) return undefined;

    const current = this.data.workflows[index];
    const newVersion = updates.steps ? current.version + 1 : current.version;
    const now = new Date().toISOString();

    const updated: Workflow = {
      ...current,
      ...updates,
      version: newVersion,
      updatedAt: now
    };

    this.data.workflows[index] = updated;

    if (updates.steps) {
      this.data.workflow_versions.push({
        id: `ver-${Date.now()}`,
        workflowId: id,
        version: newVersion,
        name: updated.name,
        steps: [...updated.steps],
        createdAt: now
      });
    }

    this.save();
    return updated;
  }

  public deleteWorkflow(id: string): boolean {
    const prevLen = this.data.workflows.length;
    this.data.workflows = this.data.workflows.filter(w => w.id !== id);
    this.data.workflow_versions = this.data.workflow_versions.filter(v => v.workflowId !== id);
    this.save();
    return this.data.workflows.length < prevLen;
  }

  public getWorkflowVersions(workflowId: string) {
    return this.data.workflow_versions
      .filter(v => v.workflowId === workflowId)
      .sort((a, b) => b.version - a.version);
  }

  // ----------------------------------------------------
  // Phone Provider Reservations
  // ----------------------------------------------------

  public getPhoneReservations(): PhoneReservation[] {
    return [...this.data.phone_reservations];
  }

  public getActiveReservationByTaskId(taskId: string): PhoneReservation | undefined {
    return this.data.phone_reservations.find(r => r.taskId === taskId && r.status === 'RESERVED');
  }

  public createPhoneReservation(taskId: string, phone: string, provider: PhoneReservation['provider']): PhoneReservation {
    // Release any existing reservation for this task
    this.releasePhoneReservation(taskId);

    const reservation: PhoneReservation = {
      id: `phone-res-${Date.now()}`,
      taskId,
      phone,
      provider,
      status: 'RESERVED',
      reservedAt: new Date().toISOString()
    };

    this.data.phone_reservations.unshift(reservation);
    this.save();
    return reservation;
  }

  public releasePhoneReservation(taskId: string): PhoneReservation | undefined {
    const res = this.getActiveReservationByTaskId(taskId);
    if (res) {
      res.status = 'RELEASED';
      res.releasedAt = new Date().toISOString();
      this.save();
      return res;
    }
    return undefined;
  }

  // ----------------------------------------------------
  // Automation Runs
  // ----------------------------------------------------

  public getAutomationRuns(): AutomationRun[] {
    return [...this.data.automation_runs];
  }

  public getActiveAutomationRun(): AutomationRun | undefined {
    return this.data.automation_runs.find(
      r => r.status === 'RUNNING' || r.status === 'STARTING' || r.status === 'WAITING_MANUAL' || r.status === 'PAUSED'
    );
  }

  public saveAutomationRun(run: AutomationRun): AutomationRun {
    const index = this.data.automation_runs.findIndex(r => r.id === run.id);
    if (index >= 0) {
      this.data.automation_runs[index] = run;
    } else {
      this.data.automation_runs.unshift(run);
      if (this.data.automation_runs.length > 50) {
        this.data.automation_runs = this.data.automation_runs.slice(0, 50);
      }
    }
    this.save();
    return run;
  }

  // ----------------------------------------------------
  // Settings & Status
  // ----------------------------------------------------

  public getSettings(): AppSettings {
    return { ...this.data.settings };
  }

  public updateSettings(updates: Partial<AppSettings>): AppSettings {
    this.data.settings = {
      ...this.data.settings,
      ...updates
    };
    this.save();
    return { ...this.data.settings };
  }

  public clearAll() {
    this.data.tasks = [];
    this.data.task_events = [];
    this.data.telegram_messages = [];
    this.data.phone_reservations = [];
    this.data.automation_runs = [];
    this.save();
  }

  public getInterruptedTasks(): Task[] {
    return this.data.tasks.filter(
      t => t.status === 'IN_PROGRESS' || t.status === 'WAITING_MANUAL_ACTION'
    );
  }

  public getStats() {
    const tasks = this.data.tasks;
    return {
      total: tasks.length,
      pending: tasks.filter(t => t.status === 'PENDING').length,
      inProgress: tasks.filter(t => t.status === 'IN_PROGRESS').length,
      waitingManual: tasks.filter(t => t.status === 'WAITING_MANUAL_ACTION').length,
      completed: tasks.filter(t => t.status === 'COMPLETED').length,
      failed: tasks.filter(t => t.status === 'FAILED').length,
      skipped: tasks.filter(t => t.status === 'SKIPPED').length,
      chatsCount: this.data.telegram_chats.length,
      messagesCount: this.data.telegram_messages.length,
      workflowsCount: this.data.workflows.length,
      activeWorkflowsCount: this.data.workflows.filter(w => w.enabled).length,
      interruptedCount: this.getInterruptedTasks().length
    };
  }
}

export const db = new LocalDatabase();
