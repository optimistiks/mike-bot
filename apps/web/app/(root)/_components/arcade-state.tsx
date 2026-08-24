import { Button } from "@/components/ui/8bit/button";
import { Spinner } from "@/components/ui/8bit/spinner";

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
    <div className="arcade-screen items-center justify-center">
      <Spinner className="size-10" />
    </div>
  );
}
