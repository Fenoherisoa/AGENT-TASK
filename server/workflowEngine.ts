import { db } from './database.js';
import { logger } from './logger.js';
import { sse } from './sse.js';
import { phoneProvider } from './phoneProvider.js';
import { browserManager } from './browserManager.js';
import { Task, Workflow, WorkflowStep, AutomationRun } from '../src/types/task.js';

export interface ExecutionContext {
  task: Task;
  workflow: Workflow;
  stepIndex: number;
  variables: Record<string, any>;
  logs: string[];
}

export class WorkflowEngine {
  /**
   * Execute a single step within isolated execution context
   */
  public async executeStep(
    context: ExecutionContext
  ): Promise<{ success: boolean; requiresManualAction?: boolean; manualInstructions?: string; error?: string }> {
    const { task, workflow, stepIndex } = context;
    const step = workflow.steps[stepIndex];

    if (!step || !step.enabled) {
      return { success: true };
    }

    logger.info(`Executing step ${stepIndex + 1}/${workflow.steps.length}: [${step.type}] ${step.name}`, {
      module: 'WORKFLOW_ENGINE',
      taskId: task.id,
      workflowId: workflow.id
    });

    db.addTaskEvent(
      task.id,
      'STEP_STARTED',
      `Étape ${stepIndex + 1}/${workflow.steps.length}: ${step.name}`,
      { stepType: step.type, stepIndex },
      workflow.id
    );

    // 1. Check for manual checkpoint requirement
    if (step.type === 'MANUAL_CHECKPOINT' || step.manualCheckpoint) {
      return {
        success: true,
        requiresManualAction: true,
        manualInstructions:
          step.manualInstructions ||
          'Action manuelle requise de l\'opérateur. Complétez l\'étape dans le navigateur/chat puis cliquez sur Continuer.'
      };
    }

    // 2. Automated Step Execution
    try {
      switch (step.type) {
        case 'OPEN': {
          // Resolve URL from step target, workflow-level targetUrl, or browser default
          const targetUrl = step.target || workflow.targetUrl;
          await browserManager.openTarget(targetUrl);
          break;
        }

        case 'NAVIGATE': {
          const targetUrl = step.target || workflow.targetUrl;
          await browserManager.executeAction({
            type: 'NAVIGATE',
            target: targetUrl
          });
          break;
        }

        case 'SWITCH_CHAT':
          // Log chat switch and update target if needed
          break;

        case 'TYPE':
          // Fill non-sensitive form fields or values
          await browserManager.executeAction({
            type: 'TYPE',
            target: step.target,
            value: step.parameters?.value
          });
          break;

        case 'CLICK':
          await browserManager.executeAction({
            type: 'CLICK',
            target: step.target
          });
          break;

        case 'WAIT':
        case 'WAIT_FOR_ELEMENT': {
          const waitMs = (step.timeoutSeconds || 2) * 1000;
          await new Promise(r => setTimeout(r, Math.min(waitMs, 4000)));
          break;
        }

        case 'VALIDATE':
          // Validation checkpoint
          break;

        case 'COMPLETE':
          // Completion step
          break;

        default:
          break;
      }

      db.addTaskEvent(
        task.id,
        'STEP_COMPLETED',
        `Étape ${stepIndex + 1}/${workflow.steps.length} terminée avec succès: ${step.name}`,
        { stepIndex },
        workflow.id
      );

      return { success: true };
    } catch (err: any) {
      logger.error(`Step execution failed: ${err.message}`, err, {
        module: 'WORKFLOW_ENGINE',
        taskId: task.id,
        workflowId: workflow.id
      });
      return { success: false, error: err.message };
    }
  }
}

export const workflowEngine = new WorkflowEngine();
