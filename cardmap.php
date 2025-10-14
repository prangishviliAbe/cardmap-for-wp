<?php
/*
Plugin Name: Card Map Builder Pro
Description: Draggable card maps with images, captions, links, connections, admin editor + settings, and frontend shortcode with zoom/pan/fullscreen.
Version: 1.10.11
Author: Abe Prangishvili
*/

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

// Define plugin constants
define( 'CARDMAP_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'CARDMAP_PLUGIN_URL', plugin_dir_url( __FILE__ ) );
define( 'CARDMAP_VERSION', '1.10.11' );

// Default configuration constants
define( 'CARDMAP_DEFAULT_LINE_STYLES', json_encode( [
    'normal' => 'Normal',
    'straight' => 'Straight',
    'straight-with-arrows' => 'Straight with Arrows',
    'bezier' => 'Bezier',
    'bezier-with-arrows' => 'Bezier with Arrows',
    'dashed' => 'Dashed',
    'dashed-with-arrows' => 'Dashed with Arrows',
    'dotted' => 'Dotted',
    'dotted-with-arrows' => 'Dotted with Arrows',
    'flowchart' => 'Flowchart',
    'flowchart-with-arrows' => 'Flowchart with Arrows',
    'flowchart-with-arrows-dashed' => 'Flowchart with Arrows (Dashed)'
] ) );

define( 'CARDMAP_DEFAULT_NODE_STYLES', json_encode( [
    'default' => 'Default',
    'highlight' => 'Highlight',
    'muted' => 'Muted',
    'bold' => 'Bold',
    'shadow' => 'Shadow',
    'bordered' => 'Bordered',
    'minimal' => 'Minimal'
] ) );

// Load plugin text domain for translations (Polylang compatible)
add_action( 'plugins_loaded', function() {
    load_plugin_textdomain( 'cardmap', false, dirname( plugin_basename( __FILE__ ) ) . '/languages/' );
});

// Migration: Update line styles to include all modern styles
add_action( 'admin_init', 'cardmap_run_migrations', 5 );
function cardmap_run_migrations() {
    $current_version = get_option( 'cardmap_version', '0' );
    
    // Only run if version has changed
    if ( version_compare( $current_version, CARDMAP_VERSION, '<' ) ) {
        update_option( 'cardmap_line_styles', CARDMAP_DEFAULT_LINE_STYLES );
        update_option( 'cardmap_node_styles', CARDMAP_DEFAULT_NODE_STYLES );
        update_option( 'cardmap_version', CARDMAP_VERSION );
    }
}

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

        // Cache file modification times
        static $admin_css_ver = null;
        static $admin_js_ver = null;
        
        if ( $admin_css_ver === null ) {
            $admin_css_ver = filemtime( CARDMAP_PLUGIN_DIR . 'assets/css/admin.css' );
        }
        if ( $admin_js_ver === null ) {
            $admin_js_ver = filemtime( CARDMAP_PLUGIN_DIR . 'assets/js/admin.js' );
        }

        wp_enqueue_style( 'cardmap-admin-css', CARDMAP_PLUGIN_URL . 'assets/css/admin.css', [], $admin_css_ver );
        wp_enqueue_script( 'jsplumb-cdn', 'https://cdnjs.cloudflare.com/ajax/libs/jsPlumb/2.15.6/js/jsplumb.min.js', [], '2.15.6', true );
        wp_enqueue_script( 'cardmap-admin-js', CARDMAP_PLUGIN_URL . 'assets/js/admin.js', [ 'jquery', 'wp-i18n', 'jsplumb-cdn' ], $admin_js_ver, true );

        $post_id = get_the_ID();
        $raw_data = get_post_meta( $post_id, '_cardmap_data', true );
        $map_data = $raw_data ? json_decode( $raw_data, true ) : [ 'nodes' => [], 'connections' => [], 'rails' => [] ];

        // Cache and decode options once
        $line_styles = json_decode( get_option( 'cardmap_line_styles', CARDMAP_DEFAULT_LINE_STYLES ), true );
        $node_styles = json_decode( get_option( 'cardmap_node_styles', CARDMAP_DEFAULT_NODE_STYLES ), true );

        wp_localize_script( 'cardmap-admin-js', 'cardmap_admin_data', [
            'ajax_url' => admin_url( 'admin-ajax.php' ),
            'nonce' => wp_create_nonce( 'cardmap_save' ),
            'post_id' => $post_id,
            'map_data' => $map_data,
            'available_line_styles' => $line_styles,
            'line_color' => get_option( 'cardmap_line_color', '#A61832' ),
            'line_thickness' => get_option( 'cardmap_line_thickness', 2 ),
            'show_rail_thickness' => (bool) get_option( 'cardmap_show_rail_thickness', 1 ),
            'enable_auto_align' => (bool) get_option( 'cardmap_enable_auto_align', 1 ),
            'node_styles' => $node_styles,
        ] );
    }

    // Enqueue assets for the settings page
    if ( 'cardmap_page_cardmap_settings' === $hook ) {
        static $settings_css_ver = null;
        if ( $settings_css_ver === null ) {
            $settings_css_ver = filemtime( CARDMAP_PLUGIN_DIR . 'assets/css/settings.css' );
        }
        wp_enqueue_style( 'cardmap-settings-css', CARDMAP_PLUGIN_URL . 'assets/css/settings.css', [], $settings_css_ver );
    }
}

add_action( 'wp_enqueue_scripts', 'cardmap_frontend_assets' );
function cardmap_frontend_assets() {
    // Register assets (only enqueued when shortcode is used)
    static $css_ver = null;
    static $js_ver = null;
    
    if ( $css_ver === null ) {
        $css_ver = filemtime( CARDMAP_PLUGIN_DIR . 'assets/css/frontend.css' );
    }
    if ( $js_ver === null ) {
        $js_ver = filemtime( CARDMAP_PLUGIN_DIR . 'assets/js/frontend.js' );
    }
    
    wp_register_style( 'cardmap-frontend-css', CARDMAP_PLUGIN_URL . 'assets/css/frontend.css', [], $css_ver );
    wp_register_script( 'jsplumb-cdn', 'https://cdnjs.cloudflare.com/ajax/libs/jsPlumb/2.15.6/js/jsplumb.min.js', [], '2.15.6', true );
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
    'cardmap-for-wp'
);

//Tell the update checker to look for a readme.txt file for details.
$myUpdateChecker->getVcsApi()->enableReleaseAssets();

//Set the branch that contains the stable release.
$myUpdateChecker->setBranch('main');