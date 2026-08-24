import React from 'react';
import { TaskEvent } from '../types/task';
import { History, Clock, CheckCircle2, Play, AlertTriangle, ShieldCheck, XCircle, RotateCcw, PhoneCall } from 'lucide-react';

interface ActivityLogProps {
  events: TaskEvent[];
  onRefresh: () => void;
}

export const ActivityLog: React.FC<ActivityLogProps> = ({ events, onRefresh }) => {
  const getEventIcon = (type: TaskEvent['eventType']) => {
    switch (type) {
      case 'CREATED':
        return <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />;
      case 'STARTED':
        return <Play className="w-3.5 h-3.5 text-blue-500 fill-current" />;
      case 'MANUAL_WAIT':
        return <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />;
      case 'COMPLETED':
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />;
      case 'FAILED':
        return <XCircle className="w-3.5 h-3.5 text-rose-500" />;
      case 'RETRIED':
        return <RotateCcw className="w-3.5 h-3.5 text-indigo-500" />;
      case 'PHONE_ASSIGNED':
      case 'PHONE_RELEASED':
        return <PhoneCall className="w-3.5 h-3.5 text-emerald-500" />;
      default:
        return <Clock className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  return (
    <div className="p-6 max-w-5xl w-full mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <History className="w-4 h-4 text-blue-500" />
            Historique Global des Actions Opérateur
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Journal d'audit local en temps réel (stocké dans la table SQLite task_events)
          </p>
        </div>

        <button
          onClick={onRefresh}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
        >
          Actualiser
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
        {events.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            Aucun événement enregistré pour le moment.
          </div>
        ) : (
          events.map((evt) => (
            <div key={evt.id} className="p-3.5 flex items-start justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 shrink-0">
                  {getEventIcon(evt.eventType)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                      {evt.eventType}
                    </span>
                    {evt.taskId && (
                      <span className="text-[11px] font-mono text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-1.5 py-0.2 rounded border border-blue-200 dark:border-blue-800">
                        {evt.taskId}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                    {evt.details}
                  </p>
                </div>
              </div>

              <span className="text-[11px] text-slate-400 font-mono whitespace-nowrap">
                {new Date(evt.timestamp).toLocaleString()}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
