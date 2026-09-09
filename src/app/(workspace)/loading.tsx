export default function Loading() {
  return (
    <div className="px-4 py-5 sm:px-6 lg:px-8 lg:py-7" aria-busy="true" aria-label="Loading workspace">
      <div className="h-8 w-40 animate-pulse rounded-md bg-line" />
      <div className="mt-2 h-4 w-64 animate-pulse rounded-md bg-line" />
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="h-20 animate-pulse rounded-md bg-line" />
        <div className="h-20 animate-pulse rounded-md bg-line" />
        <div className="h-20 animate-pulse rounded-md bg-line" />
        <div className="h-20 animate-pulse rounded-md bg-line" />
      </div>
      <div className="mt-8 h-48 animate-pulse rounded-md bg-line" />
    </div>
  );
}
