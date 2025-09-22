document.addEventListener('DOMContentLoaded', function(){
    const editor = document.getElementById('cardmap-editor');
    if (!editor) return;

    const editorWrapper = document.getElementById('cardmap-editor-wrapper');
    const postId = document.getElementById('cardmap_post_id').value;
    const ajaxUrl = cardmap_admin_data.ajax_url;
    const lineStyle = cardmap_admin_data.line_style;
    const availableLineStylesRaw = cardmap_admin_data.available_line_styles;
    let availableLineStyles = {};
    try { availableLineStyles = typeof availableLineStylesRaw === 'string' ? JSON.parse(availableLineStylesRaw) : availableLineStylesRaw; } catch(e){ availableLineStyles = availableLineStylesRaw || {}; }
    const lineColor = cardmap_admin_data.line_color;
    const lineThickness = cardmap_admin_data.line_thickness;
    const enableAlignButton = cardmap_admin_data.enable_align_button;

    let mapData = cardmap_admin_data.map_data;
    try { if (typeof mapData === 'string') mapData = JSON.parse(mapData); } catch(e){ mapData = { nodes: [], connections: [] }; }
    if (!mapData || !Array.isArray(mapData.nodes)) mapData = { nodes: [], connections: [], rails: [] };
    if (!Array.isArray(mapData.rails)) mapData.rails = mapData.rails || [];

    const pendingDeletes = new Set();
    const selectedNodes = new Set();

    function updateAlignmentToolbar() {
        const toolbar = document.getElementById('cardmap-alignment-toolbar');
        if (!toolbar) return;
        if (selectedNodes.size > 1) {
            toolbar.style.display = 'flex';
        } else {
            toolbar.style.display = 'none';
        }
    }

    function hideConnectionVisual(conn) {
        if (!conn) return;
        try {
            if (typeof conn.setVisible === 'function') {
                conn.setVisible(false);
                return;
            }
        } catch (e) {}
        try {
            const connector = (typeof conn.getConnector === 'function') ? conn.getConnector() : (conn.connector || null);
            const canvas = connector && (connector.canvas || connector.canvasElement || connector.getCanvas && connector.getCanvas());
            if (canvas) {
                canvas.style.display = 'none';
                return;
            }
        } catch (e) {}
        try {
            if (conn.canvas) { conn.canvas.style.display = 'none'; return; }
        } catch (e) {}
        try {
            const elems = editor.querySelectorAll('.cardmap-connector');
            elems.forEach(el => {
                try {
                    const r = el.getBoundingClientRect();
                    const s = document.getElementById(conn.sourceId);
                    const t = document.getElementById(conn.targetId);
                    if (!s || !t) return;
                    const rs = s.getBoundingClientRect();
                    const rt = t.getBoundingClientRect();
                    const overlaps = !(r.right < rs.left || r.left > rs.right || r.bottom < rs.top || r.top > rs.bottom) || !(r.right < rt.left || r.left > rt.right || r.bottom < rt.top || r.top > rt.bottom);
                    if (overlaps) el.style.display = 'none';
                } catch (e) {}
            });
        } catch (e) {}
    }

    function showToast(message, timeout = 2500) {
        try {
            const existing = document.getElementById('cardmap-toast');
            if (existing) existing.remove();
            const t = document.createElement('div');
            t.id = 'cardmap-toast';
            t.style.position = 'fixed';
            t.style.right = '18px';
            t.style.bottom = '18px';
            t.style.zIndex = 999999;
            t.style.background = 'rgba(0,0,0,0.8)';
            t.style.color = '#fff';
            t.style.padding = '10px 14px';
            t.style.borderRadius = '8px';
            t.style.boxShadow = '0 6px 18px rgba(0,0,0,0.22)';
            t.style.fontSize = '13px';
            t.textContent = message;
            document.body.appendChild(t);
            setTimeout(() => { try{ t.remove(); } catch(e){} }, timeout);
        } catch (e) { console.warn('Toast failed', e); }
    }

    const instance = jsPlumb.getInstance({ Container: editor, ContinuousRepaint: true });
    try {
        instance.setContainer(editor);
    } catch (e) {
        console.warn('CardMap admin: instance.setContainer(editor) failed', e);
    }

    function getConnectorConfig(style) {
        const baseConfig = { stroke: lineColor, strokeWidth: lineThickness };
        const overlays = [["Arrow",{ width:10, length:10, location:1 }]];
        const dashedOverlay = { stroke: lineColor, strokeWidth: lineThickness, dashstyle: "4 2" };
        const dottedOverlay = { stroke: lineColor, strokeWidth: lineThickness, dashstyle: "1 1" };

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
    
    const connectorConfig = getConnectorConfig(lineStyle);

    instance.importDefaults({
        Connector: connectorConfig.connector,
        PaintStyle: connectorConfig.paintStyle,
        HoverPaintStyle: connectorConfig.paintStyle,
        EndpointStyle: { radius:5 },
        Anchors: ["Continuous", "Continuous"],
        ReattachConnections: false,
        MaxConnections: -1
    });

    // Intercept connection creation to prevent automatic re-connections
    instance.bind("beforeDrop", function(info) {
        // Only allow connections that we have explicitly flagged as "user-driven".
        // This prevents jsPlumb from automatically creating connections when dragging nodes.
        if (info.connection.getParameter("user-driven")) {
            return true; // Allow the connection
        }
        return false; // Block automatic connections
    });

    // When a connection is successfully made, save the data.
    // If it's a new connection made by the user, flag it as "user-driven".
    instance.bind("connection", function(info, originalEvent) {
        if (originalEvent) {
            // This was a brand new connection created by the user dragging it.
            info.connection.setParameter("user-driven", true);
        }
        // For any allowed connection (new or existing), save the map state.
        saveMapData();
    });

    const RAIL_HEIGHT = 8;
    const RAIL_SNAP_OFFSET = 12;
    const RAIL_SNAP_THRESHOLD = 40;
    const RAIL_SNAP_OFFSET_VERTICAL = 12;
    let railResizeState = null;

    window.addEventListener('mousemove', function(e){
        if (!railResizeState) return;
        try {
            const rect = editor.getBoundingClientRect();
            const clientX = e.clientX;
            const mapX = (clientX - rect.left - offsetX) / scale;
            const rs = mapData.rails.find(r => r.id === railResizeState.railId);
            const dom = document.getElementById(railResizeState.railId);
            if (!rs || !dom) return;
            if (!rs.orientation || rs.orientation === 'horizontal') {
                if (railResizeState.side === 'right') {
                    let newWidth = Math.max(40, mapX - railResizeState.startLeft);
                    rs.width = newWidth;
                    dom.style.width = (newWidth) + 'px';
                } else if (railResizeState.side === 'left') {
                    let newLeft = Math.min(mapX, railResizeState.startLeft + railResizeState.startWidth - 40);
                    const newWidth = Math.max(40, railResizeState.startLeft + railResizeState.startWidth - newLeft);
                    rs.x = newLeft;
                    rs.width = newWidth;
                    dom.style.left = (newLeft) + 'px';
                    dom.style.width = (newWidth) + 'px';
                }
                try{ mapData.nodes.forEach(n => { if (n.attachedRail === rs.id) { n.y = rs.y + RAIL_SNAP_OFFSET; const dn = document.getElementById(n.id); if (dn) dn.style.top = n.y + 'px'; } }); } catch(e){}
            } else {
                if (railResizeState.side === 'bottom') {
                    let newHeight = Math.max(40, mapX - railResizeState.startLeft);
                    rs.height = newHeight;
                    dom.style.height = (newHeight) + 'px';
                } else if (railResizeState.side === 'top') {
                    let newTop = Math.min(mapX, railResizeState.startLeft + railResizeState.startWidth - 40);
                    const newHeight = Math.max(40, railResizeState.startLeft + railResizeState.startWidth - newTop);
                    rs.y = newTop;
                    rs.height = newHeight;
                    dom.style.top = (newTop) + 'px';
                    dom.style.height = (newHeight) + 'px';
                }
                try{ mapData.nodes.forEach(n => { if (n.attachedRail === rs.id) { n.x = rs.x + RAIL_SNAP_OFFSET_VERTICAL; const dn = document.getElementById(n.id); if (dn) dn.style.left = n.x + 'px'; } }); } catch(e){}
            }
            try{ instance.repaintEverything(); } catch(e){}
        } catch(e) {}
    });
    window.addEventListener('mouseup', function(e){ if (railResizeState) { railResizeState = null; } });

    let connectMode = false;
    let deleteMode = false;
    let firstNode = null;
    let firstAnchor = null;

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
        node.dataset.style = n.style || 'default';
        
        const nodeStylesRaw = cardmap_admin_data.node_styles;
        let nodeStyles = {};
        try { nodeStyles = typeof nodeStylesRaw === 'string' ? JSON.parse(nodeStylesRaw) : nodeStylesRaw; } catch(e){ nodeStyles = nodeStylesRaw || {}; }

        const styleOptions = Object.keys(nodeStyles).map(k => `<option value="${k}" ${ k === (n.style || 'default') ? 'selected' : '' }>${nodeStyles[k]}</option>`).join('');

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
                <label style="display:block;margin-top:8px;font-size:12px;color:#666;">Style</label>
                <select class="card-node-style" style="width:100%;">${styleOptions}</select>
            </div>
        `;

        editor.appendChild(node);

        instance.draggable(node, {
            start: function(){ window._cardmap_draggingNode = node.id; },
            drag: function(params){
                try{
                    const rails = mapData.rails || [];
                    let nearest = null; let bestDist = Infinity;
                    const rect = editor.getBoundingClientRect();
                    const elLeft = parseFloat(node.style.left) || 0;
                    const elCenterX = elLeft + (node.offsetWidth || 240) / 2;
                    for (let i = 0; i < rails.length; i++) {
                        const r = rails[i];
                        if (elCenterX >= r.x && elCenterX <= (r.x + (r.width || 0))) {
                            const dy = Math.abs((r.y + RAIL_SNAP_OFFSET) - (parseFloat(node.style.top) || 0));
                            if (dy < bestDist) { bestDist = dy; nearest = r; }
                        }
                    }
                    (mapData.rails || []).forEach(rr => { const d = document.getElementById(rr.id); if (d) { d.classList.remove('rail-highlight'); const p = d.querySelector('.rail-snap-preview'); if (p) p.style.display = 'none'; } });
                    if (nearest && bestDist <= RAIL_SNAP_THRESHOLD) {
                        const d = document.getElementById(nearest.id);
                        if (d) {
                            d.classList.add('rail-highlight');
                            const p = d.querySelector('.rail-snap-preview');
                            if (p) {
                                p.style.display = 'block';
                            }
                        }
                    }
                }catch(e){}
                try{ instance.repaintEverything(); } catch(e){}
            },
            stop: function(params){
                const draggedNode = mapData.nodes.find(n => n.id === params.el.id);
                if (draggedNode) {
                    draggedNode.x = params.pos[0];
                    draggedNode.y = params.pos[1];
                    const rails = mapData.rails || [];
                    let snapped = null;
                    for (let i = 0; i < rails.length; i++) {
                        const r = rails[i];
                        const nodeCenterX = draggedNode.x + (params.el.offsetWidth || 240) / 2;
                        if (nodeCenterX >= r.x && nodeCenterX <= (r.x + (r.width || 0))) {
                            const dy = Math.abs(draggedNode.y - (r.y + RAIL_SNAP_OFFSET));
                            if (dy <= RAIL_SNAP_THRESHOLD) { snapped = r; break; }
                        }
                    }
                    if (snapped) {
                        draggedNode.attachedRail = snapped.id;
                        if (snapped.orientation === 'vertical') {
                            draggedNode.x = snapped.x + RAIL_SNAP_OFFSET_VERTICAL;
                            params.el.style.left = draggedNode.x + 'px';
                        } else {
                            draggedNode.y = snapped.y + RAIL_SNAP_OFFSET;
                            params.el.style.top = draggedNode.y + 'px';
                        }
                    } else {
                        if (draggedNode.attachedRail) delete draggedNode.attachedRail;
                    }
                    (mapData.rails || []).forEach(rr => { const d = document.getElementById(rr.id); if (d) { d.classList.remove('rail-highlight'); const p = d.querySelector('.rail-snap-preview'); if (p) p.style.display = 'none'; } });
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
        const styleSelect = node.querySelector('.card-node-style');
        if (styleSelect) {
            styleSelect.addEventListener('change', function(){
                node.dataset.style = this.value;
                const changedNode = mapData.nodes.find(nn => nn.id === node.id);
                if (changedNode) changedNode.style = this.value;
                node.classList.remove(...Object.keys(nodeStyles).map(k=>'style-'+k));
                node.classList.add('style-' + this.value);
            });
            if (n.style) node.classList.add('style-' + n.style);
        }
        node.querySelectorAll('[contenteditable]').forEach(el => {
            el.addEventListener('mousedown', e => e.stopPropagation());
            el.addEventListener('blur', () => {
                const changedNode = mapData.nodes.find(n => n.id === node.id);
                if (changedNode) {
                    if (el.classList.contains('card-title')) changedNode.text = el.innerText;
                    if (el.classList.contains('card-caption')) changedNode.caption = el.innerText;
                }
            });
        });

        node.addEventListener('dblclick', function(e){
            e.stopPropagation();
            document.querySelectorAll('#cardmap-node-inspector').forEach(n=>n.remove());

            const inspector = document.createElement('div');
            inspector.id = 'cardmap-node-inspector';
            inspector.style.position = 'fixed';
            const rect = node.getBoundingClientRect();
            inspector.style.left = (rect.right + 10) + 'px';
            inspector.style.top = (rect.top) + 'px';
            inspector.style.zIndex = 99999;
            inspector.style.background = '#fff';
            inspector.style.border = '1px solid #ddd';
            inspector.style.padding = '8px';
            inspector.style.borderRadius = '6px';
            inspector.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)';
            inspector.style.minWidth = '220px';

            const title = document.createElement('div'); title.textContent = 'Node Actions'; title.style.fontWeight = '700'; title.style.marginBottom = '8px';
            inspector.appendChild(title);

            const list = document.createElement('div');
            const attached = (mapData.connections || []).filter(c => c.source === node.id || c.target === node.id);
            if (attached.length === 0) {
                const none = document.createElement('div'); none.textContent = 'No connections attached'; none.style.color = '#666'; list.appendChild(none);
            } else {
                attached.forEach(c => {
                    const row = document.createElement('div');
                    row.style.display = 'flex'; row.style.gap = '8px'; row.style.alignItems = 'center'; row.style.marginBottom = '6px';
                    const label = document.createElement('div'); label.style.flex = '1'; label.style.fontSize = '13px'; label.textContent = (c.source === node.id ? ('→ ' + c.target) : ('← ' + c.source));
                    const sel = document.createElement('select');
                    Object.keys(availableLineStyles).forEach(k => { const o = document.createElement('option'); o.value = k; o.textContent = availableLineStyles[k]; sel.appendChild(o); });
                    sel.value = c.style || lineStyle || Object.keys(availableLineStyles)[0] || '';
                    sel.addEventListener('change', function(){
                        c.style = this.value;
                        instance.getAllConnections().forEach(conn => {
                            if ((c.id && conn._cardmap_id === c.id) || (conn.sourceId === c.source && conn.targetId === c.target)) {
                                try{ applyConnectionStyle(conn, c.style); } catch(e){}
                            }
                        });
                    });
                    const del = document.createElement('button'); del.className = 'button'; del.textContent = 'Delete'; del.style.whiteSpace = 'nowrap';
                    del.addEventListener('click', function(){
                        let cid = c.id || null;
                        if (!cid) {
                            cid = 'conn_' + Date.now() + '_' + Math.floor(Math.random()*10000);
                            c.id = cid;
                        }
                        pendingDeletes.add(cid);
                        instance.getAllConnections().forEach(conn => { if (conn._cardmap_id === cid || (conn.sourceId === c.source && conn.targetId === c.target)) try{ hideConnectionVisual(conn); } catch(e){} });
                        try{ instance.repaintEverything(); } catch(e){}
                        row.remove();
                    });
                    row.appendChild(label); row.appendChild(sel); row.appendChild(del);
                    list.appendChild(row);
                });
            }
            inspector.appendChild(list);

            const deleteAttached = document.createElement('button'); deleteAttached.className = 'button'; deleteAttached.textContent = 'Delete attached connections'; deleteAttached.style.marginTop = '8px';
            deleteAttached.addEventListener('click', function(){
                const toDetach = [];
                instance.getAllConnections().forEach(conn => {
                    if (conn.sourceId === node.id || conn.targetId === node.id) toDetach.push(conn);
                });

                toDetach.forEach(conn => {
                    let cid = conn._cardmap_id || null;
                    if (!cid) {
                        cid = 'conn_' + Date.now() + '_' + Math.floor(Math.random()*10000);
                        try{ conn._cardmap_id = cid; } catch(e){}
                        const entry = (mapData.connections || []).find(c => c.source === conn.sourceId && c.target === conn.targetId);
                        if (entry) entry.id = cid;
                    }
                    if (cid) pendingDeletes.add(cid);
                    try{ hideConnectionVisual(conn); } catch(e){}
                });

                try{ instance.repaintEverything(); } catch(e){}
                try{
                    let attempts = 0;
                    let remaining = instance.getAllConnections().filter(conn => conn.sourceId === node.id || conn.targetId === node.id);
                    while (remaining.length > 0 && attempts < 5) {
                        remaining.forEach(conn => { try{ instance.detach(conn); } catch(e){} });
                        try{ instance.repaintEverything(); } catch(e){}
                        attempts++;
                        remaining = instance.getAllConnections().filter(conn => conn.sourceId === node.id || conn.targetId === node.id);
                    }
                } catch(e) { console.warn('Error during defensive connection cleanup', e); }

                list.innerHTML = '<div style="color:#666">No connections attached</div>';
            });
            inspector.appendChild(deleteAttached);

            const nodeDelete = document.createElement('button'); nodeDelete.className = 'button button-danger'; nodeDelete.textContent = 'Delete Node'; nodeDelete.style.marginTop = '8px';
            nodeDelete.addEventListener('click', function(){
                instance.remove(node);
                mapData.nodes = mapData.nodes.filter(n => n.id !== node.id);
                mapData.connections = (mapData.connections || []).filter(c => !(c.source === node.id || c.target === node.id));
                inspector.remove();
            });
            inspector.appendChild(nodeDelete);

            document.body.appendChild(inspector);

            const onDocClick = (ev) => { if (!inspector.contains(ev.target) && ev.target !== node) { inspector.remove(); window.removeEventListener('mousedown', onDocClick); } };
            window.addEventListener('mousedown', onDocClick);
        });

        node.addEventListener('click', function(e){
            if ( e.target.closest('.node-tools') || e.target.closest('[contenteditable]') ) return;

            if (!connectMode && !deleteMode) {
                if (!e.shiftKey) {
                    // Clear previous selection unless shift is held
                    document.querySelectorAll('.cardmap-node-selected').forEach(el => {
                        if (el.id !== node.id) el.classList.remove('cardmap-node-selected');
                    });
                    selectedNodes.forEach(id => {
                        if (id !== node.id) selectedNodes.delete(id);
                    });
                }

                // Toggle selection for the current node
                if (selectedNodes.has(node.id)) {
                    if (e.shiftKey) { // Only deselect with shift key
                        selectedNodes.delete(node.id);
                        node.classList.remove('cardmap-node-selected');
                    }
                } else {
                    selectedNodes.add(node.id);
                    node.classList.add('cardmap-node-selected');
                }
                updateAlignmentToolbar();
            }

            if (connectMode) {
                if (!firstNode) {
                    firstNode = node;
                    firstAnchor = getPreciseAnchorFromEvent(e, node);
                    node.style.boxShadow = '0 0 0 3px rgba(166,24,50,0.5)';
                } else if (firstNode !== node) {
                    const a = firstNode.id;
                    const b = node.id;
                    mapData.connections = mapData.connections || [];
                    const exists = mapData.connections.some(c => {
                        if (!c) return false;
                        return ((c.source === a && c.target === b) || (c.source === b && c.target === a)) && !pendingDeletes.has(c.id);
                    });

                    const allowParallel = !!(e && e.altKey);
                    if (exists && !allowParallel) {
                        showToast('Connection already exists between these cards. Hold Alt and click to force a parallel connection.');
                        firstNode.style.boxShadow = '';
                        firstNode = null;
                        return;
                    }

                    const secondAnchor = getPreciseAnchorFromEvent(e, node);
                    const autoAnchors = getDirectionalAnchors(firstNode, node);
                    const anchorA = firstAnchor || autoAnchors[0];
                    const anchorB = secondAnchor || autoAnchors[1];
                    const conn = instance.connect({
                        source: firstNode.id, target: node.id,
                        anchors: [ anchorA, anchorB ],
                        endpoint: ["Dot",{ radius: 5 }],
                        ...getConnectorConfig(lineStyle),
                        overlays: (getConnectorConfig(lineStyle).overlays || []).map(o => o),
                        paintStyle: Object.assign({}, getConnectorConfig(lineStyle).paintStyle || {}),
                        cssClass: 'cardmap-connector'
                    });
                    const newId = 'conn_' + Date.now() + '_' + Math.floor(Math.random()*10000);
                    try{ conn._cardmap_id = newId; } catch(e){}
                    mapData.connections.push({ id: newId, source: firstNode.id, target: node.id, style: lineStyle || 'straight', anchors: [anchorA, anchorB] });
                    firstNode.style.boxShadow = '';
                    firstNode = null;
                    firstAnchor = null;
                }
            } else if (deleteMode) {
                instance.remove(node);
                mapData.nodes = mapData.nodes.filter(n => n.id !== node.id);
                mapData.connections = (mapData.connections || []).filter(c => !(c.source === node.id || c.target === node.id));
            }
        });

        node.style.zIndex = 2000;
    }

    function renderRail(r) {
        if (!r || !r.id) return;
        if (document.getElementById(r.id)) return;
        const rail = document.createElement('div');
        rail.className = 'cardmap-rail' + (r.orientation === 'vertical' ? ' vertical' : '');
        rail.id = r.id;
        if (!r.orientation || r.orientation === 'horizontal') {
            rail.style.left = (r.x || 40) + 'px';
            rail.style.top = (r.y || 40) + 'px';
            rail.style.width = (r.width || 400) + 'px';
            rail.style.height = RAIL_HEIGHT + 'px';
            rail.dataset.orientation = 'horizontal';
        } else {
            rail.style.left = (r.x || 40) + 'px';
            rail.style.top = (r.y || 40) + 'px';
            rail.style.height = (r.height || 400) + 'px';
            rail.style.width = RAIL_HEIGHT + 'px';
            rail.dataset.orientation = 'vertical';
        }

        const handle = document.createElement('div'); handle.className = 'rail-handle'; rail.appendChild(handle);
        const leftHandle = document.createElement('div'); leftHandle.className = 'rail-resize-handle left'; leftHandle.style.position = 'absolute'; leftHandle.style.left = '-6px'; leftHandle.style.top = '50%'; leftHandle.style.transform = 'translateY(-50%)'; leftHandle.style.width = '12px'; leftHandle.style.height = '12px'; leftHandle.style.cursor = (r.orientation === 'vertical' ? 'ns-resize' : 'ew-resize'); leftHandle.style.background = 'rgba(255,255,255,0.9)'; leftHandle.style.border = '1px solid rgba(0,0,0,0.06)'; leftHandle.style.borderRadius = '2px'; rail.appendChild(leftHandle);
        const rightHandle = document.createElement('div'); rightHandle.className = 'rail-resize-handle right'; rightHandle.style.position = 'absolute'; rightHandle.style.right = '-6px'; rightHandle.style.top = '50%'; rightHandle.style.transform = 'translateY(-50%)'; rightHandle.style.width = '12px'; rightHandle.style.height = '12px'; rightHandle.style.cursor = (r.orientation === 'vertical' ? 'ns-resize' : 'ew-resize'); rightHandle.style.background = 'rgba(255,255,255,0.9)'; rightHandle.style.border = '1px solid rgba(0,0,0,0.06)'; rightHandle.style.borderRadius = '2px'; rail.appendChild(rightHandle);

        const snapPreview = document.createElement('div');
        snapPreview.className = 'rail-snap-preview';
        rail.appendChild(snapPreview);

        leftHandle.addEventListener('mousedown', function(e){ e.stopPropagation(); const side = (r.orientation === 'vertical') ? 'top' : 'left'; railResizeState = { railId: rail.id, side: side, startX: e.clientX, startLeft: parseFloat(rail.style.left) || 0, startWidth: parseFloat(rail.style.width) || (r.width || 400) }; });
        rightHandle.addEventListener('mousedown', function(e){ e.stopPropagation(); const side = (r.orientation === 'vertical') ? 'bottom' : 'right'; railResizeState = { railId: rail.id, side: side, startX: e.clientX, startLeft: parseFloat(rail.style.left) || 0, startWidth: parseFloat(rail.style.width) || (r.width || 400) }; });

        editor.appendChild(rail);

        instance.draggable(rail, {
            drag: function(){ instance.repaintEverything(); },
            stop: function(params){
                const rr = mapData.rails.find(x => x.id === params.el.id);
                if (rr) {
                    if (!rr.orientation || rr.orientation === 'horizontal') { rr.x = params.pos[0]; rr.y = params.pos[1]; }
                    else { rr.x = params.pos[0]; rr.y = params.pos[1]; }
                }
                instance.repaintEverything();
            }
        });

        rail.addEventListener('dblclick', function(e){
            e.stopPropagation();
            document.querySelectorAll('#cardmap-rail-inspector').forEach(el=>el.remove());
            const inspector = document.createElement('div'); inspector.id = 'cardmap-rail-inspector';
            inspector.style.position = 'fixed'; inspector.style.left = (e.clientX + 8) + 'px'; inspector.style.top = (e.clientY + 8) + 'px';
            inspector.style.zIndex = 99999; inspector.style.background = '#fff'; inspector.style.border = '1px solid #ddd'; inspector.style.padding = '8px'; inspector.style.borderRadius = '6px'; inspector.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)';
            const title = document.createElement('div'); title.textContent = 'Rail Actions'; title.style.fontWeight = '700'; title.style.marginBottom = '8px'; inspector.appendChild(title);
            const remBtn = document.createElement('button'); remBtn.className = 'button'; remBtn.textContent = 'Delete Rail'; remBtn.addEventListener('click', function(){
                instance.getAllConnections().forEach(conn => {
                    if (conn.sourceId === rail.id || conn.targetId === rail.id) {
                        const id = conn._cardmap_id || null;
                        if (id) pendingDeletes.add(id);
                        try{ hideConnectionVisual(conn); } catch(e){}
                    }
                });
                try{ instance.remove(rail); } catch(e){}
                mapData.rails = (mapData.rails || []).filter(x => x.id !== rail.id);
                inspector.remove();
            });
            inspector.appendChild(remBtn);
            document.body.appendChild(inspector);
            const rem = (ev) => { if (!inspector.contains(ev.target)) { inspector.remove(); window.removeEventListener('mousedown', rem); } };
            window.addEventListener('mousedown', rem);
        });

        rail.style.zIndex = 1600;

        rail.addEventListener('click', function(e){
            e.stopPropagation();
            if (e.target.closest('.rail-handle')) return;
            if (connectMode) {
                if (!firstNode) {
                    firstNode = rail;
                    firstAnchor = getPreciseAnchorFromEvent(e, rail);
                    rail.style.boxShadow = '0 0 0 3px rgba(166,24,50,0.12)';
                } else if (firstNode !== rail) {
                    const a = firstNode.id;
                    const b = rail.id;
                    mapData.connections = mapData.connections || [];
                    const exists = mapData.connections.some(c => ((c.source === a && c.target === b) || (c.source === b && c.target === a)) && !pendingDeletes.has(c.id));
                    const allowParallel = !!(e && e.altKey);
                    if (exists && !allowParallel) {
                        showToast('Connection already exists between these items. Hold Alt and click to force a parallel connection.');
                        if (firstNode.style) firstNode.style.boxShadow = '';
                        firstNode = null; firstAnchor = null;
                        return;
                    }
                    const secondAnchor = getPreciseAnchorFromEvent(e, rail);
                    const autoAnchors = getDirectionalAnchors(firstNode, rail);
                    const anchorA = firstAnchor || autoAnchors[0];
                    const anchorB = secondAnchor || autoAnchors[1];
                    const conn = instance.connect({ source: firstNode.id, target: rail.id, anchors: [anchorA, anchorB], endpoint: ["Dot",{ radius: 5 }], ...getConnectorConfig(lineStyle), cssClass: 'cardmap-connector' });
                    const newId = 'conn_' + Date.now() + '_' + Math.floor(Math.random()*10000);
                    try{ conn._cardmap_id = newId; } catch(e){}
                    mapData.connections.push({ id: newId, source: firstNode.id, target: rail.id, style: lineStyle || 'straight', anchors: [anchorA, anchorB] });
                    if (firstNode.style) firstNode.style.boxShadow = '';
                    firstNode = null; firstAnchor = null;
                }
                return;
            }
            if (deleteMode) {
                instance.getAllConnections().forEach(conn => {
                    if (conn.sourceId === rail.id || conn.targetId === rail.id) {
                        const id = conn._cardmap_id || null;
                        if (id) pendingDeletes.add(id);
                        try{ hideConnectionVisual(conn); } catch(e){}
                    }
                });
                try{ instance.repaintEverything(); } catch(e){}
            }
        });
    }
    
    function getDirectionalAnchors(sourceNode, targetNode) {
        const containerRect = editor.getBoundingClientRect();
        const s = sourceNode.getBoundingClientRect();
        const t = targetNode.getBoundingClientRect();

        const sCenterX = (s.left + s.right) / 2 - containerRect.left;
        const sCenterY = (s.top + s.bottom) / 2 - containerRect.top;
        const tCenterX = (t.left + t.right) / 2 - containerRect.left;
        const tCenterY = (t.top + t.bottom) / 2 - containerRect.top;

        const dx = tCenterX - sCenterX;
        const dy = tCenterY - sCenterY;

        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);

        try {
            const sIsRail = sourceNode.classList && sourceNode.classList.contains('cardmap-rail');
            const tIsRail = targetNode.classList && targetNode.classList.contains('cardmap-rail');
            if (sIsRail || tIsRail) {
                let rail, other;
                if (sIsRail) { rail = sourceNode; other = targetNode; } else { rail = targetNode; other = sourceNode; }
                
                const railIsVertical = rail.dataset.orientation === 'vertical';
                const otherRect = other.getBoundingClientRect();
                const railRect = rail.getBoundingClientRect();
                
                let anchor;
                if (railIsVertical) {
                    const y = (otherRect.top + otherRect.height / 2 - railRect.top) / railRect.height;
                    anchor = [0.5, Math.max(0, Math.min(1, y)), 0, 0];
                } else {
                    const x = (otherRect.left + otherRect.width / 2 - railRect.left) / railRect.width;
                    anchor = [Math.max(0, Math.min(1, x)), 0.5, 0, 0];
                }

                if (sIsRail) return [anchor, "Continuous"];
                return ["Continuous", anchor];
            }
        } catch (e) {}

        if (absDx > absDy) {
            return dx > 0 ? ["Right", "Left"] : ["Left", "Right"];
        } else {
            return dy > 0 ? ["Bottom", "Top"] : ["Top", "Bottom"];
        }
    }

    function getPreciseAnchorFromEvent(e, el) {
        const wrapperRect = editorWrapper.getBoundingClientRect();

        // Mouse position relative to the viewport (the wrapper)
        const mouseX = e.clientX - wrapperRect.left;
        const mouseY = e.clientY - wrapperRect.top;

        // Translate viewport coordinates to the panned/zoomed editor's coordinate system ("world" coordinates)
        const worldX = (mouseX - offsetX) / scale;
        const worldY = (mouseY - offsetY) / scale;

        // The element's position is in "world" coordinates
        const elX = parseFloat(el.style.left) || 0;
        const elY = parseFloat(el.style.top) || 0;

        // The click position relative to the element's top-left corner
        const x_in_el = worldX - elX;
        const y_in_el = worldY - elY;

        // The relative position (0 to 1) within the element
        const x = x_in_el / el.offsetWidth;
        const y = y_in_el / el.offsetHeight;

        if (el.classList.contains('cardmap-rail')) {
            if (el.dataset.orientation === 'vertical') {
                // For a vertical rail, anchor is on left/right edge (x=0 or x=1)
                // y position is where user clicked. dx/dy defines orientation.
                return [x > 0.5 ? 1 : 0, y, x > 0.5 ? 1 : -1, 0];
            } else {
                // For a horizontal rail, anchor is on top/bottom edge (y=0 or y=1)
                // x position is where user clicked.
                return [x, y > 0.5 ? 1 : 0, 0, y > 0.5 ? 1 : -1];
            }
        }

        // For regular nodes, find the closest edge
        const topDist = y;
        const bottomDist = 1 - y;
        const leftDist = x;
        const rightDist = 1 - x;

        const min = Math.min(topDist, bottomDist, leftDist, rightDist);
        if (min === topDist) return "Top";
        if (min === bottomDist) return "Bottom";
        if (min === leftDist) return "Left";
        return "Right";
    }

    function determineAnchorFromEvent(e, el) {
        const rect = el.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const w = rect.width;
        const h = rect.height;

        const topDist = y;
        const bottomDist = h - y;
        const leftDist = x;
        const rightDist = w - x;

        const min = Math.min(topDist, bottomDist, leftDist, rightDist);
        if (min === topDist) return "Top";
        if (min === bottomDist) return "Bottom";
        if (min === leftDist) return "Left";
        return "Right";
    }

    function applyConnectionStyle(conn, style) {
        if (!conn) return;
        const config = getConnectorConfig(style);
        try {
            if (config.connector) conn.setConnector(config.connector);
            if (config.paintStyle) conn.setPaintStyle(config.paintStyle);
            if (config.overlays) {
                conn.removeAllOverlays();
                config.overlays.forEach(o => conn.addOverlay(o));
            }
        } catch (e) { console.warn('Failed to apply style to connection', e); }
    }

    function init() {
        instance.batch(() => {
            (mapData.rails || []).forEach(renderRail);
            (mapData.nodes || []).forEach(renderNode);
            (mapData.connections || []).forEach(c => {
                if (!c || !c.source || !c.target) return;
                const sourceEl = document.getElementById(c.source);
                const targetEl = document.getElementById(c.target);
                if (!sourceEl || !targetEl) return;

                const connStyle = c.style || lineStyle || 'straight';
                const config = getConnectorConfig(connStyle);
                
                const conn = instance.connect({
                    source: c.source,
                    target: c.target,
                    anchors: c.anchors || getDirectionalAnchors(sourceEl, targetEl),
                    ...config,
                    cssClass: 'cardmap-connector'
                });
                if (conn) {
                    try { conn._cardmap_id = c.id || ('conn_' + Date.now() + '_' + Math.floor(Math.random()*10000)); } catch(e){}
                }
            });
        });
    }

    document.getElementById('add-node').addEventListener('click', function(){
        const id = 'node_' + Date.now();
        const newNode = { id: id, x: 100, y: 100, text: 'New Card', caption: 'Caption', image: '', link: '', target: '_self', style: 'default' };
        mapData.nodes.push(newNode);
        renderNode(newNode);
    });

    document.getElementById('add-rail').addEventListener('click', function(){
        const id = 'rail_' + Date.now();
        const orientation = document.getElementById('add-rail-orientation').value;
        const newRail = { id: id, x: 150, y: 150, orientation: orientation };
        if (orientation === 'vertical') {
            newRail.height = 400;
            newRail.width = RAIL_HEIGHT;
        } else {
            newRail.width = 400;
            newRail.height = RAIL_HEIGHT;
        }
        mapData.rails.push(newRail);
        renderRail(newRail);
    });

    document.getElementById('connect-mode').addEventListener('click', function(){
        connectMode = !connectMode;
        deleteMode = false;
        this.classList.toggle('button-primary', connectMode);
        document.getElementById('delete-node').classList.remove('button-primary');
        editor.style.cursor = connectMode ? 'crosshair' : 'grab';
        if (!connectMode && firstNode) {
            firstNode.style.boxShadow = '';
            firstNode = null;
            firstAnchor = null;
        }
    });

    document.getElementById('delete-node').addEventListener('click', function(){
        deleteMode = !deleteMode;
        connectMode = false;
        this.classList.toggle('button-primary', deleteMode);
        document.getElementById('connect-mode').classList.remove('button-primary');
        editor.style.cursor = deleteMode ? 'not-allowed' : 'grab';
    });

    if (enableAlignButton) {
        document.getElementById('align-nodes').addEventListener('click', function(){
            const nodes = mapData.nodes || [];
            if (nodes.length === 0) return;

            const margin = 40;
            let x = margin;
            let y = margin;
            let rowHeight = 0;
            
            // Use the visible wrapper's width for layout calculation
            const containerWidth = editorWrapper.clientWidth;

            nodes.forEach(nodeData => {
                const el = document.getElementById(nodeData.id);
                if (!el) return;

                const elWidth = el.offsetWidth;
                const elHeight = el.offsetHeight;

                // If the next node doesn't fit on the current row, start a new row
                if (x + elWidth + margin > containerWidth) {
                    x = margin;
                    y += rowHeight + margin;
                    rowHeight = 0;
                }

                // Update node data and element position
                nodeData.x = x;
                nodeData.y = y;
                el.style.left = x + 'px';
                el.style.top = y + 'px';

                // Advance x position for the next node
                x += elWidth + margin;
                
                // Keep track of the tallest node in the current row
                rowHeight = Math.max(rowHeight, elHeight);
            });

            // Reset pan and zoom to center the newly aligned nodes
            scale = 1;
            offsetX = 0;
            offsetY = 0;
            editor.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;

            instance.repaintEverything();
        });
    }

    document.getElementById('fullscreen-editor').addEventListener('click', function(){
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            editorWrapper.requestFullscreen();
        }
    });

    editorWrapper.addEventListener('click', function(e) {
        if (e.target === editorWrapper || e.target === editor) {
            document.querySelectorAll('.cardmap-node-selected').forEach(el => el.classList.remove('cardmap-node-selected'));
            selectedNodes.clear();
            updateAlignmentToolbar();
        }
    });

    function getSelectedNodesWithElements() {
        const nodes = [];
        for (const id of selectedNodes) {
            const el = document.getElementById(id);
            const data = mapData.nodes.find(n => n.id === id);
            if (el && data) {
                nodes.push({ id, el, data });
            }
        }
        return nodes;
    }

    document.getElementById('align-left').addEventListener('click', function() {
        const selected = getSelectedNodesWithElements();
        if (selected.length < 2) return;
        const minX = Math.min(...selected.map(n => n.data.x));
        selected.forEach(n => {
            n.data.x = minX;
            n.el.style.left = minX + 'px';
        });
        instance.repaintEverything();
    });

    document.getElementById('align-center').addEventListener('click', function() {
        const selected = getSelectedNodesWithElements();
        if (selected.length < 2) return;
        const totalWidth = selected.reduce((sum, n) => sum + n.el.offsetWidth, 0);
        const avgX = selected.reduce((sum, n) => sum + n.data.x, 0) / selected.length;
        const centerX = avgX + (totalWidth / selected.length / 2);
        selected.forEach(n => {
            const newX = centerX - (n.el.offsetWidth / 2);
            n.data.x = newX;
            n.el.style.left = newX + 'px';
        });
        instance.repaintEverything();
    });

    document.getElementById('align-right').addEventListener('click', function() {
        const selected = getSelectedNodesWithElements();
        if (selected.length < 2) return;
        const maxX = Math.max(...selected.map(n => n.data.x + n.el.offsetWidth));
        selected.forEach(n => {
            const newX = maxX - n.el.offsetWidth;
            n.data.x = newX;
            n.el.style.left = newX + 'px';
        });
        instance.repaintEverything();
    });

    document.getElementById('align-top').addEventListener('click', function() {
        const selected = getSelectedNodesWithElements();
        if (selected.length < 2) return;
        const minY = Math.min(...selected.map(n => n.data.y));
        selected.forEach(n => {
            n.data.y = minY;
            n.el.style.top = minY + 'px';
        });
        instance.repaintEverything();
    });

    document.getElementById('align-middle').addEventListener('click', function() {
        const selected = getSelectedNodesWithElements();
        if (selected.length < 2) return;
        const avgY = selected.reduce((sum, n) => sum + n.data.y, 0) / selected.length;
        const totalHeight = selected.reduce((sum, n) => sum + n.el.offsetHeight, 0);
        const centerY = avgY + (totalHeight / selected.length / 2);
        selected.forEach(n => {
            const newY = centerY - (n.el.offsetHeight / 2);
            n.data.y = newY;
            n.el.style.top = newY + 'px';
        });
        instance.repaintEverything();
    });

    document.getElementById('align-bottom').addEventListener('click', function() {
        const selected = getSelectedNodesWithElements();
        if (selected.length < 2) return;
        const maxY = Math.max(...selected.map(n => n.data.y + n.el.offsetHeight));
        selected.forEach(n => {
            const newY = maxY - n.el.offsetHeight;
            n.data.y = newY;
            n.el.style.top = newY + 'px';
        });
        instance.repaintEverything();
    });

    document.getElementById('distribute-horizontal').addEventListener('click', function() {
        const selected = getSelectedNodesWithElements();
        if (selected.length < 2) return;
        selected.sort((a, b) => a.data.x - b.data.x);
        const minX = selected[0].data.x;
        const maxX = selected[selected.length - 1].data.x;
        const totalWidth = selected.reduce((sum, n) => sum + n.el.offsetWidth, 0);
        const totalGap = (maxX - minX) - (totalWidth - selected[0].el.offsetWidth - selected[selected.length - 1].el.offsetWidth);
        const gap = totalGap / (selected.length - 1);
        let currentX = minX;
        selected.forEach((n, i) => {
            n.data.x = currentX;
            n.el.style.left = currentX + 'px';
            currentX += n.el.offsetWidth + gap;
        });
        instance.repaintEverything();
    });

    document.getElementById('distribute-vertical').addEventListener('click', function() {
        const selected = getSelectedNodesWithElements();
        if (selected.length < 2) return;
        selected.sort((a, b) => a.data.y - b.data.y);
        const minY = selected[0].data.y;
        const maxY = selected[selected.length - 1].data.y;
        const totalHeight = selected.reduce((sum, n) => sum + n.el.offsetHeight, 0);
        const totalGap = (maxY - minY) - (totalHeight - selected[0].el.offsetHeight - selected[selected.length - 1].el.offsetHeight);
        const gap = totalGap / (selected.length - 1);
        let currentY = minY;
        selected.forEach((n, i) => {
            n.data.y = currentY;
            n.el.style.top = currentY + 'px';
            currentY += n.el.offsetHeight + gap;
        });
        instance.repaintEverything();
    });

    function saveMap() {
            // Update mapData with the latest positions and content from the DOM before saving
            mapData.nodes.forEach(nodeData => {
                const el = document.getElementById(nodeData.id);
                if (el) {
                    nodeData.x = parseInt(el.style.left, 10) || 0;
                    nodeData.y = parseInt(el.style.top, 10) || 0;
                    nodeData.text = el.querySelector('.card-title')?.innerText || '';
                    nodeData.caption = el.querySelector('.card-caption')?.innerText || '';
                    nodeData.image = el.dataset.image || '';
                    nodeData.style = el.dataset.style || '';
                    nodeData.link = el.dataset.link || '';
                    nodeData.target = el.dataset.target || '_self';
                }
            });
            
            mapData.rails.forEach(railData => {
                const el = document.getElementById(railData.id);
                if(el) {
                    railData.x = parseInt(el.style.left, 10) || 0;
                    railData.y = parseInt(el.style.top, 10) || 0;
                    railData.width = parseInt(el.style.width, 10) || 0;
                    railData.height = parseInt(el.style.height, 10) || 0;
                }
            });

            // Filter out connections marked for deletion
            const connectionsToSave = (mapData.connections || []).filter(c => !pendingDeletes.has(c.id));

            const dataToSave = {
                nodes: mapData.nodes,
                connections: connectionsToSave,
                rails: mapData.rails || []
            };

            fetch(cardmap_admin_data.ajax_url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
                },
                body: new URLSearchParams({
                    action: 'save_cardmap',
                    post_id: cardmap_admin_data.post_id,
                    nonce: cardmap_admin_data.nonce,
                    data: JSON.stringify(dataToSave)
                })
            }).then(r => r.json()).then(res => {
                if (res && res.success) {
                    // If save was successful, permanently remove the deleted connections from our live mapData
                    if (pendingDeletes.size > 0) {
                        mapData.connections = connectionsToSave;
                        pendingDeletes.clear();
                    }
                    showToast('Map saved!');
                } else {
                    showToast('Error saving map: ' + (res.data || 'Unknown error'));
                }
            }).catch(err => {
                console.error(err);
                showToast('Saving failed. See console for details.');
            });
        }

    document.getElementById('save-map').addEventListener('click', function(){
        saveMap();
    });

    let scale = 1;
    let offsetX = 0, offsetY = 0;
    let isPanning = false;
    let panStart = { x: 0, y: 0 };

    editorWrapper.addEventListener('mousedown', function(e){
        if (e.target === editorWrapper || e.target === editor) {
            isPanning = true;
            panStart.x = e.clientX - offsetX;
            panStart.y = e.clientY - offsetY;
            editor.style.cursor = 'grabbing';
        }
    });
    editorWrapper.addEventListener('mouseup', function(){
        isPanning = false;
        editor.style.cursor = 'grab';
    });
    editorWrapper.addEventListener('mousemove', function(e){
        if (isPanning) {
            offsetX = e.clientX - panStart.x;
            offsetY = e.clientY - panStart.y;
            editor.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
        }
    });
    editorWrapper.addEventListener('wheel', function(e){
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        const newScale = Math.max(0.2, Math.min(3, scale + delta));
        
        const rect = editorWrapper.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const worldX = (mouseX - offsetX) / scale;
        const worldY = (mouseY - offsetY) / scale;

        offsetX = mouseX - worldX * newScale;
        offsetY = mouseY - worldY * newScale;
        
        scale = newScale;
        editor.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
    });

    init();
});
