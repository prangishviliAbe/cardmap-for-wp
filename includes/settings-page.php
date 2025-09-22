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
    register_setting( 'cardmap_settings_group', 'cardmap_node_styles', [ 'type' => 'string', 'default' => json_encode( [ 'default' => 'Default', 'highlight' => 'Highlight', 'muted' => 'Muted' ] ) ] );
    register_setting( 'cardmap_settings_group', 'cardmap_line_styles', [ 'type' => 'string', 'default' => json_encode( [ 'straight' => 'Straight', 'bezier' => 'Bezier', 'dashed' => 'Dashed', 'dotted' => 'Dotted', 'flowchart' => 'Flowchart' ] ) ] );
    register_setting( 'cardmap_settings_group', 'cardmap_enable_align_button', [ 'type' => 'boolean', 'default' => true ] );
});

function cardmap_settings_page() {
    if ( ! current_user_can( 'manage_options' ) ) {
        return;
    }
    ?>
    <div class="wrap">
        <h1>Card Map Builder Pro — Settings</h1>
        <form method="post" action="options.php">
            <?php settings_fields( 'cardmap_settings_group' ); do_settings_sections( 'cardmap_settings_group' ); ?>
            <table class="form-table">
                <tr>
                    <th scope="row">Enable dragging on frontend</th>
                    <td>
                        <label><input type="checkbox" name="cardmap_enable_drag" value="1" <?php checked(1, get_option('cardmap_enable_drag', 1) ); ?>> Allow visitors to drag cards on the frontend</label>
                    </td>
                </tr>
                <tr>
                    <th scope="row">Per-connection styles (JSON map)</th>
                    <td>
                        <textarea name="cardmap_line_styles" rows="3" style="width:100%;box-sizing:border-box;"><?php echo esc_textarea( get_option('cardmap_line_styles', json_encode( [ 'straight' => 'Straight', 'bezier' => 'Bezier', 'dashed' => 'Dashed', 'dotted' => 'Dotted', 'flowchart' => 'Flowchart' ] ) ) ); ?></textarea>
                        <p class="description">Provide a JSON object of style-key:label pairs for connection styles, e.g. <code>{"straight":"Straight","dashed":"Dashed"}</code></p>
                    </td>
                </tr>
                <tr>
                    <th scope="row">Connection line color</th>
                    <td>
                        <input type="color" name="cardmap_line_color" value="<?php echo esc_attr( get_option('cardmap_line_color', '#A61832') ); ?>">
                    </td>
                </tr>
                <tr>
                    <th scope="row">Connection line thickness (px)</th>
                    <td>
                        <input type="number" name="cardmap_line_thickness" min="1" max="20" value="<?php echo esc_attr( get_option('cardmap_line_thickness', 2) ); ?>">
                    </td>
                </tr>
                <tr>
                    <th scope="row">Connection line style</th>
                    <td>
                        <select name="cardmap_line_style">
                            <option value="bezier" <?php selected( get_option('cardmap_line_style'), 'bezier' ); ?>>Bezier (curved)</option>
                            <option value="straight" <?php selected( get_option('cardmap_line_style'), 'straight' ); ?>>Straight</option>
                            <option value="flowchart" <?php selected( get_option('cardmap_line_style'), 'flowchart' ); ?>>Flowchart (90-degree angles)</option>
                            <option value="state-machine" <?php selected( get_option('cardmap_line_style'), 'state-machine' ); ?>>State Machine (curved with rounded corners)</option>
                            <option value="straight-with-arrows" <?php selected( get_option('cardmap_line_style'), 'straight-with-arrows' ); ?>>Straight with Arrows</option>
                            <option value="flowchart-with-arrows" <?php selected( get_option('cardmap_line_style'), 'flowchart-with-arrows' ); ?>>Flowchart with Arrows</option>
                            <option value="diagonal" <?php selected( get_option('cardmap_line_style'), 'diagonal' ); ?>>Diagonal</option>
                            <option value="rounded-bezier" <?php selected( get_option('cardmap_line_style'), 'rounded-bezier' ); ?>>Bezier with Rounded Ends</option>
                            <option value="dashed" <?php selected( get_option('cardmap_line_style'), 'dashed' ); ?>>Dashed Line</option>
                            <option value="dotted" <?php selected( get_option('cardmap_line_style'), 'dotted' ); ?>>Dotted Line</option>
                        </select>
                    </td>
                </tr>
                <tr>
                    <th scope="row">Node styles (JSON map)</th>
                    <td>
                        <textarea name="cardmap_node_styles" rows="3" style="width:100%;box-sizing:border-box;"><?php echo esc_textarea( get_option('cardmap_node_styles', json_encode( [ 'default' => 'Default', 'highlight' => 'Highlight', 'muted' => 'Muted' ] ) ) ); ?></textarea>
                        <p class="description">Provide a JSON object of style-key:label pairs, e.g. <code>{"default":"Default","highlight":"Highlight"}</code></p>
                    </td>
                </tr>
                 <tr>
                    <th scope="row">Enable Card Alignment Button</th>
                    <td>
                        <label><input type="checkbox" name="cardmap_enable_align_button" value="1" <?php checked(1, get_option('cardmap_enable_align_button', 1) ); ?>> Show the 'Align Cards' button in the editor toolbar</label>
                    </td>
                </tr>
            </table>
            <?php submit_button(); ?>
        </form>
    </div>
    <?php
}
