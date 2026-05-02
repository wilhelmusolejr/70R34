import { useEffect, useState } from "react";

export const BROKEN_IMAGE_PLACEHOLDER = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
    <rect width="96" height="96" rx="18" fill="#f2f4f7"/>
    <path d="M24 28h48a4 4 0 0 1 4 4v32a4 4 0 0 1-4 4H24a4 4 0 0 1-4-4V32a4 4 0 0 1 4-4Z" fill="none" stroke="#98a2b3" stroke-width="6"/>
    <circle cx="38" cy="42" r="6" fill="#98a2b3"/>
    <path d="M28 62l13-13 10 10 9-9 8 12" fill="none" stroke="#98a2b3" stroke-linecap="round" stroke-linejoin="round" stroke-width="6"/>
    <path d="M30 30l36 36" stroke="#d92d20" stroke-linecap="round" stroke-width="6"/>
  </svg>`,
)}`;

const PASTEL_GRADIENTS = [
  ["#FFD6E0", "#F4A8C2"],
  ["#FFE5B4", "#F8B878"],
  ["#FFF4B8", "#F6CE57"],
  ["#D9F5C5", "#9ED99B"],
  ["#C7EBF0", "#8AC9D2"],
  ["#D8DCFF", "#A9B2F4"],
  ["#F1D6FF", "#C99DEC"],
  ["#FFD8C4", "#F49E7E"],
];

function pastelGradientFor(seed) {
  const str = String(seed || "");
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return PASTEL_GRADIENTS[hash % PASTEL_GRADIENTS.length];
}

function isMissingSrc(src) {
  return src === undefined || src === null || String(src).trim() === "";
}

export function SafeImage({
  src,
  fallbackSrc = BROKEN_IMAGE_PLACEHOLDER,
  initials,
  initialsSeed,
  alt,
  onError,
  className,
  style,
  ...props
}) {
  const missing = isMissingSrc(src);
  const [currentSrc, setCurrentSrc] = useState(missing ? fallbackSrc : src);

  useEffect(() => {
    setCurrentSrc(missing ? fallbackSrc : src);
  }, [src, fallbackSrc, missing]);

  if (missing && initials) {
    const [from, to] = pastelGradientFor(initialsSeed || initials);
    return (
      <div
        {...props}
        role="img"
        aria-label={alt}
        className={className}
        style={{
          background: `linear-gradient(135deg, ${from}, ${to})`,
          color: "#3a3a3a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 600,
          textTransform: "uppercase",
          ...style,
        }}
      >
        {String(initials).slice(0, 2)}
      </div>
    );
  }

  return (
    <img
      {...props}
      alt={alt}
      className={className}
      style={style}
      src={currentSrc || fallbackSrc}
      onError={(event) => {
        onError?.(event);
        if (currentSrc !== fallbackSrc) {
          setCurrentSrc(fallbackSrc);
        }
      }}
    />
  );
}
