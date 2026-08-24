import { api } from './api';

export const telegramClient = {
  sync: async () => {
    return api.syncTelegram();
  },
  getStatus: async () => {
    return api.getTelegramStatus();
  },
  ingestMessage: async (text: string) => {
    return api.ingestTelegramMessage(text);
  }
};
