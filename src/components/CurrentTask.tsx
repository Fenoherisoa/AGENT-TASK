import React, { useState } from 'react';
import { Task, TaskEvent, TaskStatus } from '../types/task';
import { getStatusBadge } from './TaskCard';
import { copyToClipboard } from '../services/clipboard';
import {
  User,
  KeyRound,
  Phone,
  Hash,
  Copy,
  Check,
  Eye,
  EyeOff,
  RefreshCw,
  PhoneCall,
  PhoneOff,
  AlertTriangle,
  FileText,
  Clock,
  ExternalLink,
  ShieldAlert,
  Send,
  Sparkles,
  Info,
  Calendar
} from 'lucide-react';

interface CurrentTaskProps {
  task: Task | null;
  events: TaskEvent[];
  onGetPhone: (taskId: string) => Promise<void>;
  onReleasePhone: (taskId: string) => Promise<void>;
  onRefreshPhone: (taskId: string) => Promise<void>;
  onUpdateNotes: (taskId: string, notes: string) => Promise<void>;
  onOpenBrowser: () => void;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  isLoadingPhone?: boolean;
}

export const CurrentTask: React.FC<CurrentTaskProps> = ({
  task,
  events,
  onGetPhone,
  onReleasePhone,
  onRefreshPhone,
  onUpdateNotes,
  onOpenBrowser,
  onShowToast,
  isLoadingPhone
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [notesText, setNotesText] = useState(task?.notes || '');
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [showRawTelegram, setShowRawTelegram] = useState(false);

  // Sync notes when task changes
  React.useEffect(() => {
    setNotesText(task?.notes || '');
    setIsEditingNotes(false);
  }, [task?.id]);

  if (!task) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-slate-900/30">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-4 shadow-xs">
          <Hash className="w-8 h-8" />
        </div>
        <h3 className="text-base font-semibold text-slate-700 dark:text-slate-300">Aucune tâche sélectionnée</h3>
        <p className="text-xs text-slate-500 max-w-sm mt-1">
          Sélectionnez une tâche dans la file de gauche ou cliquez sur "Next Task" pour démarrer votre session de travail.
        </p>
      </div>
    );
  }

  const badge = getStatusBadge(task.status);
  const isWaitingManual = task.status === 'WAITING_MANUAL_ACTION';

  const handleCopy = async (fieldName: string, value: string | undefined) => {
    if (!value) return;
    const res = await copyToClipboard(fieldName, value);
    if (res.success) {
      setCopiedField(fieldName);
      onShowToast(`Copié avec succès: ${fieldName}`, 'success');
      setTimeout(() => setCopiedField(null), 2000);
    } else {
      onShowToast(res.error || 'Erreur de copie', 'error');
    }
  };

  const handleCopyAll = async () => {
    const formatted = `Nom: ${task.lastName}\nPrénom: ${task.firstName}\nMot de passe: ${task.password}\nTéléphone: ${task.phone || 'Non assigné'}\nID: ${task.telegramTaskId}`;
    const res = await copyToClipboard('Toutes les données', formatted);
    if (res.success) {
      onShowToast('Données complètes copiées dans le presse-papier !', 'success');
    }
  };

  const handleSaveNotes = async () => {
    await onUpdateNotes(task.id, notesText);
    setIsEditingNotes(false);
    onShowToast('Notes mises à jour', 'success');
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-slate-50/50 dark:bg-slate-900/30">
      <div className="p-6 max-w-5xl w-full mx-auto space-y-5">
        
        {/* Top Header Card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-400 font-mono font-bold text-lg">
                #{task.telegramTaskId.slice(-4)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-slate-900 dark:text-white">
                    TASK #{task.telegramTaskId}
                  </span>
                  <button
                    onClick={() => handleCopy('Task ID', task.telegramTaskId)}
                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                    title="Copy Task ID"
                  >
                    {copiedField === 'Task ID' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(task.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Status & Quick Action */}
            <div className="flex items-center gap-2.5">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold border ${badge.bg}`}>
                <span className={`h-2 w-2 rounded-full ${badge.dot}`}></span>
                {badge.label}
              </span>

              <button
                onClick={handleCopyAll}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                title="Copier toutes les informations du formulaire"
              >
                <Copy className="w-3.5 h-3.5 text-indigo-500" />
                <span>Copier Tout</span>
              </button>
            </div>
          </div>
        </div>

        {/* CRITICAL SECURITY & MANUAL ACTION CALLOUT */}
        {isWaitingManual && (
          <div className="bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-700/80 rounded-2xl p-5 shadow-xs">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-xl bg-amber-500 text-white shrink-0 mt-0.5">
                <ShieldAlert className="w-6 h-6 animate-pulse" />
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200 tracking-wide uppercase">
                    WAITING FOR MANUAL ACTION
                  </h4>
                  <button
                    onClick={onOpenBrowser}
                    className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-700 text-white shadow-xs transition"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Ouvrir Navigateur</span>
                  </button>
                </div>
                <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                  L'étape courante requiert une validation manuelle par l'opérateur humain dans le navigateur.
                  Conformément aux normes de sécurité, <strong>aucun OTP, SMS, code de validation ou cookie n'est intercepté automatiquement</strong>.
                </p>
                <div className="bg-amber-100/70 dark:bg-amber-900/40 p-2.5 rounded-lg text-xs text-amber-900 dark:text-amber-200 font-medium">
                  Instructions : Ouvrez le navigateur, effectuez la saisie ou confirmation manuelle, puis cliquez sur <strong>"Complete"</strong> une fois terminé.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Primary Data Grid (Fields with Copy Helpers) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Prénom (First Name) */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <User className="w-3 h-3 text-blue-500" />
                Prénom (First Name)
              </span>
              <p className="text-sm font-bold text-slate-900 dark:text-white select-all">
                {task.firstName}
              </p>
            </div>
            <button
              onClick={() => handleCopy('Prénom', task.firstName)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 hover:bg-blue-50 dark:bg-slate-800 dark:hover:bg-blue-950/50 hover:text-blue-600 dark:hover:text-blue-400 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
            >
              {copiedField === 'Prénom' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>Copier</span>
            </button>
          </div>

          {/* Nom (Last Name) */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <User className="w-3 h-3 text-indigo-500" />
                Nom (Last Name)
              </span>
              <p className="text-sm font-bold text-slate-900 dark:text-white select-all">
                {task.lastName}
              </p>
            </div>
            <button
              onClick={() => handleCopy('Nom', task.lastName)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 hover:bg-blue-50 dark:bg-slate-800 dark:hover:bg-blue-950/50 hover:text-blue-600 dark:hover:text-blue-400 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
            >
              {copiedField === 'Nom' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>Copier</span>
            </button>
          </div>

          {/* Mot de passe (Password) */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
            <div className="space-y-0.5 flex-1 mr-3">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <KeyRound className="w-3 h-3 text-amber-500" />
                Mot de Passe
              </span>
              <div className="flex items-center gap-2">
                <p className="text-sm font-mono font-bold text-slate-900 dark:text-white select-all">
                  {showPassword ? task.password : '••••••••••••'}
                </p>
                <button
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
                  title={showPassword ? 'Masquer' : 'Afficher'}
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
            <button
              onClick={() => handleCopy('Mot de passe', task.password)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 hover:bg-blue-50 dark:bg-slate-800 dark:hover:bg-blue-950/50 hover:text-blue-600 dark:hover:text-blue-400 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
            >
              {copiedField === 'Mot de passe' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>Copier</span>
            </button>
          </div>

          {/* Numéro de téléphone (Phone Provider Layer) */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
            <div className="space-y-0.5 flex-1 mr-3">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Phone className="w-3 h-3 text-emerald-500" />
                Numéro (Phone Provider)
              </span>
              <p className="text-sm font-mono font-bold text-slate-900 dark:text-white select-all">
                {task.phone ? task.phone : <span className="text-slate-400 italic font-normal text-xs">Aucun numéro assigné</span>}
              </p>
            </div>

            <div className="flex items-center gap-1.5">
              {task.phone ? (
                <>
                  <button
                    onClick={() => handleCopy('Numéro', task.phone)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-100 hover:bg-blue-50 dark:bg-slate-800 dark:hover:bg-blue-950/50 hover:text-blue-600 dark:hover:text-blue-400 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                    title="Copier le numéro"
                  >
                    {copiedField === 'Numéro' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>Copier</span>
                  </button>

                  <button
                    onClick={() => onRefreshPhone(task.id)}
                    disabled={isLoadingPhone}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                    title="Changer de numéro (Refresh Number)"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingPhone ? 'animate-spin' : ''}`} />
                  </button>

                  <button
                    onClick={() => onReleasePhone(task.id)}
                    disabled={isLoadingPhone}
                    className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                    title="Libérer ce numéro (Release Number)"
                  >
                    <PhoneOff className="w-3.5 h-3.5" />
                  </button>
                </>
              ) : (
                <button
                  onClick={() => onGetPhone(task.id)}
                  disabled={isLoadingPhone}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-xs transition cursor-pointer"
                >
                  <PhoneCall className="w-3.5 h-3.5" />
                  <span>{isLoadingPhone ? 'Attribution...' : 'Get Number'}</span>
                </button>
              )}
            </div>
          </div>

        </div>

        {/* Operator Notes & Telegram Message Accordion */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Notes Section */}
          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-blue-500" />
                Notes Opérateur
              </span>
              {!isEditingNotes && (
                <button
                  onClick={() => setIsEditingNotes(true)}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium cursor-pointer"
                >
                  Modifier
                </button>
              )}
            </div>

            {isEditingNotes ? (
              <div className="space-y-2 flex-1 flex flex-col">
                <textarea
                  value={notesText}
                  onChange={(e) => setNotesText(e.target.value)}
                  placeholder="Ajouter des remarques sur cette tâche..."
                  rows={3}
                  className="w-full p-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none flex-1"
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setNotesText(task.notes || '');
                      setIsEditingNotes(false);
                    }}
                    className="px-2.5 py-1 text-xs text-slate-500 hover:text-slate-700 cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleSaveNotes}
                    className="px-3 py-1 text-xs font-semibold rounded-md bg-blue-600 text-white hover:bg-blue-700 cursor-pointer"
                  >
                    Enregistrer
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed italic bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 flex-1">
                {task.notes || 'Aucune note particulière fournie pour cette tâche.'}
              </p>
            )}
          </div>

          {/* Raw Telegram Ingest Inspector */}
          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5 text-indigo-500" />
                Message Telegram Source
              </span>
              <button
                onClick={() => setShowRawTelegram(!showRawTelegram)}
                className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer font-medium"
              >
                {showRawTelegram ? 'Masquer' : 'Afficher brut'}
              </button>
            </div>

            <pre className="text-[11px] font-mono text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 overflow-x-auto whitespace-pre-wrap flex-1 max-h-32">
              {task.rawTelegramMessage || `TASK #${task.telegramTaskId}\nPrénom: ${task.firstName}\nNom: ${task.lastName}\nMot de passe: [MASQUÉ]\n${task.phone ? 'Téléphone: ' + task.phone : ''}`}
            </pre>
          </div>
        </div>

        {/* Task Activity Audit History */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              Historique des Actions pour cette tâche
            </span>
            <span className="text-[11px] text-slate-400 font-mono">
              {events.length} événements enregistrés
            </span>
          </div>

          <div className="space-y-2">
            {events.length === 0 ? (
              <p className="text-xs text-slate-400 py-2 italic text-center">Aucun événement enregistré.</p>
            ) : (
              events.map((evt) => (
                <div
                  key={evt.id}
                  className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[10px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-mono">
                      {evt.eventType}
                    </span>
                    <span className="text-slate-700 dark:text-slate-300">{evt.details}</span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono shrink-0 ml-2">
                    {new Date(evt.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
