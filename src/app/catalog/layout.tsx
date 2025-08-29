import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Catálogo — DobleYo',
  description: 'Explora cafés por origen, proceso y tueste con variantes de tamaño y molienda.',
}

export default function CatalogLayout({ children }: { children: React.ReactNode }) {
  return children
}
