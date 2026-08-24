import React from 'react';
import { Task, TaskStatus } from '../types/task';
import { Play, Check, XCircle, SkipForward, RotateCcw, AlertTriangle, ExternalLink, ArrowRight } from 'lucide-react';

interface TaskActionsProps {
  task: Task | null;
  onStart: (id: string) => void;
  onWaitManual: (id: string) => void;
  onComplete: (id: string) => void;
  onFail: (id: string) => void;
  onSkip: (id: string) => void;
  onRetry: (id: string) => void;
  onNextTask: () => void;
  onOpenBrowser: () => void;
  isLoading?: boolean;
}

export const TaskActions: React.FC<TaskActionsProps> = ({
  task,
  onStart,
  onWaitManual,
  onComplete,
  onFail,
  onSkip,
  onRetry,
  onNextTask,
  onOpenBrowser,
  isLoading
}) => {
  if (!task) {
    return null;
  }

  const isPending = task.status === 'PENDING';
  const isInProgress = task.status === 'IN_PROGRESS';
  const isWaitingManual = task.status === 'WAITING_MANUAL_ACTION';
  const isCompleted = task.status === 'COMPLETED';
  const isFailed = task.status === 'FAILED';
  const isSkipped = task.status === 'SKIPPED';

  return (
    <div className="bg-white dark:bg-slate-900 p-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shadow-xs">
      {/* Primary Lifecycle Controls */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Start Task (if PENDING) */}
        {isPending && (
          <button
            onClick={() => onStart(task.id)}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-xs transition cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Start Task</span>
          </button>
        )}

        {/* Set to Waiting Manual Action (if IN_PROGRESS) */}
        {isInProgress && (
          <button
            onClick={() => onWaitManual(task.id)}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white shadow-xs transition cursor-pointer"
            title="Passer en attente de validation manuelle dans le navigateur"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Action Manuelle Requise</span>
          </button>
        )}

        {/* Complete Task (if IN_PROGRESS or WAITING_MANUAL_ACTION) */}
        {(isInProgress || isWaitingManual) && (
          <button
            onClick={() => onComplete(task.id)}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-xs transition cursor-pointer"
          >
            <Check className="w-4 h-4 stroke-[2.5]" />
            <span>Complete</span>
          </button>
        )}

        {/* Open Browser Button */}
        <button
          onClick={onOpenBrowser}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
        >
          <ExternalLink className="w-3.5 h-3.5 text-blue-500" />
          <span>Open Browser</span>
        </button>

        {/* Fail Button */}
        {!isCompleted && !isFailed && (
          <button
            onClick={() => onFail(task.id)}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 transition cursor-pointer"
          >
            <XCircle className="w-3.5 h-3.5" />
            <span>Failed</span>
          </button>
        )}

        {/* Skip Button */}
        {!isCompleted && (
          <button
            onClick={() => onSkip(task.id)}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition cursor-pointer"
          >
            <SkipForward className="w-3.5 h-3.5" />
            <span>Skip</span>
          </button>
        )}

        {/* Retry Button (if FAILED or SKIPPED) */}
        {(isFailed || isSkipped || isCompleted) && (
          <button
            onClick={() => onRetry(task.id)}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Retry Task</span>
          </button>
        )}
      </div>

      {/* Next Task shortcut */}
      <button
        onClick={onNextTask}
        className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 shadow-xs transition cursor-pointer"
      >
        <span>Next Task</span>
        <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
