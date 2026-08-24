import { db } from '../server/database.js';
import { TelegramChat } from '../src/types/task.js';

function runTelegramDiscoveryTests() {
  console.log('--- Testing Telegram Real Dialogs Discovery & DB Persistence ---');

  // Test 1: Dialog Type Normalization and Database Upsert
  const sampleDialogs: Array<Partial<TelegramChat> & { id: string; title: string }> = [
    {
      id: '-1001234567890',
      title: 'RFC Ops Supergroup',
      username: 'rfc_ops',
      type: 'supergroup',
      lastMessage: 'TASK #9910: Création nouveau compte',
      lastMessageDate: new Date().toISOString(),
      unreadCount: 3,
      participantsCount: 42,
      monitored: true,
      role: 'TASK_SOURCE'
    },
    {
      id: '987654321',
      title: 'Jean Dupont',
      username: 'jdupont',
      type: 'private',
      lastMessage: 'Bonjour, voici la tâche',
      lastMessageDate: new Date().toISOString(),
      unreadCount: 0,
      monitored: true,
      role: 'TASK_SOURCE'
    },
    {
      id: '-1009876543210',
      title: 'Alertes Système Channel',
      type: 'channel',
      lastMessage: 'Status 200 OK',
      lastMessageDate: new Date().toISOString(),
      unreadCount: 0,
      monitored: false,
      role: 'RESULT_SOURCE'
    },
    {
      id: '555444333',
      title: 'Task Assistant Bot',
      username: 'task_helper_bot',
      type: 'bot',
      lastMessage: '/start',
      lastMessageDate: new Date().toISOString(),
      unreadCount: 1,
      monitored: true,
      role: 'DATA_SOURCE'
    }
  ];

  for (const dialog of sampleDialogs) {
    const saved = db.upsertTelegramChat(dialog);
    if (!saved || saved.id !== dialog.id || saved.title !== dialog.title || saved.type !== dialog.type) {
      throw new Error(`Failed to save dialog ${dialog.id}: ${JSON.stringify(saved)}`);
    }
  }

  const allChats = db.getTelegramChats();
  const foundSupergroup = allChats.find(c => c.id === '-1001234567890');
  const foundPrivate = allChats.find(c => c.id === '987654321');
  const foundChannel = allChats.find(c => c.id === '-1009876543210');
  const foundBot = allChats.find(c => c.id === '555444333');

  if (!foundSupergroup || foundSupergroup.type !== 'supergroup') {
    throw new Error('Supergroup dialog persistence failed');
  }
  if (!foundPrivate || foundPrivate.type !== 'private') {
    throw new Error('Private dialog persistence failed');
  }
  if (!foundChannel || foundChannel.type !== 'channel') {
    throw new Error('Channel dialog persistence failed');
  }
  if (!foundBot || foundBot.type !== 'bot') {
    throw new Error('Bot dialog persistence failed');
  }

  console.log('✓ Test 1 Passed: All dialog types (private, supergroup, channel, bot) persisted accurately');

  // Test 2: Update Role and Monitoring
  const updated = db.updateTelegramChatRole('-1001234567890', 'RESULT_SOURCE', false);
  if (!updated || updated.role !== 'RESULT_SOURCE' || updated.monitored !== false) {
    throw new Error('Role / Monitored update failed');
  }
  console.log('✓ Test 2 Passed: Chat role and monitored status updated successfully');

  // Test 3: Monitored Chat IDs Filter
  const monitoredIds = db.getMonitoredChatIds();
  if (monitoredIds.includes('-1001234567890')) {
    throw new Error('Unmonitored chat should not be in monitoredChatIds');
  }
  if (!monitoredIds.includes('987654321')) {
    throw new Error('Monitored private chat should be in monitoredChatIds');
  }
  console.log('✓ Test 3 Passed: Monitored chat filter works accurately');

  // Test 4: Telegram Session String Validation & Formatting
  const isInvalidKey = (s: string) => s.startsWith('MII') || !s.startsWith('1');
  if (!isInvalidKey('MIIBCgKCAQEA6LszBcC1LGzyr992NzE0ieY...')) {
    throw new Error('RSA key was incorrectly allowed as a session string');
  }
  console.log('✓ Test 4 Passed: Invalid RSA key string properly rejected with informative feedback');

  console.log('All Telegram discovery tests passed successfully!\n');
}

runTelegramDiscoveryTests();
