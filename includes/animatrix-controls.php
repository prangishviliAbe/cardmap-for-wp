<?php

if (!defined('ABSPATH')) {
    exit;
}

class Animatrix_For_Elementor_Controls {

    public static function add_animation_sections($element, $section_id, $args) {
        $sections = ['section_effects', 'section_background', 'section_advanced'];
        
        if (in_array($section_id, $sections)) {
            self::add_entrance_animations_section($element);
            self::add_scroll_animations_section($element);
            self::add_hover_animations_section($element);
            self::add_exit_animations_section($element);
        }
    }

    private static function add_entrance_animations_section($element) {
        $element->start_controls_section(
            'advanced_animations_entrance',
            [
                'label' => __('Advanced Entrance Animations', 'elementor-advanced-animations'),
                'tab' => \Elementor\Controls_Manager::TAB_ADVANCED,
            ]
        );

        $element->add_control(
            'advanced_entrance_animation',
            [
                'label' => __('Entrance Animation', 'elementor-advanced-animations'),
                'type' => \Elementor\Controls_Manager::SELECT,
                'default' => '',
                'options' => Animatrix_For_Elementor_Lists::get_entrance_animations(),
                'prefix_class' => 'advanced-animation-',
                'frontend_available' => true,
            ]
        );

        $element->add_control(
            'advanced_animation_duration',
            [
                'label' => __('Animation Duration (ms)', 'elementor-advanced-animations'),
                'type' => \Elementor\Controls_Manager::SLIDER,
                'range' => [
                    'px' => [
                        'min' => 100,
                        'max' => 3000,
                        'step' => 100,
                    ],
                ],
                'default' => [
                    'size' => 1000,
                ],
                'condition' => [
                    'advanced_entrance_animation!' => '',
                ],
                'selectors' => [
                    '{{WRAPPER}}' => '--advanced-animation-duration: {{SIZE}}ms;',
                ],
            ]
        );

        $element->add_control(
            'advanced_animation_delay',
            [
                'label' => __('Animation Delay (ms)', 'elementor-advanced-animations'),
                'type' => \Elementor\Controls_Manager::SLIDER,
                'range' => [
                    'px' => [
                        'min' => 0,
                        'max' => 5000,
                        'step' => 100,
                    ],
                ],
                'default' => [
                    'size' => 0,
                ],
                'condition' => [
                    'advanced_entrance_animation!' => '',
                ],
                'selectors' => [
                    '{{WRAPPER}}' => '--advanced-animation-delay: {{SIZE}}ms;',
                ],
            ]
        );

        $element->end_controls_section();
    }

    private static function add_scroll_animations_section($element) {
        $element->start_controls_section(
            'advanced_animations_scroll',
            [
                'label' => __('Advanced Scroll Animations', 'elementor-advanced-animations'),
                'tab' => \Elementor\Controls_Manager::TAB_ADVANCED,
            ]
        );

        $element->add_control(
            'advanced_scroll_animation',
            [
                'label' => __('Scroll Animation', 'elementor-advanced-animations'),
                'type' => \Elementor\Controls_Manager::SELECT,
                'default' => '',
                'options' => Animatrix_For_Elementor_Lists::get_scroll_animations(),
                'frontend_available' => true,
            ]
        );

        $element->add_control(
            'scroll_animation_offset',
            [
                'label' => __('Animation Offset (%)', 'elementor-advanced-animations'),
                'type' => \Elementor\Controls_Manager::SLIDER,
                'range' => [
                    '%' => [
                        'min' => 0,
                        'max' => 100,
                    ],
                ],
                'default' => [
                    'size' => 50,
                ],
                'condition' => [
                    'advanced_scroll_animation!' => '',
                ],
            ]
        );

        $element->add_control(
            'scroll_animation_duration',
            [
                'label' => __('Scroll Duration (ms)', 'elementor-advanced-animations'),
                'type' => \Elementor\Controls_Manager::SLIDER,
                'range' => [
                    'px' => [
                        'min' => 100,
                        'max' => 3000,
                        'step' => 100,
                    ],
                ],
                'default' => [
                    'size' => 1000,
                ],
                'condition' => [
                    'advanced_scroll_animation!' => '',
                ],
            ]
        );

        $element->end_controls_section();
    }

    private static function add_hover_animations_section($element) {
        $element->start_controls_section(
            'advanced_animations_hover',
            [
                'label' => __('Advanced Hover Animations', 'elementor-advanced-animations'),
                'tab' => \Elementor\Controls_Manager::TAB_ADVANCED,
            ]
        );

        $element->add_control(
            'advanced_hover_animation',
            [
                'label' => __('Hover Animation', 'elementor-advanced-animations'),
                'type' => \Elementor\Controls_Manager::SELECT,
                'default' => '',
                'options' => Animatrix_For_Elementor_Lists::get_hover_animations(),
                'prefix_class' => 'advanced-hover-',
                'frontend_available' => true,
            ]
        );

        $element->add_control(
            'hover_animation_duration',
            [
                'label' => __('Hover Duration (ms)', 'elementor-advanced-animations'),
                'type' => \Elementor\Controls_Manager::SLIDER,
                'range' => [
                    'px' => [
                        'min' => 100,
                        'max' => 3000,
                        'step' => 100,
                    ],
                ],
                'default' => [
                    'size' => 300,
                ],
                'condition' => [
                    'advanced_hover_animation!' => '',
                ],
                'selectors' => [
                    '{{WRAPPER}}' => '--advanced-hover-duration: {{SIZE}}ms;',
                ],
            ]
        );

        $element->add_control(
            'smooth_hover_out',
            [
                'label' => __('Smooth Hover Out', 'elementor-advanced-animations'),
                'type' => \Elementor\Controls_Manager::SWITCHER,
                'label_on' => __('Yes', 'elementor-advanced-animations'),
                'label_off' => __('No', 'elementor-advanced-animations'),
                'return_value' => 'smooth-hover-out',
                'default' => '',
                'prefix_class' => '',
                'condition' => [
                    'advanced_hover_animation!' => '',
                ],
            ]
        );

        $element->end_controls_section();
    }

    private static function add_exit_animations_section($element) {
        $element->start_controls_section(
            'advanced_animations_exit',
            [
                'label' => __('Advanced Exit Animations', 'elementor-advanced-animations'),
                'tab' => \Elementor\Controls_Manager::TAB_ADVANCED,
            ]
        );

        $element->add_control(
            'advanced_exit_animation',
            [
                'label' => __('Exit Animation', 'elementor-advanced-animations'),
                'type' => \Elementor\Controls_Manager::SELECT,
                'default' => '',
                'options' => Animatrix_For_Elementor_Lists::get_exit_animations(),
                'prefix_class' => 'advanced-animation-',
                'frontend_available' => true,
            ]
        );

        $element->add_control(
            'advanced_exit_animation_duration',
            [
                'label' => __('Animation Duration (ms)', 'elementor-advanced-animations'),
                'type' => \Elementor\Controls_Manager::SLIDER,
                'range' => [
                    'px' => [
                        'min' => 100,
                        'max' => 3000,
                        'step' => 100,
                    ],
                ],
                'default' => [
                    'size' => 1000,
                ],
                'condition' => [
                    'advanced_exit_animation!' => '',
                ],
                'selectors' => [
                    '{{WRAPPER}}' => '--advanced-animation-duration: {{SIZE}}ms;',
                ],
            ]
        );

        $element->add_control(
            'advanced_exit_animation_delay',
            [
                'label' => __('Animation Delay (ms)', 'elementor-advanced-animations'),
                'type' => \Elementor\Controls_Manager::SLIDER,
                'range' => [
                    'px' => [
                        'min' => 0,
                        'max' => 5000,
                        'step' => 100,
                    ],
                ],
                'default' => [
                    'size' => 0,
                ],
                'condition' => [
                    'advanced_exit_animation!' => '',
                ],
                'selectors' => [
                    '{{WRAPPER}}' => '--advanced-animation-delay: {{SIZE}}ms;',
                ],
            ]
        );

        $element->end_controls_section();
    }
}