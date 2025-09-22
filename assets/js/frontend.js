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

        function getConnectorConfig(style, color, thickness) {
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
                default:
                    return { connector: ["Straight"], paintStyle: baseConfig, overlays: overlays };
            }
        }

        const instance = jsPlumb.getInstance({
            Container: panZoomContainer,
            ConnectionsDetachable: false
        });

        instance.batch(() => {
            if (mapData.connections) {
                mapData.connections.forEach(c => {
                    const sourceEl = panZoomContainer.querySelector('#' + c.source);
                    const targetEl = panZoomContainer.querySelector('#' + c.target);
                    if (sourceEl && targetEl) {
                        const connStyle = c.style || 'straight-with-arrows';
                        const config = getConnectorConfig(connStyle, mapConfig.line_color, mapConfig.line_thickness);
                        
                        instance.connect({
                            source: sourceEl,
                            target: targetEl,
                            anchors: c.anchors || "Continuous",
                            ...config,
                            endpoint: "Blank"
                        });
                    }
                });
            }
            if (mapConfig.enable_drag) {
                const nodes = wrapper.querySelectorAll('.cardmap-node');
                instance.draggable(nodes);
            }
        });

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
                wrapper.classList.add('cardmap-fullscreen');
            } else {
                wrapper.classList.remove('cardmap-fullscreen');
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
