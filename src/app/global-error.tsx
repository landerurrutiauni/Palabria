"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="es">
      <body
        style={{
          background: "#070b26",
          color: "#e8ecff",
          fontFamily: "system-ui, sans-serif",
          display: "grid",
          placeItems: "center",
          minHeight: "100vh",
          margin: 0,
        }}
      >
        <div style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 28 }}>Palabria no está disponible ahora mismo</h1>
          <p>Ha ocurrido un error inesperado. Tus partidas están guardadas en el servidor.</p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 16,
              padding: "12px 20px",
              borderRadius: 999,
              border: 0,
              background: "#33e6d7",
              fontWeight: 700,
            }}
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}
