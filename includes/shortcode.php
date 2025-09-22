<?php

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

add_shortcode( 'cardmap', function( $atts ) {
    $atts = shortcode_atts( [ 'id' => 0 ], $atts, 'cardmap' );
    $post_id = intval( $atts['id'] );
    if ( ! $post_id ) {
        return '<!-- Cardmap: Invalid ID -->';
    }

    // Enqueue assets only when the shortcode is rendered.
    wp_enqueue_style( 'cardmap-frontend-css' );
    wp_enqueue_script( 'cardmap-frontend-js' );

    $raw = get_post_meta( $post_id, '_cardmap_data', true );
    $map_data = $raw ? json_decode( $raw, true ) : [ 'nodes' => [], 'connections' => [] ];

    // Prepare data for localization and add it to the global array.
    $data_to_localize = [
        'map_data' => $map_data,
        'line_color' => get_option( 'cardmap_line_color', '#A61832' ),
        'line_thickness' => get_option( 'cardmap_line_thickness', 2 ),
        'enable_drag' => (bool) get_option( 'cardmap_enable_drag', 1 ),
        'enable_animation' => (bool) get_option( 'cardmap_enable_connection_animation', 0 ),
    ];
    cardmap_add_to_localized_data($data_to_localize, $post_id);

    ob_start();
    ?>
    <div id="cardmap-frontend-<?php echo esc_attr( $post_id ); ?>" class="cardmap-frontend-wrapper" data-map-id="<?php echo esc_attr( $post_id ); ?>" style="width:100%;height:600px;border:1px solid #ddd;position:relative;overflow:hidden;">
        <div class="cardmap-viewport" style="width:100%;height:100%;position:absolute;top:0;left:0;">
            <div class="cardmap-pan-zoom-container" style="position:relative;width:1200px;height:1000px;">
                <?php if (isset($map_data['nodes'])) : ?>
                    <?php foreach ( $map_data['nodes'] as $node ) : ?>
                        <div id="<?php echo esc_attr( $node['id'] ); ?>" class="cardmap-node <?php echo isset($node['style']) ? 'style-'.esc_attr($node['style']) : 'style-default'; ?>" style="left:<?php echo esc_attr( $node['x'] ); ?>px;top:<?php echo esc_attr( $node['y'] ); ?>px;">
                            <?php if ( ! empty( $node['link'] ) ) : ?>
                                <a href="<?php echo esc_url( $node['link'] ); ?>" target="<?php echo esc_attr( $node['target'] ?? '_self' ); ?>">
                            <?php endif; ?>
                            
                            <div class="node-image-wrapper">
                                <?php if ( ! empty( $node['image'] ) ) : ?>
                                    <div class="node-image"><img src="<?php echo esc_url( $node['image'] ); ?>" alt="<?php echo esc_attr( $node['caption'] ?? '' ); ?>"></div>
                                <?php endif; ?>
                                <?php if ( ! empty( $node['caption'] ) ) : ?>
                                    <div class="card-caption"><?php echo esc_html( $node['caption'] ); ?></div>
                                <?php endif; ?>
                            </div>
                            <div class="card-title"><?php echo esc_html( $node['text'] ); ?></div>

                            <?php if ( ! empty( $node['link'] ) ) : ?>
                                </a>
                            <?php endif; ?>
                        </div>
                    <?php endforeach; ?>
                <?php endif; ?>
                 <?php if (isset($map_data['rails'])) : ?>
                    <?php foreach ( $map_data['rails'] as $rail ) : ?>
                        <div id="<?php echo esc_attr( $rail['id'] ); ?>" class="cardmap-rail <?php echo isset($rail['orientation']) && $rail['orientation'] === 'vertical' ? 'vertical' : ''; ?>" style="left:<?php echo esc_attr( $rail['x'] ); ?>px;top:<?php echo esc_attr( $rail['y'] ); ?>px; width: <?php echo esc_attr($rail['width'] ?? 0); ?>px; height: <?php echo esc_attr($rail['height'] ?? 0); ?>px;"></div>
                    <?php endforeach; ?>
                <?php endif; ?>
            </div>
        </div>
        <div class="cardmap-controls">
            <div class="zoom-controls">
                <button class="zoom-in">+</button>
                <div id="cardmap-zoom-display-<?php echo esc_attr( $post_id ); ?>" class="cardmap-zoom-display">100%</div>
                <button class="zoom-out">-</button>
            </div>
            <button class="cardmap-fullscreen-btn">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
            </button>
        </div>
    </div>
    <?php
    return ob_get_clean();
});
