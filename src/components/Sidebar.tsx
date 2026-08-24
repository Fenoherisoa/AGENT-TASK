import React from 'react';
import {
  LayoutDashboard,
  CheckSquare,
  Radio,
  MessageSquare,
  Video,
  GitBranch,
  PlayCircle,
  Globe,
  FileText,
  Settings,
  Activity,
  Wifi,
  WifiOff,
  Cpu
} from 'lucide-react';
import { SystemStatus, AutomationState, TelegramConnectionState } from '../types/task';

interface SidebarProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  systemStatus: SystemStatus | null;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onTabChange, systemStatus }) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    {
      id: 'tasks',
      label: 'Tasks Queue',
      icon: CheckSquare,
      badge: systemStatus?.pendingCount ? `${systemStatus.pendingCount}` : undefined
    },
    {
      id: 'telegram',
      label: 'Telegram Account',
      icon: Radio,
      badge: systemStatus?.telegramState === 'CONNECTED' ? 'ON' : undefined
    },
    {
      id: 'chats',
      label: 'Telegram Chats',
      icon: MessageSquare,
      badge: systemStatus?.telegramChatCount ? `${systemStatus.telegramChatCount}` : undefined
    },
    { id: 'recorder', label: 'Workflow Recorder', icon: Video },
    { id: 'workflows', label: 'Workflows', icon: GitBranch },
    {
      id: 'automation',
      label: 'Live Automation',
      icon: PlayCircle,
      isLive: systemStatus?.automationState === 'RUNNING' || systemStatus?.automationState === 'WAITING_MANUAL'
    },
    { id: 'browser', label: 'Local Browser', icon: Globe },
    { id: 'logs', label: 'Activity Logs', icon: FileText },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'system_test', label: 'Diagnostics', icon: Activity }
  ];

  const getTelegramBadge = (state?: TelegramConnectionState) => {
    switch (state) {
      case 'READY':
      case 'CONNECTED':
        return { text: 'READY', bg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', icon: Wifi };
      case 'LOADING_CHATS':
      case 'SYNCING':
        return { text: 'SYNCING', bg: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30 animate-pulse', icon: Radio };
      case 'CONNECTING':
      case 'AUTHENTICATING':
      case 'INITIALIZING_CLIENT':
      case 'RECONNECTING':
        return { text: 'CONNECTING', bg: 'bg-amber-500/20 text-amber-400 border-amber-500/30', icon: Radio };
      case 'ERROR':
        return { text: 'ERROR', bg: 'bg-rose-500/20 text-rose-400 border-rose-500/30', icon: WifiOff };
      default:
        return { text: 'DISCONNECTED', bg: 'bg-slate-700/50 text-slate-400 border-slate-600/30', icon: WifiOff };
    }
  };

  const getAutomationBadge = (state?: AutomationState) => {
    switch (state) {
      case 'RUNNING':
        return { text: 'RUNNING', bg: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30 animate-pulse' };
      case 'WAITING_MANUAL':
        return { text: 'WAITING MANUAL', bg: 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse' };
      case 'PAUSED':
        return { text: 'PAUSED', bg: 'bg-orange-500/20 text-orange-400 border-orange-500/30' };
      default:
        return { text: 'IDLE', bg: 'bg-slate-800 text-slate-400 border-slate-700' };
    }
  };

  const tgBadge = getTelegramBadge(systemStatus?.telegramState);
  const autoBadge = getAutomationBadge(systemStatus?.automationState);
  const TgIcon = tgBadge.icon;

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between shrink-0 select-none">
      {/* Brand Header */}
      <div>
        <div className="p-4 border-b border-slate-800 flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 via-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Cpu className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-sm text-white tracking-wide flex items-center gap-1.5">
              RFC TASK AGENT
            </h1>
            <p className="text-[10px] text-slate-400 font-mono">LOCAL AUTOMATION</p>
          </div>
        </div>

        {/* Live Status Indicators */}
        <div className="px-3 py-3 border-b border-slate-800/80 space-y-2">
          <div className="flex items-center justify-between text-xs px-2">
            <span className="text-slate-400 text-[11px] font-medium flex items-center gap-1.5">
              <TgIcon className="w-3.5 h-3.5" /> Telegram Bot
            </span>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded border font-semibold ${tgBadge.bg}`}>
              {tgBadge.text}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs px-2">
            <span className="text-slate-400 text-[11px] font-medium flex items-center gap-1.5">
              <PlayCircle className="w-3.5 h-3.5" /> Runner
            </span>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded border font-semibold ${autoBadge.bg}`}>
              {autoBadge.text}
            </span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="p-2 space-y-1">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="bg-slate-800 text-slate-300 text-[10px] font-mono px-1.5 py-0.5 rounded-full border border-slate-700">
                    {item.badge}
                  </span>
                )}
                {item.isLive && (
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer System Info */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950/40">
        <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
          <span>Target URL</span>
          <span className="font-mono text-slate-300 truncate max-w-[120px]" title={systemStatus?.targetUrl}>
            {systemStatus?.targetUrl?.replace('https://', '') || 'None'}
          </span>
        </div>
        <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 mt-1">
          <span>Queue Total</span>
          <span className="font-mono text-indigo-400 font-semibold">{systemStatus?.queueLength || 0} tasks</span>
        </div>
      </div>
    </aside>
  );
};
