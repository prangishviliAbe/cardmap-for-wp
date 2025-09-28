<?php
/**
 * Uninstall handler for Animatrix for Elementor
 * This file is executed when the plugin is uninstalled from WordPress.
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
    exit;
}

// Remove any options or transient entries if you added them (none currently).
// Example: delete_option( 'animatrix_for_elementor_options' );
