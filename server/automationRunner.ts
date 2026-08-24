import { db } from './database.js';
import { logger } from './logger.js';
import { sse } from './sse.js';
import { workflowEngine } from './workflowEngine.js';
import { phoneProvider } from './phoneProvider.js';
import { Task, Workflow, AutomationRun, AutomationState } from '../src/types/task.js';

class AutomationRunnerService {
  private currentRun: AutomationRun | null = null;
  private isProcessing = false;
  private isPaused = false;

  constructor() {
    // Check for interrupted tasks at boot
    setTimeout(() => {
      this.checkInterruptedTasks();
    }, 1500);
  }

  public getStatus(): {
    state: AutomationState;
    activeRun: AutomationRun | null;
    activeTask: Task | null;
    activeWorkflow: Workflow | null;
  } {
    if (!this.currentRun) {
      return {
        state: 'IDLE',
        activeRun: null,
        activeTask: null,
        activeWorkflow: null
      };
    }

    const task = db.getTaskById(this.currentRun.taskId) || null;
    const workflow = db.getWorkflowById(this.currentRun.workflowId) || null;

    return {
      state: this.currentRun.status,
      activeRun: this.currentRun,
      activeTask: task,
      activeWorkflow: workflow
    };
  }

  /**
   * Check for interrupted tasks on server startup
   */
  public checkInterruptedTasks(): Task[] {
    const interrupted = db.getInterruptedTasks();
    if (interrupted.length > 0) {
      logger.warn(`Detected ${interrupted.length} interrupted task(s) on startup`, { module: 'RECOVERY' });
      db.addTaskEvent(undefined, 'RECOVERY', `${interrupted.length} tâche(s) interrompue(s) détectée(s) au redémarrage.`);
    }
    return interrupted;
  }

  /**
   * Start executing a task with an appropriate workflow
   */
  public async startTask(taskId: string, workflowId?: string): Promise<{ success: boolean; run?: AutomationRun; error?: string }> {
    const task = db.getTaskById(taskId);
    if (!task) {
      return { success: false, error: `Tâche ${taskId} introuvable` };
    }

    // Select workflow
    let workflow: Workflow | undefined;
    if (workflowId) {
      workflow = db.getWorkflowById(workflowId);
    } else {
      workflow = db.getActiveWorkflowForChat(task.telegramChatId);
    }

    if (!workflow) {
      // Create a default standard workflow if none exists yet
      workflow = db.createWorkflow({
        name: 'Workflow Standard d\'Exécution',
        description: 'Workflow standard automatique avec point de validation manuelle',
        enabled: true,
        sourceChats: task.telegramChatId ? [task.telegramChatId] : [],
        steps: [
          {
            id: 'step-1',
            type: 'OPEN',
            name: 'Ouvrir l\'application cible',
            timeoutSeconds: 30,
            retryCount: 1,
            enabled: true
          },
          {
            id: 'step-2',
            type: 'NAVIGATE',
            name: 'Naviguer vers le formulaire d\'inscription',
            timeoutSeconds: 30,
            retryCount: 1,
            enabled: true
          },
          {
            id: 'step-3',
            type: 'TYPE',
            name: 'Saisie des identifiants (Prénom / Nom)',
            timeoutSeconds: 30,
            retryCount: 1,
            enabled: true
          },
          {
            id: 'step-4',
            type: 'MANUAL_CHECKPOINT',
            name: 'Vérification & Validation Manuelle Opérateur',
            timeoutSeconds: 300,
            retryCount: 1,
            manualCheckpoint: true,
            manualInstructions: 'Complétez la vérification de sécurité / confirmation dans votre navigateur, puis cliquez sur Continuer.',
            enabled: true
          },
          {
            id: 'step-5',
            type: 'COMPLETE',
            name: 'Validation finale & Clôture de la tâche',
            timeoutSeconds: 30,
            retryCount: 1,
            enabled: true
          }
        ]
      });
    }

    // Update task to IN_PROGRESS
    db.updateTask(task.id, {
      status: 'IN_PROGRESS',
      workflowId: workflow.id,
      startedAt: new Date().toISOString(),
      currentStepIndex: 0,
      errorMessage: undefined
    });

    db.addTaskEvent(task.id, 'STARTED', `Tâche #${task.telegramTaskId} démarrée avec le workflow "${workflow.name}"`, undefined, workflow.id);

    // Create Automation Run
    const run: AutomationRun = {
      id: `run-${Date.now()}`,
      taskId: task.id,
      workflowId: workflow.id,
      status: 'RUNNING',
      currentStepIndex: 0,
      totalSteps: workflow.steps.length,
      startedAt: new Date().toISOString(),
      elapsedMs: 0,
      lastAction: `Démarrage du workflow ${workflow.name}`,
      logs: [`[${new Date().toLocaleTimeString()}] Démarrage de la tâche #${task.telegramTaskId}`]
    };

    this.currentRun = run;
    db.saveAutomationRun(run);

    this.isPaused = false;
    sse.broadcast('automation:status', this.getStatus());
    sse.broadcast('task:started', { task, workflow, run });

    // Execute step loop asynchronously
    this.processStepLoop();

    return { success: true, run };
  }

  /**
   * Main step execution loop
   */
  private async processStepLoop() {
    if (this.isProcessing || !this.currentRun) return;
    this.isProcessing = true;

    try {
      while (this.currentRun && this.currentRun.status === 'RUNNING' && !this.isPaused) {
        const task = db.getTaskById(this.currentRun.taskId);
        const workflow = db.getWorkflowById(this.currentRun.workflowId);

        if (!task || !workflow) {
          this.failTask(this.currentRun?.taskId || '', 'Contexte de tâche ou workflow manquant');
          break;
        }

        const stepIndex = this.currentRun.currentStepIndex;
        if (stepIndex >= workflow.steps.length) {
          // Reached end of workflow
          await this.completeTask(task.id);
          break;
        }

        const currentStep = workflow.steps[stepIndex];
        this.currentRun.lastAction = `Exécution de l'étape ${stepIndex + 1}/${workflow.steps.length}: ${currentStep.name}`;
        this.currentRun.logs.push(`[${new Date().toLocaleTimeString()}] Étape ${stepIndex + 1}: ${currentStep.name}`);
        sse.broadcast('automation:step', { stepIndex, step: currentStep, run: this.currentRun });

        // Execute step via engine
        const result = await workflowEngine.executeStep({
          task,
          workflow,
          stepIndex,
          variables: {},
          logs: this.currentRun.logs
        });

        if (result.requiresManualAction) {
          // Pause and wait for manual checkpoint confirmation
          this.currentRun.status = 'WAITING_MANUAL';
          this.currentRun.manualCheckpointRequired = true;
          this.currentRun.manualInstructions = result.manualInstructions;
          this.currentRun.lastAction = 'En attente de validation manuelle';

          db.updateTask(task.id, {
            status: 'WAITING_MANUAL_ACTION',
            currentStepIndex: stepIndex
          });

          db.addTaskEvent(task.id, 'MANUAL_WAIT', result.manualInstructions || 'Action manuelle requise.', undefined, workflow.id);
          db.saveAutomationRun(this.currentRun);

          sse.broadcast('automation:manual_checkpoint', {
            taskId: task.id,
            stepIndex,
            instructions: result.manualInstructions,
            run: this.currentRun
          });
          sse.broadcast('automation:status', this.getStatus());
          break; // Stop loop and await resume()
        }

        if (!result.success) {
          // Step failed
          const settings = db.getSettings();
          if (settings.pauseOnError) {
            this.currentRun.status = 'PAUSED';
            this.currentRun.lastError = result.error;
            db.saveAutomationRun(this.currentRun);
            sse.broadcast('automation:status', this.getStatus());
            break;
          } else {
            await this.failTask(task.id, result.error || 'Erreur lors de l\'étape');
            break;
          }
        }

        // Advance to next step
        this.currentRun.currentStepIndex += 1;
        db.updateTask(task.id, { currentStepIndex: this.currentRun.currentStepIndex });
        db.saveAutomationRun(this.currentRun);

        // Brief delay between steps
        await new Promise(r => setTimeout(r, 600));
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Resume automation after operator completes manual checkpoint
   */
  public async resumeAutomation(taskId?: string): Promise<{ success: boolean; message: string; error?: string }> {
    const targetTaskId = taskId || this.currentRun?.taskId;
    if (!targetTaskId) {
      return { success: false, message: 'Aucune tâche active à reprendre' };
    }

    const task = db.getTaskById(targetTaskId);
    if (!task) {
      return { success: false, message: 'Tâche introuvable' };
    }

    if (!this.currentRun || this.currentRun.taskId !== targetTaskId) {
      const workflow = db.getWorkflowById(task.workflowId || '') || db.getActiveWorkflowForChat(task.telegramChatId);
      if (!workflow) {
        return { success: false, message: 'Workflow manquant pour la reprise' };
      }

      this.currentRun = {
        id: `run-${Date.now()}`,
        taskId: task.id,
        workflowId: workflow.id,
        status: 'RUNNING',
        currentStepIndex: (task.currentStepIndex || 0) + 1,
        totalSteps: workflow.steps.length,
        startedAt: task.startedAt || new Date().toISOString(),
        elapsedMs: 0,
        lastAction: 'Reprise après action manuelle',
        logs: [`[${new Date().toLocaleTimeString()}] Reprise par l'opérateur`]
      };
    } else {
      this.currentRun.status = 'RUNNING';
      this.currentRun.manualCheckpointRequired = false;
      this.currentRun.currentStepIndex += 1; // Advance past manual checkpoint
      this.currentRun.lastAction = 'Reprise après action manuelle';
      this.currentRun.logs.push(`[${new Date().toLocaleTimeString()}] Action manuelle validée par l'opérateur`);
    }

    this.isPaused = false;
    db.updateTask(task.id, {
      status: 'IN_PROGRESS',
      currentStepIndex: this.currentRun.currentStepIndex
    });

    db.addTaskEvent(task.id, 'MANUAL_RESUMED', 'Action manuelle validée par l\'opérateur — Reprise de l\'automatisation');
    db.saveAutomationRun(this.currentRun);

    sse.broadcast('automation:status', this.getStatus());
    this.processStepLoop();

    return { success: true, message: 'Automatisation reprise avec succès' };
  }

  /**
   * Pause the automation
   */
  public pauseAutomation() {
    this.isPaused = true;
    if (this.currentRun) {
      this.currentRun.status = 'PAUSED';
      this.currentRun.lastAction = 'Automatisation mise en pause';
      db.saveAutomationRun(this.currentRun);
    }
    sse.broadcast('automation:status', this.getStatus());
  }

  /**
   * Safety pause when a real Telegram Call arrives (Requirement 24)
   */
  public pauseForTelegramCall(callInfo: { callerName: string; callId: string }) {
    if (this.currentRun && this.currentRun.status === 'RUNNING') {
      this.isPaused = true;
      this.currentRun.status = 'PAUSED';
      this.currentRun.lastAction = `TASK PAUSED — TELEGRAM CALL (${callInfo.callerName})`;
      this.currentRun.logs.push(`[${new Date().toLocaleTimeString()}] ⏸️ Tâche mise en pause de sécurité : Appel Telegram en cours de ${callInfo.callerName}`);
      db.saveAutomationRun(this.currentRun);
      sse.broadcast('automation:status', this.getStatus());
      logger.info(`Task #${this.currentRun.taskId} paused safely due to incoming Telegram call from ${callInfo.callerName}`, { module: 'AUTOMATION' });
    }
  }

  /**
   * Safety state update after Telegram Call ends (Requirement 24)
   */
  public resumeReadyAfterTelegramCall() {
    if (this.currentRun && this.currentRun.status === 'PAUSED' && this.currentRun.lastAction?.includes('TELEGRAM CALL')) {
      this.currentRun.lastAction = 'TASK READY TO RESUME';
      this.currentRun.logs.push(`[${new Date().toLocaleTimeString()}] ✅ Fin de l'appel Telegram — TASK READY TO RESUME (L'opérateur peut relancer l'automatisation)`);
      db.saveAutomationRun(this.currentRun);
      sse.broadcast('automation:status', this.getStatus());
      logger.info(`Telegram call ended. Task #${this.currentRun.taskId} is now in state TASK READY TO RESUME`, { module: 'AUTOMATION' });
    }
  }

  /**
   * Stop the automation
   */
  public stopAutomation() {
    this.isPaused = true;
    if (this.currentRun) {
      this.currentRun.status = 'STOPPED';
      this.currentRun.lastAction = 'Automatisation stoppée';
      db.saveAutomationRun(this.currentRun);
    }
    this.currentRun = null;
    sse.broadcast('automation:status', this.getStatus());
  }

  /**
   * Complete the task and auto-trigger next if configured
   */
  public async completeTask(taskId: string): Promise<Task | null> {
    const task = db.getTaskById(taskId);
    if (!task) return null;

    const completed = db.updateTask(taskId, {
      status: 'COMPLETED',
      completedAt: new Date().toISOString()
    });

    db.addTaskEvent(taskId, 'COMPLETED', `Tâche #${task.telegramTaskId} terminée avec succès.`);

    // Release phone reservation
    await phoneProvider.releaseNumber(taskId);

    if (this.currentRun && this.currentRun.taskId === taskId) {
      this.currentRun.status = 'COMPLETED';
      this.currentRun.completedAt = new Date().toISOString();
      this.currentRun.lastAction = 'Tâche terminée avec succès';
      db.saveAutomationRun(this.currentRun);
      this.currentRun = null;
    }

    sse.broadcast('task:completed', { task: completed });
    sse.broadcast('automation:status', this.getStatus());

    // Check Auto-Next Task
    const settings = db.getSettings();
    if (settings.autoSelectNext) {
      setTimeout(() => {
        this.triggerNextPendingTask();
      }, 1000);
    }

    return completed || null;
  }

  /**
   * Mark task as failed
   */
  public async failTask(taskId: string, reason?: string): Promise<Task | null> {
    const task = db.getTaskById(taskId);
    if (!task) return null;

    const failed = db.updateTask(taskId, {
      status: 'FAILED',
      failedAt: new Date().toISOString(),
      errorMessage: reason || 'Échec signalé'
    });

    db.addTaskEvent(taskId, 'FAILED', `Tâche échouée: ${reason || 'Raison non spécifiée'}`);
    await phoneProvider.releaseNumber(taskId);

    if (this.currentRun && this.currentRun.taskId === taskId) {
      this.currentRun.status = 'FAILED';
      this.currentRun.lastError = reason;
      db.saveAutomationRun(this.currentRun);
      this.currentRun = null;
    }

    sse.broadcast('task:failed', { task: failed, reason });
    sse.broadcast('automation:status', this.getStatus());
    return failed || null;
  }

  /**
   * Skip current task
   */
  public async skipTask(taskId: string): Promise<Task | null> {
    const skipped = db.updateTask(taskId, { status: 'SKIPPED' });
    db.addTaskEvent(taskId, 'SKIPPED', 'Tâche ignorée.');
    await phoneProvider.releaseNumber(taskId);

    if (this.currentRun && this.currentRun.taskId === taskId) {
      this.currentRun = null;
    }

    sse.broadcast('task:updated', { task: skipped });
    sse.broadcast('automation:status', this.getStatus());

    const settings = db.getSettings();
    if (settings.autoSelectNext) {
      this.triggerNextPendingTask();
    }
    return skipped || null;
  }

  /**
   * Retry task
   */
  public async retryTask(taskId: string): Promise<Task | null> {
    const task = db.getTaskById(taskId);
    if (!task) return null;

    const updated = db.updateTask(taskId, {
      status: 'PENDING',
      errorMessage: undefined,
      attemptCount: (task.attemptCount || 0) + 1
    });

    db.addTaskEvent(taskId, 'RETRIED', `Tâche #${task.telegramTaskId} réinitialisée pour une nouvelle tentative (Tentative ${updated?.attemptCount})`);
    sse.broadcast('task:updated', { task: updated });
    return updated || null;
  }

  /**
   * Auto Next trigger: find next PENDING task and start it
   */
  public async triggerNextPendingTask() {
    const pendingTasks = db.getTasks('PENDING');
    if (pendingTasks.length > 0) {
      const next = pendingTasks[0];
      logger.info(`Auto-Next: Automatically launching next pending task #${next.telegramTaskId}`, { module: 'AUTO_NEXT' });
      await this.startTask(next.id);
    }
  }
}

export const automationRunner = new AutomationRunnerService();
