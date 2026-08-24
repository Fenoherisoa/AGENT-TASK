import React, { useState, useEffect } from 'react';
import {
  Video,
  Play,
  Square,
  Plus,
  ArrowRight,
  Shield,
  CheckCircle,
  Clock,
  ExternalLink,
  Sliders,
  AlertTriangle,
  Radio,
  FileCheck
} from 'lucide-react';
import { RecorderState, TelegramChat, WorkflowStepType } from '../types/task';
import { api } from '../services/api';

interface WorkflowRecorderProps {
  chats: TelegramChat[];
  onNavigateToTab: (tab: string) => void;
  onRefresh: () => void;
}

export const WorkflowRecorder: React.FC<WorkflowRecorderProps> = ({ chats, onNavigateToTab, onRefresh }) => {
  const [recorderState, setRecorderState] = useState<RecorderState>({
    isRecording: false,
    sourceChats: [],
    workflowName: '',
    recordedEvents: []
  });
  const [workflowNameInput, setWorkflowNameInput] = useState('');
  const [selectedChatIds, setSelectedChatIds] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastBuiltWorkflow, setLastBuiltWorkflow] = useState<any | null>(null);

  useEffect(() => {
    api.getRecorderStatus().then(setRecorderState).catch(() => {});
  }, []);

  const handleStartRecording = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      const state = await api.startRecording(
        workflowNameInput || `Workflow Automatisé ${new Date().toLocaleDateString()}`,
        selectedChatIds
      );
      setRecorderState(state);
      setLastBuiltWorkflow(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddAction = async (type: WorkflowStepType, name: string, isManualCheckpoint = false) => {
    try {
      const event = await api.recordEvent({
        type,
        name,
        manualCheckpoint: isManualCheckpoint,
        manualInstructions: isManualCheckpoint ? 'Validation manuelle requise de l\'opérateur.' : undefined
      });
      setRecorderState(prev => ({
        ...prev,
        recordedEvents: [...prev.recordedEvents, event]
      }));
    } catch {}
  };

  const handleStopRecording = async () => {
    setIsProcessing(true);
    try {
      const result = await api.stopRecording();
      setLastBuiltWorkflow(result.workflow);
      setRecorderState({
        isRecording: false,
        sourceChats: [],
        workflowName: '',
        recordedEvents: []
      });
      onRefresh();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelRecording = async () => {
    try {
      await api.cancelRecording();
      setRecorderState({
        isRecording: false,
        sourceChats: [],
        workflowName: '',
        recordedEvents: []
      });
    } catch {}
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            Studio d'Enregistrement de Workflow
          </h2>
          <p className="text-xs text-slate-400">
            Capturez vos séquences d'actions réelles pour les transformer en modèle d'exécution automatisé
          </p>
        </div>
      </div>

      {lastBuiltWorkflow && (
        <div className="p-5 bg-emerald-950/40 border border-emerald-500/40 rounded-2xl flex items-center justify-between animate-in zoom-in-95">
          <div className="flex items-center space-x-3">
            <CheckCircle className="w-6 h-6 text-emerald-400" />
            <div>
              <h4 className="font-bold text-emerald-300 text-sm">
                Workflow "{lastBuiltWorkflow.name}" généré et sauvegardé avec succès !
              </h4>
              <p className="text-xs text-emerald-200/80 mt-0.5">
                {lastBuiltWorkflow.steps.length} étape(s) enregistrée(s) avec règles de complétion.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigateToTab('workflows')}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition"
          >
            Voir les Workflows →
          </button>
        </div>
      )}

      {/* Main Studio View */}
      {!recorderState.isRecording ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-xl max-w-2xl mx-auto space-y-6">
          <div className="flex items-center space-x-3 text-indigo-400">
            <Video className="w-8 h-8" />
            <h3 className="text-lg font-bold text-white">Créer un Nouveau Workflow par Enregistrement</h3>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            L'enregistreur écoute et structure vos actions réelles sur l'ordinateur local (navigation, changements de chat, validation, points de contrôle) sans stocker de données sensibles.
          </p>

          <form onSubmit={handleStartRecording} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Nom du Workflow
              </label>
              <input
                type="text"
                value={workflowNameInput}
                onChange={e => setWorkflowNameInput(e.target.value)}
                placeholder="ex: Inscription Plateforme Standard + Vérification"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-medium"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Chats Telegram Associés (Sources autorisées)
              </label>
              {chats.length === 0 ? (
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-500">
                  Aucun chat Telegram détecté. Le workflow sera global à toutes les sources.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-40 overflow-y-auto p-2 bg-slate-950 border border-slate-800 rounded-xl">
                  {chats.map(chat => {
                    const isChecked = selectedChatIds.includes(chat.id);
                    return (
                      <label
                        key={chat.id}
                        className="flex items-center space-x-2 text-xs text-slate-300 hover:text-white cursor-pointer p-1.5 rounded hover:bg-slate-900"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={e => {
                            if (e.target.checked) {
                              setSelectedChatIds([...selectedChatIds, chat.id]);
                            } else {
                              setSelectedChatIds(selectedChatIds.filter(id => id !== chat.id));
                            }
                          }}
                          className="rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-0"
                        />
                        <span className="font-medium">{chat.title}</span>
                        <span className="text-[10px] text-slate-500 font-mono">({chat.id})</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isProcessing}
              className="w-full flex items-center justify-center space-x-2 py-3 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-500/20 transition transform active:scale-98"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>COMMENCER L'ENREGISTREMENT</span>
            </button>
          </form>
        </div>
      ) : (
        /* Live Recording Studio View */
        <div className="space-y-6">
          {/* Status Bar */}
          <div className="bg-rose-950/40 border border-rose-500/40 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-pulse">
            <div className="flex items-center space-x-3">
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
              </span>
              <div>
                <span className="text-xs font-bold text-rose-300 uppercase tracking-wide">
                  ENREGISTREMENT EN COURS : "{recorderState.workflowName}"
                </span>
                <p className="text-[11px] text-rose-200/80">
                  {recorderState.recordedEvents.length} action(s) capturée(s)
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={handleStopRecording}
                disabled={isProcessing}
                className="flex items-center space-x-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition"
              >
                <Square className="w-4 h-4 fill-current" />
                <span>TERMINER & ENREGISTRER LE WORKFLOW</span>
              </button>

              <button
                onClick={handleCancelRecording}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl transition"
              >
                Annuler
              </button>
            </div>
          </div>

          {/* Action Capture Buttons */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase font-mono tracking-wider">
              Ajouter une Action au Workflow
            </h3>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <button
                onClick={() => handleAddAction('NAVIGATE', 'Naviguer vers l\'URL')}
                className="p-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-left transition"
              >
                <span className="text-[10px] font-mono text-cyan-400 uppercase block font-semibold">Étape</span>
                <span className="text-xs font-bold text-white mt-1 block">Navigation Page</span>
              </button>

              <button
                onClick={() => handleAddAction('CLICK', 'Clic sur le bouton')}
                className="p-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-left transition"
              >
                <span className="text-[10px] font-mono text-indigo-400 uppercase block font-semibold">Étape</span>
                <span className="text-xs font-bold text-white mt-1 block">Clic Élément</span>
              </button>

              <button
                onClick={() => handleAddAction('MANUAL_CHECKPOINT', 'Point de Validation Manuelle Opérateur', true)}
                className="p-3 bg-amber-950/30 hover:bg-amber-950/50 border border-amber-500/30 rounded-xl text-left transition"
              >
                <span className="text-[10px] font-mono text-amber-400 uppercase block font-semibold">Checkpoint</span>
                <span className="text-xs font-bold text-amber-200 mt-1 block">+ Validation Manuelle</span>
              </button>

              <button
                onClick={() => handleAddAction('WAIT', 'Attente temporisation 2s')}
                className="p-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-left transition"
              >
                <span className="text-[10px] font-mono text-slate-400 uppercase block font-semibold">Délai</span>
                <span className="text-xs font-bold text-white mt-1 block">Attente (Wait)</span>
              </button>
            </div>
          </div>

          {/* Timeline of Recorded Steps */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase font-mono tracking-wider">
              Séquence Capturée ({recorderState.recordedEvents.length} étapes)
            </h3>

            <div className="space-y-3">
              {recorderState.recordedEvents.map((evt, idx) => (
                <div
                  key={evt.id}
                  className={`p-3.5 rounded-xl border flex items-center justify-between ${
                    evt.type === 'MANUAL_CHECKPOINT'
                      ? 'bg-amber-950/20 border-amber-500/30 text-amber-200'
                      : 'bg-slate-950 border-slate-800 text-slate-200'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <span className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center font-mono text-[11px] font-bold text-slate-400">
                      {idx + 1}
                    </span>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-xs">{evt.name}</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                          {evt.type}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">
                        Capturé à {new Date(evt.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>

                  {evt.type === 'MANUAL_CHECKPOINT' && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      PAUSE OPÉRATEUR
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
