import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Radio,
  Sliders,
  Globe,
  Trash2,
  Save,
  CheckCircle,
  AlertTriangle,
  ExternalLink,
  ShieldCheck,
  PhoneCall,
  Phone,
  Video,
  Mic,
  Volume2,
  Lock,
  ArrowRight,
  Terminal,
  RefreshCw,
  Eye,
  Layers,
  Info
} from 'lucide-react';
import {
  AppSettings,
  TelegramConnectionState,
  TelegramChat,
  TelegramChatUIState,
  TelegramCallRecord,
  TelegramCallCapability,
  TelegramCallHistoryItem
} from '../types/task';
import { api } from '../services/api';

interface SettingsProps {
  onRefresh: () => void;
  onNavigateToTab?: (tab: string) => void;
}

export const Settings: React.FC<SettingsProps> = ({ onRefresh, onNavigateToTab }) => {
  const [settings, setSettings] = useState<AppSettings>({
    telegramBotToken: '',
    telegramApiId: '',
    telegramApiHash: '',
    telegramSession: '',
    telegramChatId: '',
    targetUrl: '',
    autoStart: false,
    autoSelectNext: true,
    maxRetries: 3,
    stepTimeoutSeconds: 30,
    pauseOnError: true,
    browserEnabled: true,
    browserHeadless: false,
    browserTimeoutSeconds: 45,
    logRedaction: true,
    theme: 'dark',
    phoneProviderMode: 'mock',
    phoneBotToken: ''
  });

  const [tgStatus, setTgStatus] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Diagnostic Keyboard State
  const [debugChats, setDebugChats] = useState<TelegramChat[]>([]);
  const [selectedDebugChatId, setSelectedDebugChatId] = useState<string>('');
  const [debugUIState, setDebugUIState] = useState<TelegramChatUIState | null>(null);
  const [isDebugLoading, setIsDebugLoading] = useState(false);

  // Diagnostic Calls State
  const [callStateData, setCallStateData] = useState<{ activeCall: TelegramCallRecord | null; capabilities: TelegramCallCapability } | null>(null);
  const [callHistory, setCallHistory] = useState<TelegramCallHistoryItem[]>([]);
  const [micStatus, setMicStatus] = useState<'AVAILABLE' | 'DENIED' | 'PENDING'>('PENDING');
  const [camStatus, setCamStatus] = useState<'AVAILABLE' | 'DENIED' | 'PENDING'>('PENDING');

  const loadData = async () => {
    try {
      const s = await api.getSettings();
      setSettings(s);
      const tg = await api.getTelegramStatus();
      setTgStatus(tg);

      const chats = await api.getTelegramChats();
      if (chats && chats.length > 0) {
        setDebugChats(chats);
        if (!selectedDebugChatId) {
          setSelectedDebugChatId(chats[0].id);
          loadDebugUIState(chats[0].id);
        }
      }

      try {
        const cState = await api.getTelegramCallState();
        if (cState?.success) {
          setCallStateData({ activeCall: cState.activeCall, capabilities: cState.capabilities });
        }
        const hist = await api.getTelegramCallHistory();
        if (hist?.success) {
          setCallHistory(hist.history || []);
        }
      } catch {}

      // Check media device permissions
      if (navigator?.permissions?.query) {
        try {
          const micPerm = await navigator.permissions.query({ name: 'microphone' as PermissionName });
          setMicStatus(micPerm.state === 'granted' ? 'AVAILABLE' : micPerm.state === 'denied' ? 'DENIED' : 'PENDING');
        } catch {}
        try {
          const camPerm = await navigator.permissions.query({ name: 'camera' as PermissionName });
          setCamStatus(camPerm.state === 'granted' ? 'AVAILABLE' : camPerm.state === 'denied' ? 'DENIED' : 'PENDING');
        } catch {}
      }
    } catch {}
  };

  const loadDebugUIState = async (chatId: string) => {
    if (!chatId) return;
    setIsDebugLoading(true);
    try {
      const res = await api.getTelegramChatUIState(chatId);
      if (res.uiState) {
        setDebugUIState(res.uiState);
      } else {
        setDebugUIState(null);
      }
    } catch {
      setDebugUIState(null);
    } finally {
      setIsDebugLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedDebugChatId) {
      loadDebugUIState(selectedDebugChatId);
    }
  }, [selectedDebugChatId]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const updated = await api.updateSettings(settings);
      setSettings(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
      onRefresh();
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearDatabase = async () => {
    if (confirm('Attention : toutes les tâches, événements et configurations personnalisées seront supprimés définitivement. Continuer ?')) {
      try {
        await api.clearDatabase();
        onRefresh();
        alert('Base de données locale réinitialisée avec succès.');
      } catch {}
    }
  };

  return (
    <div className="space-y-6 pb-12 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          Paramètres de l'Agent Local
        </h2>
        <p className="text-xs text-slate-400">
          Configuration du moteur d'automatisation, du navigateur local et de la persistance
        </p>
      </div>

      {saveSuccess && (
        <div className="p-3.5 bg-emerald-950/40 border border-emerald-500/40 rounded-xl flex items-center space-x-2 text-xs text-emerald-300 animate-in zoom-in-95">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Paramètres enregistrés et appliqués avec succès.</span>
        </div>
      )}

      {/* Telegram Account Status Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Connexion Compte Telegram de l'Opérateur</h3>
              <p className="text-[11px] text-slate-400">
                Authentification de session & synchronisation des discussions autorisées
              </p>
            </div>
          </div>

          <span className={`text-[10px] font-mono px-2.5 py-1 rounded-full border font-bold ${
            tgStatus?.state === 'CONNECTED'
              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
              : tgStatus?.state === 'CONNECTING' || tgStatus?.state === 'RECONNECTING'
              ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
              : 'bg-slate-800 text-slate-400 border-slate-700'
          }`}>
            {tgStatus?.state === 'CONNECTED'
              ? `CONNECTÉ (${tgStatus.username ? `@${tgStatus.username}` : tgStatus.accountName || 'Session'})`
              : tgStatus?.state || 'NON CONNECTÉ'}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-950/70 border border-slate-800 rounded-xl">
          <div className="text-xs text-slate-300 space-y-1">
            <p className="font-semibold text-white">
              {tgStatus?.state === 'CONNECTED'
                ? `Connecté en tant que ${tgStatus.username ? `@${tgStatus.username}` : tgStatus.accountName || 'Utilisateur'}`
                : 'Aucun compte Telegram actuellement connecté'}
            </p>
            <p className="text-[11px] text-slate-400">
              Pour connecter votre session utilisateur ou gérer vos discussions surveillées, utilisez l'écran dédié.
            </p>
          </div>

          {onNavigateToTab && (
            <button
              type="button"
              onClick={() => onNavigateToTab('telegram')}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow transition shrink-0"
            >
              <span>Gérer la Connexion Telegram</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Settings Form */}
      <form onSubmit={handleSaveSettings} className="space-y-6">
        {/* Automation Execution Settings */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center space-x-3 pb-3 border-b border-slate-800">
            <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Moteur d'Automatisation des Tâches</h3>
              <p className="text-[11px] text-slate-400">Comportement de transition, enchaînement et temporisations</p>
            </div>
          </div>

          <div className="space-y-3">
            <label className="flex items-center justify-between p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl cursor-pointer hover:bg-slate-950">
              <div>
                <div className="text-xs font-semibold text-white">Démarrage Automatique des Tâches (Auto-Start)</div>
                <div className="text-[11px] text-slate-400">Lancer automatiquement une tâche dès sa détection dans Telegram</div>
              </div>
              <input
                type="checkbox"
                checked={settings.autoStart}
                onChange={e => setSettings({ ...settings, autoStart: e.target.checked })}
                className="rounded border-slate-700 bg-slate-800 text-indigo-600"
              />
            </label>

            <label className="flex items-center justify-between p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl cursor-pointer hover:bg-slate-950">
              <div>
                <div className="text-xs font-semibold text-white">Enchaînement Automatique (Auto-Next)</div>
                <div className="text-[11px] text-slate-400">Sélectionner et lancer immédiatement la tâche suivante après validation</div>
              </div>
              <input
                type="checkbox"
                checked={settings.autoSelectNext}
                onChange={e => setSettings({ ...settings, autoSelectNext: e.target.checked })}
                className="rounded border-slate-700 bg-slate-800 text-indigo-600"
              />
            </label>

            <label className="flex items-center justify-between p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl cursor-pointer hover:bg-slate-950">
              <div>
                <div className="text-xs font-semibold text-white">Mise en Pause sur Erreur (Pause on Error)</div>
                <div className="text-[11px] text-slate-400">Interrompre la séquence en cas d'échec d'une étape pour intervention de l'opérateur</div>
              </div>
              <input
                type="checkbox"
                checked={settings.pauseOnError}
                onChange={e => setSettings({ ...settings, pauseOnError: e.target.checked })}
                className="rounded border-slate-700 bg-slate-800 text-indigo-600"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Délai d'Attente par Étape (Timeout en secondes)
              </label>
              <input
                type="number"
                min="5"
                max="300"
                value={settings.stepTimeoutSeconds}
                onChange={e => setSettings({ ...settings, stepTimeoutSeconds: parseInt(e.target.value) || 30 })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Nombre Maximal de Tentatives (Max Retries)
              </label>
              <input
                type="number"
                min="0"
                max="10"
                value={settings.maxRetries}
                onChange={e => setSettings({ ...settings, maxRetries: parseInt(e.target.value) || 0 })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white font-mono"
              />
            </div>
          </div>
        </div>

        {/* Browser & Platform Settings */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center space-x-3 pb-3 border-b border-slate-800">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Navigateur Local & Plateforme Cible</h3>
              <p className="text-[11px] text-slate-400">Configuration de l'URL cible de travail de l'opérateur</p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              URL Cible par Défaut (Optionnel)
            </label>
            <input
              type="url"
              value={settings.targetUrl || ''}
              onChange={e => setSettings({ ...settings, targetUrl: e.target.value })}
              placeholder="https://votre-plateforme.com (Optionnel)"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white font-mono placeholder-slate-600"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Optionnel : si non renseignée, l'URL sera déduite du workflow ou saisie manuellement depuis l'écran Navigateur.
            </p>
          </div>

          <div className="flex items-center justify-between p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl">
            <div>
              <div className="text-xs font-semibold text-white">Masquage des Données Confidentielles</div>
              <div className="text-[11px] text-slate-400">Masquer les mots de passe dans les journaux d'audit de l'agent</div>
            </div>
            <input
              type="checkbox"
              checked={settings.logRedaction}
              onChange={e => setSettings({ ...settings, logRedaction: e.target.checked })}
              className="rounded border-slate-700 bg-slate-800 text-indigo-600"
            />
          </div>
        </div>

        {/* Optional System Administrator Integration Section */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center space-x-3 pb-3 border-b border-slate-800">
            <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
              <PhoneCall className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Intégrations Administrateur Système (Optionnel)</h3>
              <p className="text-[11px] text-slate-400">
                Fournisseur de numéros de téléphone externe et bot système (non requis pour la session opérateur normale)
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Token Bot Fournisseur de Numéros (Optionnel)
              </label>
              <input
                type="password"
                value={settings.phoneBotToken || ''}
                onChange={e => setSettings({ ...settings, phoneBotToken: e.target.value })}
                placeholder="Laisser vide si non utilisé par l'administrateur"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white font-mono placeholder-slate-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Mode d'Attribution Téléphonique
              </label>
              <select
                value={settings.phoneProviderMode || 'mock'}
                onChange={e => setSettings({ ...settings, phoneProviderMode: e.target.value as any })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white font-mono"
              >
                <option value="mock">Pool Local Isolé (Standard)</option>
                <option value="telegram_bot">Bot Telegram Externe (Administrateur)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex items-center justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center space-x-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-500/20 transition disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Enregistrement...' : 'Enregistrer les Paramètres'}</span>
          </button>
        </div>
      </form>

      {/* Developer Diagnostic Section: Telegram Keyboard Debug */}
      <div className="bg-slate-900 border border-indigo-900/40 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">Diagnostic Développeur — Clavier & Menus Telegram</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono font-semibold border border-indigo-500/30">
                  Telegram Keyboard Debug
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Inspecteur temps réel de l'état du clavier, des menus et des boutons de la conversation Telegram sélectionnée
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedDebugChatId}
              onChange={e => setSelectedDebugChatId(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
            >
              {debugChats.length === 0 && <option value="">Aucune discussion trouvée</option>}
              {debugChats.map(c => (
                <option key={c.id} value={c.id}>
                  {c.title} ({c.type}) — ID: {c.id}
                </option>
              ))}
            </select>

            <button
              type="button"
              disabled={isDebugLoading || !selectedDebugChatId}
              onClick={() => selectedDebugChatId && loadDebugUIState(selectedDebugChatId)}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition disabled:opacity-50 border border-slate-700"
              title="Rafraîchir l'état du clavier"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isDebugLoading ? 'animate-spin text-indigo-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Keyboard Metric Cards */}
        {(() => {
          const parsedKb = debugUIState?.parsedKeyboard;
          const replyKb = debugUIState?.replyKeyboard;
          const botCmds = debugUIState?.botCommands || [];

          const hasKeyboard = !!(parsedKb?.rows?.length || replyKb?.rows?.length || botCmds.length > 0);
          const keyboardType = parsedKb?.type || (replyKb ? 'REPLY_KEYBOARD' : (botCmds.length > 0 ? 'COMMAND_MENU' : 'NONE'));
          const rowsCount = parsedKb?.rows?.length ?? (replyKb?.rows?.length ?? 0);
          const totalButtons = parsedKb?.rows
            ? parsedKb.rows.reduce((acc, r) => acc + r.length, 0)
            : (replyKb?.rows ? replyKb.rows.reduce((acc, r) => acc + r.length, 0) : 0);
          const sourceMsgId = parsedKb?.sourceMessageId || 'N/A';

          return (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                {/* Metric 1: Detected */}
                <div className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-xl">
                  <div className="text-[10px] uppercase font-mono text-slate-400">Keyboard detected</div>
                  <div className="mt-1 flex items-center gap-1.5">
                    {hasKeyboard ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        YES (OUI)
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                        NO (NON)
                      </span>
                    )}
                  </div>
                </div>

                {/* Metric 2: Type */}
                <div className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-xl">
                  <div className="text-[10px] uppercase font-mono text-slate-400">Keyboard type</div>
                  <div className="mt-1 text-xs font-mono font-bold text-indigo-300 truncate" title={keyboardType}>
                    {keyboardType}
                  </div>
                </div>

                {/* Metric 3: Rows */}
                <div className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-xl">
                  <div className="text-[10px] uppercase font-mono text-slate-400">Rows</div>
                  <div className="mt-1 text-xs font-mono font-bold text-white">
                    {rowsCount} ligne{rowsCount > 1 ? 's' : ''}
                  </div>
                </div>

                {/* Metric 4: Buttons */}
                <div className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-xl">
                  <div className="text-[10px] uppercase font-mono text-slate-400">Buttons</div>
                  <div className="mt-1 text-xs font-mono font-bold text-white">
                    {totalButtons} bouton{totalButtons > 1 ? 's' : ''}
                  </div>
                </div>

                {/* Metric 5: Source Message ID */}
                <div className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-xl">
                  <div className="text-[10px] uppercase font-mono text-slate-400">Source msg ID</div>
                  <div className="mt-1 text-xs font-mono text-slate-300 truncate" title={sourceMsgId}>
                    {sourceMsgId}
                  </div>
                </div>

                {/* Metric 6: Current Chat ID */}
                <div className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-xl">
                  <div className="text-[10px] uppercase font-mono text-slate-400">Current chat ID</div>
                  <div className="mt-1 text-xs font-mono text-slate-300 truncate" title={selectedDebugChatId || 'N/A'}>
                    {selectedDebugChatId || 'N/A'}
                  </div>
                </div>
              </div>

              {/* Rows and Buttons Visual Preview */}
              {((parsedKb && parsedKb.rows.length > 0) || (replyKb && replyKb.rows.length > 0)) && (
                <div className="p-3.5 bg-slate-950/90 border border-slate-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-indigo-400" />
                      Structure Réelle des Lignes et Boutons Telegram
                    </span>
                    {parsedKb?.placeholder && (
                      <span className="text-[10px] font-mono text-slate-400 italic">
                        Placeholder: "{parsedKb.placeholder}"
                      </span>
                    )}
                  </div>

                  <div className="space-y-1.5 pt-1">
                    {(parsedKb?.rows || replyKb?.rows || []).map((row: any[], rIdx: number) => (
                      <div key={rIdx} className="flex flex-wrap gap-1.5 p-1 bg-slate-900/80 rounded-lg border border-slate-800/80">
                        <div className="w-12 text-[10px] font-mono text-slate-400 flex items-center justify-center bg-slate-950 rounded px-1">
                          L{rIdx + 1}
                        </div>
                        {row.map((btn: any, bIdx: number) => (
                          <div
                            key={bIdx}
                            className="flex-1 min-w-[100px] px-2.5 py-1.5 bg-slate-800 rounded text-[11px] font-mono text-slate-200 border border-slate-700 flex items-center justify-between gap-1"
                          >
                            <span className="truncate">{btn.label || btn.text}</span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-900 text-indigo-300 font-mono">
                              {btn.type || 'text'}
                            </span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Bot Commands Preview */}
              {botCmds.length > 0 && (
                <div className="p-3 bg-slate-950/90 border border-slate-800 rounded-xl space-y-1.5">
                  <div className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-indigo-400" />
                    Commandes Bot Détectées ({botCmds.length})
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {botCmds.map((c, idx) => (
                      <div key={idx} className="px-2.5 py-1 bg-slate-800 rounded text-[11px] font-mono text-slate-200 border border-slate-700 flex items-center gap-1.5">
                        <span className="font-bold text-indigo-400">{c.command}</span>
                        {c.description && <span className="text-slate-400 text-[10px]">— {c.description}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* Telegram Real Audio & Video Calls Diagnostics (Requirement 22, 23, 26) */}
      <div className="bg-slate-900 border border-indigo-900/40 rounded-2xl p-6 shadow-xl space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <PhoneCall className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                Diagnostic Appels Réels Telegram (MTProto Audio & Vidéo)
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase">
                  RFC 2.2
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                État des capacités d'appels Telegram, permissions périphériques audio/vidéo et historique des communications.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={loadData}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 text-xs transition flex items-center gap-1.5"
            title="Actualiser les diagnostics d'appels"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Actualiser</span>
          </button>
        </div>

        {/* Call Capabilities Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Item 1: Telegram Conn */}
          <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl">
            <div className="text-[10px] uppercase font-mono text-slate-400">Connexion Telegram</div>
            <div className="mt-1 flex items-center gap-1.5">
              {tgStatus?.state === 'READY' || tgStatus?.state === 'CONNECTED' ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  CONNECTED
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  DISCONNECTED
                </span>
              )}
            </div>
          </div>

          {/* Item 2: Audio Calls */}
          <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl">
            <div className="text-[10px] uppercase font-mono text-slate-400 flex items-center gap-1">
              <Phone className="w-3 h-3 text-indigo-400" />
              Appels Audio
            </div>
            <div className="mt-1">
              {callStateData?.capabilities?.voiceCallsSupported ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  SUPPORTED
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700" title={callStateData?.capabilities?.reason}>
                  UNSUPPORTED
                </span>
              )}
            </div>
          </div>

          {/* Item 3: Video Calls */}
          <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl">
            <div className="text-[10px] uppercase font-mono text-slate-400 flex items-center gap-1">
              <Video className="w-3 h-3 text-indigo-400" />
              Appels Vidéo
            </div>
            <div className="mt-1">
              {callStateData?.capabilities?.videoCallsSupported ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  SUPPORTED
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                  UNSUPPORTED
                </span>
              )}
            </div>
          </div>

          {/* Item 4: Microphone */}
          <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl">
            <div className="text-[10px] uppercase font-mono text-slate-400 flex items-center gap-1">
              <Mic className="w-3 h-3 text-indigo-400" />
              Microphone
            </div>
            <div className="mt-1">
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                micStatus === 'AVAILABLE' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                micStatus === 'DENIED' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              }`}>
                {micStatus}
              </span>
            </div>
          </div>

          {/* Item 5: Camera */}
          <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl">
            <div className="text-[10px] uppercase font-mono text-slate-400 flex items-center gap-1">
              <Video className="w-3 h-3 text-indigo-400" />
              Caméra
            </div>
            <div className="mt-1">
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                camStatus === 'AVAILABLE' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                camStatus === 'DENIED' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              }`}>
                {camStatus}
              </span>
            </div>
          </div>

          {/* Item 6: Current State */}
          <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl">
            <div className="text-[10px] uppercase font-mono text-slate-400">État Appel Actuel</div>
            <div className="mt-1">
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                callStateData?.activeCall ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}>
                {callStateData?.activeCall?.state || 'NONE'}
              </span>
            </div>
          </div>
        </div>

        {/* Reason / Limitation Notice if bot or unsupported */}
        {callStateData?.capabilities?.reason && (
          <div className="p-3 bg-indigo-950/30 border border-indigo-800/30 rounded-xl text-xs text-indigo-300 flex items-start gap-2">
            <Info className="w-4 h-4 shrink-0 text-indigo-400 mt-0.5" />
            <span>{callStateData.capabilities.reason}</span>
          </div>
        )}

        {/* Call History Section */}
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
            <span>Historique Récent des Appels ({callHistory.length})</span>
            {callHistory.length > 0 && (
              <span className="text-[10px] text-slate-500 font-mono">Persisté en base locale</span>
            )}
          </div>

          {callHistory.length === 0 ? (
            <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800/80 text-center text-xs text-slate-500">
              Aucun appel Telegram enregistré pour le moment.
            </div>
          ) : (
            <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
              {callHistory.slice(0, 10).map(item => (
                <div
                  key={item.id}
                  className="p-2.5 bg-slate-950/80 border border-slate-800/80 rounded-xl flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`p-1.5 rounded-lg ${
                      item.type === 'VIDEO' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-emerald-500/20 text-emerald-400'
                    }`}>
                      {item.type === 'VIDEO' ? <Video className="w-3.5 h-3.5" /> : <Phone className="w-3.5 h-3.5" />}
                    </div>
                    <div>
                      <div className="font-semibold text-white">{item.userName}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {item.direction === 'INCOMING' ? '📥 Entrant' : '📤 Sortant'} • {new Date(item.date).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                      item.status === 'CONNECTED' || item.status === 'ENDED' ? 'bg-emerald-500/20 text-emerald-300' :
                      item.status === 'MISSED' ? 'bg-amber-500/20 text-amber-300' :
                      'bg-rose-500/20 text-rose-300'
                    }`}>
                      {item.status}
                    </span>
                    {item.duration > 0 && (
                      <span className="text-[11px] font-mono text-slate-400">
                        {Math.floor(item.duration / 60)}m {item.duration % 60}s
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Database Maintenance Section */}
      <div className="bg-slate-900 border border-rose-900/30 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
            <Trash2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Maintenance de la Base Locale</h3>
            <p className="text-[11px] text-slate-400">
              Réinitialisation complète de la base SQLite/JSON (.data/local_tasks_db.json)
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-slate-400">
            Supprime toutes les tâches, l'historique et les logs d'activité.
          </span>
          <button
            type="button"
            onClick={handleClearDatabase}
            className="px-4 py-2 bg-rose-900/40 hover:bg-rose-900/60 text-rose-300 text-xs font-bold rounded-xl border border-rose-700/50 transition"
          >
            Effacer la Base de Données
          </button>
        </div>
      </div>
    </div>
  );
};
