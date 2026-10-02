import { reconnectDelayMs } from "@heybit/shared/trade";

export type ListenerMode = "IDLE" | "ACTIVE" | "PAUSED_BACKPRESSURE" | "RECONNECTING";

/**
 * Websocket logs mentioning the mint are only a trigger.
 * The worker fetches the confirmed transaction before classifying it.
 * Commitment is confirmed. Failed transactions are ignored by the parser.
 */
export class MintLogListener {
  private socket: WebSocket | null = null;
  private mint: string | null = null;
  private stopped = true;
  private intakePaused = false;
  private attempt = 0;
  private disconnects = 0;
  private reconnects = 0;
  private socketGeneration = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly wssUrl: string,
    private readonly onSignature: (signature: string) => void,
    private readonly onMode: (mode: ListenerMode) => void,
  ) {}

  start(mint: string): void {
    if (this.mint === mint && !this.stopped) {
      return;
    }
    this.stopSocket();
    this.stopped = false;
    this.intakePaused = false;
    this.mint = mint;
    this.attempt = 0;
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    this.intakePaused = false;
    this.mint = null;
    this.stopSocket();
    this.onMode("IDLE");
  }

  pauseIntake(): void {
    if (this.stopped || this.intakePaused || !this.mint) {
      return;
    }
    this.intakePaused = true;
    this.stopSocket();
    this.onMode("PAUSED_BACKPRESSURE");
  }

  resumeIntake(): void {
    if (!this.intakePaused || this.stopped || !this.mint) {
      return;
    }
    this.intakePaused = false;
    this.attempt = 0;
    this.scheduleReconnect();
  }

  snapshot(): { ws_disconnect: number; ws_reconnect: number } {
    return { ws_disconnect: this.disconnects, ws_reconnect: this.reconnects };
  }

  private connect(): void {
    if (this.stopped || this.intakePaused || !this.mint) {
      return;
    }
    const mint = this.mint;
    const generation = ++this.socketGeneration;
    let socket: WebSocket;
    try {
      socket = new WebSocket(this.wssUrl);
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.socket = socket;
    socket.addEventListener("open", () => {
      this.attempt = 0;
      socket.send(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "logsSubscribe",
          params: [{ mentions: [mint] }, { commitment: "confirmed" }],
        }),
      );
      this.onMode("ACTIVE");
    });
    socket.addEventListener("message", (event) => {
      const signature = signatureFromLogsMessage(String(event.data));
      if (signature) {
        this.onSignature(signature);
      }
    });
    socket.addEventListener("close", () => {
      if (generation !== this.socketGeneration || this.stopped || this.intakePaused) {
        return;
      }
      this.disconnects += 1;
      this.onMode("RECONNECTING");
      this.scheduleReconnect();
    });
    socket.addEventListener("error", () => {
      // close follows. Do not log the socket or the endpoint.
    });
  }

  private scheduleReconnect(): void {
    if (this.stopped || this.intakePaused) {
      return;
    }
    this.attempt += 1;
    this.reconnects += 1;
    this.timer = setTimeout(() => this.connect(), reconnectDelayMs(this.attempt));
  }

  private stopSocket(): void {
    this.socketGeneration += 1;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    try {
      this.socket?.close();
    } catch {
      // Already closed.
    }
    this.socket = null;
  }
}

export function signatureFromLogsMessage(raw: string): string | null {
  try {
    const message = JSON.parse(raw) as {
      method?: string;
      params?: { result?: { value?: { signature?: unknown } } };
    };
    if (message.method !== "logsNotification") {
      return null;
    }
    const signature = message.params?.result?.value?.signature;
    return typeof signature === "string" && signature.trim() !== "" ? signature : null;
  } catch {
    return null;
  }
}
