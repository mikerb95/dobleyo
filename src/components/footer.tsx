export function Footer() {
  return (
    <footer className="mt-16 border-t border-coffee-100">
      <div className="container-page py-8 text-sm text-coffee-700 flex flex-col sm:flex-row items-center justify-between gap-2">
        <p>© {new Date().getFullYear()} DobleYo. Café con calma.</p>
        <p className="text-coffee-500">Hecho en Colombia</p>
      </div>
    </footer>
  )
}
