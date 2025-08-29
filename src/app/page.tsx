import Image from 'next/image'
import { products } from '@/data/products'
import { ProductCard } from '@/components/product-card'

export default function HomePage() {
  return (
    <div className="space-y-10">
      <section className="grid md:grid-cols-2 gap-8 items-center">
        <div className="space-y-4">
          <span className="badge">DobleYo</span>
          <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight text-coffee-800">
            Café de especialidad colombiano
          </h1>
          <p className="text-coffee-700 max-w-prose">
            Granos seleccionados, tostados con precisión, para acompañar tu ritual diario con calma.
          </p>
        </div>
        <div className="relative aspect-[4/3] w-full">
          <Image
            src="https://images.unsplash.com/photo-1507133750040-4a8f57021516?q=80&w=1400&auto=format&fit=crop"
            alt="Café de especialidad"
            fill
            className="object-cover rounded-xl"
            priority
          />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-coffee-800">Nuestros cafés</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>
    </div>
  )
}
