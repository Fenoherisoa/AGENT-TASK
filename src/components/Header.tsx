import React, { useState } from 'react';
import {
  RefreshCw,
  ExternalLink,
  Plus,
  Play,
  Pause,
  AlertTriangle,
  Radio
} from 'lucide-react';
import { SystemStatus, Task, AutomationRun } from '../types/task';
import { api } from '../services/api';

interface HeaderProps {
  systemStatus: SystemStatus | null;
  activeTask: Task | null;
  activeRun: AutomationRun | null;
  onRefresh: () => void;
  onNavigateToTab: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  systemStatus,
  activeTask,
  activeRun,
  onRefresh,
  onNavigateToTab
}) => {
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await api.syncTelegram();
      onRefresh();
    } catch {
      // Handled
    } finally {
      setIsSyncing(false);
    }
  };

  const handleOpenBrowser = async () => {
    try {
      await api.openBrowserTarget();
    } catch {
      // Handled
    }
  };

  const isWaitingManual = activeTask?.status === 'WAITING_MANUAL_ACTION' || activeRun?.status === 'WAITING_MANUAL';

  return (
    <header className="h-16 bg-slate-900/90 backdrop-blur border-b border-slate-800 px-6 flex items-center justify-between z-10 shrink-0">
      {/* Left: Active Task or System State */}
      <div className="flex items-center space-x-4">
        {activeTask ? (
          <div
            onClick={() => onNavigateToTab('automation')}
            className={`flex items-center space-x-3 px-3 py-1.5 rounded-lg border cursor-pointer transition-all ${
              isWaitingManual
                ? 'bg-amber-500/10 border-amber-500/40 hover:bg-amber-500/20'
                : 'bg-indigo-500/10 border-indigo-500/30 hover:bg-indigo-500/20'
            }`}
          >
            {isWaitingManual ? (
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
              </span>
            ) : (
              <span className="flex h-2 w-2 rounded-full bg-cyan-400 animate-pulse"></span>
            )}
            <div className="text-xs">
              <span className="text-slate-400 mr-1.5 font-mono">TÂCHE ACTIVE:</span>
              <span className="font-semibold text-white">#{activeTask.telegramTaskId}</span>
              <span className="text-slate-400 mx-1.5">•</span>
              <span className="text-slate-300 font-medium">
                {activeTask.firstName} {activeTask.lastName}
              </span>
              {isWaitingManual && (
                <span className="ml-2 text-[10px] bg-amber-500/20 text-amber-300 font-mono px-1.5 py-0.5 rounded border border-amber-500/40">
                  ACTION MANUELLE REQUISE
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center space-x-2 text-xs text-slate-400">
            <Radio className="w-4 h-4 text-slate-500" />
            <span>Poste de travail local — Réception en direct depuis Telegram</span>
          </div>
        )}
      </div>

      {/* Right: Quick Action Controls */}
      <div className="flex items-center space-x-3">
        {/* Sync Telegram */}
        <button
          onClick={handleSync}
          disabled={isSyncing}
          className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium shadow-sm transition disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
          <span>{isSyncing ? 'Synchronisation...' : 'Sync Telegram'}</span>
        </button>

        {/* Open Target in Browser */}
        <button
          onClick={handleOpenBrowser}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium border border-slate-700 transition"
          title="Ouvrir la page cible"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Ouvrir Cible</span>
        </button>
      </div>
    </header>
  );
};
