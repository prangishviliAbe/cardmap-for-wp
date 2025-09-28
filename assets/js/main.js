(function($) {
    'use strict';

    var Animatrix = {
        init: function() {
            elementorFrontend.hooks.addAction('frontend/element_ready/global', Animatrix.initWidget);
        },

        initWidget: function($scope) {
            var settings = $scope.data('settings') || {};
            var animation = settings.animatrix_animation || '';
            var trigger = settings.animatrix_trigger || '';

            if (!animation) {
                return;
            }

            var animationClass = 'animate__animated animate__' + animation;

            if (trigger === 'hover') {
                $scope.on('mouseenter', function() {
                    $scope.addClass(animationClass).one('animationend', function() {
                        $scope.removeClass(animationClass);
                    });
                });
            } else if (trigger === 'scroll') {
                var observer = new IntersectionObserver(function(entries) {
                    entries.forEach(function(entry) {
                        if (entry.isIntersecting) {
                            $scope.addClass(animationClass).one('animationend', function() {
                                $scope.removeClass(animationClass);
                            });
                            observer.unobserve($scope[0]);
                        }
                    });
                }, { threshold: 0.5 });

                observer.observe($scope[0]);
            } else {
                 var observer = new IntersectionObserver(function(entries) {
                    entries.forEach(function(entry) {
                        if (entry.isIntersecting) {
                            $scope.addClass(animationClass);
                            observer.unobserve($scope[0]);
                        }
                    });
                }, { threshold: 0.1 });

                observer.observe($scope[0]);
            }
        }
    };

    $(window).on('elementor/frontend/init', Animatrix.init);

})(jQuery);
