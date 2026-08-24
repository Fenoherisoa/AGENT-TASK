import React, { useState } from 'react';
import {
  Search,
  Filter,
  Plus,
  Play,
  CheckCircle,
  XCircle,
  Clock,
  RotateCcw,
  SkipForward,
  Copy,
  Check,
  Phone,
  Trash2,
  AlertTriangle,
  ExternalLink,
  ChevronRight,
  RefreshCw,
  X,
  FileText,
  User,
  Key,
  Calendar
} from 'lucide-react';
import { Task, TaskStatus, TaskEvent } from '../types/task';
import { api } from '../services/api';

interface TasksProps {
  tasks: Task[];
  selectedTask: Task | null;
  onSelectTask: (task: Task | null) => void;
  onRefresh: () => void;
}

export const Tasks: React.FC<TasksProps> = ({
  tasks,
  selectedTask,
  onSelectTask,
  onRefresh
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [taskEvents, setTaskEvents] = useState<TaskEvent[]>([]);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isPhoneLoading, setIsPhoneLoading] = useState(false);

  // Load events when a task is selected
  React.useEffect(() => {
    if (selectedTask) {
      api.getEvents(selectedTask.id).then(setTaskEvents).catch(() => setTaskEvents([]));
    } else {
      setTaskEvents([]);
    }
  }, [selectedTask]);

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleStart = async (taskId: string) => {
    try {
      await api.startTask(taskId);
      onRefresh();
    } catch {}
  };

  const handleResume = async (taskId: string) => {
    try {
      await api.resumeTask(taskId);
      onRefresh();
    } catch {}
  };

  const handleComplete = async (taskId: string) => {
    try {
      const updated = await api.completeTask(taskId);
      onSelectTask(updated);
      onRefresh();
    } catch {}
  };

  const handleFail = async (taskId: string) => {
    try {
      const updated = await api.failTask(taskId, 'Marquée comme échouée par l\'opérateur');
      onSelectTask(updated);
      onRefresh();
    } catch {}
  };

  const handleSkip = async (taskId: string) => {
    try {
      const updated = await api.skipTask(taskId);
      onSelectTask(updated);
      onRefresh();
    } catch {}
  };

  const handleRetry = async (taskId: string) => {
    try {
      const updated = await api.retryTask(taskId);
      onSelectTask(updated);
      onRefresh();
    } catch {}
  };

  const handleDelete = async (taskId: string) => {
    if (confirm('Confirmer la suppression définitive de cette tâche ?')) {
      try {
        await api.deleteTask(taskId);
        onSelectTask(null);
        onRefresh();
      } catch {}
    }
  };

  const handleGetPhone = async (taskId: string) => {
    setIsPhoneLoading(true);
    try {
      const res = await api.getPhoneNumber(taskId);
      if (selectedTask && res.phone) {
        onSelectTask({ ...selectedTask, phone: res.phone });
      }
      onRefresh();
    } finally {
      setIsPhoneLoading(false);
    }
  };

  const handleReleasePhone = async (taskId: string) => {
    setIsPhoneLoading(true);
    try {
      await api.releasePhoneNumber(taskId);
      if (selectedTask) {
        onSelectTask({ ...selectedTask, phone: undefined });
      }
      onRefresh();
    } finally {
      setIsPhoneLoading(false);
    }
  };

  const filteredTasks = tasks.filter(t => {
    const matchesSearch =
      !searchQuery ||
      t.telegramTaskId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.phone && t.phone.includes(searchQuery));

    const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            File d'Attente des Tâches Telegram
          </h2>
          <p className="text-xs text-slate-400">
            {tasks.length} tâche(s) Telegram réelle(s) enregistrée(s) dans la base locale
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex flex-col md:flex-row items-center justify-between gap-3 shadow-md">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Rechercher par ID, nom, téléphone..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
          />
        </div>

        <div className="flex items-center space-x-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          {['ALL', 'PENDING', 'IN_PROGRESS', 'WAITING_MANUAL_ACTION', 'COMPLETED', 'FAILED'].map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition shrink-0 ${
                statusFilter === st
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area: Table + Inspector Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Tasks Table */}
        <div className={`${selectedTask ? 'lg:col-span-2' : 'lg:col-span-3'} bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden`}>
          {filteredTasks.length === 0 ? (
            <div className="py-20 text-center space-y-3 px-4">
              <FileText className="w-12 h-12 text-slate-600 mx-auto" />
              <h3 className="text-base font-bold text-white uppercase tracking-wider font-mono">
                NO TELEGRAM TASKS
              </h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Waiting for a valid task message from Telegram...
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider font-mono">
                  <tr>
                    <th className="px-4 py-3">Task ID</th>
                    <th className="px-4 py-3">Source Telegram</th>
                    <th className="px-4 py-3">Identité</th>
                    <th className="px-4 py-3">Statut</th>
                    <th className="px-4 py-3">Téléphone</th>
                    <th className="px-4 py-3">Créée le</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredTasks.map(t => {
                    const isSelected = selectedTask?.id === t.id;
                    return (
                      <tr
                        key={t.id}
                        onClick={() => onSelectTask(t)}
                        className={`hover:bg-slate-800/40 cursor-pointer transition ${
                          isSelected ? 'bg-indigo-600/10 border-l-2 border-indigo-500' : ''
                        }`}
                      >
                        <td className="px-4 py-3.5 font-mono font-bold text-white whitespace-nowrap">
                          #{t.telegramTaskId}
                        </td>
                        <td className="px-4 py-3.5 text-slate-300 font-mono text-[11px] whitespace-nowrap">
                          <span className="text-cyan-400 block">{t.telegramChatTitle || `Chat ${t.telegramChatId}`}</span>
                          <span className="text-slate-500 text-[10px]">Msg #{t.telegramMessageId}</span>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="font-semibold text-slate-200">{t.firstName} {t.lastName}</div>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded border font-semibold ${
                            t.status === 'COMPLETED'
                              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                              : t.status === 'IN_PROGRESS'
                              ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                              : t.status === 'WAITING_MANUAL_ACTION'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              : t.status === 'FAILED'
                              ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}>
                            {t.status}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 font-mono text-slate-400 whitespace-nowrap">
                          {t.phone || <span className="text-slate-600 italic">Non assigné</span>}
                        </td>
                        <td className="px-4 py-3.5 text-slate-400 whitespace-nowrap">
                          {new Date(t.createdAt).toLocaleTimeString()}
                        </td>
                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          {t.status === 'PENDING' ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStart(t.id);
                              }}
                              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[11px] font-medium transition"
                            >
                              Lancer
                            </button>
                          ) : t.status === 'WAITING_MANUAL_ACTION' ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleResume(t.id);
                              }}
                              className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded text-[11px] transition"
                            >
                              Continuer
                            </button>
                          ) : (
                            <ChevronRight className="w-4 h-4 text-slate-500 ml-auto" />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Task Detail Inspector Drawer */}
        {selectedTask && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6 sticky top-6">
            {/* Drawer Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-mono font-bold text-white text-base">#{selectedTask.telegramTaskId}</span>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded border font-semibold ${
                    selectedTask.status === 'COMPLETED'
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      : selectedTask.status === 'IN_PROGRESS'
                      ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                      : selectedTask.status === 'WAITING_MANUAL_ACTION'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : selectedTask.status === 'FAILED'
                      ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}>
                    {selectedTask.status}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Créée le {new Date(selectedTask.createdAt).toLocaleString()}
                </p>
              </div>

              <button
                onClick={() => onSelectTask(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Copy Fields */}
            <div className="space-y-2.5">
              <h4 className="text-xs font-bold text-slate-400 uppercase font-mono tracking-wider">
                Champs de Saisie Opérateur
              </h4>

              {/* Prénom */}
              <div className="flex items-center justify-between p-2.5 bg-slate-950 border border-slate-800 rounded-xl">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-mono">Prénom</span>
                  <div className="text-xs font-semibold text-white">{selectedTask.firstName}</div>
                </div>
                <button
                  onClick={() => copyToClipboard(selectedTask.firstName, 'firstName')}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                  title="Copier le prénom"
                >
                  {copiedField === 'firstName' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Nom */}
              <div className="flex items-center justify-between p-2.5 bg-slate-950 border border-slate-800 rounded-xl">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-mono">Nom</span>
                  <div className="text-xs font-semibold text-white">{selectedTask.lastName}</div>
                </div>
                <button
                  onClick={() => copyToClipboard(selectedTask.lastName, 'lastName')}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                  title="Copier le nom"
                >
                  {copiedField === 'lastName' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Mot de Passe */}
              <div className="flex items-center justify-between p-2.5 bg-slate-950 border border-slate-800 rounded-xl">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-mono">Mot de Passe</span>
                  <div className="text-xs font-mono text-indigo-300 font-semibold">{selectedTask.password}</div>
                </div>
                <button
                  onClick={() => copyToClipboard(selectedTask.password, 'password')}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                  title="Copier le mot de passe"
                >
                  {copiedField === 'password' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Téléphone */}
              <div className="flex items-center justify-between p-2.5 bg-slate-950 border border-slate-800 rounded-xl">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-mono">Numéro Réservé</span>
                  <div className="text-xs font-mono text-cyan-300 font-semibold">
                    {selectedTask.phone || 'Aucun numéro réservé'}
                  </div>
                </div>
                <div className="flex items-center space-x-1">
                  {selectedTask.phone && (
                    <button
                      onClick={() => copyToClipboard(selectedTask.phone || '', 'phone')}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                      title="Copier le téléphone"
                    >
                      {copiedField === 'phone' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  )}
                  {!selectedTask.phone ? (
                    <button
                      onClick={() => handleGetPhone(selectedTask.id)}
                      disabled={isPhoneLoading}
                      className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[10px] font-mono transition"
                    >
                      {isPhoneLoading ? 'Attribution...' : 'Attribuer'}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleReleasePhone(selectedTask.id)}
                      disabled={isPhoneLoading}
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded text-[10px] font-mono transition"
                    >
                      Libérer
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Lifecycle Action Buttons */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <h4 className="text-xs font-bold text-slate-400 uppercase font-mono tracking-wider mb-2">
                Actions Opérateur
              </h4>

              <div className="grid grid-cols-2 gap-2">
                {selectedTask.status === 'PENDING' && (
                  <button
                    onClick={() => handleStart(selectedTask.id)}
                    className="col-span-2 flex items-center justify-center space-x-2 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow transition"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>DÉMARRER AUTOMATISATION</span>
                  </button>
                )}

                {selectedTask.status === 'WAITING_MANUAL_ACTION' && (
                  <button
                    onClick={() => handleResume(selectedTask.id)}
                    className="col-span-2 flex items-center justify-center space-x-2 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 text-xs font-bold rounded-xl shadow transition"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>CONTINUER AUTOMATISATION</span>
                  </button>
                )}

                <button
                  onClick={() => handleComplete(selectedTask.id)}
                  className="flex items-center justify-center space-x-1.5 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-semibold transition"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Valider (Succès)</span>
                </button>

                <button
                  onClick={() => handleFail(selectedTask.id)}
                  className="flex items-center justify-center space-x-1.5 py-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-semibold transition"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Signaler Échec</span>
                </button>

                <button
                  onClick={() => handleRetry(selectedTask.id)}
                  className="flex items-center justify-center space-x-1.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium border border-slate-700 transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Réessayer</span>
                </button>

                <button
                  onClick={() => handleSkip(selectedTask.id)}
                  className="flex items-center justify-center space-x-1.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium border border-slate-700 transition"
                >
                  <SkipForward className="w-3.5 h-3.5" />
                  <span>Ignorer</span>
                </button>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => handleDelete(selectedTask.id)}
                  className="w-full flex items-center justify-center space-x-1.5 py-1.5 text-rose-400 hover:text-rose-300 text-xs font-medium transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Supprimer de la file</span>
                </button>
              </div>
            </div>

            {/* Event Timeline for this Task */}
            {taskEvents.length > 0 && (
              <div className="pt-3 border-t border-slate-800">
                <h4 className="text-xs font-bold text-slate-400 uppercase font-mono tracking-wider mb-2">
                  Historique d'Exécution ({taskEvents.length})
                </h4>
                <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                  {taskEvents.map(evt => (
                    <div key={evt.id} className="text-[11px] p-2 bg-slate-950/60 rounded-lg border border-slate-800/60">
                      <div className="flex items-center justify-between text-slate-500 font-mono text-[10px]">
                        <span>{evt.eventType}</span>
                        <span>{new Date(evt.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <p className="text-slate-300 mt-0.5">{evt.details}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
