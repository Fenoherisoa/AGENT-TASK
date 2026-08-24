import React from 'react';
import { SystemStatus as SystemStatusType } from '../types/task';
import { Database, Radio, Layers, Zap, CheckCircle2, AlertCircle } from 'lucide-react';

interface SystemStatusProps {
  status: SystemStatusType | null;
  onRunTest?: () => void;
}

export const SystemStatus: React.FC<SystemStatusProps> = ({ status }) => {
  if (!status) return null;

  const isTgConnected = status.telegramState === 'CONNECTED';
  const isTgConnecting = status.telegramState === 'CONNECTING' || status.telegramState === 'RECONNECTING';

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {/* DB Status */}
      <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 shadow-xs flex items-center gap-3">
        <div className="p-2.5 rounded-lg bg-indigo-950/50 text-indigo-400 border border-indigo-500/20">
          <Database className="w-4 h-4" />
        </div>
        <div>
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Base Locale SQLite</div>
          <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 mt-0.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Opérationnelle
          </div>
        </div>
      </div>

      {/* Telegram Status */}
      <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 shadow-xs flex items-center gap-3">
        <div className={`p-2.5 rounded-lg border ${
          isTgConnected
            ? 'bg-emerald-950/50 text-emerald-400 border-emerald-500/30'
            : isTgConnecting
            ? 'bg-amber-950/50 text-amber-400 border-amber-500/30'
            : 'bg-slate-800 text-slate-400 border-slate-700'
        }`}>
          <Radio className="w-4 h-4" />
        </div>
        <div>
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Compte Telegram</div>
          <div className={`text-xs font-bold flex items-center gap-1.5 mt-0.5 ${
            isTgConnected ? 'text-emerald-400' : isTgConnecting ? 'text-amber-400' : 'text-slate-400'
          }`}>
            <span className={`h-1.5 w-1.5 rounded-full ${
              isTgConnected ? 'bg-emerald-400' : isTgConnecting ? 'bg-amber-400 animate-ping' : 'bg-slate-500'
            }`}></span>
            {isTgConnected ? (status.telegramUsername ? `@${status.telegramUsername}` : 'CONNECTÉ') : isTgConnecting ? 'CONNEXION...' : 'NON CONNECTÉ'}
          </div>
        </div>
      </div>

      {/* Automation State */}
      <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 shadow-xs flex items-center gap-3">
        <div className="p-2.5 rounded-lg bg-cyan-950/50 text-cyan-400 border border-cyan-500/20">
          <Zap className="w-4 h-4" />
        </div>
        <div>
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Moteur d'Exécution</div>
          <div className="text-xs font-bold text-cyan-300 mt-0.5 font-mono">
            {status.automationState || 'IDLE'}
          </div>
        </div>
      </div>

      {/* Tasks In Queue */}
      <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 shadow-xs flex items-center gap-3">
        <div className="p-2.5 rounded-lg bg-amber-950/50 text-amber-400 border border-amber-500/20">
          <Layers className="w-4 h-4" />
        </div>
        <div>
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">File d'Attente</div>
          <div className="text-xs font-bold text-white font-mono mt-0.5">
            {status.queueLength} tâches ({status.pendingCount} en attente)
          </div>
        </div>
      </div>
    </div>
  );
};
