/**
 * Crown and Chicken are tie-inclusive and conditional respectively — production
 * decides both. This only draws what the entry already says it is.
 */
export function EntryFlair({
  isCrown,
  isChicken,
}: {
  isCrown: boolean;
  isChicken: boolean;
}) {
  if (!isCrown && !isChicken) return null;

  return (
    <span className="arcade-flair" title={isCrown ? "Корона" : "Курица"}>
      {isCrown ? "👑" : "🐔"}
    </span>
  );
}
