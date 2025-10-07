document.addEventListener('DOMContentLoaded', function() {
    // Check for URL parameters to auto-enter fullscreen
    const urlParams = new URLSearchParams(window.location.search);
    const autoCardmapId = urlParams.get('cardmap_id');
    const autoFullscreen = urlParams.get('fullscreen') === '1';

    // The cardmap_frontend_data is now an object where keys are map IDs.
    if (typeof cardmap_frontend_data === 'undefined' || Object.keys(cardmap_frontend_data).length === 0) {
        return;
    }

    document.querySelectorAll('.cardmap-frontend-wrapper').forEach(wrapper => {
        const mapId = wrapper.dataset.mapId;
        if (!mapId || !cardmap_frontend_data[mapId]) {
            return;
        }

        // Auto-enter fullscreen if URL parameters match this map
        if (autoCardmapId && autoCardmapId === mapId && autoFullscreen) {
            setTimeout(() => {
                wrapper.requestFullscreen().catch(err => {
                    console.warn('Auto-fullscreen failed:', err);
                });
            }, 100); // Small delay to ensure everything is loaded
        }

        const mapConfig = cardmap_frontend_data[mapId];
        const mapData = mapConfig.map_data;
        const panZoomContainer = wrapper.querySelector('.cardmap-pan-zoom-container');

        console.log('Frontend map config:', mapConfig);
        console.log('Frontend map data:', mapData);
        console.log('Rails in map data:', mapData.rails);
        console.log('Show rail thickness setting:', mapConfig.show_rail_thickness);

        if (!panZoomContainer || !mapData) {
            return;
        }

        function getConnectorConfig(style, color, thickness, rail_size) {
            // Default rail thickness when not provided should be 3px
            const railSize = rail_size ? parseInt(rail_size, 10) : 3;
            const baseConfig = { stroke: color, strokeWidth: thickness };
            const overlays = [["Arrow",{ width:10, length:10, location:1 }]];
            const dashedOverlay = { stroke: color, strokeWidth: thickness, dashstyle: "4 2" };
            const dottedOverlay = { stroke: color, strokeWidth: thickness, dashstyle: "1 1" };

            switch (style) {
                case 'bezier':
                case 'rounded-bezier':
                    return { connector: ["Bezier", {curviness: 50}], paintStyle: baseConfig, overlays: [] };
                case 'straight':
                    return { connector: ["Straight"], paintStyle: baseConfig, overlays: [] };
                case 'flowchart':
                    return { connector: ["Flowchart"], paintStyle: baseConfig, overlays: [] };
                case 'state-machine':
                    return { connector: ["StateMachine", { curviness: 20, margin: 5, proximity: 10 }], paintStyle: baseConfig, overlays: [] };
                case 'straight-with-arrows':
                    return { connector: ["Straight"], paintStyle: baseConfig, overlays: overlays };
                case 'flowchart-with-arrows':
                    return { connector: ["Flowchart"], paintStyle: baseConfig, overlays: overlays };
                case 'diagonal':
                    return { connector: ["Straight"], paintStyle: baseConfig, anchors: ["TopLeft", "BottomRight"], overlays: [] };
                case 'dashed':
                    return { connector: ["Straight"], paintStyle: dashedOverlay, overlays: [] };
                case 'dotted':
                    return { connector: ["Straight"], paintStyle: dottedOverlay, overlays: [] };
                case 'rail':
                    return {
                        connector: ["StateMachine", { curviness: 0, margin: 5, proximity: 10 }],
                        paintStyle: { stroke: color, strokeWidth: railSize, "stroke-dasharray": "0" },
                        hoverPaintStyle: { stroke: color, strokeWidth: railSize, "stroke-dasharray": "0" },
                        overlays: []
                    };
                default:
                    return { connector: ["Straight"], paintStyle: baseConfig, overlays: overlays };
            }
        }

        function getDirectionalAnchorsFrontend(sourceEl, targetEl) {
            if (!sourceEl || !targetEl) return ["Continuous", "Continuous"];
            const s = sourceEl.getBoundingClientRect();
            const t = targetEl.getBoundingClientRect();
            const dx = (t.left + t.right) / 2 - (s.left + s.right) / 2;
            const dy = (t.top + t.bottom) / 2 - (s.top + s.bottom) / 2;
            return Math.abs(dx) > Math.abs(dy)
                ? (dx > 0 ? ["RightMiddle", "LeftMiddle"] : ["LeftMiddle", "RightMiddle"])
                : (dy > 0 ? ["BottomCenter", "TopCenter"] : ["TopCenter", "BottomCenter"]);
        }

        const instance = jsPlumb.getInstance({
            Container: panZoomContainer,
            ConnectionsDetachable: false
        });

        // Initialize rails as jsPlumb endpoints first
        const rails = panZoomContainer.querySelectorAll('.cardmap-rail');
        rails.forEach(railEl => {
            try {
                // Ensure rail has proper ID before initializing
                if (!railEl.id) {
                    console.warn('Rail missing ID, skipping jsPlumb initialization');
                    return;
                }

                console.log('Initializing rail as jsPlumb endpoint:', railEl.id, railEl);

                instance.makeSource(railEl, {
                    anchor: ["Continuous"],
                    endpoint: "Blank",
                    maxConnections: -1
                });
                instance.makeTarget(railEl, {
                    anchor: ["Continuous"],
                    endpoint: "Blank",
                    maxConnections: -1
                });
                console.log('Rail initialized as jsPlumb endpoint:', railEl.id);
            } catch (err) {
                console.error('Error initializing rail as jsPlumb endpoint:', railEl.id, err);
            }
        });

        // Create connections after a short delay to ensure rails are fully initialized
        setTimeout(() => {
            instance.batch(() => {
                if (mapData.connections) {
                    mapData.connections.forEach((c, index) => {
                    try {
                        console.log('Processing connection:', c, 'Source:', c.source, 'Target:', c.target);
                        if (!c.source || !c.target) {
                            console.warn('Connection missing source or target:', c);
                            return;
                        }

                        const sourceEl = panZoomContainer.querySelector('#' + c.source);
                        const targetEl = panZoomContainer.querySelector('#' + c.target);
                        console.log('Found elements:', {
                            source: !!sourceEl,
                            target: !!targetEl,
                            sourceId: c.source,
                            targetId: c.target,
                            sourceElId: sourceEl?.id,
                            targetElId: targetEl?.id
                        });

                        if (sourceEl && targetEl) {
                            const connStyle = c.style || 'straight-with-arrows';
                            let config = getConnectorConfig(connStyle, mapConfig.line_color, mapConfig.line_thickness, c.rail_size);

                            // If the connection is attached to a rail that has a visual appearance,
                            // try to make the connector visually match the rail (color/thickness/dash).
                            try {
                                const sourceIsRail = sourceEl.classList && sourceEl.classList.contains('cardmap-rail');
                                const targetIsRail = targetEl.classList && targetEl.classList.contains('cardmap-rail');
                                const railEl = sourceIsRail ? sourceEl : (targetIsRail ? targetEl : null);
                                if (railEl) {
                                    const railStyle = railEl.dataset.railStyle || railEl.getAttribute('data-rail-style') || '';
                                    const railColor = railEl.dataset.railColor || railEl.getAttribute('data-rail-color') || mapConfig.line_color;
                                    const railSize = parseInt(railEl.dataset.railSize || railEl.getAttribute('data-rail-size') || c.rail_size || mapConfig.line_thickness, 10) || mapConfig.line_thickness;

                                    // Start from the current config and override paintStyle properties
                                    const overridden = Object.assign({}, config);
                                    overridden.paintStyle = Object.assign({}, overridden.paintStyle || {});
                                    overridden.paintStyle.stroke = railColor;
                                    overridden.paintStyle.strokeWidth = railStyle === 'double-line' ? Math.max(2, Math.round(railSize * 1.5)) : Math.max(1, railSize);

                                    // Map some rail visual styles to dash patterns for connectors
                                    if (railStyle === 'dash-heavy') {
                                        overridden.paintStyle.dashstyle = '12 6';
                                    } else if (railStyle === 'dash-subtle') {
                                        overridden.paintStyle.dashstyle = '6 6';
                                    } else if (railStyle === 'dotted') {
                                        overridden.paintStyle.dashstyle = '1 4';
                                    } else if (railStyle === 'striped' || railStyle === 'gradient' || railStyle === 'embossed') {
                                        // these complex styles don't translate perfectly to stroke patterns;
                                        // use a solid stroke with the rail color and a slightly larger width
                                        overridden.paintStyle.dashstyle = null;
                                    }

                                    config = overridden;
                                }
                            } catch (err) {
                                // ignore and use default config
                            }

                            // Use saved anchors if available, otherwise compute directional anchors
                            const sourceIsRail = sourceEl.classList && sourceEl.classList.contains('cardmap-rail');
                            const targetIsRail = targetEl.classList && targetEl.classList.contains('cardmap-rail');

                            let anchors;
                            const savedAnchors = c.anchors;
                            
                            if (Array.isArray(savedAnchors) && savedAnchors.length >= 2) {
                                // Process saved anchors - handle both string anchors and precise anchor objects
                                anchors = savedAnchors.map(anchor => {
                                    if (anchor && typeof anchor === 'object' && anchor.type === 'precise' && Array.isArray(anchor.value)) {
                                        return anchor.value; // Return the precise anchor array [x, y, ox, oy]
                                    }
                                    return anchor; // Return string anchor as-is
                                });
                                console.log('Using saved anchors for connection:', anchors);
                            } else if (sourceIsRail || targetIsRail) {
                                // For rail connections without saved anchors, use Continuous
                                anchors = ["Continuous", "Continuous"];
                                console.log('Using Continuous anchors for rail connection');
                            } else {
                                // For node-to-node connections, compute directional anchors
                                anchors = getDirectionalAnchorsFrontend(sourceEl, targetEl) || ["Continuous", "Continuous"];
                                console.log('Using computed directional anchors:', anchors);
                            }

                            console.log('Creating connection with config:', {
                                source: c.source,
                                target: c.target,
                                anchors: anchors,
                                style: c.style,
                                sourceIsRail: sourceIsRail,
                                targetIsRail: targetIsRail,
                                config: config
                            });

                            try {
                                const connection = instance.connect({
                                    source: sourceEl,
                                    target: targetEl,
                                    anchors: anchors,
                                    ...config,
                                    endpoint: "Blank"
                                });

                                if (connection) {
                                    console.log('Connection created successfully:', c.id || 'no-id');

                                    // Apply animation if enabled
                                    if (mapConfig.enable_animation) {
                                        const animType = mapConfig.connection_animation_type || 'draw';
                                        const duration = (mapConfig.connection_animation_duration || 800) + 'ms';
                                        const delay = index * 100; // staggered delay

                                        // Apply animation after the connector DOM has been rendered
                                        setTimeout(() => {
                                            try {
                                                const connector = connection.getConnector && connection.getConnector();
                                                const svg = connector && connector.canvas;
                                                const path = svg && svg.querySelector && svg.querySelector('path');
                                                if (path) {
                                                    path.classList.add('cardmap-connection-anim', `conn-anim-${animType}`);
                                                    path.style.animationDelay = `${delay}ms`;
                                                    path.style.animationDuration = duration;
                                                }
                                            } catch (err) {
                                                console.warn('Could not apply animation to connection:', err);
                                            }
                                        }, 50);
                                    }
                                } else {
                                    console.error('Connection creation returned null/undefined');
                                }
                            } catch (connErr) {
                                console.error('Error creating connection:', connErr, {
                                    source: c.source,
                                    target: c.target,
                                    sourceEl: !!sourceEl,
                                    targetEl: !!targetEl
                                });
                            }
                        }
                    } catch (err) {
                        console.error('Error processing connection:', err, c);
                    }
                    });
                }

                if (mapConfig.enable_drag) {
                    const nodes = wrapper.querySelectorAll('.cardmap-node');
                    instance.draggable(nodes);
                }
            });

            // Force a repaint after all connections are created
            setTimeout(() => {
                instance.repaintEverything();
                console.log('Repainted all connections');
            }, 100);
        }, 50);

        // Ensure rails have a visible inner bar (.rail-bar) so we can hide/show thickness
        try {
            // Look for rails both as direct elements and as nodes with is_rail flag
            const rails = panZoomContainer.querySelectorAll('.cardmap-rail');
            console.log('Found', rails.length, 'rails in frontend');

            // Also check if there are any elements with data attributes that indicate they are rails
            const allElements = panZoomContainer.querySelectorAll('*');
            const potentialRails = Array.from(allElements).filter(el =>
                el.dataset && (el.dataset.railStyle || el.dataset.railColor || el.dataset.railSize)
            );
            console.log('Found', potentialRails.length, 'potential rails by data attributes');

            rails.forEach((railEl, index) => {
                console.log('Processing rail', index + 1, ':', {
                    id: railEl.id,
                    classList: railEl.className,
                    style: railEl.style.cssText,
                    dataset: railEl.dataset
                });
                // add rail-bar if missing
                    if (!railEl.querySelector('.rail-bar')) {
                    const bar = document.createElement('div');
                    bar.className = 'rail-bar';
                    // If rails were saved with explicit width/height of 0px, treat that
                    // as missing and fall back to 100% so the inner bar is visible.
                    const rawWidth = railEl.style.width || '';
                    const rawHeight = railEl.style.height || '';
                    const numericWidth = parseFloat(rawWidth) || 0;
                    const numericHeight = parseFloat(rawHeight) || 0;

                    // If the rail container has zero size, make the container default to 3px thickness
                    if (railEl.classList.contains('vertical')) {
                        if (numericWidth <= 0) {
                            // vertical rail missing width -> default thickness
                            railEl.style.width = '3px';
                        }
                        if (numericHeight <= 0) {
                            railEl.style.height = rawHeight || '100%';
                        }
                        bar.style.width = railEl.style.width || '100%';
                        bar.style.height = railEl.style.height || '100%';
                    } else {
                        if (numericHeight <= 0) {
                            // horizontal rail missing height -> default thickness
                            railEl.style.height = '3px';
                        }
                        if (numericWidth <= 0) {
                            railEl.style.width = rawWidth || '100%';
                        }
                        bar.style.width = railEl.style.width || '100%';
                        bar.style.height = railEl.style.height || '100%';
                    }
                    // Read appearance from data attributes (added by shortcode serialization)
                    const railStyle = railEl.dataset.railStyle || 'solid';
                    const railColor = railEl.dataset.railColor || mapConfig.line_color || '#A61832';
                    const railSizeAttr = parseInt(railEl.dataset.railSize, 10);
                    const defaultSize = 3;
                    const railSize = !isNaN(railSizeAttr) && railSizeAttr > 0 ? railSizeAttr : defaultSize;

                    // Apply thickness for the inner bar
                    if (railEl.classList.contains('vertical')) {
                        bar.style.width = (railSize) + 'px';
                        bar.style.height = railEl.style.height || '100%';
                    } else {
                        bar.style.height = (railSize) + 'px';
                        bar.style.width = railEl.style.width || '100%';
                    }

                    // Apply visual style
                    if (railStyle === 'solid') {
                        bar.style.backgroundImage = '';
                        bar.style.backgroundColor = railColor;
                    } else {
                        // dashed or dotted
                        const sizePx = Math.max(1, railSize);
                        const gap = railStyle === 'dashed' ? Math.max(6, sizePx * 2) : Math.max(3, Math.floor(sizePx / 2));
                        if (railEl.classList.contains('vertical')) {
                            bar.style.backgroundImage = `repeating-linear-gradient(180deg, ${railColor} 0 ${sizePx}px, transparent ${sizePx}px ${sizePx + gap}px)`;
                        } else {
                            bar.style.backgroundImage = `repeating-linear-gradient(90deg, ${railColor} 0 ${sizePx}px, transparent ${sizePx}px ${sizePx + gap}px)`;
                        }
                        bar.style.backgroundRepeat = 'repeat';
                        bar.style.backgroundSize = 'auto';
                        bar.style.backgroundColor = 'transparent';
                    }
                    // ensure the rail bar is visible above the plain background but below connectors
                    bar.style.zIndex = '20';
                    railEl.appendChild(bar);
                } else {
                    const bar = railEl.querySelector('.rail-bar');
                    // ensure the rail container has sensible thickness values (fallback to 3px)
                    const rawWidth = railEl.style.width || '';
                    const rawHeight = railEl.style.height || '';
                    const numericWidth = parseFloat(rawWidth) || 0;
                    const numericHeight = parseFloat(rawHeight) || 0;
                    if (railEl.classList.contains('vertical')) {
                        if (numericWidth <= 0) railEl.style.width = '3px';
                        if (numericHeight <= 0) railEl.style.height = rawHeight || '100%';
                    } else {
                        if (numericHeight <= 0) railEl.style.height = '3px';
                        if (numericWidth <= 0) railEl.style.width = rawWidth || '100%';
                    }
                    if (!bar.style.width || parseFloat(bar.style.width) <= 0) bar.style.width = railEl.style.width || '100%';
                    if (!bar.style.height || parseFloat(bar.style.height) <= 0) bar.style.height = railEl.style.height || '100%';
                    // Respect any saved rail appearance attributes if present
                    const existingRailStyle = railEl.dataset.railStyle || 'solid';
                    const existingRailColor = railEl.dataset.railColor || mapConfig.line_color || '#A61832';
                    const existingRailSizeAttr = parseInt(railEl.dataset.railSize, 10);
                    const existingRailSize = !isNaN(existingRailSizeAttr) && existingRailSizeAttr > 0 ? existingRailSizeAttr : 3;

                    if (railEl.classList.contains('vertical')) {
                        bar.style.width = (existingRailSize) + 'px';
                        bar.style.height = railEl.style.height || '100%';
                    } else {
                        bar.style.height = (existingRailSize) + 'px';
                        bar.style.width = railEl.style.width || '100%';
                    }

                    if (existingRailStyle === 'solid') {
                        bar.style.backgroundImage = '';
                        bar.style.backgroundColor = existingRailColor;
                    } else {
                        const sizePx = Math.max(1, existingRailSize);
                        const gap = existingRailStyle === 'dashed' ? Math.max(6, sizePx * 2) : Math.max(3, Math.floor(sizePx / 2));
                        if (railEl.classList.contains('vertical')) {
                            bar.style.backgroundImage = `repeating-linear-gradient(180deg, ${existingRailColor} 0 ${sizePx}px, transparent ${sizePx}px ${sizePx + gap}px)`;
                        } else {
                            bar.style.backgroundImage = `repeating-linear-gradient(90deg, ${existingRailColor} 0 ${sizePx}px, transparent ${sizePx}px ${sizePx + gap}px)`;
                        }
                        bar.style.backgroundRepeat = 'repeat';
                        bar.style.backgroundSize = 'auto';
                        bar.style.backgroundColor = 'transparent';
                    }
                    if (!bar.style.zIndex) bar.style.zIndex = '20';
                }

                // toggle visibility according to setting - default to showing rails if setting is undefined
                // Fix: Default to showing rails unless explicitly disabled
                const shouldHideRails = mapConfig.show_rail_thickness === false || mapConfig.show_rail_thickness === 0;
                console.log('Rail visibility check:', {
                    setting: mapConfig.show_rail_thickness,
                    shouldHide: shouldHideRails,
                    railId: railEl.id
                });

                if (shouldHideRails) {
                    railEl.classList.add('rail-thickness-hidden');
                    console.log('Hiding rail thickness for rail:', railEl.id);
                } else {
                    railEl.classList.remove('rail-thickness-hidden');
                    console.log('Showing rail thickness for rail:', railEl.id, 'setting:', mapConfig.show_rail_thickness, 'shouldHide:', shouldHideRails);
                }

                // Ensure rail has proper positioning and is visible in the container
                if (!railEl.style.left) railEl.style.left = '0px';
                if (!railEl.style.top) railEl.style.top = '0px';

                // Final check - ensure rail bar is visible unless explicitly hidden
                const railBar = railEl.querySelector('.rail-bar');
                if (railBar && !railEl.classList.contains('rail-thickness-hidden')) {
                    railBar.style.display = 'block';
                    railBar.style.opacity = '1';
                    console.log('Rail bar confirmed visible for:', railEl.id);
                }

                // Additional debugging for troubleshooting
                console.log('Rail final state:', {
                    id: railEl.id,
                    classes: railEl.className,
                    hasRailBar: !!railBar,
                    isHidden: railEl.classList.contains('rail-thickness-hidden'),
                    railBarDisplay: railBar ? railBar.style.display : 'no bar',
                    railBarOpacity: railBar ? railBar.style.opacity : 'no bar',
                    position: `${railEl.style.left}, ${railEl.style.top}`,
                    size: `${railEl.style.width}, ${railEl.style.height}`
                });
            });
        } catch (err) {
            // ignore DOM errors
        }

        let scale = 1;
        let panX = 0;
        let panY = 0;
        let isPanning = false;
        let panStart = { x: 0, y: 0 };

        const zoomDisplay = wrapper.querySelector('.cardmap-zoom-display');

        const applyTransform = () => {
            panZoomContainer.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
            instance.setZoom(scale);
            if (zoomDisplay) {
                zoomDisplay.textContent = `${Math.round(scale * 100)}%`;
            }
        };

        wrapper.querySelector('.zoom-in').addEventListener('click', () => {
            scale = Math.min(3, scale * 1.2);
            applyTransform();
        });

        wrapper.querySelector('.zoom-out').addEventListener('click', () => {
            scale = Math.max(0.2, scale / 1.2);
            applyTransform();
        });

        const fullscreenBtn = wrapper.querySelector('.cardmap-fullscreen-btn');
        if (fullscreenBtn) {
            fullscreenBtn.addEventListener('click', () => {
                if (!document.fullscreenElement) {
                    wrapper.requestFullscreen().catch(err => {
                        alert(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
                    });
                } else {
                    document.exitFullscreen();
                }
            });
        }


        document.addEventListener('fullscreenchange', () => {
            if (document.fullscreenElement === wrapper) {
                wrapper.classList.add('fullscreen');
            } else {
                wrapper.classList.remove('fullscreen');
            }
            instance.revalidate(panZoomContainer);
        });

        const viewport = wrapper.querySelector('.cardmap-viewport');
        viewport.addEventListener('mousedown', e => {
            if (e.target.closest('.cardmap-node') || e.target.closest('.cardmap-controls')) return;
            isPanning = true;
            panStart.x = e.clientX - panX;
            panStart.y = e.clientY - panY;
            viewport.style.cursor = 'grabbing';
            wrapper.classList.add('panning');
        });

        viewport.addEventListener('mouseup', () => {
            isPanning = false;
            viewport.style.cursor = 'grab';
            wrapper.classList.remove('panning');
        });

        viewport.addEventListener('mouseleave', () => {
            isPanning = false;
            viewport.style.cursor = 'grab';
            wrapper.classList.remove('panning');
        });

        viewport.addEventListener('mousemove', e => {
            if (isPanning) {
                panX = e.clientX - panStart.x;
                panY = e.clientY - panStart.y;
                applyTransform();
            }
        });

        viewport.addEventListener('wheel', e => {
            e.preventDefault();
            
            const rect = viewport.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            const worldXBefore = (mouseX - panX) / scale;
            const worldYBefore = (mouseY - panY) / scale;
            
            const delta = e.deltaY < 0 ? 1.1 : 1 / 1.1;
            const newScale = Math.max(0.2, Math.min(3, scale * delta));
            
            panX = mouseX - worldXBefore * newScale;
            panY = mouseY - worldYBefore * newScale;
            
            scale = newScale;
            applyTransform();
        });
    });
});
