"use client";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
      <h2 className="text-lg font-semibold text-red-700">Something went wrong!</h2>
      <p className="mt-2 text-sm text-red-600">{error.message || "Failed to load dashboard data."}</p>
      <button
        onClick={() => reset()}
        className="mt-4 px-4 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition"
      >
        Try Again
      </button>
    </div>
  );
}