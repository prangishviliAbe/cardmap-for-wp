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
            'name' => __( 'Card Maps', 'cardmap' ),
            'singular_name' => __( 'Card Map', 'cardmap' ),
        ],
        'public'      => true, // Must be true for Polylang to see it
        'show_ui'     => true,
        'supports'    => [ 'title' ],
        'menu_icon'   => 'dashicons-networking',
        'show_in_rest' => true, // Important for block editor / future compatibility
    ]);
});
