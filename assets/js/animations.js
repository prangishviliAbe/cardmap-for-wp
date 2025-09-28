(function($) {
    'use strict';

    var scrollAnimations = {
        'parallax': function($element, settings) {
            var offset = $element.offset().top;
            var scrollTop = $(window).scrollTop();
            var windowHeight = $(window).height();
            var speed = settings.scroll_animation_speed || 0.5;

            if (offset < scrollTop + windowHeight && offset + $element.height() > scrollTop) {
                var yPos = -((scrollTop - offset) * speed);
                $element.css('background-position', '50% ' + yPos + 'px');
            }
        },
        'scale-on-scroll': function($element, settings) {
            var offset = $element.offset().top;
            var scrollTop = $(window).scrollTop();
            var windowHeight = $(window).height();
            var scale = 1;
            var animationOffset = settings.scroll_animation_offset ? settings.scroll_animation_offset.size / 100 : 0.5;

            if (scrollTop > offset - windowHeight * animationOffset) {
                var progress = (scrollTop - (offset - windowHeight * animationOffset)) / (windowHeight * (1 - animationOffset));
                scale = 1 - Math.min(0.2, progress * 0.2);
                $element.css('transform', 'scale(' + scale + ')');
            }
        },
        'fade-on-scroll': function($element, settings) {
            var offset = $element.offset().top;
            var scrollTop = $(window).scrollTop();
            var windowHeight = $(window).height();
            var opacity = 1;
            var animationOffset = settings.scroll_animation_offset ? settings.scroll_animation_offset.size / 100 : 0.5;

            if (scrollTop > offset - windowHeight * animationOffset) {
                var progress = (scrollTop - (offset - windowHeight * animationOffset)) / (windowHeight * (1 - animationOffset));
                opacity = 1 - Math.min(1, progress);
                $element.css('opacity', opacity);
            }
        },
        'blur-on-scroll': function($element, settings) {
            var offset = $element.offset().top;
            var scrollTop = $(window).scrollTop();
            var windowHeight = $(window).height();
            var blur = 0;
            var animationOffset = settings.scroll_animation_offset ? settings.scroll_animation_offset.size / 100 : 0.5;

            if (scrollTop > offset - windowHeight * animationOffset) {
                var progress = (scrollTop - (offset - windowHeight * animationOffset)) / (windowHeight * (1 - animationOffset));
                blur = Math.min(10, progress * 10);
                $element.css('filter', 'blur(' + blur + 'px)');
            }
        },
        'slide-on-scroll': function($element, settings) {
            var offset = $element.offset().top;
            var scrollTop = $(window).scrollTop();
            var windowHeight = $(window).height();
            var translateX = 0;
            var animationOffset = settings.scroll_animation_offset ? settings.scroll_animation_offset.size / 100 : 0.5;

            if (scrollTop > offset - windowHeight * animationOffset) {
                var progress = (scrollTop - (offset - windowHeight * animationOffset)) / (windowHeight * (1 - animationOffset));
                translateX = -Math.min(100, progress * 100);
                $element.css('transform', 'translateX(' + translateX + 'px)');
            }
        },
        'rotate-on-scroll': function($element, settings) {
            var offset = $element.offset().top;
            var scrollTop = $(window).scrollTop();
            var windowHeight = $(window).height();
            var rotate = 0;
            var animationOffset = settings.scroll_animation_offset ? settings.scroll_animation_offset.size / 100 : 0.5;

            if (scrollTop > offset - windowHeight * animationOffset) {
                var progress = (scrollTop - (offset - windowHeight * animationOffset)) / (windowHeight * (1 - animationOffset));
                rotate = Math.min(90, progress * 90);
                $element.css('transform', 'rotate(' + rotate + 'deg)');
            }
        }
    };

    function applyScrollAnimations() {
        $('[data-advanced_scroll_animation]').each(function() {
            var $element = $(this);
            var settings = $element.data('settings');
            var animation = settings.advanced_scroll_animation;

            if (scrollAnimations[animation]) {
                scrollAnimations[animation]($element, settings);
            }
        });
    }

    $(window).on('scroll', applyScrollAnimations);
    $(window).on('resize', applyScrollAnimations);
    $(document).ready(function() {
        // Initial call
        applyScrollAnimations();

        // Elementor frontend load
        $(document).on('elementor/frontend/init', function() {
            elementorFrontend.hooks.addAction('frontend/element_ready/global', function($scope) {
                applyScrollAnimations();
            });
        });

        // Enhanced hover animation handling
        function initHoverAnimations() {
            // Ensure smooth transitions for all hover elements
            $('[class*="advanced-hover-"]').each(function() {
                const $element = $(this);
                const classes = $element.attr('class').split(' ');
                
                // Add performance optimization
                $element.css({
                    'backface-visibility': 'hidden',
                    'transform': 'translateZ(0)',
                    'will-change': 'transform, opacity, filter'
                });
                
                // Handle typewriter effect character counting
                if ($element.hasClass('advanced-hover-typewriter-reveal') || $element.hasClass('advanced-animation-typewriter')) {
                    const text = $element.text();
                    $element.css('--char-count', text.length);
                }
            });
        }

        // Initialize entrance animations with improved triggers
        function initEntranceAnimations() {
            $('[class*="advanced-animation-"]').each(function() {
                const $element = $(this);
                
                // Add intersection observer for better performance
                if ('IntersectionObserver' in window) {
                    const observer = new IntersectionObserver((entries) => {
                        entries.forEach((entry) => {
                            if (entry.isIntersecting) {
                                $(entry.target).addClass('animate-in-view');
                                observer.unobserve(entry.target);
                            }
                        });
                    }, {
                        threshold: 0.1,
                        rootMargin: '50px'
                    });
                    
                    observer.observe(this);
                } else {
                    // Fallback for older browsers
                    $element.addClass('animate-in-view');
                }
            });
        }

        // Performance optimization for reduced motion
        function respectReducedMotion() {
            if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                $('body').addClass('reduced-motion');
            }
        }

        // Initialize all enhancements
        function initAnimatrixEnhancements() {
            initHoverAnimations();
            initEntranceAnimations();
            respectReducedMotion();
        }

        // Run on document ready
        $(document).ready(function() {
            initAnimatrixEnhancements();
        });
    });

})(jQuery);
