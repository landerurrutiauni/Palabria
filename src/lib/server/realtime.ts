/**
 * Notificaciones en proceso para las conexiones SSE de una sala.
 * Es solo un «aviso rápido»: cada conexión SSE comprueba además la versión de
 * la sala en la base de datos, de modo que la sincronización funciona aunque
 * haya varias instancias del servidor.
 */
import { EventEmitter } from "node:events";

const globalForBus = globalThis as unknown as { __palabriaRoomBus?: EventEmitter };

function bus(): EventEmitter {
  if (!globalForBus.__palabriaRoomBus) {
    const emitter = new EventEmitter();
    emitter.setMaxListeners(0);
    globalForBus.__palabriaRoomBus = emitter;
  }
  return globalForBus.__palabriaRoomBus;
}

export function publishRoomUpdate(roomId: string): void {
  bus().emit(`room:${roomId}`);
}

export function subscribeRoom(roomId: string, listener: () => void): () => void {
  const event = `room:${roomId}`;
  bus().on(event, listener);
  return () => bus().off(event, listener);
}
