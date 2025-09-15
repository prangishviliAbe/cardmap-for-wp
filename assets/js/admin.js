document.addEventListener('DOMContentLoaded', function(){
    const editor = document.getElementById('cardmap-editor');
    const editorWrapper = document.getElementById('cardmap-editor-wrapper');
    const postId = cardmapAdminData.postId;
    const ajaxUrl = cardmapAdminData.ajaxUrl;
    const lineStyle = cardmapAdminData.lineStyle;
    const lineColor = cardmapAdminData.lineColor;
    const lineThickness = cardmapAdminData.lineThickness;
    const enableAlignButton = cardmapAdminData.enableAlignButton;

    let mapData = cardmapAdminData.mapData || { nodes: [], connections: [] };

    const instance = jsPlumb.getInstance({ Container: editor, ContinuousRepaint: true });

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
        HoverPaintStyle: connectorConfig.paintStyle,
        EndpointStyle: { radius:5 },
        Anchors: ["Bottom", "Top"],
        ReattachConnections: true,
        MaxConnections: -1
    });

    let connectMode = false;
    let deleteMode = false;
    let firstNode = null;

    function renderNode(n){
        if (!n || !n.id) return;
        if (document.getElementById(n.id)) return;

        const node = document.createElement('div');
        node.className = 'cardmap-node';
        node.id = n.id;
        node.style.left = (n.x || 20) + 'px';
        node.style.top = (n.y || 20) + 'px';
        node.dataset.image = n.image || '';
        node.dataset.link = n.link || '';
        node.dataset.target = n.target || '_self';

        node.innerHTML = `
            <div class="node-image-wrapper">
                <div class="node-image">${ n.image ? `<img src="${n.image}">` : 'Select an image' }</div>
                <div class="card-caption" contenteditable="true">${ n.caption || 'Caption' }</div>
            </div>
            <div class="card-title" contenteditable="true">${ n.text || 'New Card Title' }</div>
            <div class="node-tools">
                <button class="button edit-image" type="button">Select Image</button>
                <input class="card-link-input" placeholder="Card link (https://...)" value="${ n.link || '' }" />
                <select class="card-link-target">
                    <option value="_self" ${ !n.target || n.target === '_self' ? 'selected' : '' }>Same window</option>
                    <option value="_blank" ${ n.target === '_blank' ? 'selected' : '' }>New window</option>
                </select>
            </div>
        `;

        editor.appendChild(node);

        instance.draggable(node, {
            drag: function(){ instance.repaintEverything(); },
            stop: function(params){
                const draggedNode = mapData.nodes.find(nn => nn.id === params.el.id);
                if (draggedNode) {
                    draggedNode.x = params.pos[0];
                    draggedNode.y = params.pos[1];
                }
                instance.repaintEverything();
            }
        });

        node.querySelector('.edit-image').addEventListener('click', function(e){
            e.stopPropagation();
            e.preventDefault();
            const frame = wp.media({
                title: 'Select Card Image',
                multiple: false,
                library: { type: 'image' },
                button: { text: 'Use this image' }
            });
            frame.on('select', function(){
                const sel = frame.state().get('selection').first().toJSON();
                if (sel && sel.url) {
                    node.dataset.image = sel.url;
                    const imgWrap = node.querySelector('.node-image');
                    imgWrap.innerHTML = `<img src="${sel.url}">`;
                }
            });
            frame.open();
        });

        node.querySelector('.card-link-input').addEventListener('input', function(){ node.dataset.link = this.value.trim(); });
        node.querySelector('.card-link-target').addEventListener('change', function(){ node.dataset.target = this.value; });
        node.querySelectorAll('[contenteditable]').forEach(el => {
            el.addEventListener('mousedown', e => e.stopPropagation());
            el.addEventListener('blur', () => {
                const changedNode = mapData.nodes.find(nn => nn.id === node.id);
                if (changedNode) {
                    if (el.classList.contains('card-title')) changedNode.text = el.innerText;
                    if (el.classList.contains('card-caption')) changedNode.caption = el.innerText;
                }
            });
        });

        node.addEventListener('click', function(e){
            if ( e.target.closest('.node-tools') || e.target.closest('[contenteditable]') ) return;
            if (connectMode) {
                if (!firstNode) {
                    firstNode = node;
                    node.style.boxShadow = '0 0 0 3px rgba(166,24,50,0.5)';
                } else if (firstNode !== node) {
                    instance.connect({
                        source: firstNode.id, target: node.id,
                        anchors: ["Bottom","Top"],
                        endpoint: ["Dot",{ radius: 5 }],
                        ...getConnectorConfig(lineStyle)
                    });
                    firstNode.style.boxShadow = '';
                    firstNode = null;
                }
            } else if (deleteMode) {
                instance.remove(node);
                mapData.nodes = mapData.nodes.filter(nn => nn.id !== node.id);
            }
        });
    }

    function loadMap(){
        mapData.nodes.forEach(n => renderNode(n));
        setTimeout(() => {
            (mapData.connections || []).forEach(c => {
                if (document.getElementById(c.source) && document.getElementById(c.target)) {
                    instance.connect({
                        source: c.source, target: c.target,
                        anchors: ["Bottom","Top"],
                        endpoint: ["Dot",{ radius: 5 }],
                        ...getConnectorConfig(lineStyle)
                    });
                }
            });
            centerEditor();
        }, 150);
    }

    function saveMap(){
        const nodes = Array.from(editor.querySelectorAll('.cardmap-node')).map(el => ({
            id: el.id,
            x: parseInt(el.style.left, 10) || 0,
            y: parseInt(el.style.top, 10) || 0,
            text: el.querySelector('.card-title')?.innerText || '',
            caption: el.querySelector('.card-caption')?.innerText || '',
            image: el.dataset.image || '',
            link: el.dataset.link || '',
            target: el.dataset.target || '_self'
        }));
        const connections = (instance.getAllConnections() || []).map(c => ({ source: c.sourceId, target: c.targetId }));

        fetch(ajaxUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
            body: new URLSearchParams({
                action: 'save_cardmap',
                post_id: postId,
                nonce: cardmapAdminData.nonce,
                data: JSON.stringify({ nodes, connections })
            })
        }).then(r => r.json()).then(res => {
            alert(res.success ? 'Map saved!' : 'Error saving map.');
        }).catch(err => { console.error(err); alert('Saving failed'); });
    }

    document.getElementById('add-node').addEventListener('click', () => {
        const newNode = { id: 'node_' + Date.now(), x: 40, y: 40, text: 'New Card', caption: 'Caption', image: '', link: '', target: '_self' };
        mapData.nodes.push(newNode);
        renderNode(newNode);
    });

    document.getElementById('connect-mode').addEventListener('click', function(){
        connectMode = !connectMode; deleteMode = false; firstNode = null;
        this.style.background = connectMode ? '#ffecec' : '';
        document.getElementById('delete-node').style.background = '';
    });

    document.getElementById('delete-node').addEventListener('click', function(){
        deleteMode = !deleteMode; connectMode = false; firstNode = null;
        this.style.background = deleteMode ? '#ffecec' : '';
        document.getElementById('connect-mode').style.background = '';
    });

    document.getElementById('save-map').addEventListener('click', saveMap);
    
    document.getElementById('fullscreen-editor').addEventListener('click', function(){
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            editorWrapper.requestFullscreen();
        }
    });

    if (enableAlignButton && document.getElementById('align-nodes')) {
        document.getElementById('align-nodes').addEventListener('click', function(){
            if (mapData.nodes.length === 0) return;

            const cardWidth = 240;
            const hSpacing = 40;
            const proximityThreshold = 100;

            const sortedNodes = [...mapData.nodes].sort((a, b) => (a.y || 0) - (b.y || 0));
            const rows = [];
            if (sortedNodes.length > 0) {
                let currentRow = [sortedNodes[0]];
                for (let i = 1; i < sortedNodes.length; i++) {
                    if (Math.abs(sortedNodes[i].y - currentRow[currentRow.length - 1].y) < proximityThreshold) {
                        currentRow.push(sortedNodes[i]);
                    } else {
                        rows.push(currentRow);
                        currentRow = [sortedNodes[i]];
                    }
                }
                rows.push(currentRow);
            }

            rows.forEach(row => {
                const base_y = row[0].y;
                let currentX = 40;
                row.sort((a, b) => (a.x || 0) - (b.x || 0));
                
                row.forEach(node => {
                    const domNode = document.getElementById(node.id);
                    if (domNode) {
                        node.x = currentX;
                        node.y = base_y;
                        domNode.style.left = node.x + 'px';
                        domNode.style.top = node.y + 'px';
                    }
                    currentX += cardWidth + hSpacing;
                });
            });

            instance.repaintEverything();
            centerEditor();
        });
    }

    let isPanning = false, startX = 0, startY = 0, offsetX = 0, offsetY = 0, scale = 1;
    
    function updateTransform() {
        editor.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
        instance.setZoom(scale);
    }

    function centerEditor() {
        if (mapData.nodes.length === 0) return;
        const xPositions = mapData.nodes.map(n => parseInt(n.x) || 0);
        const yPositions = mapData.nodes.map(n => parseInt(n.y) || 0);

        const minX = Math.min(...xPositions);
        const minY = Math.min(...yPositions);
        const maxX = Math.max(...xPositions);
        const maxY = Math.max(...yPositions);
        
        const contentWidth = maxX - minX;
        const contentHeight = maxY - minY;
        const contentCenterX = minX + (contentWidth / 2);
        const contentCenterY = minY + (contentHeight / 2);

        const editorWidth = editorWrapper.offsetWidth;
        const editorHeight = editorWrapper.offsetHeight;

        const newOffsetX = (editorWidth / 2) - contentCenterX;
        const newOffsetY = (editorHeight / 2) - contentCenterY;
        
        offsetX = newOffsetX;
        offsetY = newOffsetY;
        updateTransform();
    }

    editorWrapper.addEventListener('mousedown', e => {
        if (e.target !== editorWrapper) return;
        isPanning = true;
        startX = e.clientX - offsetX;
        startY = e.clientY - offsetY;
        editorWrapper.style.cursor = 'grabbing';
    });
    window.addEventListener('mousemove', e => {
        if (!isPanning) return;
        e.preventDefault();
        offsetX = e.clientX - startX;
        offsetY = e.clientY - startY;
        updateTransform();
    });
    window.addEventListener('mouseup', () => {
        isPanning = false;
        editorWrapper.style.cursor = 'grab';
    });

    editorWrapper.addEventListener('wheel', e => {
        e.preventDefault();
        scale += e.deltaY * -0.002;
        scale = Math.max(0.5, Math.min(2.5, scale));
        updateTransform();
    }, { passive: false });
    
    loadMap();
});
