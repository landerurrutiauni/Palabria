"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { IS_STATIC } from "@/lib/client/runtime";
import { useServerOffset } from "@/lib/client/time";

function parts(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0"));
}

/** Cuenta atrás hasta el próximo desafío (medianoche en Madrid, calculada en el servidor). */
export function Countdown({ target, serverNow, className }: { target: number; serverNow: number; className?: string }) {
  const offset = useServerOffset(serverNow);
  const router = useRouter();
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now() + offset), 1000);
    return () => window.clearInterval(id);
  }, [offset]);
  const left = target - now;
  useEffect(() => {
    if (left <= 0) {
      // Nuevo día en Madrid: se recarga para obtener el desafío nuevo del servidor.
      const id = window.setTimeout(() => (IS_STATIC ? window.location.reload() : router.refresh()), 1500);
      return () => window.clearTimeout(id);
    }
  }, [left, router]);
  const [h, m, s] = parts(left);
  return (
    <span
      className={className}
      role="timer"
      aria-label={`Faltan ${h} horas, ${m} minutos y ${s} segundos para el próximo desafío`}
    >
      <span aria-hidden="true" className="score-digits">
        {h}:{m}:{s}
      </span>
    </span>
  );
}
