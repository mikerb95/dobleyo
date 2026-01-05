import { motion } from 'framer-motion';
import React from 'react';

export default function AnimatedButton({ children, onClick, variant = 'primary', ...props }) {
  const variants = {
    primary: {
      background: 'linear-gradient(135deg, #8b6f47 0%, #6b5635 100%)',
      color: 'white',
      hoverColor: 'linear-gradient(135deg, #6b5635 0%, #4a3a23 100%)',
    },
    secondary: {
      background: 'linear-gradient(135deg, #d4a574 0%, #c2935c 100%)',
      color: 'white',
      hoverColor: 'linear-gradient(135deg, #c2935c 0%, #8b6f47 100%)',
    },
    outline: {
      background: 'transparent',
      color: '#8b6f47',
      border: '2px solid #8b6f47',
      hoverColor: 'rgba(139, 111, 71, 0.1)',
    },
  };

  const style = variants[variant] || variants.primary;

  return (
    <motion.button
      className={`animated-btn animated-btn-${variant}`}
      onClick={onClick}
      whileHover={{
        scale: 1.05,
        transition: { duration: 0.2 },
      }}
      whileTap={{
        scale: 0.95,
        transition: { duration: 0.1 },
      }}
      style={style}
      {...props}
    >
      {children}
      <style>{`
        .animated-btn {
          padding: 0.75rem 1.5rem;
          border: none;
          border-radius: 6px;
          font-weight: bold;
          cursor: pointer;
          font-size: 1rem;
          transition: all 0.3s ease;
        }

        .animated-btn-primary {
          background: ${style.background};
          color: ${style.color};
        }

        .animated-btn-secondary {
          background: ${style.background};
          color: ${style.color};
        }

        .animated-btn-outline {
          background: ${style.background};
          color: ${style.color};
          border: ${style.border};
        }

        .animated-btn:hover {
          background: ${style.hoverColor};
          box-shadow: 0 4px 12px rgba(139, 111, 71, 0.2);
        }
      `}</style>
    </motion.button>
  );
}
