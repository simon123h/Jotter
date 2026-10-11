/**
 * Cross-tab communication channel using BroadcastChannel API.
 * Broadcasts data changes across multiple open tabs in the same browser session.
 */

export type BroadcastEvent =
  | { type: 'tasks-changed'; projectId?: string }
  | { type: 'buckets-changed'; projectId?: string }
  | { type: 'projects-changed' }
  | { type: 'timeblocks-changed' }
  | { type: 'canvas-changed'; projectId?: string; canvasId?: string };

interface InternalBroadcastEnvelope {
  senderId: string;
  payload: BroadcastEvent;
}

class CrossTabBus {
  private channel: BroadcastChannel | null = null;
  private listeners: Set<(event: BroadcastEvent) => void> = new Set();
  private tabId: string = Math.random().toString(36).substring(2) + Date.now().toString(36);

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.channel = new BroadcastChannel('jotter-cross-tab-sync');
        this.channel.onmessage = (msg: MessageEvent<InternalBroadcastEnvelope | BroadcastEvent>) => {
          if (msg && msg.data) {
            // Filter out self-echo if senderId matches this tab
            if ('senderId' in msg.data) {
              if (msg.data.senderId === this.tabId) return;
              const payload = msg.data.payload;
              this.notifyListeners(payload);
            } else {
              this.notifyListeners(msg.data as BroadcastEvent);
            }
          }
        };
      } catch (err) {
        console.warn('BroadcastChannel initialization failed, cross-tab sync disabled:', err);
      }
    }
  }

  private notifyListeners(event: BroadcastEvent): void {
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (err) {
        console.error('Error in cross-tab sync listener:', err);
      }
    });
  }

  public broadcast(event: BroadcastEvent): void {
    if (!this.channel) return;
    try {
      const envelope: InternalBroadcastEnvelope = {
        senderId: this.tabId,
        payload: event,
      };
      this.channel.postMessage(envelope);
    } catch (err) {
      console.warn('Failed to broadcast cross-tab event:', err);
    }
  }

  public subscribe(callback: (event: BroadcastEvent) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }
}

export const crossTabBus = new CrossTabBus();
