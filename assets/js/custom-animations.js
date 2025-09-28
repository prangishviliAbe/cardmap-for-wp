(function($){
    "use strict";

    $(window).on('elementor/frontend/init', function() {
        // Scroll animations
        function initScrollAnimations() {
            $('.eca-scroll-animation').each(function() {
                var $element = $(this);
                var animation = $element.data('eca-scroll-animation');
                var duration = $element.data('eca-scroll-duration') || 1000;
                var delay = $element.data('eca-scroll-delay') || 0;
                var threshold = parseFloat($element.data('eca-scroll-threshold')) || 0.1;

                // Set custom duration and delay
                $element.css({
                    'animation-duration': duration + 'ms',
                    'animation-delay': delay + 'ms'
                });

                // Add specific class for chosen animation so CSS rules can apply
                if (animation) {
                    $element.addClass(animation);
                }

                // Create Intersection Observer
                var observer = new IntersectionObserver(function(entries) {
                    entries.forEach(function(entry) {
                        if (entry.isIntersecting) {
                            setTimeout(function() {
                                $element.addClass('eca-scroll-animated');
                            }, delay);
                            observer.unobserve(entry.target);
                        }
                    });
                }, {
                    threshold: threshold
                });

                observer.observe(this);
            });
        }

        // Initialize on load
        initScrollAnimations();

        // Re-initialize when Elementor elements are rendered
        elementorFrontend.hooks.addAction('frontend/element_ready/widget', initScrollAnimations);
        elementorFrontend.hooks.addAction('frontend/element_ready/section', initScrollAnimations);
        elementorFrontend.hooks.addAction('frontend/element_ready/column', initScrollAnimations);
        elementorFrontend.hooks.addAction('frontend/element_ready/container', initScrollAnimations);
    });
})(jQuery);
