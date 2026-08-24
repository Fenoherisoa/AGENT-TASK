import { api } from './api';

export const phoneClient = {
  getNumber: async (taskId: string) => {
    return api.getPhoneNumber(taskId);
  },
  releaseNumber: async (taskId: string) => {
    return api.releasePhoneNumber(taskId);
  },
  refreshNumber: async (taskId: string) => {
    return api.refreshPhoneNumber(taskId);
  }
};
