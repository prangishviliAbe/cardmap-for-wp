<?php
namespace Animatrix_for_Elementor;

use Elementor\Controls_Manager;
use Elementor\Element_Base;

if ( ! defined( 'ABSPATH' ) ) {
    exit; // Exit if accessed directly.
}

class Controls {

    public function __construct() {
        add_action( 'elementor/element/common/_section_style/after_section_end', [ $this, 'register_section' ], 1 );
        add_action( 'elementor/element/column/section_advanced/after_section_end', [ $this, 'register_section' ], 1 );
        add_action( 'elementor/element/section/section_advanced/after_section_end', [ $this, 'register_section' ], 1 );
        add_action( 'elementor/element/container/section_layout/after_section_end', [ $this, 'register_section' ], 1 );
    }

    public function register_section( Element_Base $element ) {
        $element->start_controls_section(
            'section_animatrix',
            [
                'label' => __( 'Animatrix', 'animatrix-for-elementor' ),
                'tab' => Controls_Manager::TAB_ADVANCED,
            ]
        );

        $this->add_animation_controls( $element );

        $element->end_controls_section();
    }

    private function add_animation_controls( Element_Base $element ) {
        $element->add_control(
            'animatrix_animation',
            [
                'label' => __( 'Animation', 'animatrix-for-elementor' ),
                'type' => Controls_Manager::SELECT,
                'options' => $this->get_animations(),
                'default' => '',
                'prefix_class' => 'animatrix-',
                'render_type' => 'none',
                'frontend_available' => true,
            ]
        );

        $element->add_control(
            'animatrix_trigger',
            [
                'label' => __( 'Trigger', 'animatrix-for-elementor' ),
                'type' => Controls_Manager::SELECT,
                'options' => [
                    '' => __( 'On Load', 'animatrix-for-elementor' ),
                    'hover' => __( 'On Hover', 'animatrix-for-elementor' ),
                    'scroll' => __( 'On Scroll', 'animatrix-for-elementor' ),
                ],
                'default' => '',
                'render_type' => 'none',
                'frontend_available' => true,
            ]
        );

        $element->add_responsive_control(
            'animatrix_duration',
            [
                'label' => __( 'Animation Duration', 'animatrix-for-elementor' ),
                'type' => Controls_Manager::SLIDER,
                'size_units' => [ 's' ],
                'range' => [
                    's' => [
                        'min' => 0.1,
                        'max' => 10,
                        'step' => 0.1,
                    ],
                ],
                'selectors' => [
                    '{{WRAPPER}}' => 'animation-duration: {{SIZE}}s;',
                ],
            ]
        );

        $element->add_responsive_control(
            'animatrix_delay',
            [
                'label' => __( 'Animation Delay', 'animatrix-for-elementor' ),
                'type' => Controls_Manager::SLIDER,
                'size_units' => [ 's' ],
                'range' => [
                    's' => [
                        'min' => 0,
                        'max' => 10,
                        'step' => 0.1,
                    ],
                ],
                'selectors' => [
                    '{{WRAPPER}}' => 'animation-delay: {{SIZE}}s;',
                ],
            ]
        );

        $element->add_control(
            'animatrix_iteration_count',
            [
                'label' => __( 'Animation Iteration Count', 'animatrix-for-elementor' ),
                'type' => Controls_Manager::SELECT,
                'options' => [
                    '' => __( 'Default', 'animatrix-for-elementor' ),
                    '1' => '1',
                    '2' => '2',
                    '3' => '3',
                    'infinite' => __( 'Infinite', 'animatrix-for-elementor' ),
                ],
                'default' => '',
                'selectors' => [
                    '{{WRAPPER}}' => 'animation-iteration-count: {{VALUE}};',
                ],
            ]
        );
    }

    private function get_animations() {
        return [
            '' => __( 'None', 'animatrix-for-elementor' ),
            'fade-in' => __( 'Fade In', 'animatrix-for-elementor' ),
            'slide-in-up' => __( 'Slide In Up', 'animatrix-for-elementor' ),
            'slide-in-down' => __( 'Slide In Down', 'animatrix-for-elementor' ),
            'slide-in-left' => __( 'Slide In Left', 'animatrix-for-elementor' ),
            'slide-in-right' => __( 'Slide In Right', 'animatrix-for-elementor' ),
            'zoom-in' => __( 'Zoom In', 'animatrix-for-elementor' ),
            'zoom-out' => __( 'Zoom Out', 'animatrix-for-elementor' ),
            'rotate-in' => __( 'Rotate In', 'animatrix-for-elementor' ),
            'bounce-in' => __( 'Bounce In', 'animatrix-for-elementor' ),
            'swing' => __( 'Swing', 'animatrix-for-elementor' ),
            'wobble' => __( 'Wobble', 'animatrix-for-elementor' ),
            'pulse' => __( 'Pulse', 'animatrix-for-elementor' ),
            'flash' => __( 'Flash', 'animatrix-for-elementor' ),
            'shake' => __( 'Shake', 'animatrix-for-elementor' ),
            'tada' => __( 'Tada', 'animatrix-for-elementor' ),
            'jello' => __( 'Jello', 'animatrix-for-elementor' ),
            'heart-beat' => __( 'Heart Beat', 'animatrix-for-elementor' ),
            'hinge' => __( 'Hinge', 'animatrix-for-elementor' ),
            'jack-in-the-box' => __( 'Jack In The Box', 'animatrix-for-elementor' ),
            'roll-in' => __( 'Roll In', 'animatrix-for-elementor' ),
            'roll-out' => __( 'Roll Out', 'animatrix-for-elementor' ),
            'light-speed-in' => __( 'Light Speed In', 'animatrix-for-elementor' ),
            'light-speed-out' => __( 'Light Speed Out', 'animatrix-for-elementor' ),
            'flip' => __( 'Flip', 'animatrix-for-elementor' ),
            'flip-in-x' => __( 'Flip In X', 'animatrix-for-elementor' ),
            'flip-in-y' => __( 'Flip In Y', 'animatrix-for-elementor' ),
            'flip-out-x' => __( 'Flip Out X', 'animatrix-for-elementor' ),
            'flip-out-y' => __( 'Flip Out Y', 'animatrix-for-elementor' ),
        ];
    }
}
