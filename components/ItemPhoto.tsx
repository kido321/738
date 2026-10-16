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
  small = false,
}: {
  url: string | null;
  category: string;
  name: string;
  className?: string;
  small?: boolean;
}) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={name} loading="lazy" decoding="async" className={`bg-surface-2 object-cover ${className}`} />;
  }
  return (
    <div
      className={`grid place-items-center bg-gradient-to-b from-surface-3 to-surface-2 ${className}`}
      aria-hidden
    >
      <span className={small ? "text-2xl" : "text-3xl"}>{FALLBACK[category] ?? "⭐"}</span>
    </div>
  );
}
