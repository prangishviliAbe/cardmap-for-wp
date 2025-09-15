document.addEventListener('DOMContentLoaded', function(){
    const wrapper = document.querySelector('.cardmap-frontend-wrapper');
    const container = document.getElementById(cardmapFrontendData.containerId);
    const zoomDisplay = document.getElementById('cardmap-zoom-display');
    const lineStyle = cardmapFrontendData.lineStyle;
    const lineColor = cardmapFrontendData.lineColor;
    const lineThickness = cardmapFrontendData.lineThickness;
    
    const CARD_WIDTH = 240;
    const CARD_HEIGHT = 220;
    const PADDING = 40;

    let mapData = cardmapFrontendData.mapData || { nodes: [], connections: [] };

    const instance = jsPlumb.getInstance({ Container: container, ContinuousRepaint: true });

    function getConnectorConfig(style) {
        const baseConfig = { stroke: lineColor, strokeWidth: lineThickness };
        const overlays = [["Arrow",{ width:10, length:10, location:1 }]];
        const dashedOverlay = { stroke: lineColor, strokeWidth: lineThickness, dashstyle: "4 2" };
        const dottedOverlay = { stroke: lineColor, strokeWidth: lineThickness, dashstyle: "1 1" };

        switch (style) {
            case 'bezier':
            case 'rounded-bezier':
                return { connector: ["Bezier", {curviness: 50}], paintStyle: baseConfig };
            case 'straight':
                return { connector: ["Straight"], paintStyle: baseConfig };
            case 'flowchart':
                return { connector: ["Flowchart"], paintStyle: baseConfig };
            case 'state-machine':
                return { connector: ["StateMachine", { curviness: 20, margin: 5, proximity: 10 }], paintStyle: baseConfig };
            case 'straight-with-arrows':
                return { connector: ["Straight"], paintStyle: baseConfig, overlays: overlays };
            case 'flowchart-with-arrows':
                return { connector: ["Flowchart"], paintStyle: baseConfig, overlays: overlays };
            case 'diagonal':
                return { connector: ["Straight"], paintStyle: baseConfig, anchors: ["TopLeft", "BottomRight"] };
            case 'dashed':
                return { connector: ["Straight"], paintStyle: dashedOverlay };
            case 'dotted':
                return { connector: ["Straight"], paintStyle: dottedOverlay };
            default:
                return { connector: ["Bezier", {curviness:50}], paintStyle: baseConfig };
        }
    }

    const connectorConfig = getConnectorConfig(lineStyle);

    instance.importDefaults({
        Connector: connectorConfig.connector,
        PaintStyle: connectorConfig.paintStyle,
        EndpointStyle: { radius:5 },
        Anchors: ["Bottom","Top"],
        Overlays: connectorConfig.overlays || []
    });

    let scale = 1, offsetX = 0, offsetY = 0, isPanning = false, startX = 0, startY = 0;
    
    const updateTransform = () => {
        container.style.transform = `translate(${offsetX}px,${offsetY}px) scale(${scale})`;
        instance.setZoom(scale);
        if (zoomDisplay) zoomDisplay.textContent = `${Math.round(scale * 100)}%`;
    };
    
    const setInitialView = () => {
        if (!mapData.nodes || mapData.nodes.length === 0) { updateTransform(); return; }

        const xPositions = mapData.nodes.map(n => n.x);
        const yPositions = mapData.nodes.map(n => n.y);
        
        const minX = Math.min(...xPositions);
        const minY = Math.min(...yPositions);
        const maxX = Math.max(...xPositions) + CARD_WIDTH;
        const maxY = Math.max(...yPositions) + CARD_HEIGHT;

        const mapWidth = maxX - minX;
        const mapHeight = maxY - minY;

        const wrapperWidth = wrapper.offsetWidth;
        const wrapperHeight = wrapper.offsetHeight;
        
        const scaleX = (wrapperWidth - PADDING) / mapWidth;
        const scaleY = (wrapperHeight - PADDING) / mapHeight;
        let newScale = Math.min(scaleX, scaleY);

        newScale = Math.min(newScale, 1.0);
        newScale = Math.max(0.2, newScale);
        
        const newOffsetX = (wrapperWidth / 2) - ((minX + mapWidth/2) * newScale);
        const newOffsetY = (wrapperHeight / 2) - ((minY + mapHeight/2) * newScale);

        scale = newScale;
        offsetX = newOffsetX;
        offsetY = newOffsetY;
        
        updateTransform();
    };

    wrapper.addEventListener('click', e => {
        if (e.target.dataset.zoom) {
            const direction = e.target.dataset.zoom;
            if (direction === 'in') scale = Math.min(2.5, scale + 0.15);
            if (direction === 'out') scale = Math.max(0.5, scale - 0.15);
            if (direction === 'fullscreen') {
                if (!document.fullscreenElement) wrapper.requestFullscreen?.();
                else document.exitFullscreen?.();
            }
            updateTransform();
        }
    });

    wrapper.addEventListener('wheel', e => {
        e.preventDefault();
        scale += e.deltaY * -0.002;
        scale = Math.min(Math.max(0.5, scale), 2.5);
        updateTransform();
    }, { passive: false });

    wrapper.addEventListener('mousedown', e => {
        if (e.target.closest('.cardmap-node') || e.target.closest('.cardmap-zoom-btn')) {
            return;
        }
        isPanning = true;
        startX = e.clientX - offsetX;
        startY = e.clientY - offsetY;
        wrapper.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', e => {
        if (!isPanning) return;
        e.preventDefault();
        offsetX = e.clientX - startX;
        offsetY = e.clientY - startY;
        updateTransform();
    });
    
    window.addEventListener('mouseup', () => {
        if (isPanning) { isPanning = false; wrapper.style.cursor = 'grab'; }
    });

    (mapData.nodes || []).forEach(n => {
        const node = document.createElement('div');
        node.className = 'cardmap-node';
        node.id = n.id;
        node.style.left = (n.x || 20) + 'px';
        node.style.top = (n.y || 20) + 'px';
        
        node.innerHTML = `
            <div class="node-image-wrapper">
                <div class="node-image">${ n.image ? `<img src="${n.image}" alt="">` : '' }</div>
                <div class="card-caption">${ n.caption || '' }</div>
            </div>
            <div class="card-title">${ n.text || '' }</div>
        `;
        container.appendChild(node);

        if (cardmapFrontendData.enableDrag) { instance.draggable(node, { stop: () => instance.repaintEverything() }); }
        if (n.link) { node.addEventListener('click', () => window.open(n.link, n.target || '_self')); }
    });

    setTimeout(() => {
        setInitialView();
        (mapData.connections || []).forEach(c => {
            if (document.getElementById(c.source) && document.getElementById(c.target)) {
                instance.connect({
                    source: c.source, target: c.target,
                    ...getConnectorConfig(lineStyle)
                });
            }
        });
    }, 150);
});
