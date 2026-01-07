import { motion } from 'framer-motion';
import React, { useState } from 'react';
import { ShoppingCart, Star, Award, MapPin, Thermometer, Coffee, Droplets } from 'lucide-react';

export default function CoffeeDetail({ product, profile }) {
  const [quantity, setQuantity] = useState(1);
  const [selectedGrind, setSelectedGrind] = useState('grano');

  const grindOptions = [
    { value: 'grano', label: 'Grano Entero' },
    { value: 'fino', label: 'Molido Fino (Espresso)' },
    { value: 'medio', label: 'Molido Medio (Cafetera)' },
    { value: 'grueso', label: 'Molido Grueso (Prensa)' },
  ];

  const formatPrice = (price) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(price);
  };

  // Compatibilidad con ambos formatos de producto (BD y estático)
  const productImage = product.image_url || product.image;
  const productOrigin = product.origin || product.subcategory;
  const productPrice = typeof product.price === 'number' ? product.price : parseInt(product.price) || 0;

  const handleAddToCart = () => {
    // Lógica para agregar al carrito
    console.log('Agregando al carrito:', { product, quantity, grind: selectedGrind });
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
      className="coffee-detail-container"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <div className="coffee-detail-content">
        {/* Imagen Principal */}
        <motion.div className="image-section" variants={itemVariants}>
          <div className="main-image">
            <img src={productImage} alt={product.name} />
            {product.deal && (
              <span className="deal-badge">Oferta</span>
            )}
            {product.bestseller && (
              <span className="bestseller-badge">
                <Award size={16} /> Best Seller
              </span>
            )}
          </div>
          
          {/* Badges */}
          <div className="product-badges">
            {product.new && <span className="badge new">Nuevo</span>}
            {product.fast && <span className="badge fast">Envío Rápido</span>}
          </div>
        </motion.div>

        {/* Información Principal */}
        <motion.div className="info-section" variants={itemVariants}>
          <div className="breadcrumb">
            <a href="/">Inicio</a> / <a href="/tienda">Tienda</a> / {product.name}
          </div>

          <h1>{product.name}</h1>

          <div className="origin-info">
            <MapPin size={18} />
            <span>{productOrigin}</span>
          </div>

          <div className="rating-price">
            <div className="rating">
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
              <span>{product.rating} / 5.0</span>
            </div>
            <div className="price">{formatPrice(productPrice)}</div>
          </div>

          {/* Información de Proceso */}
          <div className="process-info">
            <div className="process-item">
              <Coffee size={20} />
              <div>
                <span className="label">Proceso</span>
                <span className="value">{product.process}</span>
              </div>
            </div>
            <div className="process-item">
              <Thermometer size={20} />
              <div>
                <span className="label">Tueste</span>
                <span className="value">{product.roast}</span>
              </div>
            </div>
            <div className="process-item">
              <Droplets size={20} />
              <div>
                <span className="label">Variedad</span>
                <span className="value">{profile.variety}</span>
              </div>
            </div>
          </div>

          {/* Selector de Molido */}
          <div className="grind-selector">
            <label>Molido:</label>
            <div className="grind-options">
              {grindOptions.map((option) => (
                <button
                  key={option.value}
                  className={`grind-option ${selectedGrind === option.value ? 'active' : ''}`}
                  onClick={() => setSelectedGrind(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Cantidad y Agregar al Carrito */}
          <div className="purchase-section">
            <div className="quantity-selector">
              <button onClick={() => setQuantity(Math.max(1, quantity - 1))}>-</button>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                min="1"
              />
              <button onClick={() => setQuantity(quantity + 1)}>+</button>
            </div>
            <button className="btn-add-cart" onClick={handleAddToCart}>
              <ShoppingCart size={20} />
              Agregar al Carrito
            </button>
          </div>
        </motion.div>
      </div>

      {/* Perfil de Taza */}
      <motion.div className="cup-profile-section" variants={itemVariants}>
        <h2>Perfil de Taza</h2>
        <div className="profile-grid">
          <div className="profile-card">
            <h3>Aroma</h3>
            <p>{profile.aroma}</p>
          </div>
          <div className="profile-card">
            <h3>Notas de Sabor</h3>
            <p>{profile.flavorNotes}</p>
          </div>
          <div className="profile-card">
            <h3>Acidez</h3>
            <p>{profile.acidity}</p>
          </div>
          <div className="profile-card">
            <h3>Cuerpo</h3>
            <p>{profile.body}</p>
          </div>
          <div className="profile-card">
            <h3>Balance</h3>
            <p>{profile.balance}</p>
          </div>
          <div className="profile-card score">
            <h3>Puntuación</h3>
            <p className="score-value">{profile.score}</p>
            <span className="score-label">/ 100</span>
          </div>
        </div>
      </motion.div>

      {/* Trazabilidad */}
      <motion.div className="traceability-section" variants={itemVariants}>
        <h2>Trazabilidad</h2>
        <div className="trace-grid">
          <div className="trace-item">
            <span className="trace-label">Finca</span>
            <span className="trace-value">{profile.farm}</span>
          </div>
          <div className="trace-item">
            <span className="trace-label">Productor</span>
            <span className="trace-value">{profile.producer}</span>
          </div>
          <div className="trace-item">
            <span className="trace-label">Altura</span>
            <span className="trace-value">{profile.altitude}</span>
          </div>
          <div className="trace-item">
            <span className="trace-label">Región</span>
            <span className="trace-value">{product.origin}</span>
          </div>
        </div>
      </motion.div>

      {/* Descripción */}
      <motion.div className="description-section" variants={itemVariants}>
        <h2>Descripción</h2>
        {product.description ? (
          <p>{product.description}</p>
        ) : (
          <>
            <p>
              Un café excepcional de {productOrigin}, cultivado a {profile.altitude} por {profile.producer} en {profile.farm}.
              Procesado mediante el método {(product.process || profile.process).toLowerCase()} y tostado a un nivel {(product.roast || profile.roast).toLowerCase()}, 
              este café ofrece una experiencia sensorial única con notas de {profile.flavorNotes.toLowerCase()}.
            </p>
            <p>
              Ideal para quienes buscan un café con {profile.body.toLowerCase()} y {profile.acidity.toLowerCase()}, 
              perfecto para disfrutar en cualquier momento del día.
            </p>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
