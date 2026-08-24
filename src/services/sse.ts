type EventCallback = (data: any) => void;

class SSEClient {
  private eventSource: EventSource | null = null;
  private listeners: Map<string, Set<EventCallback>> = new Map();
  private isConnecting = false;

  public connect() {
    if (this.eventSource || this.isConnecting) return;
    this.isConnecting = true;

    try {
      this.eventSource = new EventSource('/api/events/stream');

      this.eventSource.onopen = () => {
        this.isConnecting = false;
      };

      this.eventSource.onerror = () => {
        this.isConnecting = false;
        this.disconnect();
        // Reconnect after 4s
        setTimeout(() => this.connect(), 4000);
      };

      // Register standard event listeners
      const knownEvents = [
        'connected',
        'task:detected',
        'task:started',
        'task:updated',
        'task:completed',
        'task:failed',
        'automation:status',
        'automation:step',
        'automation:manual_checkpoint',
        'telegram:status',
        'telegram:chats',
        'recorder:status',
        'recorder:action',
        'workflow:created'
      ];

      knownEvents.forEach(evt => {
        this.eventSource?.addEventListener(evt, (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data);
            this.notify(evt, data);
          } catch {
            this.notify(evt, e.data);
          }
        });
      });
    } catch {
      this.isConnecting = false;
    }
  }

  public on(event: string, cb: EventCallback): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(cb);

    if (!this.eventSource) {
      this.connect();
    }

    return () => {
      this.listeners.get(event)?.delete(cb);
    };
  }

  private notify(event: string, data: any) {
    const cbs = this.listeners.get(event);
    if (cbs) {
      cbs.forEach(cb => cb(data));
    }
  }

  public disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }
}

export const sseClient = new SSEClient();
