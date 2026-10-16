const FALLBACK: Record<string, string> = {
  bottle: "🍾",
  drink: "🥤",
  hookah: "💨",
  other: "⭐",
};

// Shows the item's photo, or a simple icon when there is no photo yet.
export function ItemPhoto({
  url,
  category,
  name,
  className = "",
}: {
  url: string | null;
  category: string;
  name: string;
  className?: string;
}) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={name} loading="lazy" className={`object-cover ${className}`} />;
  }
  return (
    <div className={`grid place-items-center bg-surface-2 ${className}`} aria-hidden>
      <span className="text-3xl">{FALLBACK[category] ?? "⭐"}</span>
    </div>
  );
}
