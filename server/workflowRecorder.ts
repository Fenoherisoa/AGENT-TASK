import { db } from './database.js';
import { logger } from './logger.js';
import { sse } from './sse.js';
import { Workflow, WorkflowStep, WorkflowStepType, RecorderState } from '../src/types/task.js';

class WorkflowRecorderService {
  private state: RecorderState = {
    isRecording: false,
    sourceChats: [],
    workflowName: '',
    recordedEvents: []
  };

  public getStatus(): RecorderState {
    return { ...this.state };
  }

  /**
   * Start recording a new workflow procedure
   */
  public startRecording(params: { name: string; sourceChats: string[] }): { success: boolean; state: RecorderState } {
    this.state = {
      isRecording: true,
      startedAt: new Date().toISOString(),
      sourceChats: params.sourceChats || [],
      workflowName: params.name || `Workflow ${new Date().toLocaleDateString()}`,
      recordedEvents: [
        {
          id: `step-rec-1`,
          type: 'OPEN',
          name: 'Ouvrir la source Telegram',
          target: params.sourceChats[0] || 'TASK_SOURCE',
          timestamp: new Date().toISOString()
        }
      ]
    };

    logger.info(`Started workflow recording session: "${this.state.workflowName}"`, { module: 'RECORDER' });
    sse.broadcast('recorder:status', this.state);
    return { success: true, state: this.state };
  }

  /**
   * Record an observed operator action
   */
  public recordAction(action: {
    type: WorkflowStepType;
    name: string;
    target?: string;
    parameters?: Record<string, any>;
    manualCheckpoint?: boolean;
    manualInstructions?: string;
  }): { success: boolean; event: any } {
    if (!this.state.isRecording) {
      return { success: false, event: null };
    }

    const event = {
      id: `step-rec-${this.state.recordedEvents.length + 1}`,
      type: action.type,
      name: action.name,
      target: action.target,
      parameters: action.parameters,
      manualCheckpoint: action.manualCheckpoint,
      manualInstructions: action.manualInstructions,
      timestamp: new Date().toISOString()
    };

    this.state.recordedEvents.push(event);
    logger.info(`Recorded step: [${action.type}] ${action.name}`, { module: 'RECORDER' });
    sse.broadcast('recorder:action', { event, totalRecorded: this.state.recordedEvents.length });

    return { success: true, event };
  }

  /**
   * Stop recording and generate a structured Workflow object
   */
  public stopAndBuildWorkflow(): { success: boolean; workflow?: Workflow; error?: string } {
    if (!this.state.isRecording) {
      return { success: false, error: 'Aucun enregistrement en cours' };
    }

    // Ensure completion step exists
    const hasComplete = this.state.recordedEvents.some(e => e.type === 'COMPLETE');
    if (!hasComplete) {
      this.state.recordedEvents.push({
        id: `step-rec-${this.state.recordedEvents.length + 1}`,
        type: 'COMPLETE',
        name: 'Validation & Fin de tâche',
        timestamp: new Date().toISOString()
      });
    }

    // Convert recorded events to workflow steps
    const steps: WorkflowStep[] = this.state.recordedEvents.map((evt, idx) => ({
      id: `step-${idx + 1}-${Math.random().toString(36).substring(2, 5)}`,
      type: evt.type,
      name: evt.name,
      target: evt.target,
      parameters: evt.parameters,
      timeoutSeconds: 30,
      retryCount: 2,
      enabled: true,
      manualCheckpoint: evt.type === 'MANUAL_CHECKPOINT' || (evt as any).manualCheckpoint === true,
      manualInstructions: (evt as any).manualInstructions || (evt.type === 'MANUAL_CHECKPOINT' ? 'Effectuez l\'action manuelle requise dans le navigateur ou le chat puis cliquez sur Continuer.' : undefined)
    }));

    const workflow = db.createWorkflow({
      name: this.state.workflowName || 'Workflow Enregistré',
      description: `Workflow généré automatiquement via le Workflow Recorder le ${new Date().toLocaleString()}`,
      enabled: true,
      sourceChats: this.state.sourceChats,
      steps,
      completionRules: {
        autoNext: true,
        timeoutSeconds: 120
      }
    });

    // Reset recorder state
    this.state = {
      isRecording: false,
      sourceChats: [],
      workflowName: '',
      recordedEvents: []
    };

    logger.info(`Successfully built and saved workflow: "${workflow.name}" (${workflow.steps.length} steps)`, { module: 'RECORDER' });
    sse.broadcast('recorder:status', this.state);
    sse.broadcast('workflow:created', { workflow });

    return { success: true, workflow };
  }

  public cancelRecording(): { success: boolean } {
    this.state = {
      isRecording: false,
      sourceChats: [],
      workflowName: '',
      recordedEvents: []
    };
    sse.broadcast('recorder:status', this.state);
    return { success: true };
  }
}

export const workflowRecorder = new WorkflowRecorderService();
