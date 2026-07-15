// Component to render either a 3D PNG category icon or a high-quality SVG/Lucide badge.

import React from "react";
import { 
  Home, Film, Utensils, ShoppingBag, Phone, Dumbbell, Heart, Calculator, 
  Gamepad2, PawPrint, Zap, Bus, Car, Banknote, TrendingUp, Gift, HelpCircle,
  Wrench, HeartHandshake, User, Candy, GraduationCap, Plane, GlassWater, Store, Coins
} from "lucide-react";
import { getCategoryIconPath, AVAILABLE_ICONS } from "@/lib/categoryIcons";

// Maps keys to Lucide Components
const LUCIDE_ICONS: Record<string, React.ComponentType<any>> = {
  casa: Home,
  cine: Film,
  comida: Utensils,
  compras: ShoppingBag,
  comunicaciones: Phone,
  deportes: Dumbbell,
  salud: Heart,
  impuestos: Calculator,
  juegos: Gamepad2,
  mascotas: PawPrint,
  servicios: Zap,
  transporte: Bus,
  taxi: Car,
  salario: Banknote,
  inversiones: TrendingUp,
  regalos: Gift,
  otro: HelpCircle,
  herramientas: Wrench,
  diezmos: HeartHandshake,
  user: User,
  golosinas: Candy,
  educacion: GraduationCap,
  viajes: Plane,
  bebidas: GlassWater,
  negocio: Store,
  prestado: Coins
};

interface CategoryIconProps {
  categoryName?: string;
  userIconsMap?: Record<string, string>;
  iconKey?: string; // Optional direct override key
  className?: string;
  size?: number; // Size in pixels
}

export default function CategoryIcon({
  categoryName,
  userIconsMap,
  iconKey,
  className = "w-7 h-7",
  size = 18
}: CategoryIconProps) {
  // 1. Resolve which icon key applies
  let resolvedKey = "otro";
  
  if (iconKey) {
    resolvedKey = iconKey;
  } else if (categoryName) {
    // Check custom user map
    if (userIconsMap && userIconsMap[categoryName]) {
      resolvedKey = userIconsMap[categoryName];
    } else {
      // Check default keyword mappings
      const path = getCategoryIconPath(categoryName, userIconsMap);
      // Extract key from path (e.g. /categories/cat_casa.png -> casa)
      const match = path.match(/cat_([a-z_]+)\.png/);
      if (match && match[1]) {
        resolvedKey = match[1];
      }
    }
  } else {
    // No name and no key
    return (
      <div className={`rounded-xl flex items-center justify-center bg-gray-100 dark:bg-gray-700 text-foreground/50 ${className}`}>
        <HelpCircle size={size} />
      </div>
    );
  }

  // 2. Find icon definition
  const iconDef = AVAILABLE_ICONS.find(icon => icon.key === resolvedKey) || 
                  AVAILABLE_ICONS.find(icon => icon.key === "otro")!;

  // 3. Render appropriate style
  if (iconDef.isSvg) {
    const IconComponent = LUCIDE_ICONS[iconDef.lucideKey || "otro"] || HelpCircle;
    const gradientClass = iconDef.gradient || "from-gray-400 to-gray-500";
    
    return (
      <div 
        className={`rounded-xl flex items-center justify-center text-white bg-gradient-to-br shadow-sm border border-white/10 flex-shrink-0 ${gradientClass} ${className}`}
      >
        <IconComponent size={size} className="drop-shadow-sm" />
      </div>
    );
  }

  // 4. Render 3D PNG Icon
  return (
    <img 
      src={iconDef.path} 
      alt={categoryName} 
      className={`object-contain rounded-lg flex-shrink-0 ${className}`} 
      onError={(e) => {
        (e.target as HTMLImageElement).src = "/categories/cat_otro.png";
      }}
    />
  );
}
