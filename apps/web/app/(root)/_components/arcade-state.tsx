import { Button } from "@/components/ui/8bit/button";
import { Skeleton } from "@/components/ui/8bit/skeleton";

export function ArcadeState({
  title,
  hint,
  onRetry,
}: {
  title: string;
  hint?: string;
  onRetry?: VoidFunction;
}) {
  return (
    <div className="arcade-screen flex items-center justify-center px-6 text-center">
      <div className="flex max-w-sm flex-col items-center gap-4">
        <h1 className="arcade-h1">{title}</h1>
        {hint ? <p className="arcade-caption">{hint}</p> : null}
        {onRetry ? (
          <Button variant="outline" className="arcade-label" onClick={onRetry}>
            повторить
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function ArcadeLoading() {
  return (
    <div className="arcade-screen flex flex-col gap-4 px-4 py-8">
      <Skeleton className="h-5 w-36" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
    </div>
  );
}
