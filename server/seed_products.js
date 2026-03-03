import * as db from './db.js';

const products = [
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

async function seed() {
  console.log('Seeding products...');
  try {
    for (const p of products) {
      // Check if product exists
      const existing = await db.query('SELECT id FROM products WHERE id = $1', [p.id]);

      if (existing.rows.length === 0) {
        console.log(`Inserting ${p.name}...`);
        await db.query(
          `INSERT INTO products (id, name, category, price, stock_quantity, origin, process, roast, image_url)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            p.id,
            p.name,
            p.category === 'Cafés' ? 'cafe' : 'accesorio',
            p.price,
            100, // Default stock
            p.origin || null,
            p.process || null,
            p.roast || null,
            p.image
          ]
        );
      } else {
        console.log(`Updating ${p.name}...`);
        await db.query(
          `UPDATE products SET 
            name = $1, 
            price = $2, 
            origin = $3, 
            process = $4, 
            roast = $5, 
            image_url = $6,
            updated_at = NOW()
           WHERE id = $7`,
          [
            p.name,
            p.price,
            p.origin || null,
            p.process || null,
            p.roast || null,
            p.image,
            p.id
          ]
        );
      }
    }
    console.log('Seeding complete.');
    process.exit(0);
  } catch (err) {
    console.error('Error seeding products:', err);
    process.exit(1);
  }
}

seed();
