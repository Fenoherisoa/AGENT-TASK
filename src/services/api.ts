import {
  Task,
  TaskEvent,
  TaskStatus,
  TelegramChat,
  TelegramMessage,
  TelegramChatFullInfo,
  TelegramChatUIState,
  TelegramCallRecord,
  TelegramCallCapability,
  TelegramCallHistoryItem,
  Workflow,
  RecorderState,
  AutomationRun,
  AutomationState,
  AppSettings,
  SystemStatus,
  SystemTestReport
} from '../types/task';

export const api = {
  // ----------------------------------------------------
  // Tasks
  // ----------------------------------------------------
  async getTasks(status?: TaskStatus): Promise<Task[]> {
    const url = status ? `/api/tasks?status=${encodeURIComponent(status)}` : '/api/tasks';
    const res = await fetch(url);
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to fetch tasks');
    return data.tasks;
  },

  async getTask(id: string): Promise<{ task: Task; events: TaskEvent[] }> {
    const res = await fetch(`/api/tasks/${id}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Task not found');
    return { task: data.task, events: data.events };
  },

  async createTask(taskData: Partial<Task>): Promise<Task> {
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(taskData)
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to create task');
    return data.task;
  },

  async ingestTelegramMessage(message: string, chatId?: string): Promise<{ task: Task }> {
    const res = await fetch('/api/tasks/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, chatId })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to parse message');
    return data;
  },

  async updateTask(id: string, updates: Partial<Task>): Promise<Task> {
    const res = await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to update task');
    return data.task;
  },

  async deleteTask(id: string): Promise<void> {
    const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to delete task');
  },

  // ----------------------------------------------------
  // Task State Transitions & Workflow Execution
  // ----------------------------------------------------
  async startTask(id: string, workflowId?: string): Promise<{ task: Task; run?: AutomationRun }> {
    const res = await fetch(`/api/tasks/${id}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workflowId })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to start task');
    return data;
  },

  async waitManualAction(id: string): Promise<Task> {
    const res = await fetch(`/api/tasks/${id}/wait-manual`, { method: 'POST' });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to set manual action state');
    return data.task;
  },

  async resumeTask(id: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`/api/tasks/${id}/resume`, { method: 'POST' });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to resume task');
    return data;
  },

  async completeTask(id: string): Promise<Task> {
    const res = await fetch(`/api/tasks/${id}/complete`, { method: 'POST' });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to complete task');
    return data.task;
  },

  async failTask(id: string, reason?: string): Promise<Task> {
    const res = await fetch(`/api/tasks/${id}/fail`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to mark task as failed');
    return data.task;
  },

  async skipTask(id: string): Promise<Task> {
    const res = await fetch(`/api/tasks/${id}/skip`, { method: 'POST' });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to skip task');
    return data.task;
  },

  async retryTask(id: string): Promise<Task> {
    const res = await fetch(`/api/tasks/${id}/retry`, { method: 'POST' });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to retry task');
    return data.task;
  },

  // ----------------------------------------------------
  // Telegram Connection & Chat Manager
  // ----------------------------------------------------
  async getTelegramStatus() {
    const res = await fetch('/api/telegram/status');
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to get Telegram status');
    return data.status;
  },

  async connectTelegram(token: string) {
    const res = await fetch('/api/telegram/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to connect Telegram');
    return data;
  },

  async connectTelegramUser(params: { apiId: string; apiHash: string; sessionString: string }) {
    const res = await fetch('/api/telegram/connect-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to connect Telegram user session');
    return data;
  },

  async sendTelegramCode(params: { apiId: string; apiHash: string; phoneNumber: string }) {
    const res = await fetch('/api/telegram/send-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Échec de l\'envoi du code Telegram');
    return data;
  },

  async verifyTelegramCode(params: { phoneCode: string; password?: string }) {
    const res = await fetch('/api/telegram/verify-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    const data = await res.json();
    if (!data.success && !data.requires2FA) throw new Error(data.error || 'Code Telegram invalide');
    return data;
  },

  async reconnectTelegram() {
    const res = await fetch('/api/telegram/reconnect', { method: 'POST' });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to reconnect Telegram');
    return data;
  },

  async disconnectTelegram() {
    const res = await fetch('/api/telegram/disconnect', { method: 'POST' });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to disconnect Telegram');
    return data;
  },

  async getTelegramChats(): Promise<TelegramChat[]> {
    const res = await fetch('/api/telegram/chats');
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to fetch chats');
    return data.chats;
  },

  async getTelegramChat(id: string): Promise<TelegramChat> {
    const res = await fetch(`/api/telegram/chats/${encodeURIComponent(id)}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to fetch chat');
    return data.chat;
  },

  async updateTelegramChat(id: string, updates: Partial<TelegramChat>): Promise<TelegramChat> {
    const res = await fetch(`/api/telegram/chats/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to update chat');
    return data.chat;
  },

  async getTelegramMessages(
    chatId: string,
    params?: { limit?: number; offsetId?: number; search?: string }
  ): Promise<{ messages: TelegramMessage[]; hasMore: boolean }> {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offsetId) query.set('offsetId', String(params.offsetId));
    if (params?.search) query.set('search', params.search);

    const url = `/api/telegram/chats/${encodeURIComponent(chatId)}/messages?${query.toString()}`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data.success && !Array.isArray(data.messages)) throw new Error(data.error || 'Failed to fetch messages');
    return {
      messages: data.messages || [],
      hasMore: !!data.hasMore
    };
  },

  async syncTelegram(): Promise<{ tasksImported: number; chatsDiscovered: number; errors: string[] }> {
    const res = await fetch('/api/telegram/sync', { method: 'POST' });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Telegram sync failed');
    return data.result;
  },

  async sendTelegramMessage(chatId: string, message: string, replyToMsgId?: string): Promise<{ success: boolean; message?: TelegramMessage; error?: string }> {
    const res = await fetch(`/api/telegram/chats/${encodeURIComponent(chatId)}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, replyToMsgId })
    });
    return res.json();
  },

  async editTelegramMessage(chatId: string, messageId: string, text: string): Promise<{ success: boolean; message?: TelegramMessage; error?: string }> {
    const res = await fetch(`/api/telegram/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(messageId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    return res.json();
  },

  async deleteTelegramMessage(chatId: string, messageId: string): Promise<{ success: boolean; error?: string }> {
    const res = await fetch(`/api/telegram/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(messageId)}`, {
      method: 'DELETE'
    });
    return res.json();
  },

  async pinTelegramMessage(chatId: string, messageId: string, unpin = false, notify = false): Promise<{ success: boolean; error?: string }> {
    const res = await fetch(`/api/telegram/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(messageId)}/pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unpin, notify })
    });
    return res.json();
  },

  async reactTelegramMessage(chatId: string, messageId: string, reaction: string): Promise<{ success: boolean; message?: TelegramMessage; error?: string }> {
    const res = await fetch(`/api/telegram/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(messageId)}/reaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reaction })
    });
    return res.json();
  },

  async clickTelegramCallback(chatId: string, messageId: string, callbackData?: string): Promise<{ success: boolean; message?: string; alert?: boolean; url?: string; error?: string }> {
    const res = await fetch(`/api/telegram/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(messageId)}/callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callbackData })
    });
    return res.json();
  },

  async forwardTelegramMessages(chatId: string, toChatId: string, messageIds: string[]): Promise<{ success: boolean; error?: string }> {
    const res = await fetch(`/api/telegram/chats/${encodeURIComponent(chatId)}/forward`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toChatId, messageIds })
    });
    return res.json();
  },

  async getTelegramChatFull(chatId: string): Promise<{ success: boolean; info?: TelegramChatFullInfo; error?: string }> {
    const res = await fetch(`/api/telegram/chats/${encodeURIComponent(chatId)}/full`);
    return res.json();
  },

  async getTelegramChatUIState(chatId: string): Promise<{ success: boolean; uiState?: TelegramChatUIState; error?: string }> {
    const res = await fetch(`/api/telegram/chats/${encodeURIComponent(chatId)}/ui-state`);
    return res.json();
  },

  async clickTelegramReplyButton(chatId: string, buttonText: string, actionType?: string): Promise<{ success: boolean; message?: TelegramMessage; error?: string }> {
    const res = await fetch(`/api/telegram/chats/${encodeURIComponent(chatId)}/reply-button`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ buttonText, actionType })
    });
    return res.json();
  },

  async sendTelegramBotCommand(chatId: string, command: string): Promise<{ success: boolean; message?: TelegramMessage; error?: string }> {
    const res = await fetch(`/api/telegram/chats/${encodeURIComponent(chatId)}/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command })
    });
    return res.json();
  },

  async getTelegramWorkspaceState(chatId?: string): Promise<{ success: boolean; workspaceState?: any; error?: string }> {
    const res = await fetch(`/api/telegram/workspace-state${chatId ? `?chatId=${encodeURIComponent(chatId)}` : ''}`);
    return res.json();
  },

  // ----------------------------------------------------
  // Telegram Audio & Video Calls
  // ----------------------------------------------------
  async getTelegramCallState(): Promise<{ success: boolean; activeCall: TelegramCallRecord | null; capabilities: TelegramCallCapability; error?: string }> {
    const res = await fetch('/api/telegram/calls/state');
    return res.json();
  },

  async getTelegramCallHistory(chatId?: string): Promise<{ success: boolean; history: TelegramCallHistoryItem[]; error?: string }> {
    const res = await fetch(`/api/telegram/calls/history${chatId ? `?chatId=${encodeURIComponent(chatId)}` : ''}`);
    return res.json();
  },

  async startTelegramCall(chatId: string, type: 'AUDIO' | 'VIDEO'): Promise<{ success: boolean; call?: TelegramCallRecord; error?: string }> {
    const res = await fetch('/api/telegram/calls/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId, type })
    });
    return res.json();
  },

  async acceptTelegramCall(callId: string, withVideo?: boolean): Promise<{ success: boolean; call?: TelegramCallRecord; error?: string }> {
    const res = await fetch(`/api/telegram/calls/${encodeURIComponent(callId)}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ withVideo })
    });
    return res.json();
  },

  async declineTelegramCall(callId: string, reason?: string): Promise<{ success: boolean; error?: string }> {
    const res = await fetch(`/api/telegram/calls/${encodeURIComponent(callId)}/decline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    });
    return res.json();
  },

  async endTelegramCall(callId: string): Promise<{ success: boolean; error?: string }> {
    const res = await fetch(`/api/telegram/calls/${encodeURIComponent(callId)}/end`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    return res.json();
  },

  async updateTelegramCallControls(
    callId: string,
    controls: { microphoneEnabled?: boolean; cameraEnabled?: boolean; speakerEnabled?: boolean; quality?: string }
  ): Promise<{ success: boolean; call?: TelegramCallRecord; error?: string }> {
    const res = await fetch(`/api/telegram/calls/${encodeURIComponent(callId)}/controls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(controls)
    });
    return res.json();
  },

  // ----------------------------------------------------
  // Workflows
  // ----------------------------------------------------
  async getWorkflows(): Promise<Workflow[]> {
    const res = await fetch('/api/workflows');
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to get workflows');
    return data.workflows;
  },

  async getWorkflow(id: string): Promise<Workflow> {
    const res = await fetch(`/api/workflows/${id}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Workflow not found');
    return data.workflow;
  },

  async createWorkflow(wfData: Partial<Workflow>): Promise<Workflow> {
    const res = await fetch('/api/workflows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(wfData)
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to create workflow');
    return data.workflow;
  },

  async updateWorkflow(id: string, updates: Partial<Workflow>): Promise<Workflow> {
    const res = await fetch(`/api/workflows/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to update workflow');
    return data.workflow;
  },

  async deleteWorkflow(id: string): Promise<void> {
    const res = await fetch(`/api/workflows/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to delete workflow');
  },

  async duplicateWorkflow(id: string): Promise<Workflow> {
    const res = await fetch(`/api/workflows/${id}/duplicate`, { method: 'POST' });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to duplicate workflow');
    return data.workflow;
  },

  async getWorkflowVersions(id: string) {
    const res = await fetch(`/api/workflows/${id}/versions`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to fetch workflow versions');
    return data.versions;
  },

  async rollbackWorkflow(id: string, versionNumber: number): Promise<{ workflow: Workflow; message: string }> {
    const res = await fetch(`/api/workflows/${id}/rollback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ versionNumber })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to rollback workflow');
    return data;
  },

  // ----------------------------------------------------
  // Workflow Recorder
  // ----------------------------------------------------
  async getRecorderStatus(): Promise<RecorderState> {
    const res = await fetch('/api/recorder/status');
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to get recorder status');
    return data.status;
  },

  async startRecording(name: string, sourceChats: string[]): Promise<RecorderState> {
    const res = await fetch('/api/recorder/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, sourceChats })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to start recording');
    return data.state;
  },

  async recordEvent(action: any): Promise<any> {
    const res = await fetch('/api/recorder/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(action)
    });
    const data = await res.json();
    return data.event;
  },

  async stopRecording(): Promise<{ workflow: Workflow }> {
    const res = await fetch('/api/recorder/stop', { method: 'POST' });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to build workflow');
    return data;
  },

  async cancelRecording(): Promise<void> {
    await fetch('/api/recorder/cancel', { method: 'POST' });
  },

  // ----------------------------------------------------
  // Automation Runner
  // ----------------------------------------------------
  async getAutomationStatus(): Promise<{
    state: AutomationState;
    activeRun: AutomationRun | null;
    activeTask: Task | null;
    activeWorkflow: Workflow | null;
  }> {
    const res = await fetch('/api/automation/status');
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to get automation status');
    return data.status;
  },

  async pauseAutomation(): Promise<void> {
    await fetch('/api/automation/pause', { method: 'POST' });
  },

  async resumeAutomation(taskId?: string): Promise<void> {
    await fetch('/api/automation/resume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId })
    });
  },

  async stopAutomation(): Promise<void> {
    await fetch('/api/automation/stop', { method: 'POST' });
  },

  // ----------------------------------------------------
  // Browser Automation
  // ----------------------------------------------------
  async getBrowserStatus() {
    const res = await fetch('/api/browser/status');
    const data = await res.json();
    return data.status;
  },

  async openBrowserTarget(url?: string): Promise<{ success: boolean; url?: string; message?: string; error?: string }> {
    const res = await fetch('/api/browser/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    return res.json();
  },

  async executeBrowserAction(action: { type: string; target?: string; value?: string; timeoutMs?: number }): Promise<{ success: boolean; message: string }> {
    const res = await fetch('/api/browser/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(action)
    });
    return res.json();
  },

  async closeBrowser(): Promise<{ success: boolean; message: string }> {
    const res = await fetch('/api/browser/close', { method: 'POST' });
    return res.json();
  },

  // ----------------------------------------------------
  // Phone Provider
  // ----------------------------------------------------
  async getPhoneNumber(taskId: string): Promise<{ phone: string; provider: string; reservationId?: string }> {
    const res = await fetch('/api/phone/get', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to acquire phone number');
    return { phone: data.phone, provider: data.provider, reservationId: data.reservationId };
  },

  async releasePhoneNumber(taskId: string): Promise<{ releasedPhone?: string }> {
    const res = await fetch('/api/phone/release', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to release phone');
    return data;
  },

  async refreshPhoneNumber(taskId: string): Promise<{ phone: string; provider: string }> {
    const res = await fetch('/api/phone/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to refresh phone');
    return { phone: data.phone, provider: data.provider };
  },

  // ----------------------------------------------------
  // Recovery
  // ----------------------------------------------------
  async getInterruptedTasks(): Promise<Task[]> {
    const res = await fetch('/api/recovery/interrupted');
    const data = await res.json();
    return data.tasks || [];
  },

  async recoverTaskResume(id: string) {
    const res = await fetch(`/api/recovery/${id}/resume`, { method: 'POST' });
    return res.json();
  },

  async recoverTaskRestart(id: string) {
    const res = await fetch(`/api/recovery/${id}/restart`, { method: 'POST' });
    return res.json();
  },

  async recoverTaskFail(id: string) {
    const res = await fetch(`/api/recovery/${id}/fail`, { method: 'POST' });
    return res.json();
  },

  // ----------------------------------------------------
  // Events (Audit Log)
  // ----------------------------------------------------
  async getEvents(taskId?: string): Promise<TaskEvent[]> {
    const url = taskId ? `/api/events?taskId=${encodeURIComponent(taskId)}` : '/api/events';
    const res = await fetch(url);
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to load events');
    return data.events;
  },

  // ----------------------------------------------------
  // Settings & Diagnostics
  // ----------------------------------------------------
  async getSettings(): Promise<AppSettings> {
    const res = await fetch('/api/settings');
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to get settings');
    return data.settings;
  },

  async updateSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to update settings');
    return data.settings;
  },

  async getSystemStatus(): Promise<SystemStatus> {
    const res = await fetch('/api/system/status');
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to get system status');
    return data.status;
  },

  async runSystemTests(): Promise<SystemTestReport> {
    const res = await fetch('/api/system/test', { method: 'POST' });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Test suite execution failed');
    return data.report;
  },

  async clearDatabase(): Promise<void> {
    const res = await fetch('/api/database/clear', { method: 'POST' });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to clear database');
  }
};
