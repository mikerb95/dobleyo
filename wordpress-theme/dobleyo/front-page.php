<?php get_header(); ?>
<section class="hero">
  <h1>Café de especialidad colombiano</h1>
  <p>Tueste fresco, origen trazable y un estilo sereno y acogedor.</p>
  <?php 
    $shop_url = function_exists('wc_get_page_permalink') ? wc_get_page_permalink('shop') : home_url('/tienda');
  ?>
  <p><a class="btn" href="<?php echo esc_url($shop_url); ?>">Ver tienda</a></p>
</section>
<section>
  <h2>Nuestros cafés</h2>
  <div class="grid">
    <?php if (function_exists('dobleyo_products_grid')) dobleyo_products_grid(['limit'=>8,'columns'=>4]); ?>
  </div>
</section>
<?php get_footer(); ?>
