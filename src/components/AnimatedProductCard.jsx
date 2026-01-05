import { motion } from 'framer-motion';
import React from 'react';

export default function AnimatedProductCard({ product, index }) {
  const cardVariants = {
    hidden: { opacity: 0, y: 50 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        delay: index * 0.1,
        ease: 'easeOut',
      },
    },
  };

  const hoverVariants = {
    hover: {
      y: -10,
      boxShadow: '0 20px 40px rgba(139, 111, 71, 0.3)',
      transition: { duration: 0.3 },
    },
  };

  const imageVariants = {
    hover: {
      scale: 1.1,
      transition: { duration: 0.3 },
    },
  };

  const badgeVariants = {
    hidden: { scale: 0, opacity: 0 },
    visible: {
      scale: 1,
      opacity: 1,
      transition: {
        delay: 0.3,
        duration: 0.3,
        type: 'spring',
        stiffness: 200,
      },
    },
  };

  return (
    <motion.div
      className="product-card-animated"
      variants={cardVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.3 }}
      whileHover="hover"
      variants={cardVariants}
    >
      <motion.div className="card-inner" variants={hoverVariants}>
        <motion.div 
          className="product-image"
          whileHover="hover"
          variants={imageVariants}
        >
          {product.image ? (
            <img src={product.image} alt={product.name} />
          ) : (
            <div className="placeholder">
              {product.name.charAt(0)}
            </div>
          )}
          
          {product.badge && (
            <motion.span
              className="badge"
              variants={badgeVariants}
              initial="hidden"
              animate="visible"
            >
              {product.badge}
            </motion.span>
          )}
        </motion.div>

        <div className="product-content">
          <h3>{product.name}</h3>
          <p className="description">{product.description}</p>
          
          <motion.div
            className="price-section"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <span className="price">${product.price}</span>
            {product.discount && (
              <span className="discount">{product.discount}% OFF</span>
            )}
          </motion.div>

          <motion.button
            className="btn-add-cart"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => console.log('Added:', product.name)}
          >
            Agregar al carrito
          </motion.button>
        </div>
      </motion.div>

      <style>{`
        .product-card-animated {
          background: white;
          border-radius: 12px;
          overflow: hidden;
          cursor: pointer;
          height: 100%;
          display: flex;
          flex-direction: column;
        }

        .card-inner {
          display: flex;
          flex-direction: column;
          height: 100%;
        }

        .product-image {
          position: relative;
          width: 100%;
          height: 250px;
          background: #f5f5f5;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .product-image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .placeholder {
          width: 100%;
          height: 100%;
          background: linear-gradient(135deg, #d4a574 0%, #8b6f47 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 3rem;
          color: white;
          font-weight: bold;
        }

        .badge {
          position: absolute;
          top: 10px;
          right: 10px;
          background: #ff6b6b;
          color: white;
          padding: 0.4rem 0.8rem;
          border-radius: 20px;
          font-size: 0.75rem;
          font-weight: bold;
          text-transform: uppercase;
        }

        .product-content {
          flex: 1;
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
        }

        .product-content h3 {
          margin: 0 0 0.5rem 0;
          color: #2c1810;
          font-size: 1.1rem;
        }

        .description {
          color: #666;
          font-size: 0.9rem;
          margin: 0 0 1rem 0;
          flex: 1;
          line-height: 1.4;
        }

        .price-section {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 1rem;
        }

        .price {
          font-size: 1.5rem;
          font-weight: bold;
          color: #8b6f47;
        }

        .discount {
          background: #ff6b6b;
          color: white;
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: bold;
        }

        .btn-add-cart {
          width: 100%;
          padding: 0.75rem;
          background: linear-gradient(135deg, #8b6f47 0%, #6b5635 100%);
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-weight: bold;
          transition: all 0.3s ease;
        }

        .btn-add-cart:hover {
          background: linear-gradient(135deg, #6b5635 0%, #4a3a23 100%);
        }
      `}</style>
    </motion.div>
  );
}
