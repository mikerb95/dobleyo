<?php
/**
 * Theme bootstrap
 */

add_action('after_setup_theme', function() {
  add_theme_support('title-tag');
  add_theme_support('post-thumbnails');
  add_theme_support('woocommerce');
  register_nav_menus([
    'primary' => __('Primary Menu','dobleyo'),
    'footer'  => __('Footer Menu','dobleyo')
  ]);
});

add_action('wp_enqueue_scripts', function(){
  wp_enqueue_style('dobleyo-style', get_stylesheet_uri(), [], '0.1.0');
});

/** Widgets area */
add_action('widgets_init', function(){
  register_sidebar([
    'name' => __('Sidebar','dobleyo'),
    'id' => 'sidebar-1',
    'before_widget' => '<section class="widget">',
    'after_widget'  => '</section>',
    'before_title'  => '<h3 class="widget-title">',
    'after_title'   => '</h3>',
  ]);
});

/** Simple helper to render WooCommerce product grid on homepage if set */
function dobleyo_products_grid($args = []){
  if (!class_exists('WooCommerce')) return;
  $defaults = [ 'limit' => 6, 'columns' => 3, 'orderby' => 'date', 'order' => 'DESC' ];
  $args = wp_parse_args($args, $defaults);
  echo do_shortcode('[products limit="'.intval($args['limit']).'" columns="'.intval($args['columns']).'" orderby="'.esc_attr($args['orderby']).'" order="'.esc_attr($args['order']).'"]');
}
