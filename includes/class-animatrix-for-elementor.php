<?php
if (!defined('ABSPATH')) {
    exit;
}

final class Animatrix_For_Elementor {

    private static $_instance = null;

    public static function instance() {
        if (is_null(self::$_instance)) {
            self::$_instance = new self();
        }
        return self::$_instance;
    }

    public function __construct() {
        add_action('plugins_loaded', [$this, 'init']);
    }

    public function init() {
        if (!did_action('elementor/loaded')) {
            add_action('admin_notices', [$this, 'admin_notice_missing_elementor']);
            return;
        }

        if (!version_compare(ELEMENTOR_VERSION, '3.0.0', '>=')) {
            add_action('admin_notices', [$this, 'admin_notice_elementor_version']);
            return;
        }

        $this->includes();
        $this->register_hooks();
    }

    public function includes() {
        require_once __DIR__ . '/animatrix-animations.php';
        require_once __DIR__ . '/animatrix-controls.php';
    }

    public function register_hooks() {
        add_action('elementor/frontend/after_enqueue_styles', [$this, 'enqueue_styles']);
        add_action('elementor/frontend/after_register_scripts', [$this, 'enqueue_scripts']);
        add_action('elementor/element/after_section_end', ['Animatrix_For_Elementor_Controls', 'add_animation_sections'], 10, 3);
    }

    public function admin_notice_missing_elementor() {
        if (isset($_GET['activate'])) unset($_GET['activate']);
        
        $message = sprintf(
            esc_html__('"%1$s" requires "%2$s" to be installed and activated.', 'elementor-advanced-animations'),
            '<strong>' . esc_html__('Elementor Advanced Animations', 'elementor-advanced-animations') . '</strong>',
            '<strong>' . esc_html__('Elementor', 'elementor-advanced-animations') . '</strong>'
        );
        
        printf('<div class="notice notice-warning is-dismissible"><p>%1$s</p></div>', $message);
    }

    public function admin_notice_elementor_version() {
        if (isset($_GET['activate'])) unset($_GET['activate']);

        $message = sprintf(
            esc_html__('"%1$s" requires "%2$s" version %3$s or greater.', 'elementor-advanced-animations'),
            '<strong>' . esc_html__('Elementor Advanced Animations', 'elementor-advanced-animations') . '</strong>',
            '<strong>' . esc_html__('Elementor', 'elementor-advanced-animations') . '</strong>',
            '3.0.0'
        );

        printf('<div class="notice notice-warning is-dismissible"><p>%1$s</p></div>', $message);
    }

    public function enqueue_styles() {
        wp_enqueue_style(
            'animatrix-for-elementor',
            plugin_dir_url(__FILE__) . '../assets/css/animations.css',
            [],
            '1.0.0'
        );
    }

    public function enqueue_scripts() {
        wp_enqueue_script(
            'animatrix-for-elementor',
            plugin_dir_url(__FILE__) . '../assets/js/animations.js',
            ['jquery'],
            '1.0.0',
            true
        );
    }
}
