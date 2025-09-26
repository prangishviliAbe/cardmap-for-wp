<?php

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/**
 * -------------------------
 * Settings Page
 * -------------------------
 */
add_action( 'admin_menu', function(){
    add_submenu_page(
        'edit.php?post_type=cardmap',
        'Card Map Settings',
        'Settings',
        'manage_options',
        'cardmap_settings',
        'cardmap_settings_page'
    );
});

add_action( 'admin_init', function(){
    register_setting( 'cardmap_settings_group', 'cardmap_enable_drag', [ 'type' => 'boolean', 'default' => true ] );
    register_setting( 'cardmap_settings_group', 'cardmap_line_color', [ 'type' => 'string', 'default' => '#A61832' ] );
    register_setting( 'cardmap_settings_group', 'cardmap_line_thickness', [ 'type' => 'integer', 'default' => 2 ] );
    register_setting( 'cardmap_settings_group', 'cardmap_line_style', [ 'type' => 'string', 'default' => 'straight-with-arrows' ] );
    register_setting( 'cardmap_settings_group', 'cardmap_node_styles', [ 'type' => 'string', 'default' => json_encode( [ 'default' => 'Default', 'highlight' => 'Highlight', 'muted' => 'Muted' ], JSON_PRETTY_PRINT ) ] );
    register_setting( 'cardmap_settings_group', 'cardmap_line_styles', [ 'type' => 'string', 'default' => json_encode( [ 'straight' => 'Straight', 'bezier' => 'Bezier', 'dashed' => 'Dashed', 'dotted' => 'Dotted', 'flowchart' => 'Flowchart' ], JSON_PRETTY_PRINT ) ] );
    register_setting( 'cardmap_settings_group', 'cardmap_enable_align_button', [ 'type' => 'boolean', 'default' => true ] );
    register_setting( 'cardmap_settings_group', 'cardmap_enable_connection_animation', [ 'type' => 'boolean', 'default' => false ] );
    register_setting( 'cardmap_settings_group', 'cardmap_connection_animation_type', [ 'type' => 'string', 'default' => 'draw' ] );
    register_setting( 'cardmap_settings_group', 'cardmap_connection_animation_duration', [ 'type' => 'integer', 'default' => 800 ] );
    register_setting( 'cardmap_settings_group', 'cardmap_enable_frontend_view', [ 'type' => 'boolean', 'default' => true ] );
    register_setting( 'cardmap_settings_group', 'cardmap_hover_effect', [ 'type' => 'string', 'default' => 'lift' ] );
});

function cardmap_settings_page() {
    if ( ! current_user_can( 'manage_options' ) ) {
        return;
    }
    ?>
    <div class="wrap cardmap-settings-wrap">
        <h1>Card Map Builder Pro — Settings</h1>
        
        <?php settings_errors(); ?>

        <form method="post" action="options.php">
            <?php settings_fields( 'cardmap_settings_group' ); ?>

            <div class="cardmap-settings-grid">
  
                <!-- General Settings Card -->
                <div class="settings-card">
                    <h2><span class="dashicons dashicons-admin-generic"></span> General Settings</h2>
                    <div class="card-content">
                        <div class="setting-item">
                            <div class="setting-header">
                                <label for="cardmap_enable_drag" class="setting-title">Enable dragging on frontend</label>
                                <label class="toggle-switch">
                                    <input type="checkbox" id="cardmap_enable_drag" name="cardmap_enable_drag" value="1" <?php checked(1, get_option('cardmap_enable_drag', 1) ); ?>>
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>
                            <p class="description">Allow visitors to drag cards on the frontend map.</p>
                        </div>
                        <div class="setting-item">
                            <div class="setting-header">
                                <label for="cardmap_enable_frontend_view" class="setting-title">Enable Frontend Map Display</label>
                                <label class="toggle-switch">
                                    <input type="checkbox" id="cardmap_enable_frontend_view" name="cardmap_enable_frontend_view" value="1" <?php checked(1, get_option('cardmap_enable_frontend_view', 1) ); ?>>
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>
                            <p class="description">Globally enable or disable the display of all card maps on the frontend.</p>
                        </div>
                    </div>
                </div>

                <!-- Appearance Settings Card -->
                <div class="settings-card">
                    <h2><span class="dashicons dashicons-admin-appearance"></span> Appearance</h2>
                    <div class="card-content">
                        <div class="setting-item">
                            <label for="cardmap_hover_effect" class="setting-title">Card Hover Effect</label>
                            <select id="cardmap_hover_effect" name="cardmap_hover_effect">
                                <?php $current_effect = get_option('cardmap_hover_effect', 'lift'); ?>
                                <option value="none" <?php selected($current_effect, 'none'); ?>>None</option>
                                <option value="lift" <?php selected($current_effect, 'lift'); ?>>Lift</option>
                                <option value="glow" <?php selected($current_effect, 'glow'); ?>>Glow</option>
                                <option value="zoom" <?php selected($current_effect, 'zoom'); ?>>Zoom</option>
                                <option value="border" <?php selected($current_effect, 'border'); ?>>Border Highlight</option>
                            </select>
                            <p class="description">Select the visual effect when a user hovers over a card on the frontend.</p>
                        </div>
                    </div>
                </div>

                <!-- Connection Settings Card -->
                <div class="settings-card">
                    <h2><span class="dashicons dashicons-admin-links"></span> Connection Settings</h2>
                    <div class="card-content">
                        <div class="setting-item">
                             <div class="setting-header">
                                <label for="cardmap_enable_connection_animation" class="setting-title">Enable Connection Animation</label>
                                <label class="toggle-switch">
                                    <input type="checkbox" id="cardmap_enable_connection_animation" name="cardmap_enable_connection_animation" value="1" <?php checked(1, get_option('cardmap_enable_connection_animation', 0) ); ?>>
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>
                            <p class="description">Animate connections when the map first loads on the frontend.</p>
                        </div>
                        <div class="setting-item">
                            <label for="cardmap_connection_animation_type" class="setting-title">Connection Animation Type</label>
                            <?php $anim_current = get_option('cardmap_connection_animation_type', 'draw');
                                $animation_options = [
                                    'draw' => 'Draw (stroke reveal)',
                                    'fade' => 'Fade In',
                                    'grow' => 'Grow (thickness)',
                                    'dash' => 'Dash Reveal',
                                    'wipe-left' => 'Wipe Left',
                                    'wipe-right' => 'Wipe Right',
                                    'bounce' => 'Bounce',
                                    'pulse' => 'Pulse',
                                    'slide-up' => 'Slide Up',
                                    'scale' => 'Scale'
                                ];
                            ?>
                            <select id="cardmap_connection_animation_type" name="cardmap_connection_animation_type">
                                <?php foreach ($animation_options as $k => $label) : ?>
                                    <option value="<?php echo esc_attr($k); ?>" <?php selected($anim_current, $k); ?>><?php echo esc_html($label); ?></option>
                                <?php endforeach; ?>
                            </select>
                            <p class="description">Choose the animation used for connections when the map loads (when animation is enabled).</p>
                        </div>
                        <div class="setting-item">
                            <label for="cardmap_line_color" class="setting-title">Connection Line Color</label>
                            <input type="color" id="cardmap_line_color" name="cardmap_line_color" value="<?php echo esc_attr( get_option('cardmap_line_color', '#A61832') ); ?>">
                            <p class="description">Default color for the lines connecting the cards.</p>
                        </div>
                        <div class="setting-item">
                            <label for="cardmap_line_thickness" class="setting-title">Connection Line Thickness (px)</label>
                            <input type="number" id="cardmap_line_thickness" name="cardmap_line_thickness" min="1" max="20" value="<?php echo esc_attr( get_option('cardmap_line_thickness', 2) ); ?>">
                            <p class="description">Default thickness for the connection lines.</p>
                        </div>
                        <div class="setting-item">
                            <label for="cardmap_line_style" class="setting-title">Default Connection Line Style</label>
                            <?php
                                $available = json_decode( get_option('cardmap_line_styles', json_encode( [ 'straight' => 'Straight', 'bezier' => 'Bezier', 'dashed' => 'Dashed', 'dotted' => 'Dotted', 'flowchart' => 'Flowchart' ], JSON_PRETTY_PRINT ) ), true );
                                $current = get_option('cardmap_line_style', 'straight-with-arrows');
                            ?>
                            <select id="cardmap_line_style" name="cardmap_line_style">
                                <?php foreach ($available as $k => $label) : ?>
                                    <option value="<?php echo esc_attr($k); ?>" <?php selected($current, $k); ?>><?php echo esc_html($label); ?></option>
                                <?php endforeach; ?>
                            </select>
                            <p class="description">Choose the default visual style for new connections.</p>
                        </div>
                    </div>
                </div>

                <!-- Editor Settings Card -->
                <div class="settings-card">
                    <h2><span class="dashicons dashicons-edit"></span> Editor Settings</h2>
                    <div class="card-content">
                        <div class="setting-item">
                            <div class="setting-header">
                                <label for="cardmap_enable_align_button" class="setting-title">Enable Card Alignment Button</label>
                                <label class="toggle-switch">
                                    <input type="checkbox" id="cardmap_enable_align_button" name="cardmap_enable_align_button" value="1" <?php checked(1, get_option('cardmap_enable_align_button', 1) ); ?>>
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>
                            <p class="description">Show the alignment tools button in the map editor.</p>
                        </div>
                    </div>
                </div>

                <!-- Advanced Settings Card -->
                <div class="settings-card">
                    <h2><span class="dashicons dashicons-admin-settings"></span> Advanced Configuration</h2>
                    <div class="card-content">
                        <div class="setting-item">
                            <label for="cardmap_node_styles" class="setting-title">Node Styles (JSON)</label>
                            <textarea id="cardmap_node_styles" name="cardmap_node_styles" rows="4"><?php echo esc_textarea( get_option('cardmap_node_styles', json_encode( [ 'default' => 'Default', 'highlight' => 'Highlight', 'muted' => 'Muted' ], JSON_PRETTY_PRINT ) ) ); ?></textarea>
                            <p class="description">JSON object of <code>style-key:label</code> pairs for node (card) styles in the editor, e.g., <code>{"default":"Default","highlight":"Highlight"}</code>.</p>
                        </div>
                        <div class="setting-item">
                            <label for="cardmap_line_styles" class="setting-title">Per-Connection Styles (JSON)</label>
                            <textarea id="cardmap_line_styles" name="cardmap_line_styles" rows="4"><?php echo esc_textarea( get_option('cardmap_line_styles', json_encode( [ 'straight' => 'Straight', 'bezier' => 'Bezier', 'dashed' => 'Dashed', 'dotted' => 'Dotted', 'flowchart' => 'Flowchart' ], JSON_PRETTY_PRINT ) ) ); ?></textarea>
                            <p class="description">JSON object of <code>style-key:label</code> pairs for connection styles in the editor, e.g., <code>{"straight":"Straight","dashed":"Dashed"}</code>.</p>
                        </div>
                    </div>
                </div>

            </div>

            <?php submit_button(); ?>
        </form>
    </div>
    <?php
}
