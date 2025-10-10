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
            const dashedOverlay = { stroke: color, strokeWidth: thickness, dashstyle: "4 2", strokeDasharray: "4 2" };
            const dottedOverlay = { stroke: color, strokeWidth: thickness, dashstyle: "1 4", strokeDasharray: "1 4" };

            switch (style) {
                case 'normal':
                case 'straight':
                    return { connector: ["Straight"], paintStyle: baseConfig, overlays: [] };
                case 'bezier':
                case 'rounded-bezier':
                    return { connector: ["Bezier", {curviness: 50}], paintStyle: baseConfig, overlays: [] };
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
                        paintStyle: { stroke: color, strokeWidth: railSize, strokeDasharray: "0" },
                        hoverPaintStyle: { stroke: color, strokeWidth: railSize, strokeDasharray: "0" },
                        overlays: []
                    };
                default:
                    // Default to straight line without arrows for normal/unknown styles
                    return { connector: ["Straight"], paintStyle: baseConfig, overlays: [] };
            }
        }

        function getDirectionalAnchorsFrontend(sourceEl, targetEl) {
            if (!sourceEl || !targetEl) return ["RightMiddle", "LeftMiddle"];
            
            const s = sourceEl.getBoundingClientRect();
            const t = targetEl.getBoundingClientRect();
            
            // Calculate center points
            const sourceCenterX = s.left + s.width / 2;
            const sourceCenterY = s.top + s.height / 2;
            const targetCenterX = t.left + t.width / 2;
            const targetCenterY = t.top + t.height / 2;
            
            const dx = targetCenterX - sourceCenterX;
            const dy = targetCenterY - sourceCenterY;
            
            // Use cardinal directions only for consistent edge snapping
            // Determine primary direction based on which distance is greater
            if (Math.abs(dx) > Math.abs(dy)) {
                // Horizontal connection is primary
                if (dx > 0) {
                    // Target is to the right
                    return ["RightMiddle", "LeftMiddle"];
                } else {
                    // Target is to the left
                    return ["LeftMiddle", "RightMiddle"];
                }
            } else {
                // Vertical connection is primary
                if (dy > 0) {
                    // Target is below
                    return ["BottomCenter", "TopCenter"];
                } else {
                    // Target is above
                    return ["TopCenter", "BottomCenter"];
                }
            }
        }

        const instance = jsPlumb.getInstance({
            Container: panZoomContainer,
            ConnectionsDetachable: false,
            Anchors: ["TopLeft", "TopCenter", "TopRight", "LeftMiddle", "RightMiddle", "BottomLeft", "BottomCenter", "BottomRight"]
        });
        
        // Ensure the container has proper positioning for accurate calculations
        if (!panZoomContainer.style.position) {
            panZoomContainer.style.position = 'relative';
        }

        // Initialize rails as jsPlumb endpoints first
        const rails = panZoomContainer.querySelectorAll('.cardmap-rail');
        rails.forEach(railEl => {
            try {
                // Ensure rail has proper ID before initializing
                if (!railEl.id) {
                    console.warn('Rail missing ID, skipping jsPlumb initialization');
                    return;
                }


                // Use Continuous anchors for rails to allow connections at any point
                // Also ensure the rail element has proper dimensions and positioning
                const railRect = railEl.getBoundingClientRect();
                    id: railEl.id,
                    width: railRect.width,
                    height: railRect.height,
                    left: railRect.left,
                    top: railRect.top
                });

                instance.makeSource(railEl, {
                    anchor: "Continuous",
                    endpoint: "Blank", 
                    maxConnections: -1,
                    allowLoopback: false,
                    connectorStyle: { strokeWidth: 2, stroke: '#A61832' }
                });
                instance.makeTarget(railEl, {
                    anchor: "Continuous",
                    endpoint: "Blank",
                    maxConnections: -1,
                    allowLoopback: false,
                    connectorStyle: { strokeWidth: 2, stroke: '#A61832' }
                });
            } catch (err) {
                console.error('Error initializing rail as jsPlumb endpoint:', railEl.id, err);
            }
        });

        // Function to reverse a connection
        function reverseConnection(connection, connectionData, index) {
            if (!connection || !connectionData) return;

            // Store original data
            const originalSource = connectionData.source;
            const originalTarget = connectionData.target;
            const originalAnchors = connectionData.anchors;
            const originalStyle = connectionData.style;

            // Swap source and target in the data
            connectionData.source = originalTarget;
            connectionData.target = originalSource;

            // Reverse anchors if they exist
            if (Array.isArray(originalAnchors) && originalAnchors.length >= 2) {
                connectionData.anchors = [originalAnchors[1], originalAnchors[0]];
            }

            // Handle arrow direction for specific connection styles
            if (originalStyle) {
                switch (originalStyle) {
                    case 'straight-with-arrows':
                        // Keep the same style - arrows will automatically point to the new target
                        break;
                    case 'flowchart-with-arrows':
                        // Keep the same style - arrows will automatically point to the new target
                        break;
                    default:
                        // For non-arrow styles, no special handling needed
                        break;
                }
            }

            // Find the DOM elements
            const sourceEl = panZoomContainer.querySelector('#' + connectionData.source);
            const targetEl = panZoomContainer.querySelector('#' + connectionData.target);

            if (!sourceEl || !targetEl) {
                console.error('Cannot reverse connection: elements not found', {
                    source: connectionData.source,
                    target: connectionData.target
                });
                return;
            }

            // Update the connection with new source and target
            try {
                connection.setSource(sourceEl);
                connection.setTarget(targetEl);

                // Update anchors if they were changed
                if (connectionData.anchors) {
                    connection.setAnchors(connectionData.anchors);
                }

                // Update overlays (arrows) to point in the correct direction
                if (originalStyle && (originalStyle.includes('arrows'))) {
                    // Remove existing overlays and add new ones pointing to the target
                    connection.removeAllOverlays();

                    // Add arrow overlay pointing to the new target (location 1 = end of connection)
                    const arrowOverlay = ["Arrow", { width: 10, length: 10, location: 1 }];
                    connection.addOverlay(arrowOverlay);
                }

                    from: `${originalSource} -> ${originalTarget}`,
                    to: `${connectionData.source} -> ${connectionData.target}`,
                    style: originalStyle
                });

                // Force repaint to show changes
                setTimeout(() => {
                    instance.repaintEverything();
                }, 50);

            } catch (error) {
                console.error('Error reversing connection:', error);
                // Revert changes if there was an error
                connectionData.source = originalSource;
                connectionData.target = originalTarget;
                connectionData.anchors = originalAnchors;
                connectionData.style = originalStyle;
            }
        }

        // Create connections after a short delay to ensure rails are fully initialized
        setTimeout(() => {
            // Ensure all elements are properly managed by jsPlumb before creating connections
            const allElements = panZoomContainer.querySelectorAll('.cardmap-node, .cardmap-rail');
            allElements.forEach(el => {
                if (el.id) {
                    try {
                        instance.manage(el);
                    } catch (err) {
                        console.warn('Error managing element:', el.id, err);
                    }
                }
            });
            
            instance.batch(() => {
                if (mapData.connections) {
                    mapData.connections.forEach((c, index) => {
                    try {
                        if (!c.source || !c.target) {
                            console.warn('Connection missing source or target:', c);
                            return;
                        }

                        const sourceEl = panZoomContainer.querySelector('#' + c.source);
                        const targetEl = panZoomContainer.querySelector('#' + c.target);
                            source: !!sourceEl,
                            target: !!targetEl,
                            sourceId: c.source,
                            targetId: c.target,
                            sourceElId: sourceEl?.id,
                            targetElId: targetEl?.id
                        });

                        if (sourceEl && targetEl) {
                            // Get connection style with proper priority: connection's own style > source's style > target's style > global default
                            let connStyle = c.style;
                            if (!connStyle) {
                                // Try to get from mapData source/target node connectionStyle
                                const sourceNodeData = mapData.nodes?.find(n => n.id === c.source) || {};
                                const targetNodeData = mapData.nodes?.find(n => n.id === c.target) || {};
                                const sourceRailData = mapData.rails?.find(r => r.id === c.source) || {};
                                const targetRailData = mapData.rails?.find(r => r.id === c.target) || {};
                                connStyle = sourceNodeData.connectionStyle || sourceRailData.connectionStyle || 
                                           targetNodeData.connectionStyle || targetRailData.connectionStyle || 
                                           mapConfig.line_style || 'normal';
                            }
                            let config = getConnectorConfig(connStyle, mapConfig.line_color, mapConfig.line_thickness, c.rail_size);

                            // If the connection is attached to a rail that has a visual appearance,
                            // try to make the connector visually match the rail (color/thickness/dash).
                            // BUT only if the connection doesn't have its own individual style
                            try {
                                const sourceIsRail = sourceEl.classList && sourceEl.classList.contains('cardmap-rail');
                                const targetIsRail = targetEl.classList && targetEl.classList.contains('cardmap-rail');
                                const railEl = sourceIsRail ? sourceEl : (targetIsRail ? targetEl : null);
                                
                                // Only apply rail styling if connection doesn't have its own individual style
                                if (railEl && !c.style) {
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
                                        overridden.paintStyle.strokeDasharray = '12 6';
                                    } else if (railStyle === 'dash-subtle') {
                                        overridden.paintStyle.dashstyle = '6 6';
                                        overridden.paintStyle.strokeDasharray = '6 6';
                                    } else if (railStyle === 'dotted') {
                                        overridden.paintStyle.dashstyle = '1 4';
                                        overridden.paintStyle.strokeDasharray = '1 4';
                                    } else if (railStyle === 'striped' || railStyle === 'gradient' || railStyle === 'embossed') {
                                        // these complex styles don't translate perfectly to stroke patterns;
                                        // use a solid stroke with the rail color and a slightly larger width
                                        overridden.paintStyle.dashstyle = null;
                                        overridden.paintStyle.strokeDasharray = null;
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
                            } else if (sourceIsRail || targetIsRail) {
                                // For rail connections, prefer saved precise anchors, fallback to Continuous
                                if (sourceIsRail && targetIsRail) {
                                    // Rail to rail - use continuous for both to allow flexible positioning
                                    anchors = ["Continuous", "Continuous"];
                                } else if (sourceIsRail) {
                                    // Rail to node - continuous for rail (allows precise positioning), directional for node
                                    const targetAnchor = getDirectionalAnchorsFrontend(targetEl, sourceEl)[0];
                                    anchors = ["Continuous", targetAnchor];
                                } else {
                                    // Node to rail - directional for node, continuous for rail (allows precise positioning)
                                    const sourceAnchor = getDirectionalAnchorsFrontend(sourceEl, targetEl)[0];
                                    anchors = [sourceAnchor, "Continuous"];
                                }
                            } else {
                                // For node-to-node connections, compute directional anchors
                                anchors = getDirectionalAnchorsFrontend(sourceEl, targetEl) || ["RightMiddle", "LeftMiddle"];
                            }

                                source: c.source,
                                target: c.target,
                                anchors: anchors,
                                style: c.style,
                                sourceIsRail: sourceIsRail,
                                targetIsRail: targetIsRail,
                                config: config,
                                sourceElRect: sourceEl.getBoundingClientRect(),
                                targetElRect: targetEl.getBoundingClientRect()
                            });

                            try {
                                const connection = instance.connect({
                                    source: sourceEl,
                                    target: targetEl,
                                    anchors: anchors,
                                    ...config,
                                    endpoint: "Blank",
                                    detachable: false,
                                    reattach: true
                                });

                                if (connection) {
                                    
                                    // Only do minimal repainting to avoid disrupting precise positioning
                                    setTimeout(() => {
                                        try {
                                            // Only repaint if there are obvious positioning issues
                                            const connector = connection.getConnector && connection.getConnector();
                                            if (connector && connector.canvas) {
                                                const svg = connector.canvas;
                                                const left = parseFloat(svg.style.left) || 0;
                                                const top = parseFloat(svg.style.top) || 0;
                                                
                                                // Only intervene if SVG has extreme negative positioning (indicating a real problem)
                                                if (left < -100 || top < -100) {
                                                    connection.repaint();
                                                }
                                            }
                                        } catch (repaintErr) {
                                            console.warn('Error in minimal repaint check:', repaintErr);
                                        }
                                    }, 10);

                                    // Add click handler for connection reversal
                                    connection.bind('click', function(e) {
                                        // Prevent event bubbling
                                        e.stopPropagation();

                                            connectionId: c.id,
                                            source: c.source,
                                            target: c.target,
                                            index: index
                                        });

                                        // Show confirmation dialog with connection details
                                        const sourceTitle = document.querySelector('#' + c.source + ' .card-title')?.textContent || c.source;
                                        const targetTitle = document.querySelector('#' + c.target + ' .card-title')?.textContent || c.target;

                                        const confirmMessage = `Reverse connection direction?\n\nCurrent: ${sourceTitle} → ${targetTitle}\nNew: ${targetTitle} → ${sourceTitle}`;

                                        // Show confirmation dialog
                                        if (confirm(confirmMessage)) {
                                            reverseConnection(connection, c, index);
                                        }
                                    });

                                    // Add visual indicator for clickable connections
                                    const connector = connection.getConnector && connection.getConnector();
                                    if (connector && connector.canvas) {
                                        const svg = connector.canvas;
                                        if (svg) {
                                            svg.style.cursor = 'pointer';
                                            svg.title = 'Click to reverse connection direction';
                                            
                                            // Fix: Ensure stroke-dasharray is properly applied from paintStyle
                                            const path = svg.querySelector('path');
                                            if (path && config.paintStyle) {
                                                if (config.paintStyle.strokeDasharray) {
                                                    path.setAttribute('stroke-dasharray', config.paintStyle.strokeDasharray);
                                                }
                                                // Ensure stroke color and width are also applied
                                                if (config.paintStyle.stroke) {
                                                    path.setAttribute('stroke', config.paintStyle.stroke);
                                                }
                                                if (config.paintStyle.strokeWidth) {
                                                    path.setAttribute('stroke-width', config.paintStyle.strokeWidth);
                                                }
                                            }
                                        }
                                    }

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
                
                // Only do additional fixes if there are actual positioning problems
                setTimeout(() => {
                    const allConnections = instance.getAllConnections();
                    let problemConnections = 0;
                    
                    allConnections.forEach(conn => {
                        try {
                            const connector = conn.getConnector && conn.getConnector();
                            if (connector && connector.canvas) {
                                const svg = connector.canvas;
                                const left = parseFloat(svg.style.left) || 0;
                                const top = parseFloat(svg.style.top) || 0;
                                
                                // Only fix connections with extreme positioning issues
                                if (left < -50 || top < -50) {
                                    conn.repaint();
                                    problemConnections++;
                                }
                            }
                        } catch (err) {
                            console.warn('Error checking connection positioning:', err);
                        }
                    });
                    
                    if (problemConnections > 0) {
                    } else {
                    }
                }, 50);
            }, 100);
        }, 50);

        // Ensure rails have a visible inner bar (.rail-bar) so we can hide/show thickness
        try {
            // Look for rails both as direct elements and as nodes with is_rail flag
            const rails = panZoomContainer.querySelectorAll('.cardmap-rail');

            // Also check if there are any elements with data attributes that indicate they are rails
            const allElements = panZoomContainer.querySelectorAll('*');
            const potentialRails = Array.from(allElements).filter(el =>
                el.dataset && (el.dataset.railStyle || el.dataset.railColor || el.dataset.railSize)
            );

            rails.forEach((railEl, index) => {
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
                    setting: mapConfig.show_rail_thickness,
                    shouldHide: shouldHideRails,
                    railId: railEl.id
                });

                if (shouldHideRails) {
                    railEl.classList.add('rail-thickness-hidden');
                } else {
                    railEl.classList.remove('rail-thickness-hidden');
                }

                // Ensure rail has proper positioning and is visible in the container
                if (!railEl.style.left) railEl.style.left = '0px';
                if (!railEl.style.top) railEl.style.top = '0px';
                
                // Ensure the rail element has proper dimensions for connection anchoring
                const railData = mapData.rails ? mapData.rails.find(r => r.id === railEl.id) : null;
                if (railData) {
                    // Make sure the rail's DOM position matches its data position
                    if (railData.x !== undefined) railEl.style.left = railData.x + 'px';
                    if (railData.y !== undefined) railEl.style.top = railData.y + 'px';
                    if (railData.width !== undefined) railEl.style.width = railData.width + 'px';
                    if (railData.height !== undefined) railEl.style.height = railData.height + 'px';
                    
                    // Ensure minimum dimensions for proper connection anchoring
                    const currentWidth = parseInt(railEl.style.width) || railEl.offsetWidth;
                    const currentHeight = parseInt(railEl.style.height) || railEl.offsetHeight;
                    
                    if (currentWidth < 1) {
                        railEl.style.width = (railData.size || 3) + 'px';
                    }
                    if (currentHeight < 1) {
                        railEl.style.height = (railData.size || 3) + 'px';
                    }
                    
                    // Ensure proper positioning for jsPlumb calculations
                    railEl.style.position = 'absolute';
                    
                    // For vertical rails, ensure they have proper width
                    if (railData.orientation === 'vertical') {
                        const railSize = railData.size || 3;
                        railEl.style.width = railSize + 'px';
                        if (!railEl.style.height || parseInt(railEl.style.height) < 10) {
                            railEl.style.height = (railData.height || 100) + 'px';
                        }
                    }
                    // For horizontal rails, ensure they have proper height
                    else if (railData.orientation === 'horizontal') {
                        const railSize = railData.size || 3;
                        railEl.style.height = railSize + 'px';
                        if (!railEl.style.width || parseInt(railEl.style.width) < 10) {
                            railEl.style.width = (railData.width || 100) + 'px';
                        }
                    }
                    
                    // Force layout recalculation
                    railEl.offsetHeight; // Trigger reflow
                    
                        id: railEl.id,
                        dataPos: { x: railData.x, y: railData.y, w: railData.width, h: railData.height },
                        domPos: { left: railEl.style.left, top: railEl.style.top, width: railEl.style.width, height: railEl.style.height },
                        actualBounds: railEl.getBoundingClientRect()
                    });
                }

                // Final check - ensure rail bar is visible unless explicitly hidden
                const railBar = railEl.querySelector('.rail-bar');
                if (railBar && !railEl.classList.contains('rail-thickness-hidden')) {
                    railBar.style.display = 'block';
                    railBar.style.opacity = '1';
                }

                // Additional debugging for troubleshooting
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
                    // Try standard fullscreen first
                    wrapper.requestFullscreen().catch(err => {
                        console.warn('Standard fullscreen failed:', err);
                        // Try webkit prefix
                        if (wrapper.webkitRequestFullscreen) {
                            wrapper.webkitRequestFullscreen().catch(webkitErr => {
                                console.warn('Webkit fullscreen failed:', webkitErr);
                                // Try MS prefix
                                if (wrapper.msRequestFullscreen) {
                                    wrapper.msRequestFullscreen().catch(msErr => {
                                        console.warn('MS fullscreen failed:', msErr);
                                        alert(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
                                    });
                                } else {
                                    alert(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
                                }
                            });
                        } else {
                            alert(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
                        }
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
