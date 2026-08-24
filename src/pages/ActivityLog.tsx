import React, { useState, useEffect } from 'react';
import { FileText, Search, Filter, RefreshCw, Clock, Tag } from 'lucide-react';
import { TaskEvent } from '../types/task';
import { api } from '../services/api';

export const ActivityLog: React.FC = () => {
  const [events, setEvents] = useState<TaskEvent[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState(false);

  const fetchEvents = async () => {
    setIsLoading(true);
    try {
      const data = await api.getEvents();
      setEvents(data);
    } catch {} finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const eventTypes = ['ALL', ...Array.from(new Set(events.map(e => e.eventType)))];

  const filteredEvents = events.filter(e => {
    const matchesSearch =
      !searchQuery ||
      e.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.eventType.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.taskId && e.taskId.includes(searchQuery));

    const matchesType = selectedType === 'ALL' || e.eventType === selectedType;

    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            Journal d'Audit & Activités
          </h2>
          <p className="text-xs text-slate-400">
            Traçabilité intégrale de toutes les opérations locales, événements Telegram et transitions d'état
          </p>
        </div>

        <button
          onClick={fetchEvents}
          disabled={isLoading}
          className="flex items-center space-x-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Actualiser</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex flex-col md:flex-row items-center justify-between gap-3 shadow-md">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Rechercher dans les logs d'activité..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
          />
        </div>

        <div className="flex items-center space-x-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          {eventTypes.slice(0, 8).map(t => (
            <button
              key={t}
              onClick={() => setSelectedType(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition shrink-0 ${
                selectedType === t
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Event Stream List */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        {filteredEvents.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-500">
            Aucun événement répertorié.
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {filteredEvents.map(evt => (
              <div key={evt.id} className="p-4 hover:bg-slate-800/30 transition flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2.5">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-bold">
                      {evt.eventType}
                    </span>
                    {evt.taskId && (
                      <span className="text-xs font-mono text-slate-400">
                        Task: #{evt.taskId.slice(-6)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed font-mono">
                    {evt.details}
                  </p>
                </div>

                <span className="text-[10px] text-slate-500 font-mono whitespace-nowrap">
                  {new Date(evt.timestamp).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
