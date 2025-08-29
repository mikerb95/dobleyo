export const metadata = {
  title: 'Sobre DobleYo — Café de especialidad',
  description: 'Conoce nuestra filosofía y el origen de nuestros cafés.',
}
export default function AboutPage() {
  return (
    <div className="prose prose-neutral max-w-none">
      <h1>Sobre DobleYo</h1>
      <p>
        Creemos en el café como un momento de pausa. Trabajamos con caficultores colombianos para llevarte granos
        de origen, tostados con cuidado para resaltar su dulzor natural y su complejidad.
      </p>
      <h3>Nuestro Proceso</h3>
      <p>Seleccionamos lotes por perfil de taza, tostamos pequeños batchs y despachamos frescos cada semana.</p>
      <h3>Sostenibilidad</h3>
      <p>Pagamos sobreprecio por calidad, apoyando prácticas sostenibles y relaciones de largo plazo.</p>
    </div>
  )
}
