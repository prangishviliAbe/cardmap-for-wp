<?php
/**
 * Plugin Name: Animatrix for Elementor
 * Plugin URI: https://github.com/prangishviliAbe/Animatrix-for-Elementor
 * Description: Adds 30+ custom animations to Elementor elements.
 * Version: 1.0.0
 * Author: Abe Prangishvili
 * Author URI: https://github.com/prangishviliAbe
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit; // Exit if accessed directly.
}

final class Elementor_Custom_Animations {

    const VERSION = '1.0.0';
    const MINIMUM_ELEMENTOR_VERSION = '3.0.0';
    const MINIMUM_PHP_VERSION = '7.0';

    private static $_instance = null;

    public static function instance() {
        if ( is_null( self::$_instance ) ) {
            self::$_instance = new self();
        }
        return self::$_instance;
    }

    public function __construct() {
        // Load translations
        add_action( 'plugins_loaded', [ $this, 'load_textdomain' ] );

        add_action( 'init', [ $this, 'init' ] );
    }

    public function load_textdomain() {
        load_plugin_textdomain( 'animatrix-for-elementor', false, dirname( plugin_basename( __FILE__ ) ) . '/languages' );
    }

    public function init() {
        // Check if Elementor is installed and activated
        if ( ! did_action( 'elementor/loaded' ) ) {
            add_action( 'admin_notices', [ $this, 'admin_notice_missing_main_plugin' ] );
            return;
        }

        // Check for required Elementor version
        if ( ! version_compare( ELEMENTOR_VERSION, self::MINIMUM_ELEMENTOR_VERSION, '>=' ) ) {
            add_action( 'admin_notices', [ $this, 'admin_notice_minimum_elementor_version' ] );
            return;
        }

        // Check for required PHP version
        if ( version_compare( PHP_VERSION, self::MINIMUM_PHP_VERSION, '<' ) ) {
            add_action( 'admin_notices', [ $this, 'admin_notice_minimum_php_version' ] );
            return;
        }

        // Register controls
        add_action( 'elementor/controls/controls_registered', [ $this, 'register_controls' ] );

        // Register scripts
        add_action( 'elementor/frontend/after_register_scripts', [ $this, 'register_scripts' ] );
        add_action( 'elementor/frontend/after_register_styles', [ $this, 'register_styles' ] );

        // Enqueue scripts
        add_action( 'elementor/frontend/after_enqueue_scripts', [ $this, 'enqueue_scripts' ] );
        add_action( 'elementor/frontend/after_enqueue_styles', [ $this, 'enqueue_styles' ] );

        // Add animation controls
        add_action( 'elementor/element/common/_section_style/after_section_end', [ $this, 'add_animation_controls' ] );
        
        // Add hover controls
        add_action( 'elementor/element/common/_section_style/after_section_end', [ $this, 'add_hover_controls' ] );
        
        // Add scroll controls
        add_action( 'elementor/element/common/_section_style/after_section_end', [ $this, 'add_scroll_controls' ] );

        // Add render attributes
        add_action( 'elementor/frontend/widget/before_render', [ $this, 'add_render_attributes' ] );
        add_action( 'elementor/frontend/column/before_render', [ $this, 'add_render_attributes' ] );
        add_action( 'elementor/frontend/section/before_render', [ $this, 'add_render_attributes' ] );
        add_action( 'elementor/frontend/container/before_render', [ $this, 'add_render_attributes' ] );
    }

    public function admin_notice_missing_main_plugin() {
        if ( isset( $_GET['activate'] ) ) unset( $_GET['activate'] );
        $message = sprintf(
            esc_html__( '"%1$s" requires "%2$s" to be installed and activated.', 'animatrix-for-elementor' ),
            '<strong>' . esc_html__( 'Animatrix for Elementor', 'animatrix-for-elementor' ) . '</strong>',
            '<strong>' . esc_html__( 'Elementor', 'animatrix-for-elementor' ) . '</strong>'
        );
        printf( '<div class="notice notice-warning is-dismissible"><p>%1$s</p></div>', $message );
    }

    public function admin_notice_minimum_elementor_version() {
        if ( isset( $_GET['activate'] ) ) unset( $_GET['activate'] );
        $message = sprintf(
            esc_html__( '"%1$s" requires "%2$s" version %3$s or greater.', 'animatrix-for-elementor' ),
            '<strong>' . esc_html__( 'Animatrix for Elementor', 'animatrix-for-elementor' ) . '</strong>',
            '<strong>' . esc_html__( 'Elementor', 'animatrix-for-elementor' ) . '</strong>',
            self::MINIMUM_ELEMENTOR_VERSION
        );
        printf( '<div class="notice notice-warning is-dismissible"><p>%1$s</p></div>', $message );
    }

    public function admin_notice_minimum_php_version() {
        if ( isset( $_GET['activate'] ) ) unset( $_GET['activate'] );
        $message = sprintf(
            esc_html__( '"%1$s" requires "%2$s" version %3$s or greater.', 'animatrix-for-elementor' ),
            '<strong>' . esc_html__( 'Animatrix for Elementor', 'animatrix-for-elementor' ) . '</strong>',
            '<strong>' . esc_html__( 'PHP', 'animatrix-for-elementor' ) . '</strong>',
            self::MINIMUM_PHP_VERSION
        );
        printf( '<div class="notice notice-warning is-dismissible"><p>%1$s</p></div>', $message );
    }

    public function register_scripts() {
        wp_register_script(
            'animatrix-for-elementor',
            plugin_dir_url( __FILE__ ) . 'assets/js/custom-animations.js',
            [ 'jquery', 'elementor-frontend' ],
            self::VERSION,
            true
        );
    }

    public function register_styles() {
        wp_register_style(
            'animatrix-for-elementor',
            plugin_dir_url( __FILE__ ) . 'assets/css/custom-animations.css',
            [],
            self::VERSION
        );
    }

    /**
     * Placeholder for registering Elementor controls.
     *
     * Elementor fires the 'elementor/controls/controls_registered' hook —
     * provide a no-op method so we don't trigger a fatal error if the hook
     * is fired but no custom controls are required.
     *
     * You can extend this later to register custom control types.
     */
    public function register_controls() {
        // Intentionally left blank. Reserved for future control registrations.
    }

    public function enqueue_scripts() {
        wp_enqueue_script( 'animatrix-for-elementor' );
    }

    public function enqueue_styles() {
        wp_enqueue_style( 'animatrix-for-elementor' );
    }

    public function add_animation_controls( $element ) {
        $element->start_controls_section(
            'custom_animations_section',
            [
                'label' => __( 'Custom Animations', 'animatrix-for-elementor' ),
                'tab' => \Elementor\Controls_Manager::TAB_ADVANCED,
            ]
        );

        $element->add_control(
            'custom_animation',
            [
                'label' => __( 'Entrance Animation', 'animatrix-for-elementor' ),
                'type' => \Elementor\Controls_Manager::SELECT,
                'default' => '',
                'options' => [
                    '' => __( 'None', 'animatrix-for-elementor' ),
                    'eca-fade-in-up' => __( 'Fade In Up', 'animatrix-for-elementor' ),
                    'eca-fade-in-down' => __( 'Fade In Down', 'animatrix-for-elementor' ),
                    'eca-fade-in-left' => __( 'Fade In Left', 'animatrix-for-elementor' ),
                    'eca-fade-in-right' => __( 'Fade In Right', 'animatrix-for-elementor' ),
                    'eca-zoom-in' => __( 'Zoom In', 'animatrix-for-elementor' ),
                    'eca-zoom-out' => __( 'Zoom Out', 'animatrix-for-elementor' ),
                    'eca-slide-in-up' => __( 'Slide In Up', 'animatrix-for-elementor' ),
                    'eca-slide-in-down' => __( 'Slide In Down', 'animatrix-for-elementor' ),
                    'eca-slide-in-left' => __( 'Slide In Left', 'animatrix-for-elementor' ),
                    'eca-slide-in-right' => __( 'Slide In Right', 'animatrix-for-elementor' ),
                    'eca-flip-in-x' => __( 'Flip In X', 'animatrix-for-elementor' ),
                    'eca-flip-in-y' => __( 'Flip In Y', 'animatrix-for-elementor' ),
                    'eca-bounce-in' => __( 'Bounce In', 'animatrix-for-elementor' ),
                    'eca-rotate-in' => __( 'Rotate In', 'animatrix-for-elementor' ),
                    'eca-rotate-in-down-left' => __( 'Rotate In Down Left', 'animatrix-for-elementor' ),
                    'eca-rotate-in-down-right' => __( 'Rotate In Down Right', 'animatrix-for-elementor' ),
                    'eca-rotate-in-up-left' => __( 'Rotate In Up Left', 'animatrix-for-elementor' ),
                    'eca-rotate-in-up-right' => __( 'Rotate In Up Right', 'animatrix-for-elementor' ),
                    'eca-pulse' => __( 'Pulse', 'animatrix-for-elementor' ),
                    'eca-rubber-band' => __( 'Rubber Band', 'animatrix-for-elementor' ),
                    'eca-swing' => __( 'Swing', 'animatrix-for-elementor' ),
                    'eca-tada' => __( 'Tada', 'animatrix-for-elementor' ),
                    'eca-wobble' => __( 'Wobble', 'animatrix-for-elementor' ),
                    'eca-jello' => __( 'Jello', 'animatrix-for-elementor' ),
                    'eca-light-speed-in' => __( 'Light Speed In', 'animatrix-for-elementor' ),
                    'eca-roll-in' => __( 'Roll In', 'animatrix-for-elementor' ),
                    'eca-flash' => __( 'Flash', 'animatrix-for-elementor' ),
                    'eca-shake' => __( 'Shake', 'animatrix-for-elementor' ),
                    'eca-head-shake' => __( 'Head Shake', 'animatrix-for-elementor' ),
                    'eca-swirl-in' => __( 'Swirl In', 'animatrix-for-elementor' ),
                ],
                'prefix_class' => 'eca-animated ',
                'selector' => '> .elementor-widget-container, > .elementor-column-wrap, > .elementor-section-wrap',
            ]
        );

        $element->add_control(
            'custom_animation_duration',
            [
                'label' => __( 'Animation Duration (ms)', 'animatrix-for-elementor' ),
                'type' => \Elementor\Controls_Manager::NUMBER,
                'default' => 1000,
                'min' => 100,
                'max' => 5000,
                'step' => 100,
                'condition' => [
                    'custom_animation!' => '',
                ],
                'selectors' => [
                    '{{WRAPPER}}' => 'animation-duration: {{VALUE}}ms;',
                ],
            ]
        );

        $element->add_control(
            'custom_animation_delay',
            [
                'label' => __( 'Animation Delay (ms)', 'animatrix-for-elementor' ),
                'type' => \Elementor\Controls_Manager::NUMBER,
                'default' => 0,
                'min' => 0,
                'max' => 5000,
                'step' => 100,
                'condition' => [
                    'custom_animation!' => '',
                ],
                'selectors' => [
                    '{{WRAPPER}}' => 'animation-delay: {{VALUE}}ms;',
                ],
            ]
        );

        $element->end_controls_section();
    }

    public function add_hover_controls( $element ) {
        $element->start_controls_section(
            'custom_hover_animations_section',
            [
                'label' => __( 'Custom Hover Animations', 'animatrix-for-elementor' ),
                'tab' => \Elementor\Controls_Manager::TAB_ADVANCED,
            ]
        );

        $element->add_control(
            'custom_hover_animation',
            [
                'label' => __( 'Hover Animation', 'animatrix-for-elementor' ),
                'type' => \Elementor\Controls_Manager::SELECT,
                'default' => '',
                'options' => [
                    '' => __( 'None', 'animatrix-for-elementor' ),
                    'eca-hover-pulse' => __( 'Pulse', 'animatrix-for-elementor' ),
                    'eca-hover-bounce' => __( 'Bounce', 'animatrix-for-elementor' ),
                    'eca-hover-rubber-band' => __( 'Rubber Band', 'animatrix-for-elementor' ),
                    'eca-hover-swing' => __( 'Swing', 'animatrix-for-elementor' ),
                    'eca-hover-tada' => __( 'Tada', 'animatrix-for-elementor' ),
                    'eca-hover-wobble' => __( 'Wobble', 'animatrix-for-elementor' ),
                    'eca-hover-jello' => __( 'Jello', 'animatrix-for-elementor' ),
                    'eca-hover-flash' => __( 'Flash', 'animatrix-for-elementor' ),
                    'eca-hover-shake' => __( 'Shake', 'animatrix-for-elementor' ),
                    'eca-hover-head-shake' => __( 'Head Shake', 'animatrix-for-elementor' ),
                    'eca-hover-buzz' => __( 'Buzz', 'animatrix-for-elementor' ),
                    'eca-hover-buzz-out' => __( 'Buzz Out', 'animatrix-for-elementor' ),
                    'eca-hover-grow' => __( 'Grow', 'animatrix-for-elementor' ),
                    'eca-hover-shrink' => __( 'Shrink', 'animatrix-for-elementor' ),
                    'eca-hover-push' => __( 'Push', 'animatrix-for-elementor' ),
                    'eca-hover-pop' => __( 'Pop', 'animatrix-for-elementor' ),
                    'eca-hover-rotate' => __( 'Rotate', 'animatrix-for-elementor' ),
                    'eca-hover-glow' => __( 'Glow', 'animatrix-for-elementor' ),
                    'eca-hover-shadow' => __( 'Shadow', 'animatrix-for-elementor' ),
                    'eca-hover-float' => __( 'Float', 'animatrix-for-elementor' ),
                    'eca-hover-sink' => __( 'Sink', 'animatrix-for-elementor' ),
                ],
                'prefix_class' => 'eca-hover-animated ',
            ]
        );

        $element->add_control(
            'custom_hover_animation_duration',
            [
                'label' => __( 'Hover Duration (ms)', 'animatrix-for-elementor' ),
                'type' => \Elementor\Controls_Manager::NUMBER,
                'default' => 300,
                'min' => 100,
                'max' => 2000,
                'step' => 50,
                'condition' => [
                    'custom_hover_animation!' => '',
                ],
                'selectors' => [
                    '{{WRAPPER}}' => 'transition-duration: {{VALUE}}ms;',
                ],
            ]
        );

        $element->end_controls_section();
    }

    public function add_scroll_controls( $element ) {
        $element->start_controls_section(
            'custom_scroll_animations_section',
            [
                'label' => __( 'Custom Scroll Animations', 'animatrix-for-elementor' ),
                'tab' => \Elementor\Controls_Manager::TAB_ADVANCED,
            ]
        );

        $element->add_control(
            'custom_scroll_animation',
            [
                'label' => __( 'Scroll Animation', 'animatrix-for-elementor' ),
                'type' => \Elementor\Controls_Manager::SELECT,
                'default' => '',
                'options' => [
                    '' => __( 'None', 'animatrix-for-elementor' ),
                    'eca-scroll-fade-in' => __( 'Fade In', 'animatrix-for-elementor' ),
                    'eca-scroll-fade-in-up' => __( 'Fade In Up', 'animatrix-for-elementor' ),
                    'eca-scroll-fade-in-down' => __( 'Fade In Down', 'animatrix-for-elementor' ),
                    'eca-scroll-fade-in-left' => __( 'Fade In Left', 'animatrix-for-elementor' ),
                    'eca-scroll-fade-in-right' => __( 'Fade In Right', 'animatrix-for-elementor' ),
                    'eca-scroll-zoom-in' => __( 'Zoom In', 'animatrix-for-elementor' ),
                    'eca-scroll-zoom-out' => __( 'Zoom Out', 'animatrix-for-elementor' ),
                    'eca-scroll-slide-up' => __( 'Slide Up', 'animatrix-for-elementor' ),
                    'eca-scroll-slide-down' => __( 'Slide Down', 'animatrix-for-elementor' ),
                    'eca-scroll-slide-left' => __( 'Slide Left', 'animatrix-for-elementor' ),
                    'eca-scroll-slide-right' => __( 'Slide Right', 'animatrix-for-elementor' ),
                    'eca-scroll-flip-up' => __( 'Flip Up', 'animatrix-for-elementor' ),
                    'eca-scroll-flip-down' => __( 'Flip Down', 'animatrix-for-elementor' ),
                    'eca-scroll-flip-left' => __( 'Flip Left', 'animatrix-for-elementor' ),
                    'eca-scroll-flip-right' => __( 'Flip Right', 'animatrix-for-elementor' ),
                    'eca-scroll-bounce-in' => __( 'Bounce In', 'animatrix-for-elementor' ),
                    'eca-scroll-rotate-in' => __( 'Rotate In', 'animatrix-for-elementor' ),
                ],
            ]
        );

        $element->add_control(
            'custom_scroll_animation_duration',
            [
                'label' => __( 'Scroll Animation Duration (ms)', 'animatrix-for-elementor' ),
                'type' => \Elementor\Controls_Manager::NUMBER,
                'default' => 1000,
                'min' => 100,
                'max' => 3000,
                'step' => 100,
                'condition' => [
                    'custom_scroll_animation!' => '',
                ],
            ]
        );

        $element->add_control(
            'custom_scroll_animation_delay',
            [
                'label' => __( 'Scroll Animation Delay (ms)', 'animatrix-for-elementor' ),
                'type' => \Elementor\Controls_Manager::NUMBER,
                'default' => 0,
                'min' => 0,
                'max' => 3000,
                'step' => 100,
                'condition' => [
                    'custom_scroll_animation!' => '',
                ],
            ]
        );

        $element->add_control(
            'custom_scroll_animation_threshold',
            [
                'label' => __( 'Scroll Threshold', 'animatrix-for-elementor' ),
                'type' => \Elementor\Controls_Manager::SLIDER,
                'range' => [
                    'px' => [
                        'min' => 0,
                        'max' => 1,
                        'step' => 0.1,
                    ],
                ],
                'default' => [
                    'size' => 0.1,
                ],
                'condition' => [
                    'custom_scroll_animation!' => '',
                ],
            ]
        );

        $element->end_controls_section();
    }

    public function add_render_attributes( $element ) {
        $settings = $element->get_settings();

        if ( ! empty( $settings['custom_scroll_animation'] ) ) {
            $element->add_render_attribute( '_wrapper', [
                'class' => 'eca-scroll-animation',
                'data-eca-scroll-animation' => $settings['custom_scroll_animation'],
                'data-eca-scroll-duration' => $settings['custom_scroll_animation_duration'] ?? 1000,
                'data-eca-scroll-delay' => $settings['custom_scroll_animation_delay'] ?? 0,
                'data-eca-scroll-threshold' => $settings['custom_scroll_animation_threshold']['size'] ?? 0.1,
            ] );
        }
    }
}

// Initialize the plugin
Elementor_Custom_Animations::instance();

// Assets are registered/enqueued via Elementor hooks and live in assets/css and assets/js