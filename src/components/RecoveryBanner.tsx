import React, { useState } from 'react';
import { RefreshCw, Play, RotateCcw, XCircle, AlertCircle } from 'lucide-react';
import { Task } from '../types/task';
import { api } from '../services/api';

interface RecoveryBannerProps {
  interruptedTasks: Task[];
  onActionComplete: () => void;
}

export const RecoveryBanner: React.FC<RecoveryBannerProps> = ({ interruptedTasks, onActionComplete }) => {
  const [loadingTaskId, setLoadingTaskId] = useState<string | null>(null);

  if (!interruptedTasks.length) return null;

  const currentTask = interruptedTasks[0];

  const handleResume = async (taskId: string) => {
    setLoadingTaskId(taskId);
    try {
      await api.recoverTaskResume(taskId);
      onActionComplete();
    } finally {
      setLoadingTaskId(null);
    }
  };

  const handleRestart = async (taskId: string) => {
    setLoadingTaskId(taskId);
    try {
      await api.recoverTaskRestart(taskId);
      onActionComplete();
    } finally {
      setLoadingTaskId(null);
    }
  };

  const handleFail = async (taskId: string) => {
    setLoadingTaskId(taskId);
    try {
      await api.recoverTaskFail(taskId);
      onActionComplete();
    } finally {
      setLoadingTaskId(null);
    }
  };

  return (
    <div className="bg-rose-950/60 border-b border-rose-500/40 px-6 py-3 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 animate-in slide-in-from-top duration-300">
      <div className="flex items-center space-x-3">
        <div className="p-1.5 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/30">
          <AlertCircle className="w-4 h-4" />
        </div>
        <div className="text-xs">
          <span className="font-bold text-rose-300 mr-2">RÉCUPÉRATION POST-INTERRUPTION</span>
          <span className="text-rose-200/90">
            {interruptedTasks.length} tâche(s) en cours ({currentTask.firstName} {currentTask.lastName} - #{currentTask.telegramTaskId}) étaient actives lors de l'arrêt précédent.
          </span>
        </div>
      </div>

      <div className="flex items-center space-x-2 shrink-0">
        <button
          onClick={() => handleResume(currentTask.id)}
          disabled={loadingTaskId === currentTask.id}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-sm transition disabled:opacity-50"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>Reprendre</span>
        </button>

        <button
          onClick={() => handleRestart(currentTask.id)}
          disabled={loadingTaskId === currentTask.id}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition disabled:opacity-50"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Redémarrer</span>
        </button>

        <button
          onClick={() => handleFail(currentTask.id)}
          disabled={loadingTaskId === currentTask.id}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-rose-900/50 hover:bg-rose-800 text-rose-200 text-xs font-medium rounded-lg border border-rose-700/50 transition disabled:opacity-50"
        >
          <XCircle className="w-3.5 h-3.5" />
          <span>Marquer Échouée</span>
        </button>
      </div>
    </div>
  );
};
