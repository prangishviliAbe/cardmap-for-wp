<?php
/**
 * Plugin Name: Animatrix for Elementor
 * Description: A full-fledged plugin compatible with Elementor to add unique animations to containers, elements, and widgets, with hover and scroll-triggered animations.
 * Plugin URI:  https://github.com/prangishviliAbe/Animatrix-for-Elementor
 * Version:     1.0.0
 * Author:      Abe Prangishvili
 * Author URI:  https://github.com/prangishviliAbe
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit; // Exit if accessed directly.
}

define( 'ANIMATRIX_FOR_ELEMENTOR_VERSION', '1.0.0' );
define( 'ANIMATRIX_FOR_ELEMENTOR_FILE', __FILE__ );
define( 'ANIMATRIX_FOR_ELEMENTOR_PATH', plugin_dir_path( ANIMATRIX_FOR_ELEMENTOR_FILE ) );
define( 'ANIMATRIX_FOR_ELEMENTOR_URL', plugins_url( '/', ANIMATRIX_FOR_ELEMENTOR_FILE ) );

/**
 * Load the main plugin class.
 */
require_once ANIMATRIX_FOR_ELEMENTOR_PATH . 'includes/plugin.php';
