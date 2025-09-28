<?php
namespace Animatrix_for_Elementor;

if ( ! defined( 'ABSPATH' ) ) {
    exit; // Exit if accessed directly.
}

class Plugin {

    private static $_instance = null;

    public static function instance() {
        if ( is_null( self::$_instance ) ) {
            self::$_instance = new self();
        }
        return self::$_instance;
    }

    public function __construct() {
        add_action( 'elementor/init', [ $this, 'init' ] );
    }

    public function init() {
        require_once ANIMATRIX_FOR_ELEMENTOR_PATH . 'includes/controls.php';
        new Controls();

        // Add plugin actions
        add_action( 'elementor/controls/controls_registered', [ $this, 'register_controls' ] );
        add_action( 'elementor/frontend/after_enqueue_styles', [ $this, 'enqueue_frontend_styles' ] );
        add_action( 'elementor/frontend/after_register_scripts', [ $this, 'enqueue_frontend_scripts' ] );
    }

    public function register_controls( $controls_manager ) {
        // Register custom controls
    }

    public function enqueue_frontend_styles() {
        wp_enqueue_style(
            'animatrix-for-elementor',
            ANIMATRIX_FOR_ELEMENTOR_URL . 'assets/css/animations.css',
            [],
            ANIMATRIX_FOR_ELEMENTOR_VERSION
        );
    }

    public function enqueue_frontend_scripts() {
        wp_enqueue_script(
            'animatrix-for-elementor',
            ANIMATRIX_FOR_ELEMENTOR_URL . 'assets/js/main.js',
            [ 'jquery', 'elementor-frontend' ],
            ANIMATRIX_FOR_ELEMENTOR_VERSION,
            true
        );
    }
}

Plugin::instance();
