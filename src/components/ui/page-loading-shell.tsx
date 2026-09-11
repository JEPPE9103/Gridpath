export function PageLoadingShell({
  title,
  variant = "default",
}: {
  title: string;
  variant?: "default" | "map";
}) {
  return (
    <div aria-busy="true" aria-label={`Loading ${title}`}>
      <header className="flex flex-col gap-3 border-b border-line bg-canvas px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6 sm:px-6 sm:py-5 lg:px-8">
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold leading-7 tracking-tight text-ink sm:text-[28px] sm:leading-8">
            {title}
          </h1>
          <div className="mt-2 h-4 w-48 animate-pulse rounded-md bg-line" />
        </div>
      </header>
      {variant === "map" ? (
        <div className="px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
          <div className="h-[min(70vh,36rem)] animate-pulse rounded-md bg-line" />
        </div>
      ) : (
        <div className="px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-4">
            <div className="h-[4.5rem] animate-pulse bg-surface" />
            <div className="h-[4.5rem] animate-pulse bg-surface" />
            <div className="h-[4.5rem] animate-pulse bg-surface" />
            <div className="h-[4.5rem] animate-pulse bg-surface" />
          </div>
          <div className="mt-6 h-10 w-64 animate-pulse rounded-md bg-line" />
          <div className="mt-3 h-40 animate-pulse rounded-md border border-line bg-surface" />
        </div>
      )}
    </div>
  );
}
