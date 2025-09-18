<?php get_header(); ?>
<section>
  <?php if (have_posts()): while (have_posts()): the_post(); ?>
    <article class="card">
      <?php if (has_post_thumbnail()) the_post_thumbnail('large'); ?>
      <div class="p">
        <h2><a href="<?php the_permalink(); ?>"><?php the_title(); ?></a></h2>
        <div><?php the_excerpt(); ?></div>
      </div>
    </article>
  <?php endwhile; the_posts_pagination(); else: ?>
    <p><?php _e('No hay contenido aún.','dobleyo'); ?></p>
  <?php endif; ?>
</section>
<?php get_footer(); ?>
