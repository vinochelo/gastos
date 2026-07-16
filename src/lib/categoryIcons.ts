// Utility to map category names and account names to AI-generated 3D icons.

export interface IconDefinition {
  key: string;
  name: string;
  path: string;
  isSvg?: boolean;
  lucideKey?: string;
  gradient?: string;
}

// Available AI-generated 3D icons & custom SVG/Lucide icons
export const AVAILABLE_ICONS: IconDefinition[] = [
  // 3D PNG Icons
  { key: "casa", name: "Casa & Hogar", path: "/categories/cat_casa.png" },
  { key: "cine", name: "Cine & Streaming", path: "/categories/cat_cine.png" },
  { key: "comida", name: "Comida & Restaurantes", path: "/categories/cat_comida.png" },
  { key: "compras", name: "Compras & Ropa", path: "/categories/cat_compras.png" },
  { key: "comunicaciones", name: "Llamadas & Chat", path: "/categories/cat_comunicaciones.png" },
  { key: "deportes", name: "Deportes & Gimnasio", path: "/categories/cat_deportes.png" },
  { key: "salud", name: "Salud & Higiene", path: "/categories/cat_salud.png" },
  { key: "impuestos", name: "Impuestos & Cuentas", path: "/categories/cat_impuestos.png" },
  { key: "juegos", name: "Videojuegos", path: "/categories/cat_juegos.png" },
  { key: "mascotas", name: "Mascotas", path: "/categories/cat_mascotas.png" },
  { key: "servicios", name: "Servicios Básicos", path: "/categories/cat_servicios.png" },
  { key: "transporte", name: "Transporte Público", path: "/categories/cat_transporte.png" },
  { key: "taxi", name: "Taxi & Uber", path: "/categories/cat_taxi.png" },
  { key: "salario", name: "Salario & Efectivo", path: "/categories/cat_salario.png" },
  { key: "inversiones", name: "Inversiones & Banco", path: "/categories/cat_inversiones.png" },
  { key: "regalos", name: "Regalos & Donaciones", path: "/categories/cat_regalos.png" },
  { key: "otro", name: "Otro / General", path: "/categories/cat_otro.png" },
  
  // Custom 3D PNG Icons (generated with AI)
  { key: "herramientas", name: "Herramientas", path: "/categories/cat_herramientas.png" },
  { key: "diezmos", name: "Diezmos y Ofrendas", path: "/categories/cat_diezmos.png" },
  { key: "user", name: "Usuario / Mathew", path: "/categories/cat_user.png" },
  { key: "golosinas", name: "Golosinas / Dulces", path: "/categories/cat_golosinas.png" },
  { key: "educacion", name: "Educación / Universidad", path: "/categories/cat_educacion.png" },
  { key: "viajes", name: "Viajes & Vuelo", path: "/categories/cat_viajes.png" },
  { key: "bebidas", name: "Bebidas & Cafés", path: "/categories/cat_bebidas.png" },
  { key: "negocio", name: "Negocio & Oficina", path: "/categories/cat_negocio.png" },
  { key: "prestado", name: "Préstamos / Deudas", path: "/categories/cat_prestado.png" },
  { key: "supermercado", name: "Supermercado / Súper", path: "/categories/cat_supermercado.png" },
  { key: "auto", name: "Auto / Gasolina", path: "/categories/cat_auto.png" },
  { key: "ropa", name: "Ropa & Moda", path: "/categories/cat_ropa.png" },
  { key: "belleza", name: "Belleza & Cuidado", path: "/categories/cat_belleza.png" },
  { key: "ahorro", name: "Ahorro & Inversión", path: "/categories/cat_ahorro.png" },
  { key: "cafe", name: "Cafetería / Snacks", path: "/categories/cat_cafe.png" },
  
  // Custom SVG/Lucide Icons (Dynamic colorful badges for remaining or ungenerated categories)
  { key: "fiesta", name: "Fiesta & Eventos", path: "/categories/cat_otro.png", isSvg: true, lucideKey: "fiesta", gradient: "from-amber-400 to-orange-500" },
  { key: "tecnologia", name: "Tecnología / Gadgets", path: "/categories/cat_otro.png", isSvg: true, lucideKey: "tecnologia", gradient: "from-slate-600 to-slate-800" },
];

// Helper to remove accents and lowercase a string
const cleanString = (str: string): string => {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
};

// Maps default and custom categories to default icon keys
const DEFAULT_CATEGORY_MAPPINGS: Record<string, string> = {
  casa: "casa",
  cine: "cine",
  comida: "comida",
  "compras ecommerce": "compras",
  comunicaciones: "comunicaciones",
  deportes: "deportes",
  "costos bancarios": "impuestos",
  desayunos: "comida",
  restaurantes: "comida",
  entretenimiento: "cine",
  higiene: "salud",
  "iva electronico": "impuestos",
  juegos: "juegos",
  mascotas: "mascotas",
  regalos: "regalos",
  ropa: "ropa",
  moda: "ropa",
  vestimenta: "ropa",
  salud: "salud",
  "servicios basicos": "servicios",
  streaming: "cine",
  "taxi/uber": "taxi",
  transporte: "transporte",
  salario: "salario",
  inversion: "inversiones",
  regalo: "regalos",
  
  // Custom keyword mappings
  herramientas: "herramientas",
  mathew: "user",
  prestado: "prestado",
  golosinas: "golosinas",
  dulces: "golosinas",
  diezmos: "diezmos",
  ofrendas: "diezmos",
  "diezmos y ofrendas": "diezmos",
  supermercado: "supermercado",
  super: "supermercado",
  despensa: "supermercado",
  auto: "auto",
  gasolina: "auto",
  combustible: "auto",
  carro: "auto",
  belleza: "belleza",
  peluqueria: "belleza",
  barberia: "belleza",
  cuidado: "belleza",
  ahorro: "ahorro",
  ahorros: "ahorro",
  fiesta: "fiesta",
  bar: "fiesta",
  discoteca: "fiesta",
  diversion: "fiesta",
  tecnologia: "tecnologia",
  computacion: "tecnologia",
  gadget: "tecnologia",
  cafe: "cafe",
  cafeteria: "cafe",
  starbucks: "cafe",
  otro: "otro",
};

/**
 * Resolves the icon path for a given category name.
 * Checks the custom user map first, then falls back to default mappings, and finally to 'otro'.
 */
export function getCategoryIconPath(
  categoryName?: string,
  userIconsMap?: Record<string, string>
): string {
  if (!categoryName) return "/categories/cat_otro.png";

  const cleanedName = cleanString(categoryName);

  // 1. Check custom user mappings from Firestore
  if (userIconsMap && userIconsMap[categoryName]) {
    const customKey = userIconsMap[categoryName];
    const found = AVAILABLE_ICONS.find((icon) => icon.key === customKey);
    if (found) return found.path;
  }

  // 2. Exact match in default mappings
  if (DEFAULT_CATEGORY_MAPPINGS[cleanedName]) {
    const key = DEFAULT_CATEGORY_MAPPINGS[cleanedName];
    const found = AVAILABLE_ICONS.find((icon) => icon.key === key);
    if (found) return found.path;
  }

  // 3. Partial keyword matching
  for (const [key, iconKey] of Object.entries(DEFAULT_CATEGORY_MAPPINGS)) {
    if (cleanedName.includes(key) || key.includes(cleanedName)) {
      const found = AVAILABLE_ICONS.find((icon) => icon.key === iconKey);
      if (found) return found.path;
    }
  }

  return "/categories/cat_otro.png";
}

/**
 * Resolves the icon path for accounts (bancos, tarjetas, efectivo)
 */
export function getAccountIconPath(accountName?: string): string {
  if (!accountName) return "/categories/cat_otro.png";
  const cleaned = cleanString(accountName);

  if (cleaned.includes("efectivo") || cleaned.includes("cash")) {
    return "/categories/cat_salario.png"; // Cash stack icon
  }
  if (
    cleaned.includes("banco") ||
    cleaned.includes("cuenta") ||
    cleaned.includes("produbanco") ||
    cleaned.includes("guayaquil") ||
    cleaned.includes("ahorro") ||
    cleaned.includes("pichincha") ||
    cleaned.includes("internacional")
  ) {
    return "/categories/cat_inversiones.png"; // Financial/Bank chart icon
  }
  if (
    cleaned.includes("tarjeta") ||
    cleaned.includes("credito") ||
    cleaned.includes("amex") ||
    cleaned.includes("visa") ||
    cleaned.includes("mastercard") ||
    cleaned.includes("american")
  ) {
    return "/categories/cat_compras.png"; // Shopping icon (represents card spending)
  }
  if (cleaned.includes("deuna")) {
    return "/categories/cat_otro.png"; // Fallback or star
  }
  if (cleaned.includes("peigo")) {
    return "/categories/cat_juegos.png"; // Custom matching or star
  }

  return "/categories/cat_otro.png";
}
