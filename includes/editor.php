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
});

function cardmap_editor_callback( $post ) {
    $raw = get_post_meta( $post->ID, '_cardmap_data', true );
    $json = $raw ? $raw : json_encode( [ 'nodes' => [], 'connections' => [] ] );

    $enable_align_button = get_option('cardmap_enable_align_button', 1);
    ?>
    <div id="cardmap-toolbar" style="margin-bottom:10px;">
        <button type="button" class="button" id="add-node">+ Add Card</button>
        <button type="button" class="button" id="add-rail">+ Add Rail</button>
        <select id="add-rail-orientation" aria-label="Rail orientation" style="margin-left:6px;">
            <option value="horizontal">Horizontal</option>
            <option value="vertical">Vertical</option>
        </select>
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
    <p>Shortcode: <input type="text" value="<?php echo esc_attr('[cardmap id="' . $post->ID . '"]'); ?>" readonly style="width:100%;"></p>
    <?php
}
