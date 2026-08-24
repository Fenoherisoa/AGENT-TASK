import { Response } from 'express';
import { logger, sanitizePayload } from './logger.js';

interface SSEClient {
  id: string;
  res: Response;
}

class SSEManager {
  private clients: SSEClient[] = [];

  public addClient(res: Response): string {
    const id = `sse-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    
    // Set proper SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const client: SSEClient = { id, res };
    this.clients.push(client);

    // Initial heartbeat
    res.write(`event: connected\ndata: ${JSON.stringify({ clientId: id, timestamp: new Date().toISOString() })}\n\n`);

    res.on('close', () => {
      this.clients = this.clients.filter(c => c.id !== id);
    });

    return id;
  }

  public broadcast(event: string, data: any) {
    const sanitized = sanitizePayload(data);
    const payload = `event: ${event}\ndata: ${JSON.stringify(sanitized)}\n\n`;

    this.clients.forEach(client => {
      try {
        client.res.write(payload);
      } catch (err) {
        logger.debug(`Error writing SSE to client ${client.id}`);
      }
    });
  }

  public getConnectedCount(): number {
    return this.clients.length;
  }
}

export const sse = new SSEManager();
