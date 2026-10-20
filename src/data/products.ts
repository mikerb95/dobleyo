export interface Product {
  id: string;
  name: string;
  nameEn?: string;
  category: string;
  categoryEn?: string;
  origin?: string;
  process?: string;
  processEn?: string;
  roast?: string;
  roastEn?: string;
  notes?: string[];
  notesEn?: string[];
  price: number;
  priceUsd?: number;
  rating: number;
  deal?: boolean;
  bestseller?: boolean;
  new?: boolean;
  fast?: boolean;
  weight?: number;
  weight_unit?: string;
  image: string;
}

export const products: Product[] = [
  {
    id: "cf-sierra",
    name: "Sierra Nevada",
    category: "Cafés",
    origin: "Sierra Nevada",
    process: "Lavado",
    roast: "Medio",
    notes: ["Cacao", "Nuez", "Caramelo"],
    notesEn: ["Cocoa", "Hazelnut", "Caramel"],
    price: 42000,
    priceUsd: 11,
    rating: 4.6,
    deal: true,
    bestseller: true,
    fast: true,
    image:
      "https://images.unsplash.com/photo-1512568400610-62da28bc8a13?q=80&w=800&auto=format&fit=crop",
  },
  {
    id: "cf-huila",
    name: "Huila",
    category: "Cafés",
    origin: "Huila",
    process: "Honey",
    roast: "Claro",
    notes: ["Cítricos", "Miel", "Floral"],
    notesEn: ["Citrus", "Honey", "Floral"],
    price: 45000,
    priceUsd: 12,
    rating: 4.7,
    new: true,
    fast: true,
    image:
      "https://images.unsplash.com/photo-1509043759401-136742328bb3?q=80&w=800&auto=format&fit=crop",
  },
  {
    id: "cf-nar",
    name: "Nariño",
    category: "Cafés",
    origin: "Nariño",
    process: "Natural",
    roast: "Oscuro",
    notes: ["Frutas Rojas", "Chocolate", "Té Negro"],
    notesEn: ["Red Fruits", "Chocolate", "Black Tea"],
    price: 48000,
    priceUsd: 13,
    rating: 4.5,
    image:
      "https://images.unsplash.com/photo-1494415859740-21e878dd929d?q=80&w=800&auto=format&fit=crop",
  },
  // Cafés de Finca Rengifo. La fuente real es la BD (migración add_huila_microlots.js).
  {
    id: "cf-isnos-geisha",
    name: "Isnos Geisha",
    category: "Cafés",
    origin: "Isnos, Huila",
    process: "Lavado",
    roast: "Medio",
    price: 72000,
    priceUsd: 19,
    rating: 0,
    new: true,
    weight: 250,
    weight_unit: "g",
    image: "/assets/img/cafe/isnos-geisha.webp",
  },
  {
    id: "cf-pitalito-sidra",
    name: "Pitalito Sidra",
    category: "Cafés",
    origin: "Pitalito, Huila",
    process: "Lavado",
    roast: "Medio",
    price: 65000,
    priceUsd: 17,
    rating: 0,
    new: true,
    weight: 250,
    weight_unit: "g",
    image: "/assets/img/cafe/pitalito-sidra.webp",
  },
  {
    id: "acc-molinillo",
    name: "Molinillo Manual",
    nameEn: "Manual Coffee Grinder",
    category: "Accesorios",
    categoryEn: "Accessories",
    price: 199900,
    priceUsd: 52,
    rating: 4.3,
    deal: true,
    fast: true,
    image:
      "https://images.unsplash.com/photo-1611854779393-1b2da9d400fe?q=80&w=800&auto=format&fit=crop",
  },
  {
    id: "acc-chemex",
    name: "Chemex 6 tazas",
    nameEn: "Chemex 6-cup",
    category: "Accesorios",
    categoryEn: "Accessories",
    price: 269900,
    priceUsd: 70,
    rating: 4.9,
    new: true,
    image:
      "https://images.unsplash.com/photo-1545665225-b23b99e4d45e?q=80&w=800&auto=format&fit=crop",
  },
  // Línea de cacao. Precios y gramajes de referencia: la fuente real es la BD
  // (migración add_cacao_line.js), editable desde /admin/productos.
  {
    id: "cac-mesa",
    name: "Chocolate de Mesa",
    nameEn: "Drinking Chocolate Tablets",
    category: "Cacao",
    categoryEn: "Cacao",
    notes: ["70% cacao", "Ecológico", "En pastillas"],
    notesEn: ["70% cacao", "Organic", "Tablets"],
    price: 26000,
    priceUsd: 7,
    rating: 0,
    new: true,
    weight: 500,
    weight_unit: "g",
    image: "/assets/img/cacao/chocolate-de-mesa.webp",
  },
  {
    id: "cac-barra",
    name: "Barras de Cacao",
    nameEn: "Cacao Bars",
    category: "Cacao",
    categoryEn: "Cacao",
    notes: ["100% cacao", "Energético", "Nutritivo"],
    notesEn: ["100% cacao", "Energizing", "Nutritious"],
    price: 12000,
    priceUsd: 3,
    rating: 0,
    new: true,
    weight: 100,
    weight_unit: "g",
    image: "/assets/img/cacao/barras-de-cacao.webp",
  },
  {
    id: "cac-polvo",
    name: "Cacao en Polvo 100%",
    nameEn: "100% Cacao Powder",
    category: "Cacao",
    categoryEn: "Cacao",
    notes: ["100% cacao", "Repostería", "Frío o caliente"],
    notesEn: ["100% cacao", "Baking", "Hot or cold"],
    price: 22000,
    priceUsd: 6,
    rating: 0,
    new: true,
    weight: 250,
    weight_unit: "g",
    image: "/assets/img/cacao/cacao-en-polvo.webp",
  },
  {
    id: "cac-grano",
    name: "Cacao en Forma de Café",
    nameEn: "Coffee Bean Shaped Cacao",
    category: "Cacao",
    categoryEn: "Cacao",
    notes: ["Maridaje con café", "Decoración de postres"],
    notesEn: ["Coffee pairing", "Dessert topping"],
    price: 16000,
    priceUsd: 4,
    rating: 0,
    new: true,
    weight: 150,
    weight_unit: "g",
    image: "/assets/img/cacao/cacao-forma-de-cafe.webp",
  },
  {
    id: "cac-manteca",
    name: "Manteca de Cacao",
    nameEn: "Cacao Butter",
    category: "Cacao",
    categoryEn: "Cacao",
    notes: ["Extracción en frío", "Chocolatería", "Repostería"],
    notesEn: ["Cold pressed", "Chocolate making", "Baking"],
    price: 38000,
    priceUsd: 10,
    rating: 0,
    new: true,
    weight: 250,
    weight_unit: "g",
    image: "/assets/img/cacao/manteca-de-cacao.webp",
  },
];
