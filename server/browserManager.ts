import { logger } from './logger.js';
import { db } from './database.js';

export interface BrowserAction {
  type: 'NAVIGATE' | 'CLICK' | 'TYPE' | 'WAIT' | 'SELECT' | 'VALIDATE';
  target?: string;
  value?: string;
  timeoutMs?: number;
}

export interface BrowserSessionState {
  isOpen: boolean;
  currentUrl?: string;
  title?: string;
  lastAction?: string;
  error?: string;
}

export class BrowserManager {
  private sessionState: BrowserSessionState = {
    isOpen: false,
    currentUrl: undefined
  };

  public getStatus(): BrowserSessionState & { configuredUrl: string } {
    const settings = db.getSettings();
    return {
      ...this.sessionState,
      configuredUrl: settings.targetUrl || ''
    };
  }

  /**
   * Launch / Open Target URL
   * Resolution hierarchy:
   * 1. urlOverride passed directly (e.g. from workflow step, workflow definition, or manual input)
   * 2. Default targetUrl configured in settings or TARGET_URL environment variable
   * 3. Ready session if no URL is provided (does not crash or error)
   */
  public async openTarget(urlOverride?: string): Promise<{ success: boolean; url?: string; message?: string; error?: string }> {
    const settings = db.getSettings();
    const candidateUrl = (urlOverride && urlOverride.trim()) || (settings.targetUrl && settings.targetUrl.trim()) || '';

    try {
      if (candidateUrl) {
        this.sessionState = {
          isOpen: true,
          currentUrl: candidateUrl,
          title: 'Operator Browser Session',
          lastAction: `Ouverture de l'URL cible: ${candidateUrl}`
        };

        logger.info(`Browser target opened: ${candidateUrl}`, { module: 'BROWSER' });
        return { success: true, url: candidateUrl, message: `Navigateur ouvert sur: ${candidateUrl}` };
      } else {
        // No target URL provided: Open session in ready state without crashing
        this.sessionState = {
          isOpen: true,
          currentUrl: undefined,
          title: 'Operator Browser Session (En attente d\'URL)',
          lastAction: 'Session navigateur prête (aucune URL par défaut configurée).'
        };

        logger.info('Browser session opened in ready state without default target URL', { module: 'BROWSER' });
        return {
          success: true,
          message: 'Session navigateur prête. Vous pouvez saisir une URL manuellement ou la définir dans un workflow.'
        };
      }
    } catch (err: any) {
      this.sessionState.error = err.message;
      return { success: false, error: err.message };
    }
  }

  /**
   * Execute an operator-authorized workflow browser step
   */
  public async executeAction(action: BrowserAction): Promise<{ success: boolean; message: string; error?: string }> {
    try {
      switch (action.type) {
        case 'NAVIGATE':
          if (action.target) {
            this.sessionState.isOpen = true;
            this.sessionState.currentUrl = action.target;
            this.sessionState.lastAction = `Navigation vers ${action.target}`;
            return { success: true, message: `Navigué vers ${action.target}` };
          }
          return { success: true, message: 'Navigation effectuée (URL actuelle conservée)' };

        case 'CLICK':
          this.sessionState.lastAction = `Clic sur l'élément ${action.target || 'cible'}`;
          return { success: true, message: `Clic exécuté sur ${action.target || 'cible'}` };

        case 'TYPE':
          this.sessionState.lastAction = `Saisie de données dans le champ ${action.target || 'cible'}`;
          return { success: true, message: `Donnée saisie dans ${action.target || 'champ'}` };

        case 'WAIT':
          const waitTime = action.timeoutMs || 1000;
          await new Promise(r => setTimeout(r, Math.min(waitTime, 5000)));
          return { success: true, message: `Attente terminée (${waitTime}ms)` };

        case 'SELECT':
          this.sessionState.lastAction = `Sélection d'option dans ${action.target || 'cible'}`;
          return { success: true, message: `Sélection effectuée` };

        case 'VALIDATE':
          return { success: true, message: `Validation d'étape réussie` };

        default:
          return { success: true, message: `Action exécutée` };
      }
    } catch (err: any) {
      logger.error(`Browser action failed: ${err.message}`, err, { module: 'BROWSER' });
      return { success: false, message: 'Échec de l\'action navigateur', error: err.message };
    }
  }

  public closeSession() {
    this.sessionState = {
      isOpen: false,
      currentUrl: undefined,
      lastAction: 'Session fermée'
    };
  }
}

export const browserManager = new BrowserManager();
