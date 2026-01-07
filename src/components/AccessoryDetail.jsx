import { motion } from 'framer-motion';
import React, { useState } from 'react';
import { ShoppingCart, Star, Package, Truck, Shield, Check, Info } from 'lucide-react';

export default function AccessoryDetail({ product, details }) {
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);

  // Compatibilidad con ambos formatos de producto (BD y estático)
  const productImage = product.image_url || product.image;
  const productPrice = typeof product.price === 'number' ? product.price : parseInt(product.price) || 0;

  // Para demo, creamos imágenes adicionales (en producción vendrían de la BD)
  const images = [
    productImage,
    productImage,
    productImage,
  ];

  const formatPrice = (price) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const handleAddToCart = () => {
    console.log('Agregando al carrito:', { product, quantity });
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5 },
    },
  };

  return (
    <motion.div
      className="accessory-detail-container"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <div className="accessory-detail-content">
        {/* Galería de Imágenes */}
        <motion.div className="image-gallery" variants={itemVariants}>
          <div className="main-image">
            <img src={images[selectedImage]} alt={product.name} />
            {product.deal && (
              <span className="deal-badge">Oferta</span>
            )}
            {product.new && (
              <span className="new-badge">Nuevo</span>
            )}
          </div>
          <div className="thumbnail-list">
            {images.map((img, index) => (
              <button
                key={index}
                className={`thumbnail ${selectedImage === index ? 'active' : ''}`}
                onClick={() => setSelectedImage(index)}
              >
                <img src={img} alt={`${product.name} ${index + 1}`} />
              </button>
            ))}
          </div>
        </motion.div>

        {/* Información del Producto */}
        <motion.div className="product-info" variants={itemVariants}>
          <div className="breadcrumb">
            <a href="/">Inicio</a> / <a href="/tienda">Tienda</a> / <a href="/tienda?category=accesorios">Accesorios</a> / {product.name}
          </div>

          <h1>{product.name}</h1>

          <div className="brand-info">
            <span className="brand-label">Marca:</span>
            <span className="brand-name">{details.brand}</span>
          </div>

          <div className="rating-section">
            <div className="stars">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  size={20}
                  fill={i < Math.floor(product.rating) ? '#f59e0b' : 'none'}
                  stroke="#f59e0b"
                />
              ))}
            </div>
            <span className="rating-text">{product.rating} de 5 estrellas</span>
          </div>

          <div className="price-section">
            <div className="price">{formatPrice(productPrice)}</div>
            {product.deal && (
              <div className="savings">
                <span className="old-price">{formatPrice(productPrice * 1.2)}</span>
                <span className="discount">Ahorra 20%</span>
              </div>
            )}
          </div>

          {/* Características Principales */}
          <div className="key-features">
            <h3>Características Principales</h3>
            <ul>
              {details.features.map((feature, index) => (
                <li key={index}>
                  <Check size={18} className="check-icon" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          {/* Especificaciones */}
          <div className="specifications">
            <h3>Especificaciones</h3>
            <div className="spec-grid">
              <div className="spec-item">
                <span className="spec-label">Material</span>
                <span className="spec-value">{details.material}</span>
              </div>
              <div className="spec-item">
                <span className="spec-label">Dimensiones</span>
                <span className="spec-value">{details.dimensions}</span>
              </div>
              <div className="spec-item">
                <span className="spec-label">Peso</span>
                <span className="spec-value">{details.weight}</span>
              </div>
              {details.capacity && (
                <div className="spec-item">
                  <span className="spec-label">Capacidad</span>
                  <span className="spec-value">{details.capacity}</span>
                </div>
              )}
            </div>
          </div>

          {/* Compra */}
          <div className="purchase-section">
            <div className="stock-info">
              <Check size={18} className="in-stock-icon" />
              <span>Disponible en stock</span>
            </div>

            <div className="quantity-selector">
              <label>Cantidad:</label>
              <div className="quantity-controls">
                <button onClick={() => setQuantity(Math.max(1, quantity - 1))}>-</button>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  min="1"
                />
                <button onClick={() => setQuantity(quantity + 1)}>+</button>
              </div>
            </div>

            <button className="btn-add-cart" onClick={handleAddToCart}>
              <ShoppingCart size={20} />
              Agregar al Carrito
            </button>

            <button className="btn-buy-now">
              Comprar Ahora
            </button>
          </div>

          {/* Beneficios de Compra */}
          <div className="purchase-benefits">
            <div className="benefit">
              <Truck size={24} />
              <div>
                <strong>Envío Gratis</strong>
                <p>En compras superiores a $100.000</p>
              </div>
            </div>
            <div className="benefit">
              <Shield size={24} />
              <div>
                <strong>Garantía</strong>
                <p>6 meses de garantía del fabricante</p>
              </div>
            </div>
            <div className="benefit">
              <Package size={24} />
              <div>
                <strong>Devolución Gratis</strong>
                <p>30 días para devolver</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Contenido de la Caja */}
      <motion.div className="box-contents-section" variants={itemVariants}>
        <h2>
          <Package size={24} />
          Contenido de la Caja
        </h2>
        <ul className="box-contents-list">
          {details.inBox.map((item, index) => (
            <li key={index}>
              <Check size={18} />
              {item}
            </li>
          ))}
        </ul>
      </motion.div>

      {/* Descripción Detallada */}
      <motion.div className="detailed-description" variants={itemVariants}>
        <h2>
          <Info size={24} />
          Descripción del Producto
        </h2>
        <div className="description-content">
          <p>
            El <strong>{product.name}</strong> de <strong>{details.brand}</strong> es una herramienta 
            esencial para cualquier amante del café que busque calidad y durabilidad en sus accesorios.
          </p>
          <p>
            Fabricado con {details.material.toLowerCase()}, este producto combina funcionalidad 
            y diseño elegante. Perfecto para uso doméstico o profesional.
          </p>
          <h3>¿Por qué elegir este producto?</h3>
          <ul>
            {details.features.slice(0, 3).map((feature, index) => (
              <li key={index}>{feature}</li>
            ))}
          </ul>
          <p>
            Con una calificación de {product.rating} estrellas, nuestros clientes confían en la 
            calidad y rendimiento de este producto para preparar el café perfecto todos los días.
          </p>
        </div>
      </motion.div>

      {/* Productos Relacionados podría ir aquí */}
      <motion.div className="related-products-hint" variants={itemVariants}>
        <h2>También te puede interesar</h2>
        <p className="coming-soon">Productos relacionados próximamente...</p>
      </motion.div>
    </motion.div>
  );
}
