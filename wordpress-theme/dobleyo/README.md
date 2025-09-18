# Tema WordPress: DobleYo

Tema minimalista para una tienda de café basada en WooCommerce. Pensado para subir por FTP.

## Requisitos
- WordPress 6.x
- PHP 8.0+
- Plugin WooCommerce

## Instalación (FTP)
1. Comprime la carpeta `dobleyo/` en un zip (el contenido debe incluir style.css, functions.php, etc.).
2. Sube la carpeta por FTP a `wp-content/themes/` de tu servidor.
3. En WP-Admin > Apariencia > Temas, activa "DobleYo".
4. Instala y activa el plugin WooCommerce.
5. Ve a Páginas > crea "Inicio" y "Tienda" si no existen.
6. Ajustes > Lectura: establece "Una página estática" y elige "Inicio" como portada.
7. WooCommerce > Ajustes > Productos: establece "Tienda" como página de tienda.

## Menús
- Apariencia > Menús: crea un menú y asígnalo a "Primary" y otro opcional a "Footer".

## Personalización
- Cambia colores y tipografías desde `style.css`.
- La portada (front-page.php) muestra un héroe y productos recientes vía shortcode `[products]`.

## Notas
- Este tema no incluye builder ni bloques personalizados; usa el editor de bloques de WP.
- Para un estilo más avanzado, podemos añadir un `assets/` con CSS/JS y más plantillas.
