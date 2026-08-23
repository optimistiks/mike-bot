import { Badge } from "@/components/ui/8bit/badge";

/**
 * Line 1 carries only short, fixed-width things, so the rank is padded to two
 * digits: crossing from 9 to 10 never reflows the line.
 *
 * The filled chip follows the Crown rather than rank 1, because Crown is
 * tie-inclusive: singling out whoever happens to sort first would contradict the
 * very rule the flair exists to show.
 */
export function RankChip({
  rank,
  isCrown,
}: {
  rank: number;
  isCrown: boolean;
}) {
  return (
    <Badge variant={isCrown ? "default" : "outline"} className="border-primary">
      <span className="arcade-label">{String(rank).padStart(2, "0")}</span>
    </Badge>
  );
}
