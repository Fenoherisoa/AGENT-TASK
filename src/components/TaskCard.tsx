import React from 'react';
import { Task, TaskStatus } from '../types/task';
import { Clock, Phone, AlertCircle, CheckCircle2, User, KeyRound } from 'lucide-react';

interface TaskCardProps {
  task: Task;
  isSelected: boolean;
  onSelect: (task: Task) => void;
}

export const getStatusBadge = (status: TaskStatus) => {
  switch (status) {
    case 'PENDING':
      return {
        label: 'PENDING',
        bg: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700',
        dot: 'bg-slate-400'
      };
    case 'IN_PROGRESS':
      return {
        label: 'IN PROGRESS',
        bg: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
        dot: 'bg-blue-500 animate-pulse'
      };
    case 'WAITING_MANUAL_ACTION':
      return {
        label: 'WAITING MANUAL',
        bg: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
        dot: 'bg-amber-500 animate-ping'
      };
    case 'COMPLETED':
      return {
        label: 'COMPLETED',
        bg: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
        dot: 'bg-emerald-500'
      };
    case 'FAILED':
      return {
        label: 'FAILED',
        bg: 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
        dot: 'bg-rose-500'
      };
    case 'SKIPPED':
      return {
        label: 'SKIPPED',
        bg: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-zinc-700',
        dot: 'bg-zinc-400'
      };
    default:
      return {
        label: status,
        bg: 'bg-slate-100 text-slate-700 border-slate-200',
        dot: 'bg-slate-400'
      };
  }
};

export const TaskCard: React.FC<TaskCardProps> = ({ task, isSelected, onSelect }) => {
  const badge = getStatusBadge(task.status);
  const formattedDate = new Date(task.createdAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  return (
    <div
      onClick={() => onSelect(task)}
      className={`p-3.5 rounded-xl border transition-all cursor-pointer select-none relative ${
        isSelected
          ? 'bg-blue-50/70 dark:bg-blue-950/30 border-blue-500 dark:border-blue-500 ring-2 ring-blue-500/20 shadow-xs'
          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-xs'
      }`}
    >
      {/* Top row: Task ID & Status */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-slate-900 dark:text-white">
          <span className="text-blue-600 dark:text-blue-400 font-bold">#</span>
          <span>{task.telegramTaskId}</span>
        </div>

        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${badge.bg}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`}></span>
          {badge.label}
        </span>
      </div>

      {/* Operator Full Name */}
      <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-800 dark:text-slate-100 mb-2">
        <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <span className="truncate">
          {task.firstName} {task.lastName}
        </span>
      </div>

      {/* Meta Row: Phone and Timestamp */}
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-1 truncate">
          <Phone className="w-3 h-3 text-slate-400 shrink-0" />
          <span className="truncate">{task.phone || 'Non assigné'}</span>
        </div>

        <div className="flex items-center gap-1 shrink-0 font-mono text-[11px]">
          <Clock className="w-3 h-3 text-slate-400" />
          <span>{formattedDate}</span>
        </div>
      </div>

      {/* Error preview if failed */}
      {task.status === 'FAILED' && task.errorMessage && (
        <div className="mt-2 text-[11px] text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 p-1.5 rounded border border-rose-200 dark:border-rose-900 truncate flex items-center gap-1">
          <AlertCircle className="w-3 h-3 shrink-0" />
          <span className="truncate">{task.errorMessage}</span>
        </div>
      )}
    </div>
  );
};
