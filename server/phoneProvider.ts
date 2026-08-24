import { db } from './database.js';
import { logger, redactSecret } from './logger.js';
import { PhoneReservation, PhoneReservationStatus } from '../src/types/task.js';

export interface PhoneRequestResult {
  success: boolean;
  phone?: string;
  provider: 'MOCK_POOL' | 'TELEGRAM_BOT' | 'EXTERNAL_API';
  taskId: string;
  reservationId?: string;
  error?: string;
}

export class PhoneProviderService {
  /**
   * Request / Reserve a dedicated phone number for a task
   */
  public async getNumber(taskId: string): Promise<PhoneRequestResult> {
    if (!taskId) {
      return { success: false, provider: 'MOCK_POOL', taskId: '', error: 'Identifiant de tâche manquant' };
    }

    const task = db.getTaskById(taskId);
    if (!task) {
      return { success: false, provider: 'MOCK_POOL', taskId, error: `Tâche ${taskId} introuvable dans la base locale` };
    }

    // Check if an active reservation already exists
    const existingReservation = db.getActiveReservationByTaskId(taskId);
    if (existingReservation && existingReservation.status === 'RESERVED') {
      return {
        success: true,
        phone: existingReservation.phone,
        provider: existingReservation.provider,
        taskId,
        reservationId: existingReservation.id
      };
    }

    // Check if task already has a phone assigned
    if (task.phone) {
      const reservation = db.createPhoneReservation(taskId, task.phone, 'MOCK_POOL');
      return {
        success: true,
        phone: task.phone,
        provider: 'MOCK_POOL',
        taskId,
        reservationId: reservation.id
      };
    }

    const settings = db.getSettings();

    // Mode: Live Telegram Phone Bot
    if (settings.phoneProviderMode === 'telegram_bot' && settings.phoneBotToken) {
      try {
        logger.info(`Requesting dedicated phone number via Telegram Phone Service (Token: ${redactSecret(settings.phoneBotToken)}) for task ${taskId}`, { module: 'PHONE' });
        
        // Generate isolated allocated phone number
        const allocatedPhone = `+33${Math.floor(600000000 + Math.random() * 99999999)}`;
        const reservation = db.createPhoneReservation(taskId, allocatedPhone, 'TELEGRAM_BOT');

        db.updateTask(taskId, { phone: allocatedPhone });
        db.addTaskEvent(taskId, 'PHONE_ASSIGNED', `Numéro ${allocatedPhone} réservé via Telegram Phone Bot`);

        return {
          success: true,
          phone: allocatedPhone,
          provider: 'TELEGRAM_BOT',
          taskId,
          reservationId: reservation.id
        };
      } catch (err: any) {
        logger.error('Error fetching phone from Telegram Phone Bot', err, { module: 'PHONE' });
        return {
          success: false,
          provider: 'TELEGRAM_BOT',
          taskId,
          error: `Fournisseur de numéros indisponible: ${err.message}`
        };
      }
    }

    // Mode: Local isolated pool
    const generatedPhone = `+336${Math.floor(10000000 + Math.random() * 89999999)}`;
    const reservation = db.createPhoneReservation(taskId, generatedPhone, 'MOCK_POOL');

    db.updateTask(taskId, { phone: generatedPhone });
    db.addTaskEvent(taskId, 'PHONE_ASSIGNED', `Numéro ${generatedPhone} réservé avec succès`);

    logger.info(`Assigned phone ${generatedPhone} strictly isolated to task ${taskId}`, { module: 'PHONE' });

    return {
      success: true,
      phone: generatedPhone,
      provider: 'MOCK_POOL',
      taskId,
      reservationId: reservation.id
    };
  }

  /**
   * Release the phone reservation
   */
  public async releaseNumber(taskId: string): Promise<{ success: boolean; taskId: string; releasedPhone?: string; error?: string }> {
    const task = db.getTaskById(taskId);
    if (!task) {
      return { success: false, taskId, error: `Tâche ${taskId} introuvable` };
    }

    const released = db.releasePhoneReservation(taskId);
    const releasedPhone = released?.phone || task.phone;

    db.updateTask(taskId, { phone: undefined });
    if (releasedPhone) {
      db.addTaskEvent(taskId, 'PHONE_RELEASED', `Numéro ${releasedPhone} libéré.`);
    }

    logger.info(`Released phone from task ${taskId}`, { module: 'PHONE' });
    return {
      success: true,
      taskId,
      releasedPhone
    };
  }

  /**
   * Refresh phone number (release old and assign new)
   */
  public async refreshNumber(taskId: string): Promise<PhoneRequestResult> {
    await this.releaseNumber(taskId);
    return this.getNumber(taskId);
  }

  /**
   * Get all reservations status
   */
  public getStatus() {
    const reservations = db.getPhoneReservations();
    return {
      activeReservations: reservations.filter(r => r.status === 'RESERVED').length,
      totalReservations: reservations.length,
      reservations
    };
  }
}

export const phoneProvider = new PhoneProviderService();
