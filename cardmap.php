<?php
/*
Plugin Name: Card Map Builder Pro
Description: Draggable card maps with images, captions, links, connections, admin editor + settings, and frontend shortcode with zoom/pan/fullscreen.
Version: 4.9
Author: Abe
Text Domain: cardmap-for-wp
*/

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
    register_setting( 'cardmap_settings_group', 'cardmap_line_style', [ 'type' => 'string', 'default' => 'bezier' ] );
    register_setting( 'cardmap_settings_group', 'cardmap_enable_align_button', [ 'type' => 'boolean', 'default' => false ] );
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
                    <th scope="row">Enable Card Alignment Button</th>
                    <td>
                        <label><input type="checkbox" name="cardmap_enable_align_button" value="1" <?php checked(1, get_option('cardmap_enable_align_button', 0) ); ?>> Show the 'Align Cards' button in the editor toolbar</label>
                    </td>
                </tr>
            </table>
            <?php submit_button(); ?>
        </form>
    </div>
    <?php
}

/**
 * -------------------------
 * Admin: Meta Box + Editor
 * -------------------------
 */
add_action( 'add_meta_boxes', function(){
    add_meta_box( 'cardmap_editor', 'Card Map Editor', 'cardmap_editor_callback', 'cardmap', 'normal', 'high' );
});

add_action( 'admin_enqueue_scripts', function( $hook ) {
    if ( $hook === 'post.php' || $hook === 'post-new.php' ) {
        $screen = get_current_screen();
        if ( $screen && $screen->post_type === 'cardmap' ) {
            wp_enqueue_media();
            wp_enqueue_script( 'jsplumb-cdn', 'https://cdnjs.cloudflare.com/ajax/libs/jsPlumb/2.15.6/js/jsplumb.min.js', [], null, true );
            wp_enqueue_script( 'cardmap-admin', plugin_dir_url( __FILE__ ) . 'assets/js/admin.js', [ 'jsplumb-cdn' ], filemtime( plugin_dir_path( __FILE__ ) . 'assets/js/admin.js' ), true );
            wp_enqueue_style( 'cardmap-admin-css', plugin_dir_url( __FILE__ ) . 'assets/css/admin.css', [], filemtime( plugin_dir_path( __FILE__ ) . 'assets/css/admin.css' ) );
            // Localize admin data for per-post use
            $raw = get_post_meta( get_the_ID(), '_cardmap_data', true );
            $decoded_raw = $raw ? ( is_string( $raw ) ? json_decode( wp_unslash( $raw ), true ) : $raw ) : [ 'nodes' => [], 'connections' => [] ];
            if ( ! is_array( $decoded_raw ) ) $decoded_raw = [ 'nodes' => [], 'connections' => [] ];
            wp_localize_script( 'cardmap-admin', 'cardmapAdminData', [
                'postId' => get_the_ID(),
                'ajaxUrl' => admin_url( 'admin-ajax.php' ),
                'lineStyle' => get_option( 'cardmap_line_style', 'bezier' ),
                'lineColor' => get_option( 'cardmap_line_color', '#A61832' ),
                'lineThickness' => intval( get_option( 'cardmap_line_thickness', 2) ),
                'enableAlignButton' => (bool) get_option('cardmap_enable_align_button', 0),
                'mapData' => $decoded_raw,
                'nonce' => wp_create_nonce( 'save_cardmap_' . get_the_ID() ),
            ] );
        }
    }
});

function cardmap_editor_callback( $post ) {
    $raw = get_post_meta( $post->ID, '_cardmap_data', true );
    $decoded_raw = $raw ? ( is_string( $raw ) ? json_decode( wp_unslash( $raw ), true ) : $raw ) : [ 'nodes' => [], 'connections' => [] ];
    if ( ! is_array( $decoded_raw ) ) {
        $decoded_raw = [ 'nodes' => [], 'connections' => [] ];
    }

    $admin_drag = get_option( 'cardmap_enable_drag', 1 ) ? 1 : 0;
    $line_color = esc_js( get_option( 'cardmap_line_color', '#A61832' ) );
    $line_thickness = intval( get_option( 'cardmap_line_thickness', 2) );
    $line_style = esc_js( get_option( 'cardmap_line_style', 'bezier') );
    $enable_align_button = get_option('cardmap_enable_align_button', 0);
    $ajax_url = admin_url( 'admin-ajax.php' );
    ?>
    <div id="cardmap-toolbar" style="margin-bottom:10px;">
        <button type="button" class="button" id="add-node">+ Add Card</button>
        <button type="button" class="button" id="connect-mode">🔗 Connect</button>
        <button type="button" class="button" id="delete-node">❌ Delete Node</button>
        <?php if ($enable_align_button) : ?>
            <button type="button" class="button button-secondary" id="align-nodes">🧹 Align Cards</button>
        <?php endif; ?>
        <button type="button" class="button button-secondary" id="fullscreen-editor">⛶ Fullscreen</button>
        <button type="button" class="button button-primary" id="save-map">💾 Save</button>
    </div>

    <div id="cardmap-editor-wrapper" style="width:100%;height:520px;border:1px solid #ddd;position:relative;overflow:hidden;background:#fafafa; cursor:grab;">
        <div id="cardmap-editor" style="position:relative;width:1200px;height:1000px;"></div>
    </div>

    <input type="hidden" id="cardmap_post_id" value="<?php echo esc_attr( $post->ID ); ?>">
    // Enqueue frontend assets and localize the data
    wp_enqueue_style( 'cardmap-frontend-css', plugin_dir_url( __FILE__ ) . 'assets/css/frontend.css', [], filemtime( plugin_dir_path( __FILE__ ) . 'assets/css/frontend.css' ) );
    wp_enqueue_script( 'jsplumb-cdn-frontend', 'https://cdnjs.cloudflare.com/ajax/libs/jsPlumb/2.15.6/js/jsplumb.min.js', [], null, true );
    wp_enqueue_script( 'cardmap-frontend', plugin_dir_url( __FILE__ ) . 'assets/js/frontend.js', [ 'jsplumb-cdn-frontend' ], filemtime( plugin_dir_path( __FILE__ ) . 'assets/js/frontend.js' ), true );
    wp_localize_script( 'cardmap-frontend', 'cardmapFrontendData', [
        'containerId' => 'cardmap-frontend-' . esc_attr( $post_id ),
        'mapData' => json_decode( $data_json, true ),
        'lineStyle' => $line_style,
        'lineColor' => $line_color,
        'lineThickness' => $line_thickness,
        'enableDrag' => ( get_option( 'cardmap_enable_drag', 1 ) ? true : false ),
    ] );

    ob_start();
    ?>
    <div class="cardmap-frontend-wrapper" style="position:relative; width:100%; height:600px; border:1px solid #ddd; overflow:hidden; background-color:#f8f9fa; background-image:url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTAgMGgwNHY0MEgwWiIgZmlsbD0iI2U5ZmVmZSIvPjxwYXRoIGQ9Ik00MCAwSDQwdi00MEgwWiIgZmlsbD0iI2YyZjVmNiIvPjwvc3ZnPg=='); cursor: grab;">
        <div class="cardmap-controls" style="position:absolute;bottom:18px;left:18px;z-index:1200; display:flex;flex-direction:column;gap:10px;">
            <button class="cardmap-zoom-btn" data-zoom="in" aria-label="Zoom in">+</button>
            <button class="cardmap-zoom-btn" data-zoom="out" aria-label="Zoom out">−</button>
            <button class="cardmap-zoom-btn" data-zoom="fullscreen" title="Fullscreen" aria-label="Fullscreen">⛶</button>
            <div id="cardmap-zoom-display" style="color:#A61832;font-weight:700;font-size:18px;padding-top:5px;"></div>
        </div>
        <div id="cardmap-frontend-<?php echo esc_attr($post_id); ?>" style="position:relative; transform-origin:0 0; transition: transform 0.3s ease-out; width:1200px; height:1000px;"></div>
    </div>
    <?php
    return ob_get_clean();
            });
        }

        function loadMap(){
            mapData.nodes.forEach(n => renderNode(n));
            setTimeout(() => {
                (mapData.connections || []).forEach(c => {
                    if (document.getElementById(c.source) && document.getElementById(c.target)) {
                        instance.connect({
                            source: c.source, target: c.target,
                            anchors: ["Bottom","Top"],
                            endpoint: ["Dot",{ radius: 5 }],
                            ...getConnectorConfig(lineStyle)
                        });
                    }
                });
                centerEditor();
            }, 150);
        }

        function saveMap(){
            const nodes = Array.from(editor.querySelectorAll('.cardmap-node')).map(el => ({
                id: el.id,
                x: parseInt(el.style.left, 10) || 0,
                y: parseInt(el.style.top, 10) || 0,
                text: el.querySelector('.card-title')?.innerText || '',
                caption: el.querySelector('.card-caption')?.innerText || '',
                image: el.dataset.image || '',
                link: el.dataset.link || '',
                target: el.dataset.target || '_self'
            }));
            const connections = (instance.getAllConnections() || []).map(c => ({ source: c.sourceId, target: c.targetId }));
            
            fetch(ajaxUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
                body: new URLSearchParams({
                    action: 'save_cardmap',
                    post_id: postId,
                    nonce: document.getElementById('cardmap_nonce') ? document.getElementById('cardmap_nonce').value : '',
                    data: JSON.stringify({ nodes, connections })
                })
            }).then(r => r.json()).then(res => {
                alert(res.success ? 'Map saved!' : 'Error saving map.');
            }).catch(err => { console.error(err); alert('Saving failed'); });
        }

        document.getElementById('add-node').addEventListener('click', () => {
            const newNode = { id: 'node_' + Date.now(), x: 40, y: 40, text: 'New Card', caption: 'Caption', image: '', link: '', target: '_self' };
            mapData.nodes.push(newNode);
            renderNode(newNode);
        });

        document.getElementById('connect-mode').addEventListener('click', function(){
            connectMode = !connectMode; deleteMode = false; firstNode = null;
            this.style.background = connectMode ? '#ffecec' : '';
            document.getElementById('delete-node').style.background = '';
        });

        document.getElementById('delete-node').addEventListener('click', function(){
            deleteMode = !deleteMode; connectMode = false; firstNode = null;
            this.style.background = deleteMode ? '#ffecec' : '';
            document.getElementById('connect-mode').style.background = '';
        });

        document.getElementById('save-map').addEventListener('click', saveMap);
        
        document.getElementById('fullscreen-editor').addEventListener('click', function(){
            if (document.fullscreenElement) {
                document.exitFullscreen();
            } else {
                editorWrapper.requestFullscreen();
            }
        });

        if (enableAlignButton) {
            document.getElementById('align-nodes').addEventListener('click', function(){
                if (mapData.nodes.length === 0) return;

                const cardWidth = 240;
                const hSpacing = 40;
                const proximityThreshold = 100; // Vertical distance to group into a single row

                // 1. Group nodes into rows based on vertical proximity
                const sortedNodes = [...mapData.nodes].sort((a, b) => (a.y || 0) - (b.y || 0));
                const rows = [];
                if (sortedNodes.length > 0) {
                    let currentRow = [sortedNodes[0]];
                    for (let i = 1; i < sortedNodes.length; i++) {
                        if (Math.abs(sortedNodes[i].y - currentRow[currentRow.length - 1].y) < proximityThreshold) {
                            currentRow.push(sortedNodes[i]);
                        } else {
                            rows.push(currentRow);
                            currentRow = [sortedNodes[i]];
                        }
                    }
                    rows.push(currentRow);
                }

                // 2. Align nodes within each row using their original y position as the anchor
                rows.forEach(row => {
                    const base_y = row[0].y;
                    let currentX = 40;
                    // Sort nodes within the row by their horizontal position
                    row.sort((a, b) => (a.x || 0) - (b.x || 0));
                    
                    row.forEach(node => {
                        const domNode = document.getElementById(node.id);
                        if (domNode) {
                            node.x = currentX;
                            node.y = base_y;
                            domNode.style.left = node.x + 'px';
                            domNode.style.top = node.y + 'px';
                        }
                        currentX += cardWidth + hSpacing;
                    });
                });

                instance.repaintEverything();
                centerEditor();
            });
        }

        let isPanning = false, startX = 0, startY = 0, offsetX = 0, offsetY = 0, scale = 1;
        
        function updateTransform() {
            editor.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
            instance.setZoom(scale);
        }

        function centerEditor() {
            if (mapData.nodes.length === 0) return;
            
            const xPositions = mapData.nodes.map(n => parseInt(n.x) || 0);
            const yPositions = mapData.nodes.map(n => parseInt(n.y) || 0);

            const minX = Math.min(...xPositions);
            const minY = Math.min(...yPositions);
            const maxX = Math.max(...xPositions);
            const maxY = Math.max(...yPositions);
            
            const contentWidth = maxX - minX;
            const contentHeight = maxY - minY;
            const contentCenterX = minX + (contentWidth / 2);
            const contentCenterY = minY + (contentHeight / 2);

            const editorWidth = editorWrapper.offsetWidth;
            const editorHeight = editorWrapper.offsetHeight;

            const newOffsetX = (editorWidth / 2) - contentCenterX;
            const newOffsetY = (editorHeight / 2) - contentCenterY;
            
            offsetX = newOffsetX;
            offsetY = newOffsetY;
            updateTransform();
        }

        editorWrapper.addEventListener('mousedown', e => {
            if (e.target !== editorWrapper) return;
            isPanning = true;
            startX = e.clientX - offsetX;
            startY = e.clientY - offsetY;
            editorWrapper.style.cursor = 'grabbing';
        });
        window.addEventListener('mousemove', e => {
            if (!isPanning) return;
            e.preventDefault();
            offsetX = e.clientX - startX;
            offsetY = e.clientY - startY;
            updateTransform();
        });
        window.addEventListener('mouseup', () => {
            isPanning = false;
            editorWrapper.style.cursor = 'grab';
        });

        editorWrapper.addEventListener('wheel', e => {
            e.preventDefault();
            scale += e.deltaY * -0.002;
            scale = Math.max(0.5, Math.min(2.5, scale));
            updateTransform();
        }, { passive: false });
        
        loadMap();
    });
    </script>
    <?php
}

/**
 * -------------------------
 * AJAX Save Handler
 * -------------------------
 */
add_action( 'wp_ajax_save_cardmap', function(){
    $post_id = isset( $_POST['post_id'] ) ? intval( $_POST['post_id'] ) : 0;
    if ( ! $post_id ) {
        wp_send_json_error( 'Missing post_id', 400 );
    }

    // Capability check for the specific post
    if ( ! current_user_can( 'edit_post', $post_id ) ) {
        wp_send_json_error( 'Unauthorized', 403 );
    }

    // Verify nonce
    $nonce = isset( $_POST['nonce'] ) ? sanitize_text_field( wp_unslash( $_POST['nonce'] ) ) : '';
    if ( ! wp_verify_nonce( $nonce, 'save_cardmap_' . $post_id ) ) {
        wp_send_json_error( 'Invalid nonce', 403 );
    }

    $data_raw = isset( $_POST['data'] ) ? wp_unslash( $_POST['data'] ) : '';
    if ( ! $data_raw ) {
        wp_send_json_error( 'Missing data', 400 );
    }

    // Decode and validate JSON structure
    $decoded = json_decode( $data_raw, true );
    if ( json_last_error() !== JSON_ERROR_NONE || ! is_array( $decoded ) ) {
        wp_send_json_error( 'Invalid JSON', 400 );
    }

    $decoded = wp_unslash( $decoded );

    // Basic structure validation
    if ( ! isset( $decoded['nodes'] ) || ! is_array( $decoded['nodes'] ) ) {
        $decoded['nodes'] = [];
    }
    if ( ! isset( $decoded['connections'] ) || ! is_array( $decoded['connections'] ) ) {
        $decoded['connections'] = [];
    }

    // Optionally sanitize nodes/connections further here (e.g., validate IDs, positions, URLs)

    update_post_meta( $post_id, '_cardmap_data', wp_json_encode( $decoded ) );
    wp_send_json_success();
});

/**
 * -------------------------
 * Frontend Shortcode
 * -------------------------
 */
add_shortcode( 'cardmap', function( $atts ) {
    $atts = shortcode_atts( [ 'id' => 0 ], $atts, 'cardmap' );
    $post_id = intval( $atts['id'] );
    if ( ! $post_id ) return 'Invalid Card Map ID';

    $raw = get_post_meta( $post_id, '_cardmap_data', true );
    if ( ! $raw ) return 'No map data found.';
    // Ensure we have safe JSON for embedding in JS
    $data_decoded = is_string( $raw ) ? json_decode( wp_unslash( $raw ), true ) : $raw;
    if ( json_last_error() !== JSON_ERROR_NONE || ! is_array( $data_decoded ) ) {
        $data_decoded = [ 'nodes' => [], 'connections' => [] ];
    }
    $data_json = wp_json_encode( $data_decoded );

    $enable_drag = get_option( 'cardmap_enable_drag', 1 ) ? 'true' : 'false';
    $line_color = esc_js( get_option( 'cardmap_line_color', '#A61832' ) );
    $line_thickness = intval( get_option( 'cardmap_line_thickness', 2) );
    $line_style = esc_js( get_option( 'cardmap_line_style', 'bezier') );
    ob_start();
    ?>
    <div class="cardmap-frontend-wrapper" style="position:relative; width:100%; height:600px; border:1px solid #ddd; overflow:hidden; background-color:#f8f9fa; background-image:url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTAgMGgwNHY0MEgwWiIgZmlsbD0iI2U5ZmVmZSIvPjxwYXRoIGQ9Ik00MCAwSDQwdi00MEgwWiIgZmlsbD0iI2YyZjVmNiIvPjwvc3ZnPg=='); cursor: grab;">
        <div class="cardmap-controls" style="position:absolute;bottom:18px;left:18px;z-index:1200; display:flex;flex-direction:column;gap:10px;">
            <button class="cardmap-zoom-btn" data-zoom="in" aria-label="Zoom in">+</button>
            <button class="cardmap-zoom-btn" data-zoom="out" aria-label="Zoom out">−</button>
            <button class="cardmap-zoom-btn" data-zoom="fullscreen" title="Fullscreen" aria-label="Fullscreen">⛶</button>
            <div id="cardmap-zoom-display" style="color:#A61832;font-weight:700;font-size:18px;padding-top:5px;"></div>
        </div>
        <div id="cardmap-frontend-<?php echo esc_attr($post_id); ?>" style="position:relative; transform-origin:0 0; transition: transform 0.3s ease-out; width:1200px; height:1000px;"></div>
    </div>

    <style>
    /* Corrected Frontend Styles */
    .cardmap-zoom-btn {
        background:#A61832; color:#ffffff; border:none; border-radius:8px;
        width:48px; height:48px; font-size:18px; font-weight:700; cursor:pointer;
        display:inline-flex; align-items:center; justify-content:center;
        box-shadow:0 6px 16px rgba(0,0,0,0.12);
    }
    .cardmap-zoom-btn:hover { transform:scale(1.06); }
    .cardmap-frontend-wrapper .cardmap-node {
        position:absolute; width:240px; background:#fff; border-radius:8px;
        box-shadow:0 4px 15px rgba(0,0,0,0.1); overflow:hidden;
        cursor:grab; user-select:none; transition: transform .12s;
        border: 1px solid #E0E0E0;
    }
    .cardmap-frontend-wrapper .cardmap-node:hover { transform: translateY(-2px); }
    .cardmap-frontend-wrapper .node-image-wrapper { position: relative; }
    .cardmap-frontend-wrapper .node-image img {
        width:100%; height:160px; object-fit:cover; display:block;
    }
    .cardmap-frontend-wrapper .card-caption {
        position: absolute; bottom: 0; left: 0; width: 100%;
        font-size:14px; color: white; background-color: rgba(40, 40, 40, 0.7);
        padding: 8px 12px; text-align:left; box-sizing: border-box;
    }
    .cardmap-frontend-wrapper .card-title {
        font-size:16px; font-weight:600; padding:12px; color:#222; text-align:left;
    }
    </style>

    <script src="https://cdnjs.cloudflare.com/ajax/libs/jsPlumb/2.15.6/js/jsplumb.min.js"></script>
    <script>
    document.addEventListener('DOMContentLoaded', function(){
        const wrapper = document.querySelector('.cardmap-frontend-wrapper');
        const container = document.getElementById('cardmap-frontend-<?php echo esc_js($post_id); ?>');
        const zoomDisplay = document.getElementById('cardmap-zoom-display');
    const lineStyle = '<?php echo esc_js( $line_style ); ?>';
    const lineColor = "<?php echo esc_js( $line_color ); ?>";
    const lineThickness = <?php echo intval( $line_thickness ); ?>;
        
        const CARD_WIDTH = 240;
        const CARD_HEIGHT = 220;
        const PADDING = 40;

    let mapData = <?php echo $data_json; ?>;
        if (typeof mapData === 'string') {
            try {
                mapData = JSON.parse(mapData);
            } catch(e) {
                console.error("CardMap: Failed to parse map data.", e);
                mapData = { nodes: [], connections: [] };
            }
        }
        if (!mapData || !mapData.nodes) {
             mapData = { nodes: [], connections: [] };
        }

        const instance = jsPlumb.getInstance({ Container: container, ContinuousRepaint: true });

        function getConnectorConfig(style) {
            const baseConfig = { stroke: lineColor, strokeWidth: lineThickness };
            const overlays = [["Arrow",{ width:10, length:10, location:1 }]];
            const dashedOverlay = { stroke: lineColor, strokeWidth: lineThickness, dashstyle: "4 2" };
            const dottedOverlay = { stroke: lineColor, strokeWidth: lineThickness, dashstyle: "1 1" };

            switch (style) {
                case 'bezier':
                case 'rounded-bezier':
                    return { connector: ["Bezier", {curviness: 50}], paintStyle: baseConfig };
                case 'straight':
                    return { connector: ["Straight"], paintStyle: baseConfig };
                case 'flowchart':
                    return { connector: ["Flowchart"], paintStyle: baseConfig };
                case 'state-machine':
                    return { connector: ["StateMachine", { curviness: 20, margin: 5, proximity: 10 }], paintStyle: baseConfig };
                case 'straight-with-arrows':
                    return { connector: ["Straight"], paintStyle: baseConfig, overlays: overlays };
                case 'flowchart-with-arrows':
                    return { connector: ["Flowchart"], paintStyle: baseConfig, overlays: overlays };
                case 'diagonal':
                    return { connector: ["Straight"], paintStyle: baseConfig, anchors: ["TopLeft", "BottomRight"] };
                case 'dashed':
                    return { connector: ["Straight"], paintStyle: dashedOverlay };
                case 'dotted':
                    return { connector: ["Straight"], paintStyle: dottedOverlay };
                default:
                    return { connector: ["Bezier", {curviness:50}], paintStyle: baseConfig };
            }
        }

        const connectorConfig = getConnectorConfig(lineStyle);

        instance.importDefaults({
            Connector: connectorConfig.connector,
            PaintStyle: connectorConfig.paintStyle,
            EndpointStyle: { radius:5 },
            Anchors: ["Bottom","Top"],
            Overlays: connectorConfig.overlays || []
        });

        let scale = 1, offsetX = 0, offsetY = 0, isPanning = false, startX = 0, startY = 0;
        
        const updateTransform = () => {
            container.style.transform = `translate(${offsetX}px,${offsetY}px) scale(${scale})`;
            instance.setZoom(scale);
            zoomDisplay.textContent = `${Math.round(scale * 100)}%`;
        };
        
        const setInitialView = () => {
            if (mapData.nodes.length === 0) {
                updateTransform();
                return;
            }

            const xPositions = mapData.nodes.map(n => n.x);
            const yPositions = mapData.nodes.map(n => n.y);
            
            const minX = Math.min(...xPositions);
            const minY = Math.min(...yPositions);
            const maxX = Math.max(...xPositions) + CARD_WIDTH;
            const maxY = Math.max(...yPositions) + CARD_HEIGHT;

            const mapWidth = maxX - minX;
            const mapHeight = maxY - minY;

            const wrapperWidth = wrapper.offsetWidth;
            const wrapperHeight = wrapper.offsetHeight;
            
            const scaleX = (wrapperWidth - PADDING) / mapWidth;
            const scaleY = (wrapperHeight - PADDING) / mapHeight;
            let newScale = Math.min(scaleX, scaleY);

            newScale = Math.min(newScale, 1.0); // Cap initial zoom at 100%
            newScale = Math.max(0.2, newScale); // Min zoom for initial view
            
            const newOffsetX = (wrapperWidth / 2) - ((minX + mapWidth/2) * newScale);
            const newOffsetY = (wrapperHeight / 2) - ((minY + mapHeight/2) * newScale);

            scale = newScale;
            offsetX = newOffsetX;
            offsetY = newOffsetY;
            
            updateTransform();
        };

        wrapper.addEventListener('click', e => {
            if (e.target.dataset.zoom) {
                const direction = e.target.dataset.zoom;
                if (direction === 'in') scale = Math.min(2.5, scale + 0.15);
                if (direction === 'out') scale = Math.max(0.5, scale - 0.15);
                if (direction === 'fullscreen') {
                    if (!document.fullscreenElement) wrapper.requestFullscreen?.();
                    else document.exitFullscreen?.();
                }
                updateTransform();
            }
        });

        wrapper.addEventListener('wheel', e => {
            e.preventDefault();
            scale += e.deltaY * -0.002;
            scale = Math.min(Math.max(0.5, scale), 2.5);
            updateTransform();
        }, { passive: false });

        wrapper.addEventListener('mousedown', e => {
            if (e.target.closest('.cardmap-node') || e.target.closest('.cardmap-zoom-btn')) {
                return;
            }
            isPanning = true;
            startX = e.clientX - offsetX;
            startY = e.clientY - offsetY;
            wrapper.style.cursor = 'grabbing';
        });

        window.addEventListener('mousemove', e => {
            if (!isPanning) return;
            e.preventDefault();
            offsetX = e.clientX - startX;
            offsetY = e.clientY - startY;
            updateTransform();
        });
        
        window.addEventListener('mouseup', () => {
            if (isPanning) {
                isPanning = false;
                wrapper.style.cursor = 'grab';
            }
        });

        const enableDrag = <?php echo $enable_drag; ?>;
        (mapData.nodes || []).forEach(n => {
            const node = document.createElement('div');
            node.className = 'cardmap-node';
            node.id = n.id;
            node.style.left = (n.x || 20) + 'px';
            node.style.top = (n.y || 20) + 'px';
            
            node.innerHTML = `
                <div class="node-image-wrapper">
                    <div class="node-image">${ n.image ? `<img src="${n.image}" alt="">` : '' }</div>
                    <div class="card-caption">${ n.caption || '' }</div>
                </div>
                <div class="card-title">${ n.text || '' }</div>
            `;
            container.appendChild(node);

            if (enableDrag) { instance.draggable(node, { stop: () => instance.repaintEverything() }); }
            if (n.link) { node.addEventListener('click', () => window.open(n.link, n.target || '_self')); }
        });

        setTimeout(() => {
            setInitialView();
            (mapData.connections || []).forEach(c => {
                if (document.getElementById(c.source) && document.getElementById(c.target)) {
                    instance.connect({
                        source: c.source, target: c.target,
                        ...getConnectorConfig(lineStyle)
                    });
                }
            });
        }, 150);
    });
    </script>
    <?php
    return ob_get_clean();
});

/* End of plugin file */