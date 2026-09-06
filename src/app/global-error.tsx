"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(
      JSON.stringify({
        event: "client.global_error",
        message: error.message,
        digest: error.digest ?? null,
      }),
    );
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main style={{ fontFamily: "system-ui", padding: "2rem", maxWidth: 480 }}>
          <h1>Something went wrong</h1>
          <p>An unexpected error occurred. Try again, or return to the home page.</p>
          <button type="button" onClick={reset}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
