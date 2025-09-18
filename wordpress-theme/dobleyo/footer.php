</main>
<footer>
  <div class="container">
    <p>&copy; <?php echo date('Y'); ?> DobleYo · Café de especialidad colombiano</p>
    <?php wp_nav_menu(['theme_location'=>'footer','container'=>false,'fallback_cb'=>'__return_false','depth'=>1]); ?>
  </div>
</footer>
<?php wp_footer(); ?>
</body>
</html>
