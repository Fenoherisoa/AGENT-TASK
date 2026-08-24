import React, { useState, useEffect } from 'react';
import {
  Wifi,
  WifiOff,
  Radio,
  RefreshCw,
  ShieldCheck,
  Key,
  UserCheck,
  Send,
  CheckCircle2,
  AlertTriangle,
  Info,
  Server,
  MessageSquare,
  Lock,
  ArrowRight,
  Layers,
  Smartphone,
  KeyRound,
  Sparkles,
  HelpCircle
} from 'lucide-react';
import { api } from '../services/api';
import { TelegramConnectionState, TelegramChat } from '../types/task';

interface TelegramConnectionProps {
  onNavigateToChats?: () => void;
}

export const TelegramConnection: React.FC<TelegramConnectionProps> = ({ onNavigateToChats }) => {
  const [connectionType, setConnectionType] = useState<'phone' | 'session' | 'bot'>('phone');
  
  // Credentials
  const [botToken, setBotToken] = useState('');
  const [apiId, setApiId] = useState('');
  const [apiHash, setApiHash] = useState('');
  const [sessionString, setSessionString] = useState('');
  
  // Interactive Phone Auth State
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [twoFactorPassword, setTwoFactorPassword] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [codeViaApp, setCodeViaApp] = useState(true);
  const [requires2FA, setRequires2FA] = useState(false);

  const [status, setStatus] = useState<{
    state: TelegramConnectionState;
    diagnosticState?: string;
    accountType?: 'BOT' | 'USER_SESSION' | 'NONE';
    username?: string;
    accountName?: string;
    accountId?: string;
    error?: string;
    chatCount: number;
    monitoredChatCount: number;
    lastSyncTime?: string;
    messagesSyncedCount?: number;
    isLoadingChats?: boolean;
  }>({
    state: 'DISCONNECTED',
    chatCount: 0,
    monitoredChatCount: 0
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [syncSummary, setSyncSummary] = useState<{ tasksImported: number; chatsDiscovered: number } | null>(null);

  const fetchStatus = async () => {
    try {
      const data = await api.getTelegramStatus();
      setStatus(data);
    } catch (err: any) {
      console.error('Failed to fetch telegram status', err);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiId.trim() || !apiHash.trim() || !phoneNumber.trim()) {
      setFeedback({ type: 'error', message: 'Veuillez renseigner API ID, API Hash et votre numéro de téléphone.' });
      return;
    }

    setIsLoading(true);
    setFeedback(null);
    try {
      const res = await api.sendTelegramCode({
        apiId: apiId.trim(),
        apiHash: apiHash.trim(),
        phoneNumber: phoneNumber.trim()
      });
      if (res.success) {
        setCodeSent(true);
        setCodeViaApp(!!res.isCodeViaApp);
        setFeedback({
          type: 'success',
          message: res.message || (res.isCodeViaApp ? 'Code envoyé dans votre application Telegram !' : 'Code envoyé par SMS !')
        });
      } else {
        setFeedback({ type: 'error', message: res.error || res.message });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneCode.trim()) {
      setFeedback({ type: 'error', message: 'Veuillez saisir le code reçu.' });
      return;
    }

    setIsLoading(true);
    setFeedback(null);
    try {
      const res = await api.verifyTelegramCode({
        phoneCode: phoneCode.trim(),
        password: twoFactorPassword.trim() || undefined
      });

      if (res.requires2FA) {
        setRequires2FA(true);
        setFeedback({
          type: 'error',
          message: 'Ce compte Telegram est protégé par un mot de passe (2FA). Veuillez saisir votre mot de passe ci-dessous.'
        });
      } else if (res.success) {
        setFeedback({ type: 'success', message: res.message });
        setCodeSent(false);
        setPhoneCode('');
        setTwoFactorPassword('');
        setRequires2FA(false);
        await fetchStatus();
      } else {
        setFeedback({ type: 'error', message: res.error || res.message });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnectBot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!botToken.trim()) return;

    setIsLoading(true);
    setFeedback(null);
    try {
      const res = await api.connectTelegram(botToken.trim());
      if (res.success) {
        setFeedback({ type: 'success', message: res.message });
        setBotToken('');
        await fetchStatus();
      } else {
        setFeedback({ type: 'error', message: res.error || res.message });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnectUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanSession = sessionString.trim().replace(/^['"]|['"]$/g, '');
    if (!cleanSession) return;

    if (!cleanSession.startsWith('1') && cleanSession.startsWith('MII')) {
      setFeedback({
        type: 'error',
        message: 'Attention : Vous avez collé une clé RSA ou un certificat au format PEM au lieu d\'une Session String GramJS. Utilisez la "Connexion par Téléphone" pour générer automatiquement une session valide.'
      });
      return;
    }

    setIsLoading(true);
    setFeedback(null);
    try {
      const res = await api.connectTelegramUser({
        apiId: apiId.trim(),
        apiHash: apiHash.trim(),
        sessionString: cleanSession
      });
      if (res.success) {
        setFeedback({ type: 'success', message: res.message });
        setSessionString('');
        await fetchStatus();
      } else {
        setFeedback({ type: 'error', message: res.error || res.message });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setIsLoading(true);
    try {
      await api.disconnectTelegram();
      setFeedback({ type: 'success', message: 'Compte Telegram déconnecté avec succès.' });
      setCodeSent(false);
      await fetchStatus();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleReconnect = async () => {
    setIsLoading(true);
    try {
      const res = await api.reconnectTelegram();
      if (res.success) {
        setFeedback({ type: 'success', message: res.message });
      } else {
        setFeedback({ type: 'error', message: res.error || res.message });
      }
      await fetchStatus();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSyncNow = async () => {
    setIsSyncing(true);
    setFeedback(null);
    try {
      const result = await api.syncTelegram();
      setSyncSummary(result);
      setFeedback({
        type: 'success',
        message: `Synchronisation réussie : ${result.chatsDiscovered} conversation(s) découverte(s), ${result.tasksImported} tâche(s) importée(s).`
      });
      await fetchStatus();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setIsSyncing(false);
    }
  };

  const isConnected = status.state === 'CONNECTED' || status.state === 'READY';
  const isTransitioning =
    status.state === 'CONNECTING' ||
    status.state === 'AUTHENTICATING' ||
    status.state === 'INITIALIZING_CLIENT' ||
    status.state === 'LOADING_CHATS' ||
    status.state === 'SYNCING' ||
    status.state === 'RECONNECTING';

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-lg">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <Radio className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-wide">Gestionnaire de Connexion Telegram</h1>
              <p className="text-xs text-slate-400">Authentification interactive par SMS/App, session MTProto ou Bot API avec découverte en temps réel</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSyncNow}
            disabled={!isConnected || isSyncing || isTransitioning}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing || status.isLoadingChats ? 'animate-spin text-cyan-400' : ''}`} />
            {isSyncing || status.isLoadingChats ? 'Synchronisation...' : 'Refresh Chats (Actualiser)'}
          </button>

          {isConnected ? (
            <button
              onClick={handleDisconnect}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-semibold rounded-lg border border-rose-500/30 transition"
            >
              <WifiOff className="w-3.5 h-3.5" />
              Déconnecter
            </button>
          ) : (
            <button
              onClick={handleReconnect}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow-lg shadow-indigo-600/20 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Reconnecter
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
          {feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
          <span className="text-xs font-medium">{feedback.message}</span>
        </div>
      )}

      {/* Diagnostic State Warning */}
      {status.diagnosticState === 'TELEGRAM_DIALOG_DISCOVERY_FAILED' && (
        <div className="bg-amber-950/40 border border-amber-500/40 rounded-2xl p-4 flex items-start space-x-3.5">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <h4 className="font-bold text-amber-300 font-mono">TELEGRAM_DIALOG_DISCOVERY_FAILED</h4>
            <p className="text-amber-200/80">
              Aucune conversation n'a pu être retournée par l'API Telegram. Vérifiez vos identifiants ou cliquez sur <strong>Refresh Chats</strong> pour relancer la découverte.
            </p>
          </div>
        </div>
      )}

      {/* Connection Status Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 block mb-2">État de Connexion</span>
          <div className="flex items-center gap-2">
            <span
              className={`w-3 h-3 rounded-full ${
                isConnected
                  ? 'bg-emerald-400 ring-4 ring-emerald-500/20 animate-pulse'
                  : isTransitioning
                  ? 'bg-amber-400 ring-4 ring-amber-500/20 animate-spin'
                  : status.state === 'ERROR'
                  ? 'bg-rose-400 ring-4 ring-rose-500/20'
                  : 'bg-slate-500'
              }`}
            />
            <span className="text-sm font-bold text-white font-mono">{status.state}</span>
          </div>
          {status.error && <p className="text-[10px] text-rose-400 mt-2 line-clamp-2">{status.error}</p>}
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 block mb-2">Compte / Entité</span>
          <div className="flex items-center gap-2 text-white font-medium text-sm">
            <UserCheck className="w-4 h-4 text-cyan-400" />
            <span className="truncate">{status.username ? `@${status.username}` : status.accountName || 'Non connecté'}</span>
          </div>
          <span className="text-[10px] text-slate-500 mt-1 block">
            Type: {status.accountType === 'BOT' ? 'Bot API' : status.accountType === 'USER_SESSION' ? 'Session MTProto' : 'Aucun'}
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 block mb-2">Conversations Réelles</span>
          <div className="flex items-baseline gap-2">
            {isTransitioning && status.chatCount === 0 ? (
              <span className="text-sm font-semibold text-indigo-400 flex items-center gap-1.5 font-mono">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Découverte...
              </span>
            ) : (
              <>
                <span className="text-2xl font-bold text-white font-mono">{status.chatCount}</span>
                <span className="text-xs text-slate-400">({status.monitoredChatCount} surveillées)</span>
              </>
            )}
          </div>
          {onNavigateToChats && status.chatCount > 0 && (
            <button
              onClick={onNavigateToChats}
              className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 mt-1 font-medium"
            >
              Gérer les conversations <ArrowRight className="w-2.5 h-2.5" />
            </button>
          )}
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 block mb-2">Dernière Synchronisation</span>
          <div className="text-xs text-slate-300 font-mono">
            {status.lastSyncTime ? new Date(status.lastSyncTime).toLocaleTimeString() : 'Aucune synchro'}
          </div>
          <span className="text-[10px] text-slate-500 mt-1 block">
            Messages traités: {status.messagesSyncedCount ?? 0}
          </span>
        </div>
      </div>

      {/* Authentication Tabs & Form */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-4 mb-6 gap-3">
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-indigo-400" />
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Connexion au Compte Telegram</h2>
          </div>

          <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button
              type="button"
              onClick={() => { setConnectionType('phone'); setFeedback(null); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition ${
                connectionType === 'phone'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              Par Téléphone & Code (Recommandé)
            </button>
            <button
              type="button"
              onClick={() => { setConnectionType('session'); setFeedback(null); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition ${
                connectionType === 'session'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              Session String
            </button>
            <button
              type="button"
              onClick={() => { setConnectionType('bot'); setFeedback(null); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition ${
                connectionType === 'bot'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Wifi className="w-3.5 h-3.5" />
              Bot Token
            </button>
          </div>
        </div>

        {/* Option 1: Interactive Phone Number + Code Login (Easiest & Most Reliable) */}
        {connectionType === 'phone' && (
          <div className="space-y-5">
            <div className="bg-indigo-950/30 border border-indigo-500/20 rounded-xl p-4 flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
              <div className="text-xs text-indigo-200/90 leading-relaxed">
                <strong className="text-indigo-300 font-semibold">Connexion sans extraction manuelle de session :</strong> Entrez votre <strong>API ID</strong> et <strong>API Hash</strong> (obtenus sur <a href="https://my.telegram.org" target="_blank" rel="noreferrer" className="underline font-bold text-cyan-300 hover:text-cyan-200">my.telegram.org</a>) et votre numéro de téléphone. Un code de connexion vous sera envoyé directement par Telegram.
              </div>
            </div>

            {!codeSent ? (
              <form onSubmit={handleSendCode} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Telegram App API ID</label>
                    <input
                      type="text"
                      value={apiId}
                      onChange={e => setApiId(e.target.value)}
                      placeholder="ex: 12345678"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500 placeholder-slate-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Telegram App API Hash</label>
                    <input
                      type="password"
                      value={apiHash}
                      onChange={e => setApiHash(e.target.value)}
                      placeholder="ex: a1b2c3d4e5f6..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500 placeholder-slate-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Numéro de Téléphone (Format International)</label>
                  <div className="relative">
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={e => setPhoneNumber(e.target.value)}
                      placeholder="ex: +33612345678 ou +261340000000"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500 placeholder-slate-600"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Incluez impérativement l'indicatif international avec le signe « + ».
                  </p>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={isLoading || !phoneNumber.trim() || !apiId.trim() || !apiHash.trim()}
                    className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-lg shadow-indigo-600/20 transition"
                  >
                    {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Envoyer le Code de Vérification
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleVerifyCode} className="space-y-4 bg-slate-950 border border-indigo-500/30 p-5 rounded-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-indigo-300 font-medium">
                    <Smartphone className="w-4 h-4 text-cyan-400" />
                    <span>Code envoyé à <strong className="text-white font-mono">{phoneNumber}</strong> ({codeViaApp ? 'Application Telegram' : 'SMS'})</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setCodeSent(false); setRequires2FA(false); }}
                    className="text-[11px] text-slate-400 hover:text-slate-200 underline"
                  >
                    Changer de numéro
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Code de Vérification (5 chiffres)</label>
                  <input
                    type="text"
                    autoFocus
                    value={phoneCode}
                    onChange={e => setPhoneCode(e.target.value)}
                    placeholder="ex: 12345"
                    className="w-full max-w-xs bg-slate-900 border border-indigo-500/40 rounded-lg px-4 py-3 text-lg text-white font-mono tracking-widest text-center focus:outline-none focus:border-indigo-400"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Vérifiez les messages du compte officiel "Telegram" dans votre application.
                  </p>
                </div>

                {requires2FA && (
                  <div>
                    <label className="block text-xs font-medium text-amber-300 mb-1">Mot de passe 2FA (Double Authentification)</label>
                    <input
                      type="password"
                      value={twoFactorPassword}
                      onChange={e => setTwoFactorPassword(e.target.value)}
                      placeholder="Votre mot de passe 2FA Telegram..."
                      className="w-full bg-slate-900 border border-amber-500/40 rounded-lg px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>
                )}

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={handleSendCode}
                    disabled={isLoading}
                    className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1"
                  >
                    <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
                    Renvoyer le code
                  </button>

                  <button
                    type="submit"
                    disabled={isLoading || !phoneCode.trim()}
                    className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-lg shadow-emerald-600/20 transition"
                  >
                    {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Valider & Connecter le Compte
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Option 2: Session String */}
        {connectionType === 'session' && (
          <form onSubmit={handleConnectUser} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Telegram App API ID</label>
                <input
                  type="text"
                  value={apiId}
                  onChange={e => setApiId(e.target.value)}
                  placeholder="ex: 12345678"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500 placeholder-slate-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Telegram App API Hash</label>
                <input
                  type="password"
                  value={apiHash}
                  onChange={e => setApiHash(e.target.value)}
                  placeholder="ex: a1b2c3d4e5f6..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500 placeholder-slate-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Session String (MTProto GramJS)</label>
              <textarea
                rows={3}
                value={sessionString}
                onChange={e => setSessionString(e.target.value)}
                placeholder="ex: 1AZF_..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500 placeholder-slate-600 resize-none"
              />
              <div className="flex items-start gap-1.5 text-[11px] text-slate-400 mt-1">
                <Info className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                <span>
                  La session string GramJS doit commencer par le chiffre « <strong>1</strong> » (générée par <code>client.session.save()</code>). Les clés RSA PEM (commençant par <code>MII...</code>) ne sont pas des sessions valides. Si vous n'avez pas de session existante, utilisez l'onglet <strong>Par Téléphone & Code</strong> ci-dessus.
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isLoading || !sessionString.trim()}
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-lg shadow-indigo-600/20 transition"
              >
                {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
                Connecter la Session Utilisateur
              </button>
            </div>
          </form>
        )}

        {/* Option 3: Bot Token */}
        {connectionType === 'bot' && (
          <form onSubmit={handleConnectBot} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Telegram Bot Token (HTTP API Token)
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={botToken}
                  onChange={e => setBotToken(e.target.value)}
                  placeholder="ex: 123456789:AAFgAbCdEfGhIjKlMnOpQrStUvWxYz..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 placeholder-slate-600"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Le token est stocké localement et strictement masqué dans les journaux d'audit.
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isLoading || !botToken.trim()}
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-lg shadow-indigo-600/20 transition"
              >
                {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}
                Connecter le Bot Telegram
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Architecture & Security Notice */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
          <div className="text-xs text-slate-400 space-y-1">
            <p className="font-medium text-slate-200">Fonctionnement du Robot d'Exécution Telegram</p>
            <p>
              Dès que la connexion est établie, le moteur récupère les conversations réelles de votre compte (privées, groupes, supergroupes, canaux et bots) et synchronise les messages entrants.
            </p>
            <p className="text-slate-400 font-mono text-[11px]">
              Protection des secrets : L'API Hash, tokens et chaînes de session ne sont jamais exposés dans les journaux ni transmis à des tiers.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

