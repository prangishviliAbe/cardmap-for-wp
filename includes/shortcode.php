<?php

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

add_shortcode( 'cardmap', function( $atts ) {
    // Check the global setting first. If disabled, return nothing.
    if ( ! get_option( 'cardmap_enable_frontend_view', 1 ) ) {
        return '<!-- Cardmap display is disabled globally in settings. -->';
    }

    $atts = shortcode_atts( [ 'id' => 0 ], $atts, 'cardmap' );
    $post_id = intval( $atts['id'] );
    if ( ! $post_id ) {
        return '<!-- Cardmap: Invalid ID -->';
    }

    // Enqueue assets only when the shortcode is rendered
    wp_enqueue_style( 'cardmap-frontend-css' );
    wp_enqueue_script( 'cardmap-frontend-js' );

    // Fetch and decode map data
    $raw = get_post_meta( $post_id, '_cardmap_data', true );
    $map_data = $raw ? json_decode( $raw, true ) : [ 'nodes' => [], 'connections' => [], 'rails' => [] ];

    // Merge rails into nodes array
    if ( ! empty( $map_data['rails'] ) && is_array( $map_data['rails'] ) ) {
        foreach ( $map_data['rails'] as $rail ) {
            if ( isset( $rail['id'] ) ) {
                $map_data['nodes'][] = [
                    'id' => $rail['id'],
                    'x' => $rail['x'],
                    'y' => $rail['y'],
                    'is_rail' => true,
                    'width' => $rail['width'] ?? 0,
                    'height' => $rail['height'] ?? 0,
                    'orientation' => $rail['orientation'] ?? 'horizontal'
                ];
            }
        }
    }

    // Batch fetch all settings to reduce database queries
    $settings = [
        'line_color' => get_option( 'cardmap_line_color', '#A61832' ),
        'line_thickness' => get_option( 'cardmap_line_thickness', 2 ),
        'default_rail_thickness' => (int) get_option( 'cardmap_default_rail_thickness', 8 ),
        'enable_drag' => (bool) get_option( 'cardmap_enable_drag', 1 ),
        'enable_animation' => (bool) get_option( 'cardmap_enable_connection_animation', 0 ),
        'connection_animation_type' => get_option( 'cardmap_connection_animation_type', 'draw' ),
        'enable_captions' => (bool) get_option( 'cardmap_enable_captions', 1 ),
        'connection_animation_duration' => (int) get_option( 'cardmap_connection_animation_duration', 1200 ),
        'connection_animation_stagger' => (int) get_option( 'cardmap_connection_animation_stagger', 200 ),
        'show_rail_thickness' => (bool) get_option( 'cardmap_show_rail_thickness', 1 ),
        'hover_effect' => get_option( 'cardmap_hover_effect', 'lift' ),
        'initial_zoom' => (int) get_option( 'cardmap_initial_zoom', 100 ),
        'enable_rail_animation' => (bool) get_option( 'cardmap_enable_rail_animation', 0 ),
        'rail_animation_style' => get_option( 'cardmap_rail_animation_style', 'pulse' ),
        'background_image' => get_option( 'cardmap_background_image', '' ),
        'background_size' => get_option( 'cardmap_background_size', 'auto' ),
        'background_repeat' => get_option( 'cardmap_background_repeat', 'repeat' ),
    ];

    // Prepare data for localization
    $data_to_localize = array_merge( [ 'map_data' => $map_data ], $settings );
    cardmap_add_to_localized_data( $data_to_localize, $post_id );

    ob_start();
    $animation_class = $settings['enable_animation'] ? ' cardmap-animate-connections' : '';
    
    // Build background styles
    $background_styles = '';
    if ( !empty($settings['background_image']) ) {
        $background_styles = sprintf(
            'background-image: url(%s); background-size: %s; background-repeat: %s; background-position: center;',
            esc_url($settings['background_image']),
            esc_attr($settings['background_size']),
            esc_attr($settings['background_repeat'])
        );
    }
    ?>
    <div id="cardmap-frontend-<?php echo esc_attr( $post_id ); ?>" class="cardmap-frontend-wrapper<?php echo $animation_class; ?>" data-map-id="<?php echo esc_attr( $post_id ); ?>" style="width:100%;height:600px;border:1px solid #ddd;position:relative;overflow:hidden;<?php echo $background_styles; ?>">
        <div class="cardmap-viewport" style="width:100%;height:100%;position:absolute;top:0;left:0;">
            <div class="cardmap-pan-zoom-container" style="position:relative;width:1200px;height:1000px;">
                <?php if ( ! empty( $map_data['nodes'] ) ) : ?>
                    <?php $hover_effect = $settings['hover_effect']; ?>
                    <?php foreach ( $map_data['nodes'] as $node ) : 
                        if (isset($node['is_rail']) && $node['is_rail']) {
                            $orientation_class = isset($node['orientation']) && $node['orientation'] === 'vertical' ? 'vertical' : 'horizontal';
                            // If rail appearance properties exist in the rails array, pass them through as data attributes.
                            $rail_style = '';
                            $rail_color = '';
                            $rail_size = '';
                            // Attempt to find the corresponding rail data in original $map_data['rails']
                            if (!empty($map_data['rails']) && is_array($map_data['rails'])) {
                                foreach ($map_data['rails'] as $r) {
                                    if (isset($r['id']) && $r['id'] === $node['id']) {
                                        $rail_style = isset($r['railStyle']) ? $r['railStyle'] : (isset($r['rail_style']) ? $r['rail_style'] : '');
                                        $rail_color = isset($r['railColor']) ? $r['railColor'] : (isset($r['rail_color']) ? $r['rail_color'] : '');
                                        $rail_size = isset($r['size']) ? $r['size'] : (isset($r['rail_size']) ? $r['rail_size'] : '');
                                        break;
                                    }
                                }
                            }
                            echo '<div id="' . esc_attr( $node['id'] ) . '" class="cardmap-rail ' . $orientation_class . '" data-rail-style="' . esc_attr($rail_style) . '" data-rail-color="' . esc_attr($rail_color) . '" data-rail-size="' . esc_attr($rail_size) . '" style="left:' . esc_attr( $node['x'] ) . 'px;top:' . esc_attr( $node['y'] ) . 'px; width: ' . esc_attr($node['width']) . 'px; height: ' . esc_attr($node['height']) . 'px;"></div>';
                        } else {
                    ?>
                        <?php
                            $card_style = 'left:' . esc_attr( $node['x'] ) . 'px;top:' . esc_attr( $node['y'] ) . 'px;';
                            if ( isset($node['cardWidth']) ) $card_style .= 'width:' . esc_attr($node['cardWidth']) . 'px;';
                            if ( isset($node['cardHeight']) ) $card_style .= 'height:' . esc_attr($node['cardHeight']) . 'px;';
                        ?>
                        <div id="<?php echo esc_attr( $node['id'] ); ?>" class="cardmap-node hover-<?php echo esc_attr($hover_effect); ?> <?php echo isset($node['style']) ? 'style-'.esc_attr($node['style']) : 'style-default'; ?>" style="<?php echo $card_style; ?>">
                            <?php if ( ! empty( $node['link'] ) ) : ?>
                                <a href="<?php echo esc_url( $node['link'] ); ?>" target="<?php echo esc_attr( $node['target'] ?? '_self' ); ?>">
                            <?php endif; ?>
                            
                            <div class="node-image-wrapper">
                                <?php if ( ! empty( $node['image'] ) ) : ?>
                                    <div class="node-image"><img src="<?php echo esc_url( $node['image'] ); ?>" alt="<?php echo esc_attr( $node['caption'] ?? '' ); ?>"></div>
                                <?php endif; ?>
                                <?php if ( $settings['enable_captions'] && ! empty( $node['caption'] ) ) : ?>
                                    <div class="card-caption" style="<?php echo isset($node['fontSize']) ? 'font-size:' . esc_attr($node['fontSize']) . 'px;' : ''; ?>"><?php echo esc_html( $node['caption'] ); ?></div>
                                <?php endif; ?>
                            </div>
                            <div class="card-title" style="<?php echo isset($node['fontSize']) ? 'font-size:' . esc_attr($node['fontSize']) . 'px;' : ''; ?>"><?php echo esc_html( $node['text'] ); ?></div>

                            <?php if ( ! empty( $node['link'] ) ) : ?>
                                </a>
                            <?php endif; ?>
                        </div>
                    <?php 
                        }
                    endforeach; 
                    ?>
                <?php endif; ?>
                 
            </div>
        </div>
        <div class="cardmap-controls">
            <div class="zoom-controls">
                <button class="zoom-in">+</button>
                <div id="cardmap-zoom-display-<?php echo esc_attr( $post_id ); ?>" class="cardmap-zoom-display">100%</div>
                <button class="zoom-out">-</button>
            </div>
            <button class="cardmap-fullscreen-btn" title="Toggle fullscreen">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
                </svg>
            </button>
        </div>
    </div>
    <?php
    return ob_get_clean();
});
