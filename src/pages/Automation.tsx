import React from 'react';
import {
  PlayCircle,
  PauseCircle,
  StopCircle,
  SkipForward,
  Play,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Terminal,
  Shield,
  Zap,
  ArrowRight,
  ExternalLink,
  Layers
} from 'lucide-react';
import { Task, Workflow, AutomationRun, AutomationState, SystemStatus } from '../types/task';
import { api } from '../services/api';

interface AutomationProps {
  activeTask: Task | null;
  activeWorkflow: Workflow | null;
  activeRun: AutomationRun | null;
  systemStatus: SystemStatus | null;
  tasks: Task[];
  onRefresh: () => void;
  onNavigateToTab: (tab: string) => void;
}

export const Automation: React.FC<AutomationProps> = ({
  activeTask,
  activeWorkflow,
  activeRun,
  systemStatus,
  tasks,
  onRefresh,
  onNavigateToTab
}) => {
  const isWaitingManual = activeTask?.status === 'WAITING_MANUAL_ACTION' || activeRun?.status === 'WAITING_MANUAL';

  const handlePause = async () => {
    try {
      await api.pauseAutomation();
      onRefresh();
    } catch {}
  };

  const handleResume = async () => {
    try {
      await api.resumeAutomation(activeTask?.id);
      onRefresh();
    } catch {}
  };

  const handleStop = async () => {
    try {
      await api.stopAutomation();
      onRefresh();
    } catch {}
  };

  const handleSkip = async () => {
    if (activeTask) {
      try {
        await api.skipTask(activeTask.id);
        onRefresh();
      } catch {}
    }
  };

  const handleStartPending = async (taskId: string) => {
    try {
      await api.startTask(taskId);
      onRefresh();
    } catch {}
  };

  const pendingTasks = tasks.filter(t => t.status === 'PENDING');

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            Console d'Exécution en Direct
          </h2>
          <p className="text-xs text-slate-400">
            Exécution pas-à-pas du robot d'automatisation avec surveillance en temps réel
          </p>
        </div>

        {/* Live Controls */}
        {activeTask && (
          <div className="flex items-center space-x-2.5">
            {activeRun?.status === 'PAUSED' ? (
              <button
                onClick={handleResume}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow transition"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Reprendre</span>
              </button>
            ) : (
              <button
                onClick={handlePause}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium border border-slate-700 transition"
              >
                <PauseCircle className="w-3.5 h-3.5" />
                <span>Pause</span>
              </button>
            )}

            <button
              onClick={handleSkip}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium border border-slate-700 transition"
            >
              <SkipForward className="w-3.5 h-3.5" />
              <span>Passer Tâche</span>
            </button>

            <button
              onClick={handleStop}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-rose-900/40 hover:bg-rose-900/60 text-rose-300 rounded-lg text-xs font-medium border border-rose-700/50 transition"
            >
              <StopCircle className="w-3.5 h-3.5" />
              <span>Arrêter</span>
            </button>
          </div>
        )}
      </div>

      {/* Manual Checkpoint Prominent Station */}
      {isWaitingManual && activeTask && (
        <div className="bg-gradient-to-r from-amber-950/80 via-amber-900/40 to-slate-900 border-2 border-amber-500/50 rounded-2xl p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
          <div className="flex items-start space-x-4">
            <div className="p-3 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-xl shrink-0 mt-1">
              <AlertTriangle className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-amber-300 tracking-wide">
                  POINT DE VALIDATION MANUELLE EN ATTENTE
                </h3>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-200 border border-amber-500/30 font-semibold">
                  TÂCHE #{activeTask.telegramTaskId}
                </span>
              </div>
              <p className="text-xs text-amber-100/90 mt-1.5 leading-relaxed max-w-3xl">
                {activeRun?.manualInstructions ||
                  'Action manuelle requise : vérifiez les données ou résolvez le défi dans votre navigateur/chat, puis confirmez pour poursuivre le workflow.'}
              </p>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end space-x-3">
            <button
              onClick={handleResume}
              className="flex items-center space-x-2 px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow-xl shadow-amber-500/20 transition transform active:scale-95"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>VALIDER L'ACTION & CONTINUER L'AUTOMATISATION</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Execution View */}
      {activeTask && activeWorkflow && activeRun ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Left 2 Cols: Step Pipeline Visualizer + Status */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
              {/* Task & Workflow Overview Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div>
                  <div className="flex items-center space-x-2.5">
                    <span className="font-mono font-bold text-white text-lg">
                      #{activeTask.telegramTaskId}
                    </span>
                    <span className="font-semibold text-slate-200 text-base">
                      {activeTask.firstName} {activeTask.lastName}
                    </span>
                  </div>
                  <p className="text-xs text-indigo-400 font-mono mt-0.5">
                    Workflow: {activeWorkflow.name} (v{activeWorkflow.version})
                  </p>
                </div>

                <span className={`text-xs font-mono px-3 py-1 rounded-lg border font-bold ${
                  isWaitingManual
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                    : 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                }`}>
                  {activeRun.status}
                </span>
              </div>

              {/* Step Sequence Timeline */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase font-mono tracking-wider">
                  Étapes du Workflow ({activeRun.currentStepIndex + 1} / {activeWorkflow.steps.length})
                </h4>

                <div className="space-y-3">
                  {activeWorkflow.steps.map((step, idx) => {
                    const isPassed = idx < activeRun.currentStepIndex;
                    const isCurrent = idx === activeRun.currentStepIndex;
                    const isPending = idx > activeRun.currentStepIndex;

                    return (
                      <div
                        key={step.id}
                        className={`p-4 rounded-xl border flex items-center justify-between transition-all ${
                          isCurrent
                            ? isWaitingManual
                              ? 'bg-amber-950/30 border-amber-500/50 shadow-md ring-1 ring-amber-500/30'
                              : 'bg-indigo-950/30 border-indigo-500/50 shadow-md ring-1 ring-indigo-500/30'
                            : isPassed
                            ? 'bg-slate-950/80 border-emerald-500/30 text-slate-300'
                            : 'bg-slate-950/40 border-slate-800/60 opacity-60 text-slate-500'
                        }`}
                      >
                        <div className="flex items-center space-x-3.5">
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono text-xs font-bold ${
                              isPassed
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : isCurrent
                                ? isWaitingManual
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
                                  : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                                : 'bg-slate-800 text-slate-500'
                            }`}
                          >
                            {isPassed ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                          </div>

                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-xs text-white">{step.name}</span>
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 uppercase">
                                {step.type}
                              </span>
                            </div>
                            {step.manualInstructions && (
                              <p className="text-[11px] text-amber-300/90 mt-0.5 font-mono">
                                {step.manualInstructions}
                              </p>
                            )}
                          </div>
                        </div>

                        <span className="text-[11px] font-mono font-semibold">
                          {isPassed ? (
                            <span className="text-emerald-400">TERMINÉ</span>
                          ) : isCurrent ? (
                            <span className={isWaitingManual ? 'text-amber-300 animate-pulse' : 'text-cyan-400'}>
                              {isWaitingManual ? 'ATTENTE OPÉRATEUR' : 'EN COURS'}
                            </span>
                          ) : (
                            <span className="text-slate-600">EN ATTENTE</span>
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Right Col: Live Terminal Logs */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
            <div className="flex items-center space-x-2 pb-2 border-b border-slate-800">
              <Terminal className="w-4 h-4 text-cyan-400" />
              <h3 className="text-xs font-bold text-white uppercase font-mono">Journal d'Événements Live</h3>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 font-mono text-[11px] text-slate-300 max-h-[460px] overflow-y-auto space-y-1.5">
              {activeRun.logs.map((log, i) => (
                <div key={i} className="text-slate-400 leading-relaxed break-words">
                  {log}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Empty / Idle State */
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-4 max-w-lg mx-auto shadow-xl">
          <div className="w-14 h-14 rounded-2xl bg-slate-800/80 border border-slate-700 text-slate-500 flex items-center justify-center mx-auto">
            <PlayCircle className="w-7 h-7" />
          </div>

          <div>
            <h3 className="text-base font-bold text-white">Console en Veille (IDLE)</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Aucune tâche n'est actuellement en cours d'automatisation.
            </p>
          </div>

          {pendingTasks.length > 0 ? (
            <div className="pt-2">
              <button
                onClick={() => handleStartPending(pendingTasks[0].id)}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-500/20 transition"
              >
                Lancer la Première Tâche en Attente (#{pendingTasks[0].telegramTaskId})
              </button>
            </div>
          ) : (
            <div className="pt-2">
              <button
                onClick={() => onNavigateToTab('tasks')}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold underline"
              >
                Voir la File des Tâches →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
