// Component to render 3D PNG category icons exclusively to maintain visual coherence.

import React from "react";
import { getCategoryIconPath, AVAILABLE_ICONS } from "@/lib/categoryIcons";

interface CategoryIconProps {
  categoryName?: string;
  userIconsMap?: Record<string, string>;
  iconKey?: string; // Optional direct override key
  className?: string;
  size?: number; // Prevent TS errors from components passing size
}

export default function CategoryIcon({
  categoryName,
  userIconsMap,
  iconKey,
  className = "w-7 h-7",
  size
}: CategoryIconProps) {
  let resolvedPath = "/categories/cat_otro.png";

  if (iconKey) {
    const found = AVAILABLE_ICONS.find(icon => icon.key === iconKey);
    if (found) resolvedPath = found.path;
  } else if (categoryName) {
    resolvedPath = getCategoryIconPath(categoryName, userIconsMap);
  }

  return (
    <img 
      src={resolvedPath} 
      alt={categoryName || "Icono"} 
      className={`object-contain rounded-lg flex-shrink-0 ${className}`} 
      onError={(e) => {
        (e.target as HTMLImageElement).src = "/categories/cat_otro.png";
      }}
    />
  );
}
