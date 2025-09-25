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

add_action( 'wp_ajax_generate_post_hierarchy_map', function() {
    if ( ! isset( $_POST['nonce'] ) || ! wp_verify_nonce( $_POST['nonce'], 'cardmap_save' ) ) {
        wp_send_json_error( 'Nonce verification failed', 403 );
    }
    if ( ! current_user_can( 'edit_posts' ) ) {
        wp_send_json_error( 'Unauthorized', 403 );
    }

    $post_type = isset( $_POST['post_type'] ) ? sanitize_text_field( $_POST['post_type'] ) : 'page';

    if ( ! post_type_exists( $post_type ) || ! is_post_type_hierarchical( $post_type ) ) {
        wp_send_json_error( 'Invalid post type.' );
    }

    $posts = get_posts([
        'post_type' => $post_type,
        'post_status' => 'publish',
        'numberposts' => -1,
        'orderby' => 'menu_order title',
        'order' => 'ASC',
    ]);

    $nodes = [];
    $connections = [];
    $node_map = []; // post_id => node_id

    // Create nodes
    foreach ( $posts as $p ) {
        $node_id = 'node_' . $p->ID;
        $nodes[] = [
            'id' => $node_id,
            'text' => $p->post_title,
            'x' => 0, 'y' => 0, // Positions will be calculated later
            'caption' => '',
            'image' => get_the_post_thumbnail_url( $p->ID, 'medium' ) ?: '',
            'link' => get_permalink( $p->ID ),
            'target' => '_self',
            'style' => 'default',
            'post_id' => $p->ID,
            'parent_id' => $p->post_parent,
        ];
        $node_map[$p->ID] = $node_id;
    }

    // Create connections
    foreach ( $nodes as $node ) {
        if ( $node['parent_id'] != 0 && isset( $node_map[$node['parent_id']] ) ) {
            $connections[] = [
                'source' => $node_map[$node['parent_id']],
                'target' => $node['id'],
                'id' => 'conn_' . $node_map[$node['parent_id']] . '_' . $node['id'],
            ];
        }
    }
    
    // Simple auto-layout (Sugiyama-style basic)
    $levels = [];
    $node_objects = array_combine(array_column($nodes, 'post_id'), $nodes);

    // Determine level for each node
    foreach ($node_objects as $id => &$node) {
        $level = 0;
        $p = $node['parent_id'];
        while ($p != 0 && isset($node_objects[$p])) {
            $p = $node_objects[$p]['parent_id'];
            $level++;
        }
        $node['level'] = $level;
        if (!isset($levels[$level])) {
            $levels[$level] = [];
        }
        $levels[$level][] = $id;
    }
    unset($node);

    // Assign positions
    $y_gap = 250;
    $x_gap = 300;
    foreach ($levels as $level => $level_nodes) {
        $y = $level * $y_gap;
        $total_width = count($level_nodes) * $x_gap;
        $x_start = -$total_width / 2;
        foreach ($level_nodes as $i => $node_id) {
            $x = $x_start + $i * $x_gap;
            $node_objects[$node_id]['x'] = $x + 600; // Center it roughly
            $node_objects[$node_id]['y'] = $y;
        }
    }

    wp_send_json_success([
        'nodes' => array_values($node_objects),
        'connections' => $connections,
    ]);
});
