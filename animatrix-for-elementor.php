<?php
/**
 * Plugin Name: Animatrix for Elementor
 * Description: Add 160+ professional animations to Elementor - Entrance, Hover, Scroll & Exit animations with 3D effects, physics-based motion, creative transitions & smooth hover interactions
 * Version: 1.2.0
 * Author: Abe Prangishvili
 */

if (!defined('ABSPATH')) {
    exit;
}

require_once __DIR__ . '/includes/class-animatrix-for-elementor.php';

Animatrix_For_Elementor::instance();