<?php

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/**
 * -------------------------
 * Admin: Meta Box + Editor
 * -------------------------
 */
add_action( 'add_meta_boxes', function(){
    add_meta_box( 'cardmap_editor', 'Card Map Editor', 'cardmap_editor_callback', 'cardmap', 'normal', 'high' );
    add_meta_box( 'cardmap_config', 'Map Configuration', 'cardmap_config_callback', 'cardmap', 'side', 'high' );
});

function cardmap_config_callback( $post ) {
    wp_nonce_field( 'cardmap_config_save', 'cardmap_config_nonce' );
    $map_type = get_post_meta( $post->ID, '_cardmap_type', true );
    if ( empty( $map_type ) ) {
        $map_type = 'manual';
    }

    $post_types = get_post_types( [ 'public' => true ], 'objects' );
    $selected_post_type = get_post_meta( $post->ID, '_cardmap_source_post_type', true );
    $taxonomies = get_taxonomies([ 'public' => true ], 'objects');
    $selected_taxonomy = get_post_meta( $post->ID, '_cardmap_source_taxonomy', true );
    ?>
    <div id="cardmap-type-selector">
        <strong><?php esc_html_e( 'Map Type', 'cardmap' ); ?></strong>
        <p>
            <label>
                <input type="radio" name="cardmap_type" value="manual" <?php checked( 'manual', $map_type ); ?>>
                <?php esc_html_e( 'Manual Layout', 'cardmap' ); ?>
            </label>
            <br>
            <label>
                <input type="radio" name="cardmap_type" value="post_hierarchy" <?php checked( 'post_hierarchy', $map_type ); ?>>
                <?php esc_html_e( 'Post Hierarchy', 'cardmap' ); ?>
            </label>
        </p>
    </div>

    <div id="cardmap-post-hierarchy-options" style="<?php echo $map_type === 'post_hierarchy' ? '' : 'display:none;'; ?>">
        <hr>
        <strong><?php esc_html_e( 'Hierarchy Options', 'cardmap' ); ?></strong>
        <p>
            <label for="cardmap-source-post-type"><?php esc_html_e( 'Select Post Type', 'cardmap' ); ?></label>
            <select name="cardmap_source_post_type" id="cardmap-source-post-type" style="width:100%;">
                <?php foreach ( $post_types as $pt ) : ?>
                    <option value="<?php echo esc_attr( $pt->name ); ?>" <?php selected( $pt->name, $selected_post_type ); ?>>
                        <?php echo esc_html( $pt->labels->singular_name ); ?>
                    </option>
                <?php endforeach; ?>
            </select>
        </p>
        <p>
            <label for="cardmap-source-taxonomy"><?php esc_html_e( 'Select Taxonomy (for non-hierarchical)', 'cardmap' ); ?></label>
            <select name="cardmap_source_taxonomy" id="cardmap-source-taxonomy" style="width:100%;">
                <option value="">---</option>
                <?php foreach ( $taxonomies as $tax ) : ?>
                    <option value="<?php echo esc_attr( $tax->name ); ?>" <?php selected( $tax->name, $selected_taxonomy ); ?>>
                        <?php echo esc_html( $tax->labels->singular_name ); ?>
                    </option>
                <?php endforeach; ?>
            </select>
        </p>
        <button type="button" class="button button-secondary" id="generate-post-map" style="width:100%;"><?php esc_html_e( 'Generate Map', 'cardmap' ); ?></button>
        <p class="description"><?php esc_html_e( 'This will overwrite existing card data for this map.', 'cardmap' ); ?></p>
    </div>

    <script>
    jQuery(document).ready(function($){
        $('input[name="cardmap_type"]').on('change', function(){
            if (this.value === 'post_hierarchy') {
                $('#cardmap-post-hierarchy-options').slideDown();
            } else {
                $('#cardmap-post-hierarchy-options').slideUp();
            }
        });
    });
    </script>
    <?php
}

add_action( 'save_post_cardmap', function( $post_id ) {
    if ( ! isset( $_POST['cardmap_config_nonce'] ) || ! wp_verify_nonce( $_POST['cardmap_config_nonce'], 'cardmap_config_save' ) ) {
        return;
    }
    if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) {
        return;
    }
    if ( ! current_user_can( 'edit_post', $post_id ) ) {
        return;
    }

    if ( isset( $_POST['cardmap_type'] ) ) {
        update_post_meta( $post_id, '_cardmap_type', sanitize_text_field( $_POST['cardmap_type'] ) );
    }
    if ( isset( $_POST['cardmap_source_post_type'] ) ) {
        update_post_meta( $post_id, '_cardmap_source_post_type', sanitize_text_field( $_POST['cardmap_source_post_type'] ) );
    }
    if ( isset( $_POST['cardmap_source_taxonomy'] ) ) {
        update_post_meta( $post_id, '_cardmap_source_taxonomy', sanitize_text_field( $_POST['cardmap_source_taxonomy'] ) );
    }
});

function cardmap_editor_callback( $post ) {
    $raw = get_post_meta( $post->ID, '_cardmap_data', true );
    $json = $raw ? $raw : json_encode( [ 'nodes' => [], 'connections' => [] ] );

    ?>
    <div id="cardmap-toolbar" style="margin-bottom:10px;">
        <button type="button" class="button" id="undo-action" title="Undo (Ctrl+Z)" disabled>↶ Undo</button>
        <button type="button" class="button" id="redo-action" title="Redo (Ctrl+Y)" disabled>↷ Redo</button>
        <div class="cardmap-history-dropdown" style="display:inline-block;position:relative;margin-left:5px;">
            <button type="button" class="button" id="history-toggle" title="Show History">📋 History</button>
            <div id="history-panel" class="cardmap-history-panel" style="display:none;">
                <div class="history-header">Action History</div>
                <div id="history-list" class="history-list"></div>
                <div class="history-footer">
                    <button type="button" class="button button-small" id="clear-history">Clear History</button>
                </div>
            </div>
        </div>
        <span style="display:inline-block;width:1px;height:20px;background:#ddd;margin:0 8px;vertical-align:middle;"></span>
        <button type="button" class="button" id="add-node">+ Add Card</button>
        <button type="button" class="button" id="add-rail">+ Add Rail</button>
        <?php if ( get_option( 'cardmap_show_rail_thickness', 1 ) ) : ?>
            <input type="number" id="rail-size" value="3" min="1" max="100" style="width: 60px; margin-left: 6px;" title="Rail Size">
        <?php endif; ?>
        <select id="add-rail-orientation" aria-label="Rail orientation" style="margin-left:6px;">
            <option value="horizontal">Horizontal</option>
            <option value="vertical">Vertical</option>
        </select>
        <button type="button" class="button" id="connect-mode">🔗 Connect</button>
        <button type="button" class="button" id="delete-node">❌ Delete Node</button>
        <button type="button" class="button" id="delete-connection">✂️ Delete Link</button>
        <button type="button" class="button" id="delete-rail">🧨 Delete Rail</button>
        <?php if ( get_option( 'cardmap_enable_auto_align', 1 ) ) : ?>
        <button type="button" class="button button-secondary" id="auto-align-cards" title="Automatically align cards that are close to each other">⚡ Auto-Align</button>
        <?php endif; ?>
        <span style="display:inline-block;width:1px;height:20px;background:#ddd;margin:0 8px;vertical-align:middle;"></span>
        <button type="button" class="button button-secondary" id="fullscreen-editor">⛶ Fullscreen</button>
        <button type="button" class="button button-primary" id="save-map">💾 Save</button>
    </div>

    <div id="cardmap-editor-wrapper" style="width:100%;height:520px;border:1px solid #ddd;position:relative;overflow:hidden;background:#fafafa; cursor:grab;">
        <div id="cardmap-editor" style="position:relative;width:1200px;height:1000px;"></div>
    </div>

    <input type="hidden" id="cardmap_post_id" value="<?php echo esc_attr( $post->ID ); ?>">
    <p>Shortcode: <input type="text" value="<?php echo esc_attr('[cardmap id="' . $post->ID . '"]'); ?>" readonly style="width:100%;"></p>
    <?php
}
