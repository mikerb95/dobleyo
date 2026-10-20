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
