<?php
/**
 * Plugin Name: Animatrix for Elementor
 * Description: Add advanced animations to Elementor sections, widgets, and containers - 160+ professional animations with smooth hover transitions
 * Version: 2.0.0
 * Author: Abe Prangishvili
 */

if (!defined('ABSPATH')) {
    exit;
}

require_once __DIR__ . '/includes/class-animatrix-for-elementor.php';

Animatrix_For_Elementor::instance();