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

/**
 * Add duplicate link to row actions
 */
add_filter( 'post_row_actions', 'cardmap_duplicate_post_link', 10, 2 );
function cardmap_duplicate_post_link( $actions, $post ) {
    if ( $post->post_type === 'cardmap' && current_user_can( 'edit_posts' ) ) {
        $url = wp_nonce_url(
            add_query_arg(
                [
                    'action' => 'cardmap_duplicate_post',
                    'post' => $post->ID,
                ],
                admin_url( 'admin.php' )
            ),
            'cardmap_duplicate_' . $post->ID
        );
        
        $actions['duplicate'] = '<a href="' . esc_url( $url ) . '" title="' . esc_attr__( 'Duplicate this map', 'cardmap' ) . '">' . __( 'Duplicate', 'cardmap' ) . '</a>';
    }
    return $actions;
}

/**
 * Handle the duplicate action
 */
add_action( 'admin_action_cardmap_duplicate_post', 'cardmap_duplicate_post_action' );
function cardmap_duplicate_post_action() {
    // Get the post ID
    if ( empty( $_GET['post'] ) ) {
        wp_die( __( 'No post to duplicate has been provided!', 'cardmap' ) );
    }
    
    $post_id = absint( $_GET['post'] );
    
    // Verify nonce
    if ( ! isset( $_GET['_wpnonce'] ) || ! wp_verify_nonce( $_GET['_wpnonce'], 'cardmap_duplicate_' . $post_id ) ) {
        wp_die( __( 'Security check failed!', 'cardmap' ) );
    }
    
    // Check permissions
    if ( ! current_user_can( 'edit_posts' ) ) {
        wp_die( __( 'You do not have permission to duplicate this map!', 'cardmap' ) );
    }
    
    // Get the original post
    $post = get_post( $post_id );
    
    if ( ! $post || $post->post_type !== 'cardmap' ) {
        wp_die( __( 'Invalid post or post type!', 'cardmap' ) );
    }
    
    // Create the duplicate post
    $new_post = [
        'post_title' => $post->post_title . ' (Copy)',
        'post_content' => $post->post_content,
        'post_status' => 'draft',
        'post_type' => 'cardmap',
        'post_author' => get_current_user_id(),
    ];
    
    // Insert the new post
    $new_post_id = wp_insert_post( $new_post );
    
    if ( is_wp_error( $new_post_id ) ) {
        wp_die( __( 'Failed to duplicate the map!', 'cardmap' ) );
    }
    
    // Copy all post meta
    $post_meta = get_post_meta( $post_id );
    if ( $post_meta ) {
        foreach ( $post_meta as $meta_key => $meta_values ) {
            // Skip internal WordPress meta that shouldn't be copied
            if ( $meta_key === '_edit_lock' || $meta_key === '_edit_last' ) {
                continue;
            }
            
            foreach ( $meta_values as $meta_value ) {
                add_post_meta( $new_post_id, $meta_key, maybe_unserialize( $meta_value ) );
            }
        }
    }
    
    // Redirect to edit the new post
    wp_safe_redirect( admin_url( 'post.php?action=edit&post=' . $new_post_id ) );
    exit;
}
