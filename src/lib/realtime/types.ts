/** Events pushed to a connected client. Keep the payloads minimal — the client
 *  re-fetches authoritative data; these are nudges, not a sync protocol. */
export type RealtimeEvent =
  | {
      type: "message";
      conversationId: string;
      messageId: string;
      /** Sender, so the receiver can ignore its own echo. */
      senderId: string;
      body: string;
      createdAt: string;
    }
  | { type: "read"; conversationId: string; readerId: string; at: string }
  | { type: "match"; matchId: string; conversationId: string; withUserId: string }
  | { type: "notification"; notificationType: string }
  | { type: "ping" };

export interface RealtimeProvider {
  readonly name: string;
  /** Deliver an event to one user's open connections. Best-effort, never throws. */
  publish(userId: string, event: RealtimeEvent): Promise<void>;
  /**
   * Subscribe a connection. Returns an unsubscribe function.
   * Only used by the transport route, never by feature code.
   */
  subscribe(userId: string, onEvent: (event: RealtimeEvent) => void): () => void;
  /** How many live connections this process has for a user (diagnostics). */
  connectionCount(userId: string): number;
}
