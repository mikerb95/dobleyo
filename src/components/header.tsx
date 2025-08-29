'use client'
import Link from 'next/link'
import { useCart } from './cart-context'

export function Header() {
  const { count } = useCart()
  return (
    <header className="border-b border-coffee-100 bg-white/70 backdrop-blur">
      <div className="container-page py-4 flex items-center justify-between">
        <Link href="/" className="text-xl font-semibold text-coffee-800">DobleYo</Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/" className="hover:underline">Inicio</Link>
          <Link href="/about" className="hover:underline">Nosotros</Link>
          <Link href="/cart" className="btn btn-outline">Carrito ({count})</Link>
        </nav>
      </div>
    </header>
  )
}
