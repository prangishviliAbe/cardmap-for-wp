document.addEventListener('DOMContentLoaded', function() {
    // The cardmap_frontend_data is now an object where keys are map IDs.
    if (typeof cardmap_frontend_data === 'undefined' || Object.keys(cardmap_frontend_data).length === 0) {
        return;
    }

    document.querySelectorAll('.cardmap-frontend-wrapper').forEach(wrapper => {
        const mapId = wrapper.dataset.mapId;
        if (!mapId || !cardmap_frontend_data[mapId]) {
            return;
        }

        const mapConfig = cardmap_frontend_data[mapId];
        const mapData = mapConfig.map_data;
        const panZoomContainer = wrapper.querySelector('.cardmap-pan-zoom-container');

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
            if (!sourceEl || !targetEl) return "Continuous";
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

        instance.batch(() => {
            if (mapData.connections) {
                mapData.connections.forEach((c, index) => {
                    const sourceEl = panZoomContainer.querySelector('#' + c.source);
                    const targetEl = panZoomContainer.querySelector('#' + c.target);
                    if (sourceEl && targetEl) {
                        const connStyle = c.style || 'straight-with-arrows';
                        const config = getConnectorConfig(connStyle, mapConfig.line_color, mapConfig.line_thickness, c.rail_size);
                        
                        const anchors = c.anchors || getDirectionalAnchorsFrontend(sourceEl, targetEl) || "Continuous";
                        const connection = instance.connect({
                            source: sourceEl,
                            target: targetEl,
                            anchors: anchors,
                            ...config,
                            endpoint: "Blank"
                        });

                        if (mapConfig.enable_animation) {
                            // Apply animation after the connector DOM has been rendered.
                            // Use double requestAnimationFrame to ensure SVG path exists, and
                            // reset animation so it reliably plays on initial load. If the
                            // path isn't available immediately, retry a few times with a
                            // short timeout fallback.
                            const animType = mapConfig.connection_animation_type || 'draw';
                            const duration = (mapConfig.connection_animation_duration || 800) + 'ms';
                            const delay = index * 100; // staggered delay

                            (function(conn, attempts){
                                attempts = attempts || 0;
                                function tryApply() {
                                    requestAnimationFrame(() => {
                                        requestAnimationFrame(() => {
                                            try {
                                                const connector = conn.getConnector && conn.getConnector();
                                                const svg = connector && connector.canvas;
                                                const path = svg && svg.querySelector && svg.querySelector('path');
                                                if (path) {
                                                    // reset any running animation
                                                    try { path.style.animation = 'none'; } catch(e) {}
                                                    // force reflow
                                                    void path.offsetWidth;
                                                    // remove any previous conn-anim-* classes then add ours
                                                    try {
                                                        const removeClasses = Array.from(path.classList || []).filter(c => c.indexOf('conn-anim-') === 0 || c === 'cardmap-connection-anim');
                                                        removeClasses.forEach(c => path.classList.remove(c));
                                                    } catch(e) {}
                                                    path.classList.add('cardmap-connection-anim', `conn-anim-${animType}`);
                                                    path.style.animationDelay = `${delay}ms`;
                                                    path.style.animationDuration = duration;
                                                    return;
                                                }
                                            } catch (err) {
                                                // ignore
                                            }

                                            // If path not found yet, retry a few times with a small timeout
                                            if (attempts < 4) {
                                                attempts++;
                                                setTimeout(tryApply, 60);
                                            }
                                        });
                                    });
                                }
                                tryApply();
                            })(connection, 0);
                        }
                    }
                });
            }
            if (mapConfig.enable_drag) {
                const nodes = wrapper.querySelectorAll('.cardmap-node');
                instance.draggable(nodes);
            }
        });

        // Ensure rails have a visible inner bar (.rail-bar) so we can hide/show thickness
        try {
            const rails = panZoomContainer.querySelectorAll('.cardmap-rail');
            rails.forEach(railEl => {
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

                // toggle visibility according to setting
                if (mapConfig.show_rail_thickness === false || mapConfig.show_rail_thickness === 0) {
                    railEl.classList.add('rail-thickness-hidden');
                } else {
                    railEl.classList.remove('rail-thickness-hidden');
                }
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
            if (e.target.closest('.cardmap-node')) return;
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
