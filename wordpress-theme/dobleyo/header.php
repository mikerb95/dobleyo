<!doctype html>
<html <?php language_attributes(); ?>>
<head>
  <meta charset="<?php bloginfo('charset'); ?>">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>
<header class="site-header">
  <div class="container">
    <a class="site-brand" href="<?php echo esc_url(home_url('/')); ?>">DobleYo</a>
    <nav class="site-nav">
      <?php wp_nav_menu(['theme_location'=>'primary','container'=>false,'fallback_cb'=>'__return_false','depth'=>1]); ?>
    </nav>
  </div>
</header>
<main class="container">
