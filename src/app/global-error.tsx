"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          background: "#fbf6f1",
          color: "#221c26",
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          margin: 0,
        }}
      >
        <div style={{ maxWidth: 360, textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 20, marginBottom: 8 }}>Something went badly wrong</h1>
          <p style={{ fontSize: 14, color: "#4b4350", marginBottom: 16 }}>
            The app hit an error it couldn&apos;t recover from. Reloading usually fixes it.
          </p>
          <button
            onClick={reset}
            style={{
              padding: "10px 20px",
              borderRadius: 12,
              border: "none",
              background: "#d0566a",
              color: "#fff",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
