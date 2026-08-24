import React from 'react';
import {
  ListOrdered,
  Clock,
  PlayCircle,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  SkipForward,
  Plus,
  RefreshCw,
  ExternalLink,
  MessageSquare,
  ArrowRight,
  ShieldCheck,
  Zap,
  Activity
} from 'lucide-react';
import { SystemStatus, Task, TelegramChat, AutomationRun, Workflow } from '../types/task';
import { api } from '../services/api';

interface DashboardProps {
  systemStatus: SystemStatus | null;
  tasks: Task[];
  chats: TelegramChat[];
  activeTask: Task | null;
  activeRun: AutomationRun | null;
  activeWorkflow: Workflow | null;
  onNavigateToTab: (tab: string) => void;
  onRefresh: () => void;
  onSelectTask: (task: Task) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  systemStatus,
  tasks,
  chats,
  activeTask,
  activeRun,
  activeWorkflow,
  onNavigateToTab,
  onRefresh,
  onSelectTask
}) => {
  const isWaitingManual = activeTask?.status === 'WAITING_MANUAL_ACTION' || activeRun?.status === 'WAITING_MANUAL';

  const handleStartTask = async (taskId: string) => {
    try {
      await api.startTask(taskId);
      onRefresh();
    } catch {
      // Handled
    }
  };

  const handleResumeTask = async (taskId: string) => {
    try {
      await api.resumeTask(taskId);
      onRefresh();
    } catch {
      // Handled
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Telegram Connection Alert if Disconnected */}
      {systemStatus && systemStatus.telegramState !== 'CONNECTED' && systemStatus.telegramState !== 'READY' && (
        <div className="bg-slate-900 border border-indigo-500/30 p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg">
          <div className="flex items-center space-x-3.5">
            <div className="p-3 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold font-mono tracking-wider text-amber-400 uppercase">
                  TELEGRAM NON CONNECTÉ
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                  {systemStatus.telegramState}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Connectez votre compte ou session Telegram autorisé pour synchroniser les messages en direct et découvrir vos groupes.
              </p>
            </div>
          </div>

          <button
            onClick={() => onNavigateToTab('telegram')}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-600/20 transition shrink-0"
          >
            <span>Connecter un Compte Telegram</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div
          onClick={() => onNavigateToTab('tasks')}
          className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl hover:border-slate-700 cursor-pointer transition"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Total File</span>
            <ListOrdered className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">{systemStatus?.queueLength || 0}</div>
          <div className="text-[10px] text-slate-400 mt-1">Toutes les tâches</div>
        </div>

        <div
          onClick={() => onNavigateToTab('tasks')}
          className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl hover:border-slate-700 cursor-pointer transition"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">En Attente</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400 font-mono">{systemStatus?.pendingCount || 0}</div>
          <div className="text-[10px] text-slate-400 mt-1">Prêtes à exécuter</div>
        </div>

        <div
          onClick={() => onNavigateToTab('automation')}
          className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl hover:border-slate-700 cursor-pointer transition"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">En Cours</span>
            <PlayCircle className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold text-cyan-400 font-mono">{systemStatus?.inProgressCount || 0}</div>
          <div className="text-[10px] text-slate-400 mt-1">Automatisation active</div>
        </div>

        <div
          onClick={() => onNavigateToTab('tasks')}
          className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl hover:border-slate-700 cursor-pointer transition"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Action Manuelle</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-300 font-mono">{systemStatus?.waitingManualCount || 0}</div>
          <div className="text-[10px] text-slate-400 mt-1">Points de contrôle</div>
        </div>

        <div
          onClick={() => onNavigateToTab('tasks')}
          className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl hover:border-slate-700 cursor-pointer transition"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Terminées</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 font-mono">{systemStatus?.completedCount || 0}</div>
          <div className="text-[10px] text-slate-400 mt-1">Validées avec succès</div>
        </div>

        <div
          onClick={() => onNavigateToTab('tasks')}
          className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl hover:border-slate-700 cursor-pointer transition"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Échouées</span>
            <XCircle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold text-rose-400 font-mono">{systemStatus?.failedCount || 0}</div>
          <div className="text-[10px] text-slate-400 mt-1">À réinspecter</div>
        </div>
      </div>

      {/* Main Grid: Active Automation Console + Quick Control */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Live Execution Console */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    Console d'Automatisation en Direct
                  </h2>
                  <p className="text-xs text-slate-400">Exécution séquentielle des workflows de tâches</p>
                </div>
              </div>
              <button
                onClick={() => onNavigateToTab('automation')}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
              >
                Plein Écran <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {activeTask ? (
              <div className="mt-5 space-y-5">
                {/* Active Task Summary Card */}
                <div className="p-4 bg-slate-950/70 border border-slate-800/80 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center space-x-2.5 mb-1">
                      <span className="font-mono font-bold text-white text-base">#{activeTask.telegramTaskId}</span>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded border font-semibold ${
                        isWaitingManual
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                      }`}>
                        {activeTask.status}
                      </span>
                      {activeWorkflow && (
                        <span className="text-xs text-slate-400 font-mono">
                          [{activeWorkflow.name}]
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-300">
                      <span className="font-medium text-white">{activeTask.firstName} {activeTask.lastName}</span>
                      {activeTask.phone && <span className="ml-3 font-mono text-slate-400">{activeTask.phone}</span>}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {isWaitingManual ? (
                      <button
                        onClick={() => handleResumeTask(activeTask.id)}
                        className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs rounded-lg shadow-lg shadow-amber-500/20 transition"
                      >
                        CONTINUER
                      </button>
                    ) : (
                      <button
                        onClick={() => onNavigateToTab('automation')}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition"
                      >
                        Contrôles
                      </button>
                    )}
                  </div>
                </div>

                {/* Progress Bar */}
                {activeWorkflow && activeRun && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                      <span>Progression: Étape {activeRun.currentStepIndex + 1} / {activeWorkflow.steps.length}</span>
                      <span>{Math.round(((activeRun.currentStepIndex + 1) / activeWorkflow.steps.length) * 100)}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 via-cyan-400 to-emerald-400 transition-all duration-300"
                        style={{ width: `${Math.min(100, ((activeRun.currentStepIndex + 1) / activeWorkflow.steps.length) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Live Console Output */}
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-xs text-slate-300 max-h-40 overflow-y-auto space-y-1">
                  {activeRun?.logs?.map((log, i) => (
                    <div key={i} className="text-[11px] text-slate-400 leading-relaxed">
                      {log}
                    </div>
                  )) || (
                    <div className="text-[11px] text-slate-500 italic">En attente de messages...</div>
                  )}
                </div>
              </div>
            ) : (
              <div className="py-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-800/80 border border-slate-700 text-slate-500 flex items-center justify-center mx-auto">
                  <PlayCircle className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-300">Aucune tâche en cours d'exécution</p>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    {systemStatus?.pendingCount
                      ? `${systemStatus.pendingCount} tâche(s) en attente dans la file. Lancez la première tâche ci-dessous.`
                      : 'La file d\'attente est vide. Synchronisez Telegram ou collez un nouveau message.'}
                  </p>
                </div>
                {tasks.filter(t => t.status === 'PENDING').length > 0 && (
                  <button
                    onClick={() => handleStartTask(tasks.filter(t => t.status === 'PENDING')[0].id)}
                    className="mt-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg shadow-lg shadow-indigo-500/20 transition"
                  >
                    Démarrer la Tâche #{tasks.filter(t => t.status === 'PENDING')[0].telegramTaskId}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Recent Tasks List */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center space-x-2.5">
                <ListOrdered className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-bold text-white">File d'Attente Récente</h3>
              </div>
              <button
                onClick={() => onNavigateToTab('tasks')}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
              >
                Voir Tout ({tasks.length})
              </button>
            </div>

            {tasks.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                Aucune tâche reçue pour le moment.
              </div>
            ) : (
              <div className="mt-3 divide-y divide-slate-800/60">
                {tasks.slice(0, 5).map(task => (
                  <div
                    key={task.id}
                    onClick={() => onSelectTask(task)}
                    className="py-3 flex items-center justify-between hover:bg-slate-800/30 px-2 rounded-lg cursor-pointer transition"
                  >
                    <div className="flex items-center space-x-3">
                      <span className="font-mono text-xs font-bold text-white">#{task.telegramTaskId}</span>
                      <div className="text-xs">
                        <span className="text-slate-200 font-medium">{task.firstName} {task.lastName}</span>
                        {task.phone && <span className="text-slate-500 font-mono ml-2">{task.phone}</span>}
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded border font-semibold ${
                        task.status === 'COMPLETED'
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                          : task.status === 'IN_PROGRESS'
                          ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                          : task.status === 'WAITING_MANUAL_ACTION'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : task.status === 'FAILED'
                          ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}>
                        {task.status}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-600" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Col: Monitored Telegram Chats & System Health */}
        <div className="space-y-6">
          {/* Quick Action Widget */}
          <div className="bg-gradient-to-br from-indigo-950/40 via-slate-900 to-slate-900 border border-indigo-500/20 rounded-2xl p-5 shadow-xl">
            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4 text-indigo-400" /> Actions Rapides
            </h3>
            <div className="space-y-2">
              <button
                onClick={() => onNavigateToTab('telegram')}
                className="w-full flex items-center justify-between p-3 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 rounded-xl text-xs font-medium text-slate-200 transition"
              >
                <div className="flex items-center space-x-2.5">
                  <MessageSquare className="w-4 h-4 text-indigo-400" />
                  <span>Synchroniser Telegram MTProto</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
              </button>

              <button
                onClick={() => onNavigateToTab('recorder')}
                className="w-full flex items-center justify-between p-3 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 rounded-xl text-xs font-medium text-slate-200 transition"
              >
                <div className="flex items-center space-x-2.5">
                  <Activity className="w-4 h-4 text-cyan-400" />
                  <span>Enregistrer Nouveau Workflow</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
              </button>

              <button
                onClick={() => onNavigateToTab('chats')}
                className="w-full flex items-center justify-between p-3 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 rounded-xl text-xs font-medium text-slate-200 transition"
              >
                <div className="flex items-center space-x-2.5">
                  <MessageSquare className="w-4 h-4 text-amber-400" />
                  <span>Gérer Chats Telegram</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
              </button>
            </div>
          </div>

          {/* Discovered Chats Mini List */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <div className="flex items-center space-x-2">
                <MessageSquare className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-bold text-white">Chats Détectés</h3>
              </div>
              <button
                onClick={() => onNavigateToTab('chats')}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
              >
                Gérer ({chats.length})
              </button>
            </div>

            {chats.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500">
                Aucun chat Telegram détecté pour l'instant.
              </div>
            ) : (
              <div className="space-y-2">
                {chats.slice(0, 4).map(chat => (
                  <div
                    key={chat.id}
                    className="p-2.5 bg-slate-950/60 border border-slate-800/60 rounded-xl flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-medium text-slate-200 truncate max-w-[140px]">{chat.title}</div>
                      <div className="text-[10px] text-slate-500 font-mono">ID: {chat.id}</div>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                      {chat.role}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
