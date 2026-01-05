import { motion } from 'framer-motion';
import React from 'react';

export default function AnimatedHeader() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: -20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.8, ease: 'easeOut' },
    },
  };

  return (
    <motion.header
      className="header-animated"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      <motion.div className="logo-container" variants={itemVariants}>
        <h1>DobleYo Café</h1>
      </motion.div>
      
      <motion.nav className="nav-menu" variants={containerVariants}>
        {['Inicio', 'Tienda', 'Blog', 'Nosotros', 'Contacto'].map((item, index) => (
          <motion.a
            key={index}
            href={`/${item.toLowerCase()}.html`}
            variants={itemVariants}
            whileHover={{ 
              scale: 1.1, 
              color: '#8b6f47',
              transition: { duration: 0.2 }
            }}
          >
            {item}
          </motion.a>
        ))}
      </motion.nav>

      <style>{`
        .header-animated {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.5rem 2rem;
          background: linear-gradient(135deg, #2c1810 0%, #1a0f0a 100%);
          border-bottom: 3px solid #8b6f47;
        }

        .logo-container h1 {
          font-size: 1.8rem;
          color: #f5e6d3;
          margin: 0;
          font-weight: bold;
          letter-spacing: 2px;
        }

        .nav-menu {
          display: flex;
          gap: 2rem;
          list-style: none;
          margin: 0;
          padding: 0;
        }

        .nav-menu a {
          color: #d4a574;
          text-decoration: none;
          font-size: 1rem;
          font-weight: 500;
          cursor: pointer;
          transition: color 0.3s ease;
        }

        .nav-menu a:hover {
          color: #8b6f47;
        }

        @media (max-width: 768px) {
          .header-animated {
            flex-direction: column;
            gap: 1rem;
          }
          
          .nav-menu {
            flex-direction: column;
            gap: 0.5rem;
            text-align: center;
          }
        }
      `}</style>
    </motion.header>
  );
}
