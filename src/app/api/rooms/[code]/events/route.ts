import { serverNow } from "@/lib/server/clock";
import { getDb } from "@/lib/server/db";
import { errorResponse } from "@/lib/server/http";
import { requirePlayer } from "@/lib/server/identity";
import { subscribeRoom } from "@/lib/server/realtime";
import { getRoomView, roomPulse } from "@/lib/server/room-service";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Duración máxima de cada conexión; el navegador se reconecta solo (EventSource). */
const STREAM_LIFETIME_MS = 120_000;
const POLL_MS = 1_000;
const REFRESH_MS = 3_000;

/**
 * Sincronización en tiempo real de la sala mediante Server-Sent Events.
 * Cada participante recibe su propia vista (sin preguntas ni respuestas ajenas).
 * La conexión hace además de latido de presencia y aplica las transiciones
 * por tiempo (fin de reloj, abandono) en cuanto vencen.
 */
export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  let player;
  let initial;
  const { code } = await params;
  try {
    player = await requirePlayer();
    initial = await getRoomView(player, code);
  } catch (error) {
    return errorResponse(error);
  }
  const db = await getDb();
  const encoder = new TextEncoder();
  const roomId = initial.roomId;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      let wake: () => void = () => undefined;
      const unsubscribe = subscribeRoom(roomId, () => wake());
      const close = () => {
        closed = true;
        wake();
      };
      request.signal.addEventListener("abort", close);
      const write = (chunk: string) => {
        if (!closed) controller.enqueue(encoder.encode(chunk));
      };
      const sendState = (view: unknown) => write(`event: state\ndata: ${JSON.stringify(view)}\n\n`);

      write("retry: 1500\n\n");
      sendState(initial.view);
      let lastVersion = initial.version;
      let lastRefresh = Date.now();
      const openedAt = Date.now();
      try {
        while (!closed && Date.now() - openedAt < STREAM_LIFETIME_MS) {
          await new Promise<void>((resolve) => {
            const timer = setTimeout(resolve, POLL_MS);
            wake = () => {
              clearTimeout(timer);
              resolve();
            };
          });
          if (closed) break;
          const pulse = await roomPulse(db, roomId);
          if (!pulse) break;
          const now = await serverNow(db);
          const due = pulse.expiresAt !== null && now >= pulse.expiresAt;
          if (pulse.version !== lastVersion || due || Date.now() - lastRefresh >= REFRESH_MS) {
            const snapshot = await getRoomView(player, code, db);
            lastRefresh = Date.now();
            if (snapshot.version !== lastVersion) {
              lastVersion = snapshot.version;
              sendState(snapshot.view);
            } else {
              write(`: latido ${now}\n\n`);
            }
          }
          if (pulse.status === "completed" || pulse.status === "abandoned" || pulse.status === "expired") {
            if (pulse.version === lastVersion) break;
          }
        }
      } catch (error) {
        write(`event: problem\ndata: ${JSON.stringify({ message: (error as Error).message })}\n\n`);
      } finally {
        unsubscribe();
        request.signal.removeEventListener("abort", close);
        closed = true;
        try {
          controller.close();
        } catch {
          /* ya cerrado */
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
