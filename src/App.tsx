import React, { useState, useEffect, useCallback } from 'react';
import { api } from './services/api';
import { sseClient } from './services/sse';
import {
  Task,
  TelegramChat,
  TelegramCallRecord,
  TelegramCallCapability,
  Workflow,
  AutomationRun,
  SystemStatus,
  AppSettings
} from './types/task';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { ManualCheckpointBanner } from './components/ManualCheckpointBanner';
import { RecoveryBanner } from './components/RecoveryBanner';
import { TelegramCallOverlay } from './components/TelegramCallOverlay';
import { Dashboard } from './pages/Dashboard';
import { Tasks } from './pages/Tasks';
import { TelegramConnection } from './pages/TelegramConnection';
import { TelegramChats } from './pages/TelegramChats';
import { WorkflowRecorder } from './pages/WorkflowRecorder';
import { Workflows } from './pages/Workflows';
import { Automation } from './pages/Automation';
import { BrowserPage } from './pages/BrowserPage';
import { ActivityLog } from './pages/ActivityLog';
import { Settings } from './pages/Settings';
import { SystemTest } from './pages/SystemTest';

export default function App() {
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [chats, setChats] = useState<TelegramChat[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [interruptedTasks, setInterruptedTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [activeRun, setActiveRun] = useState<AutomationRun | null>(null);
  const [activeWorkflow, setActiveWorkflow] = useState<Workflow | null>(null);
  const [activeCall, setActiveCall] = useState<TelegramCallRecord | null>(null);
  const [callCapabilities, setCallCapabilities] = useState<TelegramCallCapability | undefined>(undefined);

  const loadData = useCallback(async () => {
    try {
      const [fetchedTasks, fetchedChats, fetchedWorkflows, fetchedStatus, fetchedInterrupted, callStateRes] =
        await Promise.all([
          api.getTasks(),
          api.getTelegramChats(),
          api.getWorkflows(),
          api.getSystemStatus(),
          api.getInterruptedTasks(),
          api.getTelegramCallState().catch(() => ({ success: false, activeCall: null, capabilities: { voiceCallsSupported: false, videoCallsSupported: false, groupCallsSupported: false } }))
        ]);

      setTasks(fetchedTasks);
      setChats(fetchedChats);
      setWorkflows(fetchedWorkflows);
      setSystemStatus(fetchedStatus);
      setInterruptedTasks(fetchedInterrupted);
      if (callStateRes?.success) {
        setActiveCall(callStateRes.activeCall);
        setCallCapabilities(callStateRes.capabilities);
      }

      // Identify active task & automation
      const autoStatus = await api.getAutomationStatus();
      setActiveTask(autoStatus.activeTask);
      setActiveRun(autoStatus.activeRun);
      setActiveWorkflow(autoStatus.activeWorkflow);

      // If a task is selected, keep its reference updated
      setSelectedTask(prev => {
        if (!prev) return null;
        return fetchedTasks.find(t => t.id === prev.id) || null;
      });
    } catch {
      // Ignored for resilience
    }
  }, []);

  // Initial load + Real-time SSE Setup
  useEffect(() => {
    loadData();

    // Connect SSE client
    sseClient.connect();

    const unsubTasks = sseClient.on('task:updated', () => loadData());
    const unsubDetected = sseClient.on('task:detected', () => loadData());
    const unsubCompleted = sseClient.on('task:completed', () => loadData());
    const unsubFailed = sseClient.on('task:failed', () => loadData());
    const unsubAuto = sseClient.on('automation:status', () => loadData());
    const unsubAutoStep = sseClient.on('automation:step', () => loadData());
    const unsubAutoManual = sseClient.on('automation:manual_checkpoint', () => loadData());
    const unsubChats = sseClient.on('telegram:chats', () => loadData());
    const unsubCallIncoming = sseClient.on('telegram:call:incoming', (data: any) => {
      if (data?.activeCall) setActiveCall(data.activeCall);
      else loadData();
    });
    const unsubCallState = sseClient.on('telegram:call:state', (data: any) => {
      if (data?.activeCall !== undefined) setActiveCall(data.activeCall);
      else loadData();
    });
    const unsubCallEnded = sseClient.on('telegram:call:ended', (data: any) => {
      if (data?.activeCall !== undefined) setActiveCall(data.activeCall);
      else loadData();
    });

    const interval = setInterval(loadData, 5000);

    return () => {
      unsubTasks();
      unsubDetected();
      unsubCompleted();
      unsubFailed();
      unsubAuto();
      unsubAutoStep();
      unsubAutoManual();
      unsubChats();
      unsubCallIncoming();
      unsubCallState();
      unsubCallEnded();
      clearInterval(interval);
      sseClient.disconnect();
    };
  }, [loadData]);

  const handleSelectTaskAndNavigate = (task: Task) => {
    setSelectedTask(task);
    setCurrentTab('tasks');
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 font-sans antialiased overflow-hidden select-none">
      {/* Navigation Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        systemStatus={systemStatus}
      />

      {/* Global Real Telegram Audio & Video Call Overlay */}
      <TelegramCallOverlay
        activeCall={activeCall}
        capabilities={callCapabilities}
        onCallStateChanged={loadData}
      />

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-950">
        {/* Top Header */}
        <Header
          systemStatus={systemStatus}
          activeTask={activeTask}
          activeRun={activeRun}
          onRefresh={loadData}
          onNavigateToTab={setCurrentTab}
        />

        {/* Global Manual Checkpoint Alert Banner */}
        {activeTask && activeTask.status === 'WAITING_MANUAL_ACTION' && (
          <ManualCheckpointBanner
            task={activeTask}
            run={activeRun}
            onResumed={loadData}
          />
        )}

        {/* Crash / Interrupted Tasks Recovery Banner */}
        {interruptedTasks.length > 0 && (
          <RecoveryBanner
            interruptedTasks={interruptedTasks}
            onActionComplete={loadData}
          />
        )}

        {/* Scrollable Page Body */}
        <main className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-slate-800">
          {currentTab === 'dashboard' && (
            <Dashboard
              systemStatus={systemStatus}
              tasks={tasks}
              chats={chats}
              activeTask={activeTask}
              activeRun={activeRun}
              activeWorkflow={activeWorkflow}
              onNavigateToTab={setCurrentTab}
              onRefresh={loadData}
              onSelectTask={handleSelectTaskAndNavigate}
            />
          )}

          {currentTab === 'tasks' && (
            <Tasks
              tasks={tasks}
              selectedTask={selectedTask}
              onSelectTask={setSelectedTask}
              onRefresh={loadData}
            />
          )}

          {currentTab === 'telegram' && (
            <TelegramConnection
              onNavigateToChats={() => setCurrentTab('chats')}
            />
          )}

          {currentTab === 'chats' && (
            <TelegramChats
              chats={chats}
              isTelegramConnected={systemStatus?.telegramState === 'CONNECTED' || systemStatus?.telegramState === 'READY'}
              onRefresh={loadData}
              onNavigateToTab={setCurrentTab}
            />
          )}

          {currentTab === 'recorder' && (
            <WorkflowRecorder
              chats={chats}
              onNavigateToTab={setCurrentTab}
              onRefresh={loadData}
            />
          )}

          {currentTab === 'workflows' && (
            <Workflows
              workflows={workflows}
              chats={chats}
              onRefresh={loadData}
              onNavigateToTab={setCurrentTab}
            />
          )}

          {currentTab === 'automation' && (
            <Automation
              activeTask={activeTask}
              activeWorkflow={activeWorkflow}
              activeRun={activeRun}
              systemStatus={systemStatus}
              tasks={tasks}
              onRefresh={loadData}
              onNavigateToTab={setCurrentTab}
            />
          )}

          {currentTab === 'browser' && <BrowserPage />}

          {currentTab === 'logs' && <ActivityLog />}

          {currentTab === 'settings' && (
            <Settings onRefresh={loadData} onNavigateToTab={setCurrentTab} />
          )}

          {currentTab === 'system_test' && (
            <SystemTest systemStatus={systemStatus} onRefresh={loadData} />
          )}
        </main>
      </div>
    </div>
  );
}
