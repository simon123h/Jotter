/**
 * Cross-tab communication channel using BroadcastChannel API.
 * Broadcasts data changes across multiple open tabs in the same browser session.
 */

export type BroadcastEvent =
  | { type: 'tasks-changed'; projectId?: string }
  | { type: 'buckets-changed'; projectId?: string }
  | { type: 'projects-changed' }
  | { type: 'timeblocks-changed' };

class CrossTabBus {
  private channel: BroadcastChannel | null = null;
  private listeners: Set<(event: BroadcastEvent) => void> = new Set();

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.channel = new BroadcastChannel('jotter-cross-tab-sync');
        this.channel.onmessage = (msg: MessageEvent<BroadcastEvent>) => {
          if (msg && msg.data) {
            this.listeners.forEach((listener) => {
              try {
                listener(msg.data);
              } catch (err) {
                console.error('Error in cross-tab sync listener:', err);
              }
            });
          }
        };
      } catch (err) {
        console.warn('BroadcastChannel initialization failed, cross-tab sync disabled:', err);
      }
    }
  }

  public broadcast(event: BroadcastEvent): void {
    if (!this.channel) return;
    try {
      this.channel.postMessage(event);
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
