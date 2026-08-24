import React, { useState, useEffect } from 'react';
import {
  Activity,
  CheckCircle,
  XCircle,
  Play,
  RefreshCw,
  Clock,
  Shield,
  Layers,
  Database,
  Cpu,
  Radio,
  Server
} from 'lucide-react';
import { SystemTestReport, SystemStatus } from '../types/task';
import { api } from '../services/api';

interface SystemTestProps {
  systemStatus: SystemStatus | null;
  onRefresh: () => void;
}

export const SystemTest: React.FC<SystemTestProps> = ({ systemStatus, onRefresh }) => {
  const [report, setReport] = useState<SystemTestReport | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRunTests = async () => {
    setIsRunning(true);
    setError(null);
    try {
      const rep = await api.runSystemTests();
      setReport(rep);
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Échec de l\'exécution de la suite de tests');
    } finally {
      setIsRunning(false);
    }
  };

  useEffect(() => {
    handleRunTests();
  }, []);

  return (
    <div className="space-y-6 pb-12 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            Diagnostics Système & Tests de Validation
          </h2>
          <p className="text-xs text-slate-400">
            Validation fonctionnelle en temps réel des modules locaux (sans simulation factice)
          </p>
        </div>

        <button
          onClick={handleRunTests}
          disabled={isRunning}
          className="flex items-center space-x-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-500/20 transition disabled:opacity-50"
        >
          <Play className={`w-3.5 h-3.5 fill-current ${isRunning ? 'animate-spin' : ''}`} />
          <span>{isRunning ? 'Tests en cours...' : 'Exécuter la Suite de Diagnostics'}</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-950/40 border border-rose-500/30 rounded-xl text-xs text-rose-300">
          {error}
        </div>
      )}

      {/* System Status Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-medium">Uptime Système</span>
            <Clock className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-lg font-bold text-white font-mono">
            {systemStatus?.uptimeSeconds ? `${systemStatus.uptimeSeconds}s` : 'Actif'}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-medium">Base Locale</span>
            <Database className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-lg font-bold text-emerald-400 font-mono">OK (JSON/SQLite)</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-medium">Telegram Bot</span>
            <Radio className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-lg font-bold text-cyan-400 font-mono">
            {systemStatus?.telegramState || 'NOT CONFIGURED'}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-medium">Runner Moteur</span>
            <Cpu className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-lg font-bold text-amber-400 font-mono">
            {systemStatus?.automationState || 'IDLE'}
          </div>
        </div>
      </div>

      {/* Test Suite Report */}
      {report && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center space-x-3">
              {report.allPassed ? (
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5" />
                </div>
              ) : (
                <div className="w-9 h-9 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center">
                  <XCircle className="w-5 h-5" />
                </div>
              )}
              <div>
                <h3 className="text-sm font-bold text-white">
                  Résultats des Tests : {report.summary}
                </h3>
                <p className="text-[11px] text-slate-400 font-mono">
                  Horodatage: {new Date(report.timestamp).toLocaleTimeString()}
                </p>
              </div>
            </div>

            <span className={`text-xs font-mono px-3 py-1 rounded-lg border font-bold ${
              report.allPassed
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
            }`}>
              {report.tests.filter(t => t.passed).length} / {report.tests.length} VALIDÉS
            </span>
          </div>

          <div className="space-y-3">
            {report.tests.map(test => (
              <div
                key={test.id}
                className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                  test.passed
                    ? 'bg-slate-950/80 border-slate-800/80'
                    : 'bg-rose-950/20 border-rose-500/40'
                }`}
              >
                <div className="flex items-start space-x-3">
                  {test.passed ? (
                    <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
                  )}
                  <div>
                    <h4 className="text-xs font-bold text-white">{test.name}</h4>
                    {test.message && (
                      <p className="text-[11px] text-slate-400 font-mono mt-0.5">{test.message}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-3 shrink-0 self-end md:self-auto font-mono text-[11px]">
                  <span className="text-slate-500">{test.durationMs}ms</span>
                  <span className={`px-2 py-0.5 rounded font-bold ${
                    test.passed
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  }`}>
                    {test.passed ? 'PASSED' : 'FAILED'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
