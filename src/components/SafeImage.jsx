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

export function SafeImage({
  src,
  fallbackSrc = BROKEN_IMAGE_PLACEHOLDER,
  onError,
  ...props
}) {
  const [currentSrc, setCurrentSrc] = useState(src || fallbackSrc);

  useEffect(() => {
    setCurrentSrc(src || fallbackSrc);
  }, [src, fallbackSrc]);

  return (
    <img
      {...props}
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
