<?php

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

add_action( 'wp_ajax_save_cardmap', function() {
    if ( ! isset( $_POST['nonce'] ) || ! wp_verify_nonce( $_POST['nonce'], 'cardmap_save' ) ) {
        wp_send_json_error( 'Nonce verification failed', 403 );
    }

    if ( ! current_user_can( 'edit_posts' ) ) {
        wp_send_json_error( 'Unauthorized', 403 );
    }

    $post_id = isset( $_POST['post_id'] ) ? intval( $_POST['post_id'] ) : 0;
    $data = isset( $_POST['data'] ) ? wp_unslash( $_POST['data'] ) : '';

    if ( $post_id && ! empty( $data ) ) {
        // Basic data validation
        $decoded_data = json_decode( $data, true );
        if ( json_last_error() === JSON_ERROR_NONE && is_array( $decoded_data ) ) {
            update_post_meta( $post_id, '_cardmap_data', wp_slash($data) );
            wp_send_json_success( 'Map saved successfully.' );
        } else {
            wp_send_json_error( 'Invalid data format.' );
        }
    } else {
        wp_send_json_error( 'Missing post ID or data.' );
    }
} );
