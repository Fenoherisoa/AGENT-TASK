import React, { useState } from 'react';
import { AlertTriangle, Play, CheckCircle, ExternalLink, HelpCircle } from 'lucide-react';
import { Task, AutomationRun } from '../types/task';
import { api } from '../services/api';

interface ManualCheckpointBannerProps {
  task: Task;
  run?: AutomationRun | null;
  onResumed: () => void;
}

export const ManualCheckpointBanner: React.FC<ManualCheckpointBannerProps> = ({ task, run, onResumed }) => {
  const [isResuming, setIsResuming] = useState(false);

  const handleResume = async () => {
    setIsResuming(true);
    try {
      await api.resumeTask(task.id);
      onResumed();
    } catch {
      // Handled
    } finally {
      setIsResuming(false);
    }
  };

  const instructions =
    run?.manualInstructions ||
    'Action manuelle requise de l\'opérateur (saisie de CAPTCHA, code de vérification ou confirmation sur la plateforme cible).';

  return (
    <div className="bg-amber-950/70 border-b border-amber-500/40 px-6 py-3.5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-in slide-in-from-top duration-300">
      <div className="flex items-start space-x-3.5">
        <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0 mt-0.5">
          <AlertTriangle className="w-5 h-5 animate-pulse" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <span className="font-bold text-amber-300 text-sm tracking-wide">
              POINT DE VALIDATION MANUELLE ACTIF
            </span>
            <span className="font-mono text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-200 border border-amber-500/30">
              TÂCHE #{task.telegramTaskId}
            </span>
          </div>
          <p className="text-xs text-amber-200/90 mt-1 max-w-3xl leading-relaxed">
            {instructions}
          </p>
        </div>
      </div>

      <div className="flex items-center space-x-3 shrink-0 self-end md:self-auto">
        <button
          onClick={handleResume}
          disabled={isResuming}
          className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs rounded-lg shadow-lg shadow-amber-500/20 transition transform active:scale-95 disabled:opacity-50"
        >
          <Play className="w-4 h-4 fill-current" />
          <span>{isResuming ? 'Reprise en cours...' : 'CONTINUER L\'AUTOMATISATION'}</span>
        </button>
      </div>
    </div>
  );
};
