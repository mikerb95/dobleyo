import './globals.css'
import { Metadata } from 'next'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { CartProvider } from '@/components/cart-context'
import { getBaseUrl } from '@/lib/env'

export const metadata: Metadata = {
  title: 'DobleYo — Café de especialidad colombiano',
  description: 'Tienda en línea de café de especialidad colombiano. Tu ritual, con calma.',
  icons: { icon: '/favicon.svg' },
  openGraph: {
    title: 'DobleYo — Café de especialidad colombiano',
    description: 'Café de especialidad para tu ritual con calma.',
  url: getBaseUrl(),
    siteName: 'DobleYo',
    type: 'website',
    locale: 'es_CO',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <CartProvider>
          <Header />
          <main className="container-page py-8 sm:py-12">{children}</main>
          <Footer />
        </CartProvider>
      </body>
    </html>
  )
}
