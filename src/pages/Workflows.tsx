import React, { useState, useEffect } from 'react';
import {
  GitBranch,
  Plus,
  Play,
  Trash2,
  Edit2,
  Copy,
  History,
  CheckCircle,
  Sliders,
  AlertTriangle,
  Clock,
  ArrowRight,
  Shield,
  Layers,
  ChevronDown,
  ChevronUp,
  RotateCcw
} from 'lucide-react';
import { Workflow, WorkflowStep, WorkflowStepType, TelegramChat, WorkflowVersion } from '../types/task';
import { api } from '../services/api';

interface WorkflowsProps {
  workflows: Workflow[];
  chats: TelegramChat[];
  onRefresh: () => void;
  onNavigateToTab: (tab: string) => void;
}

export const Workflows: React.FC<WorkflowsProps> = ({ workflows, chats, onRefresh, onNavigateToTab }) => {
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(workflows[0] || null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newWorkflowName, setNewWorkflowName] = useState('');
  const [newWorkflowDescription, setNewWorkflowDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [versions, setVersions] = useState<WorkflowVersion[]>([]);
  const [showVersionsModal, setShowVersionsModal] = useState(false);

  // Synchronize selected workflow when list updates
  React.useEffect(() => {
    if (workflows.length > 0 && (!selectedWorkflow || !workflows.find(w => w.id === selectedWorkflow.id))) {
      setSelectedWorkflow(workflows[0]);
    }
  }, [workflows]);

  useEffect(() => {
    if (selectedWorkflow) {
      loadVersions(selectedWorkflow.id);
    }
  }, [selectedWorkflow?.id]);

  const loadVersions = async (wfId: string) => {
    try {
      const v = await api.getWorkflowVersions(wfId);
      setVersions(v || []);
    } catch {
      setVersions([]);
    }
  };

  const handleToggleEnabled = async (workflow: Workflow) => {
    try {
      await api.updateWorkflow(workflow.id, { enabled: !workflow.enabled });
      onRefresh();
    } catch {}
  };

  const handleDeleteWorkflow = async (id: string) => {
    if (confirm('Confirmer la suppression de ce workflow ?')) {
      try {
        await api.deleteWorkflow(id);
        setSelectedWorkflow(null);
        onRefresh();
      } catch {}
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      const duplicated = await api.duplicateWorkflow(id);
      setSelectedWorkflow(duplicated);
      onRefresh();
    } catch {}
  };

  const handleRollback = async (versionNumber: number) => {
    if (!selectedWorkflow) return;
    if (confirm(`Confirmer le retour à la version v${versionNumber} ?`)) {
      try {
        const res = await api.rollbackWorkflow(selectedWorkflow.id, versionNumber);
        setSelectedWorkflow(res.workflow);
        setShowVersionsModal(false);
        onRefresh();
      } catch {}
    }
  };

  const handleCreateNewWorkflow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkflowName.trim()) return;

    setIsSaving(true);
    try {
      const created = await api.createWorkflow({
        name: newWorkflowName.trim(),
        description: newWorkflowDescription.trim(),
        enabled: true,
        sourceChats: [],
        steps: [
          {
            id: `step-1`,
            type: 'OPEN',
            name: 'Ouvrir URL Cible',
            timeoutSeconds: 30,
            retryCount: 1,
            enabled: true
          },
          {
            id: `step-2`,
            type: 'MANUAL_CHECKPOINT',
            name: 'Vérification Opérateur',
            timeoutSeconds: 300,
            retryCount: 1,
            manualCheckpoint: true,
            manualInstructions: 'Complétez l\'action dans le navigateur puis cliquez sur Continuer.',
            enabled: true
          },
          {
            id: `step-3`,
            type: 'COMPLETE',
            name: 'Clôture de Tâche',
            timeoutSeconds: 30,
            retryCount: 1,
            enabled: true
          }
        ]
      });

      setNewWorkflowName('');
      setNewWorkflowDescription('');
      setIsCreatingNew(false);
      setSelectedWorkflow(created);
      onRefresh();
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddStep = async () => {
    if (!selectedWorkflow) return;
    const newStep: WorkflowStep = {
      id: `step-${selectedWorkflow.steps.length + 1}-${Math.random().toString(36).substring(2, 5)}`,
      type: 'NAVIGATE',
      name: `Nouvelle Étape ${selectedWorkflow.steps.length + 1}`,
      timeoutSeconds: 30,
      retryCount: 1,
      enabled: true
    };

    const updatedSteps = [...selectedWorkflow.steps, newStep];
    try {
      const updated = await api.updateWorkflow(selectedWorkflow.id, { steps: updatedSteps });
      setSelectedWorkflow(updated);
      onRefresh();
    } catch {}
  };

  const handleMoveStep = async (stepIndex: number, direction: 'up' | 'down') => {
    if (!selectedWorkflow) return;
    const steps = [...selectedWorkflow.steps];
    const targetIdx = direction === 'up' ? stepIndex - 1 : stepIndex + 1;
    if (targetIdx < 0 || targetIdx >= steps.length) return;

    const temp = steps[stepIndex];
    steps[stepIndex] = steps[targetIdx];
    steps[targetIdx] = temp;

    try {
      const updated = await api.updateWorkflow(selectedWorkflow.id, { steps });
      setSelectedWorkflow(updated);
      onRefresh();
    } catch {}
  };

  const handleRemoveStep = async (stepIndex: number) => {
    if (!selectedWorkflow) return;
    const updatedSteps = selectedWorkflow.steps.filter((_, idx) => idx !== stepIndex);
    try {
      const updated = await api.updateWorkflow(selectedWorkflow.id, { steps: updatedSteps });
      setSelectedWorkflow(updated);
      onRefresh();
    } catch {}
  };

  const handleToggleManualCheckpoint = async (stepIndex: number) => {
    if (!selectedWorkflow) return;
    const updatedSteps = [...selectedWorkflow.steps];
    const current = updatedSteps[stepIndex];
    current.manualCheckpoint = !current.manualCheckpoint;
    if (current.manualCheckpoint) {
      current.manualInstructions = 'Action manuelle requise de l\'opérateur.';
    }

    try {
      const updated = await api.updateWorkflow(selectedWorkflow.id, { steps: updatedSteps });
      setSelectedWorkflow(updated);
      onRefresh();
    } catch {}
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            Gestion & Constructeur de Workflows
          </h2>
          <p className="text-xs text-slate-400">
            Modèles d'exécution séquentielle, règles d'automatisation et points de contrôle manuels
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => onNavigateToTab('recorder')}
            className="flex items-center space-x-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition"
          >
            <span>Enregistrer Nouveau Workflow</span>
          </button>

          <button
            onClick={() => setIsCreatingNew(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg shadow-lg shadow-indigo-500/20 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Nouveau Workflow</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Workflows List (Left) + Steps Pipeline Editor (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: Workflows Directory */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="text-xs font-bold text-slate-400 uppercase font-mono tracking-wider">
              Workflows Définis ({workflows.length})
            </h3>
          </div>

          {workflows.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-500 space-y-2">
              <p>Aucun workflow configuré.</p>
              <button
                onClick={() => setIsCreatingNew(true)}
                className="text-indigo-400 font-semibold underline"
              >
                Créer un premier workflow →
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {workflows.map(wf => {
                const isSelected = selectedWorkflow?.id === wf.id;
                return (
                  <div
                    key={wf.id}
                    onClick={() => setSelectedWorkflow(wf)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition ${
                      isSelected
                        ? 'bg-indigo-600/10 border-indigo-500/50'
                        : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-800/30'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-xs text-white truncate max-w-[170px]">
                        {wf.name}
                      </h4>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                        v{wf.version}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                      {wf.description || 'Workflow sans description.'}
                    </p>

                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-800/60 text-[10px] text-slate-500 font-mono">
                      <span>{wf.steps.length} étapes</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleEnabled(wf);
                        }}
                        className={`px-2 py-0.5 rounded font-semibold border ${
                          wf.enabled
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}
                      >
                        {wf.enabled ? 'ACTIF' : 'DÉSACTIVÉ'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Workflow Steps Pipeline & Editor */}
        <div className="lg:col-span-2 space-y-6">
          {selectedWorkflow ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
              {/* Header Info */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-base font-bold text-white">{selectedWorkflow.name}</h3>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-semibold">
                      VERSION {selectedWorkflow.version}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    {selectedWorkflow.description || 'Description standard du workflow'}
                  </p>
                </div>

                <div className="flex items-center flex-wrap gap-2">
                  <button
                    onClick={() => setShowVersionsModal(true)}
                    className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium border border-slate-700 transition"
                    title="Historique des versions et rollback"
                  >
                    <History className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Versions ({versions.length})</span>
                  </button>

                  <button
                    onClick={() => handleDuplicate(selectedWorkflow.id)}
                    className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium border border-slate-700 transition"
                    title="Dupliquer ce workflow"
                  >
                    <Copy className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Dupliquer</span>
                  </button>

                  <button
                    onClick={handleAddStep}
                    className="flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Ajouter Étape</span>
                  </button>

                  <button
                    onClick={() => handleDeleteWorkflow(selectedWorkflow.id)}
                    className="p-1.5 bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-400 rounded-lg transition"
                    title="Supprimer ce workflow"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Associated Telegram Source Chats */}
              <div className="space-y-2 p-4 bg-slate-950/70 border border-slate-800 rounded-xl">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-300 uppercase font-mono tracking-wider flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5 text-indigo-400" />
                    Sources Telegram Associées ({selectedWorkflow.sourceChats?.length || 0})
                  </h4>
                  <span className="text-[10px] text-slate-500 font-mono">
                    Sélectionnez les conversations déclenchant ce workflow
                  </span>
                </div>

                {chats.length === 0 ? (
                  <p className="text-xs text-slate-500 italic py-1">
                    Aucune discussion Telegram connectée. Connectez votre compte Telegram pour lier ce workflow.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 pt-1">
                    {chats.map(chat => {
                      const isSelected = selectedWorkflow.sourceChats?.includes(chat.id);
                      return (
                        <div
                          key={chat.id}
                          onClick={async () => {
                            const current = selectedWorkflow.sourceChats || [];
                            const updated = isSelected
                              ? current.filter(id => id !== chat.id)
                              : [...current, chat.id];
                            await api.updateWorkflow(selectedWorkflow.id, { sourceChats: updated });
                            onRefresh();
                          }}
                          className={`p-2.5 rounded-lg border text-xs cursor-pointer transition flex items-center justify-between gap-2 ${
                            isSelected
                              ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-200'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-200 truncate">{chat.title}</p>
                            <p className="text-[10px] text-slate-500 font-mono truncate">
                              {chat.username ? `@${chat.username}` : `ID: ${chat.id}`} • {chat.type}
                            </p>
                          </div>
                          <input
                            type="checkbox"
                            checked={!!isSelected}
                            readOnly
                            className="rounded text-indigo-600 focus:ring-0 focus:ring-offset-0 bg-slate-950 border-slate-700"
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Steps Pipeline */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase font-mono tracking-wider">
                  Pipeline d'Exécution ({selectedWorkflow.steps.length} étapes)
                </h4>

                <div className="space-y-2.5">
                  {selectedWorkflow.steps.map((step, idx) => (
                    <div
                      key={step.id}
                      className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                        step.manualCheckpoint
                          ? 'bg-amber-950/20 border-amber-500/30 text-amber-200'
                          : 'bg-slate-950 border-slate-800 text-slate-200'
                      }`}
                    >
                      <div className="flex items-center space-x-3.5">
                        <div className="flex flex-col items-center">
                          <button
                            onClick={() => handleMoveStep(idx, 'up')}
                            disabled={idx === 0}
                            className="p-0.5 text-slate-500 hover:text-indigo-400 disabled:opacity-20"
                            title="Monter"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-6 h-6 rounded-md bg-slate-800 flex items-center justify-center font-mono text-[11px] font-bold text-indigo-400">
                            {idx + 1}
                          </span>
                          <button
                            onClick={() => handleMoveStep(idx, 'down')}
                            disabled={idx === selectedWorkflow.steps.length - 1}
                            className="p-0.5 text-slate-500 hover:text-indigo-400 disabled:opacity-20"
                            title="Descendre"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-xs text-white">{step.name}</span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 uppercase">
                              {step.type}
                            </span>
                          </div>
                          {step.manualInstructions && (
                            <p className="text-[11px] text-amber-300/80 mt-1 font-mono">
                              ⚠️ {step.manualInstructions}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 shrink-0 self-end md:self-auto">
                        <button
                          onClick={() => handleToggleManualCheckpoint(idx)}
                          className={`px-2.5 py-1 rounded text-[10px] font-mono font-semibold border transition ${
                            step.manualCheckpoint
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        >
                          {step.manualCheckpoint ? 'POINT MANUEL ACTIF' : '+ POINT MANUEL'}
                        </button>

                        <button
                          onClick={() => handleRemoveStep(idx)}
                          className="p-1 rounded text-slate-500 hover:text-rose-400 transition"
                          title="Supprimer cette étape"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-xs text-slate-500">
              Sélectionnez un workflow dans la liste de gauche pour afficher et éditer ses étapes.
            </div>
          )}
        </div>
      </div>

      {/* New Workflow Modal */}
      {isCreatingNew && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-white">Créer un Nouveau Workflow</h3>
            <form onSubmit={handleCreateNewWorkflow} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Nom du Workflow
                </label>
                <input
                  type="text"
                  value={newWorkflowName}
                  onChange={e => setNewWorkflowName(e.target.value)}
                  placeholder="ex: Inscription Partenaire Standard"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={newWorkflowDescription}
                  onChange={e => setNewWorkflowDescription(e.target.value)}
                  placeholder="Description du processus et des étapes requises..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreatingNew(false)}
                  className="px-3 py-1.5 bg-slate-800 text-slate-300 text-xs rounded-lg"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSaving || !newWorkflowName.trim()}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition disabled:opacity-50"
                >
                  {isSaving ? 'Création...' : 'Créer Workflow'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Version History & Rollback Modal */}
      {showVersionsModal && selectedWorkflow && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-cyan-400" />
                <h3 className="text-sm font-bold text-white">
                  Historique des Versions : {selectedWorkflow.name}
                </h3>
              </div>
              <button
                onClick={() => setShowVersionsModal(false)}
                className="text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {versions.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-500">
                  Aucun historique antérieur enregistré pour ce workflow.
                </div>
              ) : (
                versions.map((ver) => (
                  <div
                    key={ver.id}
                    className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white font-mono">
                          Version {ver.version}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {new Date(ver.savedAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">
                        {ver.steps.length} étape(s) • {ver.notes || 'Sauvegarde automatique'}
                      </p>
                    </div>

                    <button
                      onClick={() => handleRollback(ver.version)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-cyan-600/30 hover:border-cyan-500/40 text-cyan-300 text-xs font-semibold rounded-lg border border-slate-700 transition"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Restaurer
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowVersionsModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
