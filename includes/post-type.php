<?php

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/**
 * -------------------------
 * Register Custom Post Type
 * -------------------------
 */
add_action( 'init', function() {
    register_post_type( 'cardmap', [
        'labels' => [
            'name' => __( 'Card Maps' ),
            'singular_name' => __( 'Card Map' ),
        ],
        'public'      => false,
        'show_ui'     => true,
        'supports'    => [ 'title' ],
        'menu_icon'   => 'dashicons-networking',
    ]);
});
