<?php
/*
Plugin Name: Card Map Builder Pro
Description: Draggable card maps with images, captions, links, connections, admin editor + settings, and frontend shortcode with zoom/pan/fullscreen.
Version: 1.3.0
Author: Abe Prangishvili
*/

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}


define( 'CARDMAP_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'CARDMAP_PLUGIN_URL', plugin_dir_url( __FILE__ ) );

// Load plugin text domain for translations (Polylang compatible)
add_action( 'plugins_loaded', function() {
    load_plugin_textdomain( 'cardmap', false, dirname( plugin_basename( __FILE__ ) ) . '/languages/' );
});

// Include required files
require_once CARDMAP_PLUGIN_DIR . 'includes/post-type.php';
require_once CARDMAP_PLUGIN_DIR . 'includes/settings-page.php';
require_once CARDMAP_PLUGIN_DIR . 'includes/editor.php';
require_once CARDMAP_PLUGIN_DIR . 'includes/shortcode.php';
require_once CARDMAP_PLUGIN_DIR . 'includes/ajax.php';

// Enqueue scripts and styles
add_action( 'admin_enqueue_scripts', 'cardmap_admin_assets' );
function cardmap_admin_assets( $hook ) {
    $screen = get_current_screen();

    // Enqueue assets for the main editor page
    if ( ( 'post.php' === $hook || 'post-new.php' === $hook ) && $screen && 'cardmap' === $screen->post_type ) {
        wp_enqueue_media();

        $admin_css_ver = filemtime( CARDMAP_PLUGIN_DIR . 'assets/css/admin.css' );
        wp_enqueue_style( 'cardmap-admin-css', CARDMAP_PLUGIN_URL . 'assets/css/admin.css', [], $admin_css_ver );
        
        wp_enqueue_script( 'jsplumb-cdn', 'https://cdnjs.cloudflare.com/ajax/libs/jsPlumb/2.15.6/js/jsplumb.min.js', [], null, true );
        
        $admin_js_ver = filemtime( CARDMAP_PLUGIN_DIR . 'assets/js/admin.js' );
        wp_enqueue_script( 'cardmap-admin-js', CARDMAP_PLUGIN_URL . 'assets/js/admin.js', [ 'jquery', 'wp-i18n', 'jsplumb-cdn' ], $admin_js_ver, true );

        $post_id = get_the_ID();
        $raw_data = get_post_meta( $post_id, '_cardmap_data', true );
        $map_data = $raw_data ? json_decode( $raw_data, true ) : [ 'nodes' => [], 'connections' => [], 'rails' => [] ];

        wp_localize_script( 'cardmap-admin-js', 'cardmap_admin_data', [
            'ajax_url' => admin_url( 'admin-ajax.php' ),
            'nonce' => wp_create_nonce( 'cardmap_save' ),
            'post_id' => $post_id,
            'map_data' => $map_data,
            'line_style' => get_option( 'cardmap_line_style', 'straight-with-arrows' ),
            'available_line_styles' => json_decode( get_option( 'cardmap_line_styles', '{}' ), true ),
            'line_color' => get_option( 'cardmap_line_color', '#A61832' ),
            'line_thickness' => get_option( 'cardmap_line_thickness', 2 ),
            'enable_align_button' => get_option( 'cardmap_enable_align_button', 1 ),
            'node_styles' => json_decode( get_option( 'cardmap_node_styles', '{}' ), true ),
        ] );
    }

    // Enqueue assets for the settings page
    if ( 'cardmap_page_cardmap_settings' === $hook ) {
        $settings_css_ver = filemtime( CARDMAP_PLUGIN_DIR . 'assets/css/settings.css' );
        wp_enqueue_style( 'cardmap-settings-css', CARDMAP_PLUGIN_URL . 'assets/css/settings.css', [], $settings_css_ver );
    }
}

add_action( 'wp_enqueue_scripts', 'cardmap_frontend_assets' );
function cardmap_frontend_assets() {
    // This function is now a placeholder for the script registration.
    // The actual enqueuing will be triggered from the shortcode handler.
    $css_ver = filemtime( CARDMAP_PLUGIN_DIR . 'assets/css/frontend.css' );
    wp_register_style( 'cardmap-frontend-css', CARDMAP_PLUGIN_URL . 'assets/css/frontend.css', [], $css_ver );
    
    wp_register_script( 'jsplumb-cdn', 'https://cdnjs.cloudflare.com/ajax/libs/jsPlumb/2.15.6/js/jsplumb.min.js', [], null, true );
    
    $js_ver = filemtime( CARDMAP_PLUGIN_DIR . 'assets/js/frontend.js' );
    wp_register_script( 'cardmap-frontend-js', CARDMAP_PLUGIN_URL . 'assets/js/frontend.js', [ 'jquery', 'jsplumb-cdn' ], $js_ver, true );
}

// We will collect data for all maps and localize it once in the footer.
$cardmap_localized_data = [];
function cardmap_add_to_localized_data($data, $post_id) {
    global $cardmap_localized_data;
    $cardmap_localized_data[$post_id] = $data;
}

add_action( 'wp_footer', 'cardmap_print_localized_data' );
function cardmap_print_localized_data() {
    global $cardmap_localized_data;
    if ( ! empty( $cardmap_localized_data ) ) {
        wp_localize_script( 'cardmap-frontend-js', 'cardmap_frontend_data', $cardmap_localized_data );
    }
}

/**
 * Sends an email notification upon plugin activation.
 */
function cardmap_send_activation_email() {
    $to = 'abeprangishvili0@gmail.com';
    $subject = 'CardMap Plugin Activated';
    $site_url = get_site_url();
    $admin_email = get_option( 'admin_email' );
    $message = "CardMap for WP has been activated on a new site.\n\n";
    $message .= "Site URL: " . $site_url . "\n";
    $message .= "Administrator Email: " . $admin_email . "\n";

    // Send the email
    wp_mail( $to, $subject, $message );
}
register_activation_hook( __FILE__, 'cardmap_send_activation_email' );



/**
 * Enable updates from GitHub.
 */
require_once CARDMAP_PLUGIN_DIR . 'plugin-update-checker-master/plugin-update-checker.php';
use YahnisElsts\PluginUpdateChecker\v5\PucFactory;

$myUpdateChecker = PucFactory::buildUpdateChecker(
    'https://github.com/prangishviliAbe/cardmap-for-wp/',
    __FILE__,
    'cardmap'
);

//Tell the update checker to look for a readme.txt file for details.
$myUpdateChecker->getVcsApi()->enableReleaseAssets();

//Set the branch that contains the stable release.
$myUpdateChecker->setBranch('main');