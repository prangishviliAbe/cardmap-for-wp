<?php
if (!defined('ABSPATH')) {
    exit;
}

class Animatrix_For_Elementor_Lists {

    public static function get_entrance_animations() {
        return [
            '' => __('None', 'elementor-advanced-animations'),
            
            // Enhanced Basic Animations
            'fade-in-up' => __('Fade In Up', 'elementor-advanced-animations'),
            'fade-in-down' => __('Fade In Down', 'elementor-advanced-animations'),
            'fade-in-left' => __('Fade In Left', 'elementor-advanced-animations'),
            'fade-in-right' => __('Fade In Right', 'elementor-advanced-animations'),
            'zoom-in' => __('Zoom In', 'elementor-advanced-animations'),
            'zoom-out' => __('Zoom Out', 'elementor-advanced-animations'),
            'bounce-in' => __('Bounce In', 'elementor-advanced-animations'),
            'slide-in-up' => __('Slide In Up', 'elementor-advanced-animations'),
            'slide-in-down' => __('Slide In Down', 'elementor-advanced-animations'),
            'slide-in-left' => __('Slide In Left', 'elementor-advanced-animations'),
            'slide-in-right' => __('Slide In Right', 'elementor-advanced-animations'),
            
            // 3D Transformations
            'flip-in-x' => __('Flip In X', 'elementor-advanced-animations'),
            'flip-in-y' => __('Flip In Y', 'elementor-advanced-animations'),
            'cube-in-left' => __('Cube In Left', 'elementor-advanced-animations'),
            'cube-in-right' => __('Cube In Right', 'elementor-advanced-animations'),
            'unfold-horizontal' => __('Unfold Horizontal', 'elementor-advanced-animations'),
            'unfold-vertical' => __('Unfold Vertical', 'elementor-advanced-animations'),
            'perspective-left' => __('Perspective Left', 'elementor-advanced-animations'),
            'perspective-right' => __('Perspective Right', 'elementor-advanced-animations'),
            'perspective-up' => __('Perspective Up', 'elementor-advanced-animations'),
            'perspective-down' => __('Perspective Down', 'elementor-advanced-animations'),
            
            // Creative Unique Animations
            'typewriter' => __('Typewriter Effect', 'elementor-advanced-animations'),
            'glitch-in' => __('Glitch In', 'elementor-advanced-animations'),
            'matrix-rain' => __('Matrix Rain', 'elementor-advanced-animations'),
            'particle-explosion' => __('Particle Explosion', 'elementor-advanced-animations'),
            'liquid-morph' => __('Liquid Morph', 'elementor-advanced-animations'),
            'hologram' => __('Hologram', 'elementor-advanced-animations'),
            'neon-glow-in' => __('Neon Glow In', 'elementor-advanced-animations'),
            'digital-noise' => __('Digital Noise', 'elementor-advanced-animations'),
            'origami-fold' => __('Origami Fold', 'elementor-advanced-animations'),
            'paper-airplane' => __('Paper Airplane', 'elementor-advanced-animations'),
            'kaleidoscope' => __('Kaleidoscope', 'elementor-advanced-animations'),
            'prism-shatter' => __('Prism Shatter', 'elementor-advanced-animations'),
            
            // Advanced Physics-Based
            'elastic-in' => __('Elastic In', 'elementor-advanced-animations'),
            'magnetic-pull' => __('Magnetic Pull', 'elementor-advanced-animations'),
            'gravity-drop' => __('Gravity Drop', 'elementor-advanced-animations'),
            'spring-bounce' => __('Spring Bounce', 'elementor-advanced-animations'),
            'pendulum-swing' => __('Pendulum Swing', 'elementor-advanced-animations'),
            'wind-blow' => __('Wind Blow', 'elementor-advanced-animations'),
            'ripple-effect' => __('Ripple Effect', 'elementor-advanced-animations'),
            'wave-pulse' => __('Wave Pulse', 'elementor-advanced-animations'),
            
            // Morphing Animations
            'morph-circle-square' => __('Morph Circle to Square', 'elementor-advanced-animations'),
            'morph-expand' => __('Morph Expand', 'elementor-advanced-animations'),
            'morph-twist' => __('Morph Twist', 'elementor-advanced-animations'),
            'morph-blob' => __('Morph Blob', 'elementor-advanced-animations'),
            
            // Cinematic Effects
            'spotlight' => __('Spotlight', 'elementor-advanced-animations'),
            'curtain-reveal' => __('Curtain Reveal', 'elementor-advanced-animations'),
            'film-reel' => __('Film Reel', 'elementor-advanced-animations'),
            'vintage-tv' => __('Vintage TV On', 'elementor-advanced-animations'),
            'scanner-line' => __('Scanner Line', 'elementor-advanced-animations'),
            'radar-sweep' => __('Radar Sweep', 'elementor-advanced-animations'),
            
            // Geometric Patterns
            'geometric-expand' => __('Geometric Expand', 'elementor-advanced-animations'),
            'hexagon-burst' => __('Hexagon Burst', 'elementor-advanced-animations'),
            'triangle-mosaic' => __('Triangle Mosaic', 'elementor-advanced-animations'),
            'spiral-in' => __('Spiral In', 'elementor-advanced-animations'),
            'fractal-zoom' => __('Fractal Zoom', 'elementor-advanced-animations'),
            
            // Classic Enhanced
            'rotate-in' => __('Rotate In', 'elementor-advanced-animations'),
            'pulse-in' => __('Pulse In', 'elementor-advanced-animations'),
            'swing-in' => __('Swing In', 'elementor-advanced-animations'),
            'wobble-in' => __('Wobble In', 'elementor-advanced-animations'),
            'tada-in' => __('Tada In', 'elementor-advanced-animations'),
            'jack-in-box' => __('Jack In The Box', 'elementor-advanced-animations'),
            'roll-in' => __('Roll In', 'elementor-advanced-animations'),
            'light-speed-in' => __('Light Speed In', 'elementor-advanced-animations'),
        ];
    }

    public static function get_scroll_animations() {
        return [
            '' => __('None', 'elementor-advanced-animations'),
            
            // Basic Scroll Effects
            'parallax' => __('Parallax', 'elementor-advanced-animations'),
            'parallax-reverse' => __('Parallax Reverse', 'elementor-advanced-animations'),
            'scale-on-scroll' => __('Scale On Scroll', 'elementor-advanced-animations'),
            'scale-reverse' => __('Scale Reverse', 'elementor-advanced-animations'),
            'fade-on-scroll' => __('Fade On Scroll', 'elementor-advanced-animations'),
            'fade-reverse' => __('Fade Reverse', 'elementor-advanced-animations'),
            'blur-on-scroll' => __('Blur On Scroll', 'elementor-advanced-animations'),
            'slide-on-scroll' => __('Slide On Scroll', 'elementor-advanced-animations'),
            'rotate-on-scroll' => __('Rotate On Scroll', 'elementor-advanced-animations'),
            'skew-on-scroll' => __('Skew On Scroll', 'elementor-advanced-animations'),
            
            // Advanced 3D Scroll Effects
            'perspective-scroll' => __('Perspective Scroll', 'elementor-advanced-animations'),
            'cube-scroll' => __('Cube Scroll', 'elementor-advanced-animations'),
            'cylinder-roll' => __('Cylinder Roll', 'elementor-advanced-animations'),
            'book-flip' => __('Book Flip', 'elementor-advanced-animations'),
            'card-stack' => __('Card Stack', 'elementor-advanced-animations'),
            'depth-layers' => __('Depth Layers', 'elementor-advanced-animations'),
            
            // Creative Unique Scroll
            'liquid-morph' => __('Liquid Morph', 'elementor-advanced-animations'),
            'particle-trail' => __('Particle Trail', 'elementor-advanced-animations'),
            'magnetic-field' => __('Magnetic Field', 'elementor-advanced-animations'),
            'gravity-well' => __('Gravity Well', 'elementor-advanced-animations'),
            'time-warp' => __('Time Warp', 'elementor-advanced-animations'),
            'dimension-shift' => __('Dimension Shift', 'elementor-advanced-animations'),
            'portal-effect' => __('Portal Effect', 'elementor-advanced-animations'),
            'matrix-code' => __('Matrix Code', 'elementor-advanced-animations'),
            'hologram-flicker' => __('Hologram Flicker', 'elementor-advanced-animations'),
            'digital-glitch' => __('Digital Glitch', 'elementor-advanced-animations'),
            
            // Interactive Elements
            'reveal-mask' => __('Reveal Mask', 'elementor-advanced-animations'),
            'typewriter-scroll' => __('Typewriter Scroll', 'elementor-advanced-animations'),
            'counter-scroll' => __('Counter Scroll', 'elementor-advanced-animations'),
            'progress-bar' => __('Progress Bar', 'elementor-advanced-animations'),
            'loading-bar' => __('Loading Bar', 'elementor-advanced-animations'),
            'step-indicator' => __('Step Indicator', 'elementor-advanced-animations'),
            
            // Nature-Inspired
            'wave-motion' => __('Wave Motion', 'elementor-advanced-animations'),
            'ocean-swell' => __('Ocean Swell', 'elementor-advanced-animations'),
            'wind-sway' => __('Wind Sway', 'elementor-advanced-animations'),
            'leaf-flutter' => __('Leaf Flutter', 'elementor-advanced-animations'),
            'fire-flicker' => __('Fire Flicker', 'elementor-advanced-animations'),
            'water-ripple' => __('Water Ripple', 'elementor-advanced-animations'),
            
            // Geometric Patterns
            'mosaic-reveal' => __('Mosaic Reveal', 'elementor-advanced-animations'),
            'hexagon-expand' => __('Hexagon Expand', 'elementor-advanced-animations'),
            'triangle-shift' => __('Triangle Shift', 'elementor-advanced-animations'),
            'spiral-scroll' => __('Spiral Scroll', 'elementor-advanced-animations'),
            'kaleidoscope-turn' => __('Kaleidoscope Turn', 'elementor-advanced-animations'),
            
            // Cinematic Effects
            'film-strip' => __('Film Strip', 'elementor-advanced-animations'),
            'lens-flare' => __('Lens Flare', 'elementor-advanced-animations'),
            'zoom-blur' => __('Zoom Blur', 'elementor-advanced-animations'),
            'vintage-film' => __('Vintage Film', 'elementor-advanced-animations'),
            'scanner-sweep' => __('Scanner Sweep', 'elementor-advanced-animations'),
            'radar-pulse' => __('Radar Pulse', 'elementor-advanced-animations'),
        ];
    }

    public static function get_hover_animations() {
        return [
            '' => __('None', 'elementor-advanced-animations'),
            
            // Smooth Transform Effects
            'lift-up' => __('Lift Up', 'elementor-advanced-animations'),
            'lift-down' => __('Lift Down', 'elementor-advanced-animations'),
            'grow-smooth' => __('Grow Smooth', 'elementor-advanced-animations'),
            'shrink-smooth' => __('Shrink Smooth', 'elementor-advanced-animations'),
            'tilt-left' => __('Tilt Left', 'elementor-advanced-animations'),
            'tilt-right' => __('Tilt Right', 'elementor-advanced-animations'),
            'rotate-clockwise' => __('Rotate Clockwise', 'elementor-advanced-animations'),
            'rotate-counter' => __('Rotate Counter-Clockwise', 'elementor-advanced-animations'),
            'skew-forward' => __('Skew Forward', 'elementor-advanced-animations'),
            'skew-backward' => __('Skew Backward', 'elementor-advanced-animations'),
            
            // 3D Perspective Effects
            'flip-horizontal' => __('Flip Horizontal', 'elementor-advanced-animations'),
            'flip-vertical' => __('Flip Vertical', 'elementor-advanced-animations'),
            'cube-rotate-x' => __('Cube Rotate X', 'elementor-advanced-animations'),
            'cube-rotate-y' => __('Cube Rotate Y', 'elementor-advanced-animations'),
            'perspective-flip' => __('Perspective Flip', 'elementor-advanced-animations'),
            'depth-push' => __('Depth Push', 'elementor-advanced-animations'),
            'depth-pull' => __('Depth Pull', 'elementor-advanced-animations'),
            
            // Glow & Shadow Effects
            'neon-glow' => __('Neon Glow', 'elementor-advanced-animations'),
            'soft-glow' => __('Soft Glow', 'elementor-advanced-animations'),
            'inner-glow' => __('Inner Glow', 'elementor-advanced-animations'),
            'shadow-drop' => __('Shadow Drop', 'elementor-advanced-animations'),
            'shadow-lift' => __('Shadow Lift', 'elementor-advanced-animations'),
            'shadow-spread' => __('Shadow Spread', 'elementor-advanced-animations'),
            'color-shadow' => __('Color Shadow', 'elementor-advanced-animations'),
            
            // Border & Outline Effects
            'border-grow' => __('Border Grow', 'elementor-advanced-animations'),
            'border-pulse' => __('Border Pulse', 'elementor-advanced-animations'),
            'border-rainbow' => __('Border Rainbow', 'elementor-advanced-animations'),
            'outline-draw' => __('Outline Draw', 'elementor-advanced-animations'),
            'frame-expand' => __('Frame Expand', 'elementor-advanced-animations'),
            
            // Color & Gradient Effects
            'color-shift' => __('Color Shift', 'elementor-advanced-animations'),
            'gradient-slide' => __('Gradient Slide', 'elementor-advanced-animations'),
            'rainbow-wave' => __('Rainbow Wave', 'elementor-advanced-animations'),
            'hue-rotate' => __('Hue Rotate', 'elementor-advanced-animations'),
            'invert-colors' => __('Invert Colors', 'elementor-advanced-animations'),
            'grayscale-pop' => __('Grayscale Pop', 'elementor-advanced-animations'),
            
            // Creative Unique Effects
            'magnetic-attract' => __('Magnetic Attract', 'elementor-advanced-animations'),
            'liquid-wobble' => __('Liquid Wobble', 'elementor-advanced-animations'),
            'elastic-bounce' => __('Elastic Bounce', 'elementor-advanced-animations'),
            'jelly-shake' => __('Jelly Shake', 'elementor-advanced-animations'),
            'rubber-stretch' => __('Rubber Stretch', 'elementor-advanced-animations'),
            'spring-compress' => __('Spring Compress', 'elementor-advanced-animations'),
            
            // Particle & Texture Effects
            'sparkle-burst' => __('Sparkle Burst', 'elementor-advanced-animations'),
            'pixel-dissolve' => __('Pixel Dissolve', 'elementor-advanced-animations'),
            'noise-texture' => __('Noise Texture', 'elementor-advanced-animations'),
            'holographic' => __('Holographic', 'elementor-advanced-animations'),
            'chrome-reflection' => __('Chrome Reflection', 'elementor-advanced-animations'),
            
            // Motion Effects
            'float-gentle' => __('Float Gentle', 'elementor-advanced-animations'),
            'sway-left-right' => __('Sway Left Right', 'elementor-advanced-animations'),
            'bob-up-down' => __('Bob Up Down', 'elementor-advanced-animations'),
            'wiggle' => __('Wiggle', 'elementor-advanced-animations'),
            'pendulum' => __('Pendulum', 'elementor-advanced-animations'),
            'orbit' => __('Orbit', 'elementor-advanced-animations'),
            
            // Text-Specific Effects
            'typewriter-reveal' => __('Typewriter Reveal', 'elementor-advanced-animations'),
            'letter-spacing' => __('Letter Spacing', 'elementor-advanced-animations'),
            'text-glow-pulse' => __('Text Glow Pulse', 'elementor-advanced-animations'),
            'character-dance' => __('Character Dance', 'elementor-advanced-animations'),
            
            // Scale & Zoom Effects
            'zoom-in-smooth' => __('Zoom In Smooth', 'elementor-advanced-animations'),
            'zoom-out-smooth' => __('Zoom Out Smooth', 'elementor-advanced-animations'),
            'scale-x' => __('Scale X', 'elementor-advanced-animations'),
            'scale-y' => __('Scale Y', 'elementor-advanced-animations'),
            'pulse-scale' => __('Pulse Scale', 'elementor-advanced-animations'),
            'breathe' => __('Breathe', 'elementor-advanced-animations'),
        ];
    }
     public static function get_exit_animations() {
        return [
            '' => __('None', 'elementor-advanced-animations'),
            'fade-out' => __('Fade Out', 'elementor-advanced-animations'),
            'fade-out-up' => __('Fade Out Up', 'elementor-advanced-animations'),
            'fade-out-down' => __('Fade Out Down', 'elementor-advanced-animations'),
            'fade-out-left' => __('Fade Out Left', 'elementor-advanced-animations'),
            'fade-out-right' => __('Fade Out Right', 'elementor-advanced-animations'),
            'zoom-out' => __('Zoom Out', 'elementor-advanced-animations'),
            'zoom-out-up' => __('Zoom Out Up', 'elementor-advanced-animations'),
            'zoom-out-down' => __('Zoom Out Down', 'elementor-advanced-animations'),
            'zoom-out-left' => __('Zoom Out Left', 'elementor-advanced-animations'),
            'zoom-out-right' => __('Zoom Out Right', 'elementor-advanced-animations'),
            'slide-out-left' => __('Slide Out Left', 'elementor-advanced-animations'),
            'slide-out-right' => __('Slide Out Right', 'elementor-advanced-animations'),
            'slide-out-up' => __('Slide Out Up', 'elementor-advanced-animations'),
            'slide-out-down' => __('Slide Out Down', 'elementor-advanced-animations'),
            'bounce-out' => __('Bounce Out', 'elementor-advanced-animations'),
            'bounce-out-down' => __('Bounce Out Down', 'elementor-advanced-animations'),
            'bounce-out-left' => __('Bounce Out Left', 'elementor-advanced-animations'),
            'bounce-out-right' => __('Bounce Out Right', 'elementor-advanced-animations'),
            'bounce-out-up' => __('Bounce Out Up', 'elementor-advanced-animations'),
            'fade-out-down-big' => __('Fade Out Down Big', 'elementor-advanced-animations'),
            'fade-out-left-big' => __('Fade Out Left Big', 'elementor-advanced-animations'),
            'fade-out-right-big' => __('Fade Out Right Big', 'elementor-advanced-animations'),
            'fade-out-up-big' => __('Fade Out Up Big', 'elementor-advanced-animations'),
            'flip-out-x' => __('Flip Out X', 'elementor-advanced-animations'),
            'flip-out-y' => __('Flip Out Y', 'elementor-advanced-animations'),
            'light-speed-out' => __('Light Speed Out', 'elementor-advanced-animations'),
            'rotate-out-down-left' => __('Rotate Out Down Left', 'elementor-advanced-animations'),
            'rotate-out-down-right' => __('Rotate Out Down Right', 'elementor-advanced-animations'),
            'rotate-out-up-left' => __('Rotate Out Up Left', 'elementor-advanced-animations'),
            'rotate-out-up-right' => __('Rotate Out Up Right', 'elementor-advanced-animations'),
            'roll-out' => __('Roll Out', 'elementor-advanced-animations'),
            'zoom-out-down' => __('Zoom Out Down', 'elementor-advanced-animations'),
            'zoom-out-left' => __('Zoom Out Left', 'elementor-advanced-animations'),
            'zoom-out-right' => __('Zoom Out Right', 'elementor-advanced-animations'),
            'zoom-out-up' => __('Zoom Out Up', 'elementor-advanced-animations'),
            'slide-out-down' => __('Slide Out Down', 'elementor-advanced-animations'),
            'slide-out-left' => __('Slide Out Left', 'elementor-advanced-animations'),
            'slide-out-right' => __('Slide Out Right', 'elementor-advanced-animations'),
            'slide-out-up' => __('Slide Out Up', 'elementor-advanced-animations'),
        ];
    }
}
