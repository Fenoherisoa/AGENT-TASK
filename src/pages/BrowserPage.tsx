import React, { useState, useEffect } from 'react';
import {
  Globe,
  Play,
  Square,
  RefreshCw,
  ExternalLink,
  Terminal,
  Layers,
  MousePointer,
  Type,
  Clock,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Settings,
  ArrowRight
} from 'lucide-react';
import { api } from '../services/api';

export const BrowserPage: React.FC = () => {
  const [browserStatus, setBrowserStatus] = useState<{
    isOpen: boolean;
    currentUrl?: string;
    title?: string;
    lastAction?: string;
    configuredUrl: string;
  }>({
    isOpen: false,
    configuredUrl: ''
  });

  const [urlInput, setUrlInput] = useState('');
  const [actionType, setActionType] = useState<'NAVIGATE' | 'CLICK' | 'TYPE' | 'WAIT' | 'VALIDATE'>('NAVIGATE');
  const [actionTarget, setActionTarget] = useState('');
  const [actionValue, setActionValue] = useState('');
  const [actionTimeout, setActionTimeout] = useState<number>(3000);

  const [isLoading, setIsLoading] = useState(false);
  const [isExecutingAction, setIsExecutingAction] = useState(false);
  const [actionLogs, setActionLogs] = useState<Array<{ timestamp: string; text: string; success: boolean }>>([]);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchStatus = async () => {
    try {
      const status = await api.getBrowserStatus();
      setBrowserStatus(status);
      if (!urlInput && status.configuredUrl) {
        setUrlInput(status.configuredUrl);
      }
    } catch (err: any) {
      console.error('Failed to fetch browser status', err);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleOpenBrowser = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const target = urlInput.trim() || undefined;
    setIsLoading(true);
    setFeedback(null);

    try {
      const res = await api.openBrowserTarget(target);
      if (res.success) {
        setFeedback({
          type: 'success',
          message: res.url ? `Navigateur ouvert sur ${res.url}` : (res.message || 'Session navigateur prête')
        });
        addActionLog(res.url ? `Session ouverte sur: ${res.url}` : 'Session navigateur ouverte (Prête)', true);
      } else {
        setFeedback({ type: 'error', message: res.error || 'Échec de l\'ouverture du navigateur' });
        addActionLog(`Échec d'ouverture: ${res.error || 'Erreur'}`, false);
      }
      await fetchStatus();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
      addActionLog(`Erreur: ${err.message}`, false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCloseBrowser = async () => {
    setIsLoading(true);
    try {
      await api.closeBrowser();
      setFeedback({ type: 'success', message: 'Session navigateur fermée.' });
      addActionLog('Session fermée par l\'opérateur', true);
      await fetchStatus();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleExecuteAction = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsExecutingAction(true);
    setFeedback(null);

    try {
      const res = await api.executeBrowserAction({
        type: actionType,
        target: actionTarget.trim() || undefined,
        value: actionValue.trim() || undefined,
        timeoutMs: actionTimeout
      });

      if (res.success) {
        setFeedback({ type: 'success', message: res.message });
        addActionLog(`[${actionType}] ${res.message}`, true);
      } else {
        setFeedback({ type: 'error', message: res.message });
        addActionLog(`[${actionType}] Échec: ${res.message}`, false);
      }
      await fetchStatus();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
      addActionLog(`[${actionType}] Erreur: ${err.message}`, false);
    } finally {
      setIsExecutingAction(false);
    }
  };

  const addActionLog = (text: string, success: boolean) => {
    setActionLogs(prev => [
      {
        timestamp: new Date().toLocaleTimeString(),
        text,
        success
      },
      ...prev.slice(0, 49)
    ]);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-cyan-600/20 text-cyan-400 border border-cyan-500/30">
            <Globe className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-wide">Contrôleur du Navigateur Local</h1>
            <p className="text-xs text-slate-400">Automatisation locale, exécution des étapes de formulaires et gestion de session</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchStatus}
            className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Actualiser
          </button>

          {browserStatus.isOpen ? (
            <button
              onClick={handleCloseBrowser}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-semibold rounded-lg border border-rose-500/30 transition"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              Fermer Session
            </button>
          ) : (
            <button
              onClick={handleOpenBrowser}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold rounded-lg shadow-lg shadow-cyan-600/20 transition"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Lancer Navigateur
            </button>
          )}
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border flex items-center gap-3 ${
            feedback.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
          }`}
        >
          {feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
          <span className="text-xs font-medium">{feedback.message}</span>
        </div>
      )}

      {/* Status Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 block mb-2">État de Session</span>
          <div className="flex items-center gap-2">
            <span
              className={`w-3 h-3 rounded-full ${
                browserStatus.isOpen ? 'bg-emerald-400 ring-4 ring-emerald-500/20 animate-pulse' : 'bg-slate-600'
              }`}
            />
            <span className="text-sm font-bold text-white font-mono">
              {browserStatus.isOpen ? 'SESSION ACTIVE' : 'FERMÉE / EN ATTENTE'}
            </span>
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">
            Mode visible local (HEADLESS = false par défaut)
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 block mb-2">URL Actuelle</span>
          <div className="text-xs text-cyan-300 font-mono truncate" title={browserStatus.currentUrl || 'Aucune URL ouverte'}>
            {browserStatus.currentUrl || 'Non initialisée'}
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">
            Cible configurée: {browserStatus.configuredUrl || 'Non définie (Optionnelle)'}
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 block mb-2">Dernière Action Navigateur</span>
          <div className="text-xs text-slate-300 font-mono truncate">
            {browserStatus.lastAction || 'Aucune action exécutée'}
          </div>
          <span className="text-[10px] text-slate-500 mt-1 block">
            Session locale de l'opérateur
          </span>
        </div>
      </div>

      {/* URL Launcher & Navigation */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg">
        <h2 className="text-sm font-semibold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
          <ExternalLink className="w-4 h-4 text-cyan-400" />
          Navigation Directe vers l'Application Cible
        </h2>

        <form onSubmit={handleOpenBrowser} className="flex gap-3">
          <input
            type="url"
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            placeholder="https://votre-application-cible.com"
            className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 placeholder-slate-600"
          />
          <button
            type="submit"
            disabled={isLoading}
            className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-lg shadow-cyan-600/20 transition flex items-center gap-2"
          >
            {isLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            Ouvrir Cible
          </button>
        </form>
      </div>

      {/* Interactive Action Tester & Inspection */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Action Form */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
            <MousePointer className="w-4 h-4 text-indigo-400" />
            Exécuter une Action Navigateur
          </h2>

          <form onSubmit={handleExecuteAction} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Type d'Action</label>
              <select
                value={actionType}
                onChange={e => setActionType(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
              >
                <option value="NAVIGATE">NAVIGATE (Changer d'URL)</option>
                <option value="CLICK">CLICK (Cliquer un élément ou sélecteur)</option>
                <option value="TYPE">TYPE (Saisir du texte dans un champ)</option>
                <option value="WAIT">WAIT (Attendre un délai en ms)</option>
                <option value="VALIDATE">VALIDATE (Vérifier état)</option>
              </select>
            </div>

            {(actionType === 'NAVIGATE' || actionType === 'CLICK' || actionType === 'TYPE' || actionType === 'VALIDATE') && (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  {actionType === 'NAVIGATE' ? 'URL Cible' : 'Sélecteur CSS / Cible (ex: button#submit, input[name="email"])'}
                </label>
                <input
                  type="text"
                  value={actionTarget}
                  onChange={e => setActionTarget(e.target.value)}
                  placeholder={actionType === 'NAVIGATE' ? 'https://example.com/form' : 'input[name="first_name"]'}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500 placeholder-slate-600"
                />
              </div>
            )}

            {actionType === 'TYPE' && (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Valeur à Saisir</label>
                <input
                  type="text"
                  value={actionValue}
                  onChange={e => setActionValue(e.target.value)}
                  placeholder="Valeur de test"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500 placeholder-slate-600"
                />
              </div>
            )}

            {actionType === 'WAIT' && (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Délai d'Attente (millisecondes)</label>
                <input
                  type="number"
                  value={actionTimeout}
                  onChange={e => setActionTimeout(Number(e.target.value))}
                  min={500}
                  max={30000}
                  step={500}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={isExecutingAction}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-lg shadow-indigo-600/20 transition"
            >
              {isExecutingAction ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
              Exécuter Action Test
            </button>
          </form>
        </div>

        {/* Live Action Logs */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-400" />
              Journal des Opérations Navigateur
            </h2>
            {actionLogs.length > 0 && (
              <button
                onClick={() => setActionLogs([])}
                className="text-[10px] text-slate-400 hover:text-slate-200"
              >
                Effacer
              </button>
            )}
          </div>

          <div className="flex-1 bg-slate-950 border border-slate-800/80 rounded-lg p-3 font-mono text-xs overflow-y-auto max-h-72 space-y-2">
            {actionLogs.length === 0 ? (
              <div className="text-slate-600 text-center py-10 text-xs">
                Aucune action exécutée récemment dans cette session.
              </div>
            ) : (
              actionLogs.map((log, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-slate-500 text-[10px] shrink-0">[{log.timestamp}]</span>
                  <span className={log.success ? 'text-emerald-400' : 'text-rose-400'}>
                    {log.text}
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
