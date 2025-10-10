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
    register_setting( 'cardmap_settings_group', 'cardmap_line_styles', [ 'type' => 'string', 'default' => json_encode( [ 'straight' => 'Straight', 'straight-with-arrows' => 'Straight with Arrows', 'bezier' => 'Bezier', 'dashed' => 'Dashed', 'dotted' => 'Dotted', 'flowchart' => 'Flowchart', 'flowchart-with-arrows' => 'Flowchart with Arrows' ], JSON_PRETTY_PRINT ) ] );
    register_setting( 'cardmap_settings_group', 'cardmap_enable_auto_align', [ 'type' => 'boolean', 'default' => true ] );
    register_setting( 'cardmap_settings_group', 'cardmap_enable_connection_animation', [ 'type' => 'boolean', 'default' => false ] );
    register_setting( 'cardmap_settings_group', 'cardmap_connection_animation_type', [ 'type' => 'string', 'default' => 'draw' ] );
    register_setting( 'cardmap_settings_group', 'cardmap_connection_animation_duration', [ 'type' => 'integer', 'default' => 800 ] );
    register_setting( 'cardmap_settings_group', 'cardmap_show_rail_thickness', [ 'type' => 'boolean', 'default' => true ] );
    register_setting( 'cardmap_settings_group', 'cardmap_enable_frontend_view', [ 'type' => 'boolean', 'default' => true ] );
    register_setting( 'cardmap_settings_group', 'cardmap_hover_effect', [ 'type' => 'string', 'default' => 'lift' ] );
});

/**
 * Export/Import Settings Functions
 */
function cardmap_export_settings() {
    if (!wp_verify_nonce($_POST['nonce'], 'cardmap_export_import')) {
        wp_die('Security check failed');
    }

    if (!current_user_can('manage_options')) {
        wp_die('Insufficient permissions');
    }

    $settings_to_export = [
        'cardmap_enable_drag',
        'cardmap_line_color',
        'cardmap_line_thickness',
        'cardmap_line_style',
        'cardmap_node_styles',
        'cardmap_line_styles',
        'cardmap_enable_auto_align',
        'cardmap_enable_connection_animation',
        'cardmap_connection_animation_type',
        'cardmap_connection_animation_duration',
        'cardmap_show_rail_thickness',
        'cardmap_enable_frontend_view',
        'cardmap_hover_effect'
    ];

    $export_data = [];
    foreach ($settings_to_export as $setting) {
        $export_data[$setting] = get_option($setting);
    }

    $export_data['export_timestamp'] = current_time('mysql');
    $export_data['plugin_version'] = '1.6.2';

    wp_send_json_success([
        'data' => $export_data,
        'filename' => 'cardmap-settings-' . date('Y-m-d-H-i-s') . '.json'
    ]);
}

function cardmap_import_settings() {
    if (!wp_verify_nonce($_POST['nonce'], 'cardmap_export_import')) {
        wp_die('Security check failed');
    }

    if (!current_user_can('manage_options')) {
        wp_die('Insufficient permissions');
    }

    if (empty($_FILES['import_file']['tmp_name'])) {
        wp_send_json_error('No file uploaded');
    }

    $file_content = file_get_contents($_FILES['import_file']['tmp_name']);
    if (!$file_content) {
        wp_send_json_error('Could not read file');
    }

    $import_data = json_decode($file_content, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        wp_send_json_error('Invalid JSON file');
    }

    if (!isset($import_data['cardmap_line_color'])) {
        wp_send_json_error('Invalid settings file format');
    }

    $imported_count = 0;
    $settings_to_import = [
        'cardmap_enable_drag',
        'cardmap_line_color',
        'cardmap_line_thickness',
        'cardmap_line_style',
        'cardmap_node_styles',
        'cardmap_line_styles',
        'cardmap_enable_auto_align',
        'cardmap_enable_connection_animation',
        'cardmap_connection_animation_type',
        'cardmap_connection_animation_duration',
        'cardmap_show_rail_thickness',
        'cardmap_enable_frontend_view',
        'cardmap_hover_effect'
    ];

    foreach ($settings_to_import as $setting) {
        if (isset($import_data[$setting])) {
            update_option($setting, $import_data[$setting]);
            $imported_count++;
        }
    }

    wp_send_json_success([
        'message' => sprintf('%d settings imported successfully', $imported_count),
        'imported_count' => $imported_count
    ]);
}

add_action('wp_ajax_cardmap_export_settings', 'cardmap_export_settings');
add_action('wp_ajax_cardmap_import_settings', 'cardmap_import_settings');

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
                        <!-- Show Rail Thickness moved to Editor Settings -->
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
                                <label for="cardmap_enable_auto_align" class="setting-title">Enable Auto-Align Button</label>
                                <label class="toggle-switch">
                                    <input type="checkbox" id="cardmap_enable_auto_align" name="cardmap_enable_auto_align" value="1" <?php checked(1, get_option('cardmap_enable_auto_align', 1) ); ?>>
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>
                            <p class="description">Show the Auto-Align button in the editor toolbar. This feature intelligently aligns cards that are positioned close to each other horizontally or vertically, distributing them proportionally for a cleaner layout.</p>
                        </div>
                        <div class="setting-item">
                            <div class="setting-header">
                                <label for="cardmap_show_rail_thickness" class="setting-title">Show Rail Thickness</label>
                                <label class="toggle-switch">
                                    <input type="checkbox" id="cardmap_show_rail_thickness" name="cardmap_show_rail_thickness" value="1" <?php checked(1, get_option('cardmap_show_rail_thickness', 1) ); ?>>
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>
                            <p class="description">Toggle whether the rail thickness (the visible bar) is shown in the editor and on the frontend.</p>
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
                            <textarea id="cardmap_line_styles" name="cardmap_line_styles" rows="4"><?php echo esc_textarea( get_option('cardmap_line_styles', json_encode( [ 'straight' => 'Straight', 'straight-with-arrows' => 'Straight with Arrows', 'bezier' => 'Bezier', 'dashed' => 'Dashed', 'dotted' => 'Dotted', 'flowchart' => 'Flowchart', 'flowchart-with-arrows' => 'Flowchart with Arrows' ], JSON_PRETTY_PRINT ) ) ); ?></textarea>
                            <p class="description">JSON object of <code>style-key:label</code> pairs for connection styles in the editor, e.g., <code>{"straight":"Straight","dashed":"Dashed"}</code>.</p>
                        </div>
                    </div>
                </div>

                <!-- Import/Export Settings Card -->
                <div class="settings-card">
                    <h2><span class="dashicons dashicons-database-import"></span> Import / Export Settings</h2>
                    <div class="card-content">
                        <div class="setting-item">
                            <h4>Export Settings</h4>
                            <p class="description">Download your current plugin settings as a JSON file for backup or to use on another site.</p>
                            <button type="button" id="cardmap-export-settings" class="button button-secondary">
                                <span class="dashicons dashicons-download"></span> Export Settings
                            </button>
                        </div>
                        <div class="setting-item">
                            <h4>Import Settings</h4>
                            <p class="description">Upload a previously exported settings file to restore or apply settings from another site.</p>
                            <div class="import-settings-container">
                                <input type="file" id="cardmap-import-file" accept=".json" style="display: none;">
                                <button type="button" id="cardmap-import-trigger" class="button button-secondary">
                                    <span class="dashicons dashicons-upload"></span> Choose File & Import
                                </button>
                                <div id="cardmap-import-status" class="import-status" style="display: none; margin-top: 10px;"></div>
                            </div>
                        </div>
                        <div class="setting-item">
                            <div class="export-info">
                                <strong>What gets exported:</strong> All plugin settings including colors, styles, animation preferences, and configuration options.
                                <br><em>Note: This does not export your actual card maps - only the plugin settings and preferences.</em>
                            </div>
                        </div>
                    </div>
                </div>

            </div>

            <?php submit_button(); ?>
        </form>

        <!-- Export/Import JavaScript -->
        <script>
        document.addEventListener('DOMContentLoaded', function() {
            const exportBtn = document.getElementById('cardmap-export-settings');
            const importTrigger = document.getElementById('cardmap-import-trigger');
            const importFile = document.getElementById('cardmap-import-file');
            const importStatus = document.getElementById('cardmap-import-status');

            // Export functionality
            if (exportBtn) {
                exportBtn.addEventListener('click', function() {
                    exportBtn.disabled = true;
                    exportBtn.innerHTML = '<span class="dashicons dashicons-update-alt"></span> Exporting...';

                    fetch(ajaxurl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded',
                        },
                        body: new URLSearchParams({
                            action: 'cardmap_export_settings',
                            nonce: '<?php echo wp_create_nonce('cardmap_export_import'); ?>'
                        })
                    })
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            // Create and download file
                            const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' });
                            const url = window.URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = data.data.filename || 'cardmap-settings.json';
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            window.URL.revokeObjectURL(url);

                            showImportStatus('Settings exported successfully!', 'success');
                        } else {
                            showImportStatus('Export failed: ' + (data.data || 'Unknown error'), 'error');
                        }
                    })
                    .catch(error => {
                        console.error('Export error:', error);
                        showImportStatus('Export failed: ' + error.message, 'error');
                    })
                    .finally(() => {
                        exportBtn.disabled = false;
                        exportBtn.innerHTML = '<span class="dashicons dashicons-download"></span> Export Settings';
                    });
                });
            }

            // Import trigger
            if (importTrigger) {
                importTrigger.addEventListener('click', function() {
                    importFile.click();
                });
            }

            // Import file selection
            if (importFile) {
                importFile.addEventListener('change', function() {
                    if (this.files.length > 0) {
                        const file = this.files[0];
                        importTrigger.innerHTML = '<span class="dashicons dashicons-upload"></span> Importing...';
                        importTrigger.disabled = true;

                        const formData = new FormData();
                        formData.append('action', 'cardmap_import_settings');
                        formData.append('nonce', '<?php echo wp_create_nonce('cardmap_export_import'); ?>');
                        formData.append('import_file', file);

                        fetch(ajaxurl, {
                            method: 'POST',
                            body: formData
                        })
                        .then(response => response.json())
                        .then(data => {
                            if (data.success) {
                                showImportStatus(data.data.message || 'Settings imported successfully!', 'success');
                                // Reload page after successful import to show updated settings
                                setTimeout(() => {
                                    window.location.reload();
                                }, 1500);
                            } else {
                                showImportStatus('Import failed: ' + (data.data || 'Unknown error'), 'error');
                            }
                        })
                        .catch(error => {
                            console.error('Import error:', error);
                            showImportStatus('Import failed: ' + error.message, 'error');
                        })
                        .finally(() => {
                            importTrigger.disabled = false;
                            importTrigger.innerHTML = '<span class="dashicons dashicons-upload"></span> Choose File & Import';
                            this.value = ''; // Reset file input
                        });
                    }
                });
            }

            function showImportStatus(message, type) {
                importStatus.textContent = message;
                importStatus.className = 'import-status ' + type;
                importStatus.style.display = 'block';

                // Auto-hide after 5 seconds
                setTimeout(() => {
                    importStatus.style.display = 'none';
                }, 5000);
            }
        });
        </script>
    </div>
    <?php
}
