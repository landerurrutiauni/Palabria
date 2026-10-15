/**
 * Avisos de cambio de una sala.
 *  - Por defecto (servidor Node.js): emisor en proceso que despierta las
 *    conexiones SSE de esa sala (que, además, comprueban la versión en la BD).
 *  - En la Edge Function de Supabase se sustituye por un aviso de Supabase
 *    Realtime (Broadcast) al canal `room-<código>`.
 * El aviso nunca contiene datos de la partida: solo indica que hay que releer.
 */
import { EventEmitter } from "node:events";

export interface RoomRef {
  id: string;
  code: string;
}

type Publisher = (room: RoomRef) => Promise<void> | void;

const globalForBus = globalThis as unknown as { __palabriaRoomBus?: EventEmitter; __palabriaPublisher?: Publisher };

function bus(): EventEmitter {
  if (!globalForBus.__palabriaRoomBus) {
    const emitter = new EventEmitter();
    emitter.setMaxListeners(0);
    globalForBus.__palabriaRoomBus = emitter;
  }
  return globalForBus.__palabriaRoomBus;
}

export function setRoomPublisher(publisher: Publisher | null): void {
  globalForBus.__palabriaPublisher = publisher ?? undefined;
}

export async function publishRoomUpdate(room: RoomRef): Promise<void> {
  bus().emit(`room:${room.id}`);
  const publisher = globalForBus.__palabriaPublisher;
  if (!publisher) return;
  try {
    await publisher(room);
  } catch (error) {
    // Un aviso perdido no rompe nada: los clientes también sondean el estado.
    console.error("[realtime]", error);
  }
}

export function subscribeRoom(roomId: string, listener: () => void): () => void {
  const event = `room:${roomId}`;
  bus().on(event, listener);
  return () => bus().off(event, listener);
}
