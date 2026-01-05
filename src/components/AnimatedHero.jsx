import { motion } from 'framer-motion';
import React from 'react';

export default function AnimatedHero({ title, subtitle, image }) {
  const titleVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.8,
        ease: 'easeOut',
      },
    },
  };

  const subtitleVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.8,
        delay: 0.2,
        ease: 'easeOut',
      },
    },
  };

  const backgroundVariants = {
    animate: {
      backgroundPosition: ['0% 0%', '100% 100%'],
      transition: {
        duration: 20,
        repeat: Infinity,
        repeatType: 'reverse',
      },
    },
  };

  return (
    <motion.section
      className="hero-section"
      variants={backgroundVariants}
      animate="animate"
      style={{
        backgroundImage: image ? `url(${image})` : undefined,
      }}
    >
      <div className="hero-overlay" />
      
      <motion.div className="hero-content">
        <motion.h1 variants={titleVariants} initial="hidden" animate="visible">
          {title}
        </motion.h1>
        
        {subtitle && (
          <motion.p variants={subtitleVariants} initial="hidden" animate="visible">
            {subtitle}
          </motion.p>
        )}
      </motion.div>

      <style>{`
        .hero-section {
          position: relative;
          width: 100%;
          min-height: 500px;
          display: flex;
          align-items: center;
          justify-content: center;
          background-size: cover;
          background-position: center;
          background-attachment: fixed;
          overflow: hidden;
        }

        .hero-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(135deg, rgba(44, 24, 16, 0.85) 0%, rgba(26, 15, 10, 0.85) 100%);
        }

        .hero-content {
          position: relative;
          z-index: 10;
          text-align: center;
          color: white;
          max-width: 800px;
          padding: 2rem;
        }

        .hero-content h1 {
          font-size: 3.5rem;
          font-weight: bold;
          margin: 0 0 1rem 0;
          letter-spacing: 2px;
          line-height: 1.2;
        }

        .hero-content p {
          font-size: 1.3rem;
          margin: 0;
          color: #d4a574;
          line-height: 1.6;
        }

        @media (max-width: 768px) {
          .hero-section {
            min-height: 350px;
          }

          .hero-content h1 {
            font-size: 2rem;
          }

          .hero-content p {
            font-size: 1rem;
          }
        }
      `}</style>
    </motion.section>
  );
}
