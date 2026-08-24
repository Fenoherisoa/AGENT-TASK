import React, { useState, useMemo } from 'react';
import { Task, TaskStatus } from '../types/task';
import { TaskCard } from './TaskCard';
import { Search, Filter, Layers, CheckCircle2, Clock, AlertTriangle, XCircle, ArrowRight } from 'lucide-react';

interface TaskListProps {
  tasks: Task[];
  selectedTask: Task | null;
  onSelectTask: (task: Task) => void;
  onNextTask: () => void;
}

type FilterTab = 'ALL' | TaskStatus;

export const TaskList: React.FC<TaskListProps> = ({
  tasks,
  selectedTask,
  onSelectTask,
  onNextTask
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterTab>('ALL');

  // Count per status
  const counts = useMemo(() => {
    return {
      ALL: tasks.length,
      PENDING: tasks.filter(t => t.status === 'PENDING').length,
      IN_PROGRESS: tasks.filter(t => t.status === 'IN_PROGRESS').length,
      WAITING_MANUAL_ACTION: tasks.filter(t => t.status === 'WAITING_MANUAL_ACTION').length,
      COMPLETED: tasks.filter(t => t.status === 'COMPLETED').length,
      FAILED: tasks.filter(t => t.status === 'FAILED').length,
      SKIPPED: tasks.filter(t => t.status === 'SKIPPED').length,
    };
  }, [tasks]);

  // Filtered and searched list
  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      // Status filter
      if (statusFilter !== 'ALL' && t.status !== statusFilter) {
        return false;
      }
      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const fullName = `${t.firstName} ${t.lastName}`.toLowerCase();
        const taskId = t.telegramTaskId.toLowerCase();
        const phone = (t.phone || '').toLowerCase();
        const notes = (t.notes || '').toLowerCase();
        return (
          fullName.includes(query) ||
          taskId.includes(query) ||
          phone.includes(query) ||
          notes.includes(query)
        );
      }
      return true;
    });
  }, [tasks, statusFilter, searchQuery]);

  const filterTabs: { id: FilterTab; label: string; count: number }[] = [
    { id: 'ALL', label: 'Toutes', count: counts.ALL },
    { id: 'PENDING', label: 'En attente', count: counts.PENDING },
    { id: 'IN_PROGRESS', label: 'En cours', count: counts.IN_PROGRESS },
    { id: 'WAITING_MANUAL_ACTION', label: 'Action Manuelle', count: counts.WAITING_MANUAL_ACTION },
    { id: 'COMPLETED', label: 'Terminées', count: counts.COMPLETED },
    { id: 'FAILED', label: 'Échouées', count: counts.FAILED },
  ];

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900/50 border-r border-slate-200 dark:border-slate-800">
      {/* Search & Header */}
      <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 font-semibold text-sm text-slate-800 dark:text-slate-100">
            <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>File des Tâches</span>
            <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full font-mono">
              {filteredTasks.length}
            </span>
          </div>

          <button
            onClick={onNextTask}
            className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 transition cursor-pointer"
            title="Passer à la prochaine tâche en attente"
          >
            <span>Next Task</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher par nom, #ID, tél..."
            className="w-full pl-8.5 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
            >
              &times;
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-2.5 pb-1 no-scrollbar text-xs">
          {filterTabs.map((tab) => {
            const active = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition cursor-pointer flex items-center gap-1 ${
                  active
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    active
                      ? 'bg-white/20 dark:bg-slate-900/20 text-white dark:text-slate-900'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Task Cards List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {filteredTasks.length === 0 ? (
          <div className="h-56 flex flex-col items-center justify-center text-center p-4 text-slate-400">
            <Layers className="w-8 h-8 stroke-1 text-slate-400 dark:text-slate-600 mb-2" />
            <p className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase font-mono">
              NO TELEGRAM TASKS
            </p>
            <p className="text-[11px] text-slate-400 mt-1 max-w-[200px]">
              Waiting for a valid task message from Telegram...
            </p>
          </div>
        ) : (
          filteredTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              isSelected={selectedTask?.id === task.id}
              onSelect={onSelectTask}
            />
          ))
        )}
      </div>
    </div>
  );
};
