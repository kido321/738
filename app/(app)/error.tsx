"use client";

export default function AppError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="card mt-6 text-center">
      <p className="mb-1 font-semibold">Something went wrong</p>
      <p className="mb-4 text-sm text-muted">{error.message || "Please try again."}</p>
      <button className="btn-gold" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
