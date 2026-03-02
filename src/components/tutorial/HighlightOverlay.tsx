interface HighlightOverlayProps {
  rect: DOMRect | null;
}

export function HighlightOverlay({ rect }: HighlightOverlayProps) {
  if (!rect) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed z-[90] rounded-lg border-2 border-primary shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] transition-all duration-300"
      style={{
        top: rect.top - 6,
        left: rect.left - 6,
        width: rect.width + 12,
        height: rect.height + 12,
      }}
    />
  );
}
