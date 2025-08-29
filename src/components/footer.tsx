export function Footer() {
  return (
    <footer className="mt-16 border-t border-coffee-100">
      <div className="container-page py-8 text-sm text-coffee-700 flex flex-col sm:flex-row items-center justify-between gap-2">
        <p>© {new Date().getFullYear()} DobleYo. Café con calma.</p>
        <div className="flex items-center gap-4">
          <a className="hover:underline" href="/policies">Políticas</a>
          <a className="hover:underline" href="/contact">Contacto</a>
          <span className="text-coffee-500">Hecho en Colombia</span>
        </div>
      </div>
    </footer>
  )
}
