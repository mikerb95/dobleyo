export interface Product {
  id: string;
  name: string;
  category: string;
  origin?: string;
  process?: string;
  roast?: string;
  price: number;
  rating: number;
  deal?: boolean;
  bestseller?: boolean;
  new?: boolean;
  fast?: boolean;
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
    price: 42000,
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
    price: 45000,
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
    price: 48000,
    rating: 4.5,
    image:
      "https://images.unsplash.com/photo-1494415859740-21e878dd929d?q=80&w=800&auto=format&fit=crop",
  },
  {
    id: "acc-molinillo",
    name: "Molinillo Manual",
    category: "Accesorios",
    price: 199900,
    rating: 4.3,
    deal: true,
    fast: true,
    image:
      "https://images.unsplash.com/photo-1507133750040-4a8f57021524?q=80&w=800&auto=format&fit=crop",
  },
  {
    id: "acc-chemex",
    name: "Chemex 6 tazas",
    category: "Accesorios",
    price: 269900,
    rating: 4.9,
    new: true,
    image:
      "https://images.unsplash.com/photo-1503481766315-7a586b20f66f?q=80&w=800&auto=format&fit=crop",
  },
];
