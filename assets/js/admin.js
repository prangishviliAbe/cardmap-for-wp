(function() {
    /**
     * Main class for the CardMap editor.
     * Encapsulates all functionality for the admin editor interface.
     */
    class CardMapEditor {
        constructor() {
            this.editor = document.getElementById('cardmap-editor');
            if (!this.editor) return;

            // Core properties
            this.editorWrapper = document.getElementById('cardmap-editor-wrapper');
            this.postId = document.getElementById('cardmap_post_id').value;
            this.ajaxUrl = cardmap_admin_data.ajax_url;
            this.nonce = cardmap_admin_data.nonce;

            // Configuration from WordPress
            this.config = {
                lineStyle: cardmap_admin_data.line_style,
                availableLineStyles: this.parseJson(cardmap_admin_data.available_line_styles, {}),
                lineColor: cardmap_admin_data.line_color,
                lineThickness: cardmap_admin_data.line_thickness,
                enableAlignButton: cardmap_admin_data.enable_align_button,
                nodeStyles: this.parseJson(cardmap_admin_data.node_styles, {})
            };

            // Editor state
            this.mapData = this.parseJson(cardmap_admin_data.map_data, { nodes: [], connections: [], rails: [] });
            if (!this.mapData.rails) this.mapData.rails = [];

            this.pendingDeletes = new Set();
            this.selectedNodes = new Set();
            this.selectedRail = null;
            this.deleteRailMode = false;
            
            this.connectMode = false;
            this.deleteMode = false;
            this.firstNode = null;
            this.firstAnchor = null;

            this.railResizeState = null;
            
            // Pan & Zoom state
            this.scale = 1;
            this.offsetX = 0;
            this.offsetY = 0;
            this.isPanning = false;
            this.panStartCoords = { x: 0, y: 0 };

            // Constants
            this.RAIL_HEIGHT = 8;
            this.RAIL_SNAP_OFFSET = 12;
            this.RAIL_SNAP_THRESHOLD = 40;
            this.RAIL_SNAP_OFFSET_VERTICAL = 12;

            this.init();
        }

        /**
         * Initializes the editor, jsPlumb instance, and event listeners.
         */
        init() {
            this.initJsPlumb();
            this.initEventListeners();
            this.loadInitialData();
        }

        /**
         * Safely parses a JSON string or returns a default value.
         */
        parseJson(jsonString, defaultValue) {
            if (typeof jsonString === 'object' && jsonString !== null) return jsonString;
            try {
                const parsed = JSON.parse(jsonString);
                return parsed;
            } catch (e) {
                return defaultValue;
            }
        }

        /**
         * Configures and initializes the jsPlumb instance.
         */
        initJsPlumb() {
            this.instance = jsPlumb.getInstance({ Container: this.editor, ContinuousRepaint: true });
            this.instance.setContainer(this.editor);

            const connectorConfig = this.getConnectorConfig(this.config.lineStyle);

            this.instance.importDefaults({
                Connector: connectorConfig.connector,
                PaintStyle: connectorConfig.paintStyle,
                HoverPaintStyle: connectorConfig.paintStyle,
                EndpointStyle: { radius: 3, fill: '#456' },
                Anchors: ["TopCenter", "BottomCenter", "LeftMiddle", "RightMiddle"],
                ReattachConnections: false,
                MaxConnections: -1
            });

            this.instance.bind("beforeDrop", (info) => info.connection.getParameter("user-driven") === true);
            this.instance.bind("connection", (info, originalEvent) => {
                if (originalEvent) {
                    info.connection.setParameter("user-driven", true);
                }
                this.saveMapData();
            });
        }

        /**
         * Sets up all DOM event listeners for the editor UI.
         */
        initEventListeners() {
            document.getElementById('add-node').addEventListener('click', this.addNode.bind(this));
            document.getElementById('add-rail').addEventListener('click', this.addRail.bind(this));
            document.getElementById('rail-size').addEventListener('change', (e) => {
                const railId = this.selectedRail;
                if (railId && this.mapData.rails.find(r => r.id === railId)) {
                    const rail = this.mapData.rails.find(r => r.id === railId);
                    const newSize = parseInt(e.target.value, 10);
                    if (!isNaN(newSize) && newSize > 0) {
                        rail.size = newSize;
                        // keep length properties intact, but update thickness
                        if (rail.orientation === 'vertical') {
                            rail.width = newSize;
                        } else {
                            rail.height = newSize;
                        }
                        this.renderRail(rail);
                        this.instance.repaintEverything();
                        this.saveMapData();
                    }
                }
            });
            document.getElementById('connect-mode').addEventListener('click', this.toggleConnectMode.bind(this));
            document.getElementById('delete-node').addEventListener('click', this.toggleDeleteMode.bind(this));
            document.getElementById('save-map').addEventListener('click', this.saveMapData.bind(this));
            document.getElementById('fullscreen-editor').addEventListener('click', this.toggleFullscreen.bind(this));
            // Alignment feature removed per request (buttons removed server-side)

            this.editorWrapper.addEventListener('mousedown', this.handlePanStart.bind(this));
            this.editorWrapper.addEventListener('mouseup', this.handlePanEnd.bind(this));
            this.editorWrapper.addEventListener('mouseleave', this.handlePanEnd.bind(this));
            this.editorWrapper.addEventListener('mousemove', this.handlePanMove.bind(this));
            this.editorWrapper.addEventListener('mousemove', this.handleConnectMouseMove.bind(this));
            this.editorWrapper.addEventListener('wheel', this.handleZoom.bind(this));
            
            this.editorWrapper.addEventListener('click', (e) => {
                if (e.target === this.editorWrapper || e.target === this.editor) {
                    this.deselectAllNodes();
                }
                const railEl = e.target.closest('.cardmap-rail');
                if (railEl) {
                    this.selectRail(railEl.id);
                }
            });

            const generateBtn = document.getElementById('generate-post-map');
            if (generateBtn) {
                generateBtn.addEventListener('click', this.generatePostHierarchyMap.bind(this));
            }

            window.addEventListener('mousemove', this.handleRailResize.bind(this));
            window.addEventListener('mouseup', () => { if (this.railResizeState) this.railResizeState = null; });

            // Alignment controls removed
            const deleteRailBtn = document.getElementById('delete-rail');
            if (deleteRailBtn) deleteRailBtn.addEventListener('click', this.toggleDeleteRailMode.bind(this));
        }

        /**
         * Fetches post hierarchy data and generates a map.
         */
        generatePostHierarchyMap() {
            const postType = document.getElementById('cardmap-source-post-type').value;
            if (!postType) {
                this.showToast('Please select a post type first.');
                return;
            }

            if (!confirm('This will clear the current map and generate a new one. Are you sure?')) {
                return;
            }

            const generateBtn = document.getElementById('generate-post-map');
            generateBtn.textContent = 'Generating...';
            generateBtn.disabled = true;

            fetch(this.ajaxUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
                body: new URLSearchParams({
                    action: 'generate_post_hierarchy_map',
                    nonce: this.nonce,
                    post_type: postType
                })
            })
            .then(r => r.json())
            .then(res => {
                if (res.success) {
                    this.instance.reset();
                    this.mapData = res.data;
                    if (!this.mapData.rails) this.mapData.rails = [];
                    this.loadInitialData();
                    this.saveMapData(); // Save the newly generated map
                    this.showToast('Map generated successfully!');
                } else {
                    this.showToast(`Error: ${res.data || 'Could not generate map.'}`);
                }
            })
            .catch(err => {
                console.error(err);
                this.showToast('An error occurred. See console for details.');
            })
            .finally(() => {
                generateBtn.textContent = 'Generate Map';
                generateBtn.disabled = false;
            });
        }

        /**
         * Renders the initial map data from the server.
         */
        loadInitialData() {
            this.instance.batch(() => {
                (this.mapData.rails || []).forEach(r => this.renderRail(r));
                (this.mapData.nodes || []).forEach(n => this.renderNode(n));
                // Only auto-arrange on load if none of the nodes have saved
                // numeric positions. This prevents overriding a user's saved
                // manual layout on page refresh.
                const nodes = this.mapData.nodes || [];
                const hasSavedPositions = nodes.some(n => typeof n.x === 'number' && typeof n.y === 'number');
                if (!hasSavedPositions) {
                    this.autoArrangeOnLoad();
                }
                (this.mapData.connections || []).forEach(c => {
                    if (!c || !c.source || !c.target) return;
                    const sourceEl = document.getElementById(c.source);
                    const targetEl = document.getElementById(c.target);
                    if (!sourceEl || !targetEl) return;

                    const connStyle = c.style || this.config.lineStyle || 'straight';
                    const config = this.getConnectorConfig(connStyle);
                    
                    // normalize saved anchors: allow {type:'precise',value:[x,y,ox,oy]} entries
                    let anchors = null;
                    if (Array.isArray(c.anchors)) {
                        anchors = c.anchors.map(a => {
                            if (a && typeof a === 'object' && a.type === 'precise' && Array.isArray(a.value)) return a.value;
                            return a;
                        });
                    }
                    if (!anchors) anchors = c.anchors || this.getDirectionalAnchors(sourceEl, targetEl);

                    const conn = this.instance.connect({
                        source: c.source,
                        target: c.target,
                        anchors: anchors,
                        ...config,
                        cssClass: 'cardmap-connector'
                    });
                    if (conn) {
                        conn._cardmap_id = c.id || `conn_${Date.now()}_${Math.floor(Math.random()*10000)}`;
                    }
                });
            });
        }

        /**
         * Renders a single node element on the canvas.
         * @param {object} n The node data object.
         */
        renderNode(n) {
            if (!n || !n.id || document.getElementById(n.id)) return;

            const node = document.createElement('div');
            node.className = 'cardmap-node';
            node.id = n.id;
            node.style.left = `${n.x || 20}px`;
            node.style.top = `${n.y || 20}px`;
            node.dataset.image = n.image || '';
            node.dataset.link = n.link || '';
            node.dataset.target = n.target || '_self';
            node.dataset.style = n.style || 'default';
            
            const styleOptions = Object.keys(this.config.nodeStyles).map(k => `<option value="${k}" ${ k === (n.style || 'default') ? 'selected' : '' }>${this.config.nodeStyles[k]}</option>`).join('');

            node.innerHTML = `
                <div class="cardmap-node-visible-area">
                    <div class="node-image-wrapper">
                        <div class="node-image">${ n.image ? `<img src="${n.image}">` : 'Select an image' }</div>
                        <div class="card-caption" contenteditable="true">${ n.caption || 'Caption' }</div>
                    </div>
                    <div class="card-title" contenteditable="true">${ n.text || 'New Card Title' }</div>
                </div>
                <button type="button" class="card-settings-toggle button icon"><span class="dashicons dashicons-admin-generic"></span></button>
                <div class="node-tools">
                    <button class="button edit-image" type="button">Select Image</button>
                    <input class="card-link-input" placeholder="Card link (https://...)" value="${ n.link || '' }" />
                    <select class="card-link-target">
                        <option value="_self" ${ !n.target || n.target === '_self' ? 'selected' : '' }>Same window</option>
                        <option value="_blank" ${ n.target === '_blank' ? 'selected' : '' }>New window</option>
                    </select>
                    <label style="display:block;margin-top:8px;font-size:12px;color:#666;">Style</label>
                    <select class="card-node-style" style="width:100%;">${styleOptions}</select>
                    <label style="display:block;margin-top:8px;font-size:12px;color:#666;">Connection Style</label>
                    <select class="card-connection-style" style="width:100%;">
                        ${ Object.keys(this.config.availableLineStyles).map(k => `<option value="${k}" ${ (n.connectionStyle || this.config.lineStyle) === k ? 'selected' : '' }>${this.config.availableLineStyles[k]}</option>` ).join('') }
                    </select>
                </div>
            `;

            this.editor.appendChild(node);

            // Make node draggable
            this.instance.draggable(node, {
                start: (params) => this.onNodeDragStart(params),
                drag: (params) => this.onNodeDrag(params),
                stop: (params) => this.onNodeDragStop(params)
            });

            // Add event listeners for the node's UI elements
            this.addNodeUIListeners(node);
            node.style.zIndex = 2000;
        }

        /**
         * Adds event listeners to a newly rendered node's controls.
         * @param {HTMLElement} node The node element.
         */
        addNodeUIListeners(node) {
            const nodeData = this.mapData.nodes.find(nd => nd.id === node.id);
            if (!nodeData) return;

            node.querySelector('.card-settings-toggle').addEventListener('click', (e) => {
                e.stopPropagation();
                node.classList.toggle('settings-visible');
            });

            node.querySelector('.edit-image').addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                const frame = wp.media({
                    title: 'Select Card Image',
                    multiple: false,
                    library: { type: 'image' },
                    button: { text: 'Use this image' }
                });
                frame.on('select', () => {
                    const sel = frame.state().get('selection').first().toJSON();
                    if (sel && sel.url) {
                        node.dataset.image = sel.url;
                        node.querySelector('.node-image').innerHTML = `<img src="${sel.url}">`;
                    }
                });
                frame.open();
            });

            node.querySelector('.card-link-input').addEventListener('input', function(){ node.dataset.link = this.value.trim(); });
            node.querySelector('.card-link-target').addEventListener('change', function(){ node.dataset.target = this.value; });
            
            const styleSelect = node.querySelector('.card-node-style');
            if (styleSelect) {
                styleSelect.addEventListener('change', () => {
                    node.dataset.style = styleSelect.value;
                    nodeData.style = styleSelect.value;
                    node.classList.remove(...Object.keys(this.config.nodeStyles).map(k => 'style-' + k));
                    node.classList.add('style-' + styleSelect.value);
                });
                if (nodeData.style) node.classList.add('style-' + nodeData.style);
            }

            const connStyleSelect = node.querySelector('.card-connection-style');
            if (connStyleSelect) {
                // initialize value from data if present
                if (nodeData.connectionStyle) connStyleSelect.value = nodeData.connectionStyle;
                connStyleSelect.addEventListener('change', () => {
                    nodeData.connectionStyle = connStyleSelect.value;
                    // Update existing connections that originate from this node to use the new style
                    const conns = this.instance.getConnections({ source: node.id });
                    conns.forEach(c => {
                        const config = this.getConnectorConfig(nodeData.connectionStyle || this.config.lineStyle);
                        try {
                            c.setPaintStyle && c.setPaintStyle(config.paintStyle);
                            if (config.connector) c.setConnector && c.setConnector(config.connector);
                        } catch (err) {}
                    });
                });
            }

            node.querySelectorAll('[contenteditable]').forEach(el => {
                el.addEventListener('mousedown', e => e.stopPropagation());
                el.addEventListener('blur', () => {
                    if (el.classList.contains('card-title')) nodeData.text = el.innerText;
                    if (el.classList.contains('card-caption')) nodeData.caption = el.innerText;
                });
            });

            node.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                this.openNodeInspector(node);
            });

            node.addEventListener('click', (e) => this.onNodeClick(e, node));
        }

        /**
         * Handles the start of a node drag operation.
         */
        onNodeDragStart(params) {
            const connections = this.instance.getConnections({ source: params.el.id }).concat(this.instance.getConnections({ target: params.el.id }));
            connections.forEach(conn => {
                // Store original anchors at the start of any drag
                conn._originalAnchors = conn.getAnchors();
            });
        }

        /**
         * Handles the dragging of a node, including rail snapping previews.
         */
        onNodeDrag(params) {
            this.instance.repaintEverything();
            const node = params.el;
            const draggedNode = this.mapData.nodes.find(n => n.id === node.id);

            // If the node is on a rail, temporarily simplify anchors for smooth dragging
            if (draggedNode && draggedNode.attachedRail) {
                const rail = this.mapData.rails.find(r => r.id === draggedNode.attachedRail);
                if (rail) {
                    const connections = this.instance.getConnections({ source: node.id }).concat(this.instance.getConnections({ target: node.id }));
                    const simpleAnchors = rail.orientation === 'vertical' ? ["LeftMiddle", "RightMiddle"] : ["TopCenter", "BottomCenter"];
                    connections.forEach(conn => conn.setAnchors(simpleAnchors));
                }
            }

            const rails = this.mapData.rails || [];
            let nearest = null;
            let bestDist = Infinity;
            const elLeft = parseFloat(node.style.left) || 0;
            const elTop = parseFloat(node.style.top) || 0;
            const elCenterX = elLeft + (node.offsetWidth || 240) / 2;
            const elCenterY = elTop + (node.offsetHeight || 150) / 2;

            for (const r of rails) {
                const railTop = r.y;
                const railBottom = r.y + (r.height || 0);
                if (r.orientation === 'vertical') {
                    if (elCenterY >= railTop && elCenterY <= railBottom) {
                        const railCenterX = r.x + ((r.width || r.size || this.RAIL_HEIGHT) / 2);
                        const dx = Math.abs(railCenterX - elLeft);
                        if (dx < bestDist) {
                            bestDist = dx;
                            nearest = r;
                        }
                    }
                } else if (r.orientation === 'diagonal') {
                    const dist = this.distanceToLineSegment(elCenterX, elCenterY, r.x, r.y, r.x + r.width, r.y + r.height);
                    if (dist < this.RAIL_SNAP_THRESHOLD && dist < bestDist) {
                        bestDist = dist;
                        nearest = r;
                    }
                } else { // horizontal
                    const railLeft = r.x;
                    const railRight = r.x + (r.width || 0);
                    if (elCenterX >= railLeft && elCenterX <= railRight) {
                        const dy = Math.abs((r.y + this.RAIL_SNAP_OFFSET) - elTop);
                        if (dy < bestDist) {
                            bestDist = dy;
                            nearest = r;
                        }
                    }
                }
            }

            (this.mapData.rails || []).forEach(rr => {
                const d = document.getElementById(rr.id);
                if (d) {
                    d.classList.remove('rail-highlight');
                    const p = d.querySelector('.rail-snap-preview');
                    if (p) p.style.display = 'none';
                }
            });

            if (nearest && bestDist <= this.RAIL_SNAP_THRESHOLD) {
                const d = document.getElementById(nearest.id);
                if (d) {
                    d.classList.add('rail-highlight');
                    const p = d.querySelector('.rail-snap-preview');
                    if (p) p.style.display = 'block';
                }
            }
        }

        /**
         * Handles the end of a node drag, finalizing position and rail attachment.
         */
        onNodeDragStop(params) {
            const draggedNode = this.mapData.nodes.find(n => n.id === params.el.id);
            if (draggedNode) {
                draggedNode.x = params.pos[0];
                draggedNode.y = params.pos[1];
                const rails = this.mapData.rails || [];
                let snapped = null;
                let bestDist = Infinity;

                for (const r of rails) {
                    const railTop = r.y;
                    const railBottom = r.y + r.height;
                    if (r.orientation === 'vertical') {
                        const nodeCenterY = draggedNode.y + (params.el.offsetHeight || 150) / 2;
                        if (nodeCenterY >= railTop && nodeCenterY <= railBottom) {
                            const railCenterX = r.x + ((r.width || r.size || this.RAIL_HEIGHT) / 2);
                            const dx = Math.abs(draggedNode.x - railCenterX);
                             if (dx <= this.RAIL_SNAP_THRESHOLD && dx < bestDist) {
                                bestDist = dx;
                                snapped = r;
                            }
                        }
                    } else if (r.orientation === 'diagonal') {
                        const dist = this.distanceToLineSegment(draggedNode.x, draggedNode.y, r.x, r.y, r.x + r.width, r.y + r.height);
                        if (dist < this.RAIL_SNAP_THRESHOLD && dist < bestDist) {
                            bestDist = dist;
                            snapped = r;
                        }
                    } else { // horizontal
                        const nodeCenterX = draggedNode.x + (params.el.offsetWidth || 240) / 2;
                        const railLeft = r.x;
                        const railRight = r.x + (r.width || 0);
                        if (nodeCenterX >= railLeft && nodeCenterX <= railRight) {
                            const dy = Math.abs(draggedNode.y - (r.y + this.RAIL_SNAP_OFFSET));
                            if (dy <= this.RAIL_SNAP_THRESHOLD && dy < bestDist) {
                                bestDist = dy;
                                snapped = r;
                            }
                        }
                    }
                }

                const connections = this.instance.getConnections({ source: params.el.id }).concat(this.instance.getConnections({ target: params.el.id }));

                if (snapped) {
                    draggedNode.attachedRail = snapped.id;
                    
                    // Define anchors based on rail orientation
                    const anchors = snapped.orientation === 'vertical' 
                        ? ["LeftMiddle", "RightMiddle"] 
                        : ["TopCenter", "BottomCenter"];

                    if (snapped.orientation === 'vertical') {
                        draggedNode.x = snapped.x - (params.el.offsetWidth / 2) + (snapped.size / 2);
                        params.el.style.left = `${draggedNode.x}px`;
                    } else { // horizontal
                        draggedNode.y = snapped.y - (params.el.offsetHeight / 2) + (snapped.size / 2);
                        params.el.style.top = `${draggedNode.y}px`;
                    }
                    
                    // Set the determined anchors for all connections of the node
                    connections.forEach(c => c.setAnchors(anchors));

                } else {
                    delete draggedNode.attachedRail;
                    // Restore original or directional anchors when not on a rail
                    connections.forEach(conn => {
                        if (conn._originalAnchors) {
                            conn.setAnchors(conn._originalAnchors);
                            delete conn._originalAnchors;
                        } else {
                            const sourceEl = document.getElementById(conn.sourceId);
                            const targetEl = document.getElementById(conn.targetId);
                            if (sourceEl && targetEl) {
                                conn.setAnchors(this.getDirectionalAnchors(sourceEl, targetEl));
                            }
                        }
                    });
                }

                (this.mapData.rails || []).forEach(rr => {
                    const d = document.getElementById(rr.id);
                    if (d) {
                        d.classList.remove('rail-highlight');
                        const p = d.querySelector('.rail-snap-preview');
                        if (p) p.style.display = 'none';
                    }
                });
            }

            this.instance.repaintEverything();
        }

        /**
         * Handles clicks on a node for selection, connection, or deletion.
         */
        onNodeClick(e, node) {
            if (e.target.closest('.node-tools') || e.target.closest('[contenteditable]')) return;

            if (this.connectMode) {
                this.handleConnectionClick(e, node);
            } else if (this.deleteMode) {
                this.deleteNode(node);
            } else {
                this.handleSelectionClick(e, node);
            }
        }

        /** Convert screen event to world coordinates inside the editor */
        getWorldCoordsFromEvent(e) {
            const wrapperRect = this.editorWrapper.getBoundingClientRect();
            const worldX = (e.clientX - wrapperRect.left - this.offsetX) / this.scale;
            const worldY = (e.clientY - wrapperRect.top - this.offsetY) / this.scale;
            return { x: worldX, y: worldY };
        }

        /** Handle clicks on rails (selection and connect mode) */
        onRailClick(e, railEl, railData) {
            // If delete-rail mode, remove the rail
            if (this.deleteRailMode) {
                e.stopPropagation();
                this.deleteRail(railEl.id);
                return;
            }

            // If not in connect mode, select the rail for editing
            if (!this.connectMode) {
                this.selectRail(railEl.id);
                return;
            }

            // In connect mode: treat a rail click similarly to a node click
            if (!this.firstNode) {
                // Use rail element as firstNode
                this.firstNode = railEl;
                this.firstAnchor = this.getRailAnchorFromEvent(e, railEl, railData);
                railEl.style.boxShadow = '0 0 0 3px rgba(166,24,50,0.5)';
            } else if (this.firstNode !== railEl) {
                const sourceId = this.firstNode.id;
                const targetId = railEl.id;

                const exists = (this.mapData.connections || []).some(c =>
                    !this.pendingDeletes.has(c.id) && ((c.source === sourceId && c.target === targetId) || (c.source === targetId && c.target === sourceId))
                );
                if (exists && !e.altKey) {
                    this.showToast('Connection already exists. Hold Alt to add a parallel connection.');
                    this.firstNode.style.boxShadow = '';
                    this.firstNode = null;
                    return;
                }

                // prefer exact hover position if available (so connections anchor where cursor was)
                let anchorA = null;
                let anchorB = null;
                const sourceEl = document.getElementById(sourceId);
                const autoAnchors = this.getDirectionalAnchors(sourceEl || this.firstNode, railEl);
                anchorA = this.firstAnchor || autoAnchors[0];

                if (this._lastRailHover && this._lastRailHover.railId === railEl.id) {
                    // use precise relative anchor array for the rail
                    anchorB = this.getPreciseRailAnchorArray(railEl, this._lastRailHover.clientX, this._lastRailHover.clientY);
                }
                if (!anchorB) anchorB = this.getRailAnchorFromEvent(e, railEl, railData) || autoAnchors[1];

                // choose connection style: prefer source node's connectionStyle then target's then global
                const sourceNodeData = this.mapData.nodes.find(n => n.id === sourceId) || {};
                const targetNodeData = this.mapData.nodes.find(n => n.id === targetId) || {};
                const connStyle = sourceNodeData.connectionStyle || targetNodeData.connectionStyle || this.config.lineStyle;
                const conn = this.instance.connect({
                    source: sourceId,
                    target: targetId,
                    anchors: [anchorA, anchorB],
                    ...this.getConnectorConfig(connStyle),
                    cssClass: 'cardmap-connector'
                });
                const newId = `conn_${Date.now()}_${Math.floor(Math.random()*10000)}`;
                if (conn) {
                    conn._cardmap_id = newId;
                    try { conn.setParameter && conn.setParameter('user-driven', true); } catch(e) {}
                }
                // store anchors; convert precise arrays to a serializable representation
                const savedAnchors = [
                    anchorA,
                    (Array.isArray(anchorB) ? { type: 'precise', value: anchorB } : anchorB)
                ];
                this.mapData.connections.push({ id: newId, source: sourceId, target: targetId, style: connStyle, anchors: savedAnchors });

                // force an immediate repaint so anchors/paths are calculated correctly
                try { this.instance.repaintEverything(); } catch (e) {}

                this.firstNode.style.boxShadow = '';
                this.firstNode = null;
                this.firstAnchor = null;
            }
        }

        /** Choose a reasonable anchor for a rail based on click position and orientation */
        getRailAnchorFromEvent(e, railEl, railData) {
            if (!railData || !railEl) return null;
            const rect = railEl.getBoundingClientRect();
            const localX = e.clientX - rect.left;
            const localY = e.clientY - rect.top;
            if (railData.orientation === 'vertical') {
                // left or right depending on click side
                return (localX < rect.width/2) ? 'LeftMiddle' : 'RightMiddle';
            }
            // horizontal or diagonal: top or bottom
            return (localY < rect.height/2) ? 'TopCenter' : 'BottomCenter';
        }

        /** Return a precise relative anchor array for a rail element given client coords */
        getPreciseRailAnchorArray(railEl, clientX, clientY) {
            if (!railEl) return null;
            const rect = railEl.getBoundingClientRect();
            // compute relative coordinates inside element (0..1)
            let relX = (clientX - rect.left) / rect.width;
            let relY = (clientY - rect.top) / rect.height;
            relX = Math.max(0, Math.min(1, relX));
            relY = Math.max(0, Math.min(1, relY));
            // jsPlumb accepts [x, y, ox, oy] anchor arrays where x,y are relative
            return [relX, relY, 0, 0];
        }

        handleConnectMouseMove(e) {
            if (!this.connectMode) return;
            // hide all previews first
            document.querySelectorAll('.rail-anchor-preview').forEach(d => d.style.display = 'none');

            const railEl = e.target.closest && e.target.closest('.cardmap-rail');
            if (!railEl) {
                this._lastRailHover = null;
                return;
            }
            const railId = railEl.id;
            const railData = this.mapData.rails.find(r => r.id === railId);
            if (!railData) return;

            const rect = railEl.getBoundingClientRect();
            const localX = e.clientX - rect.left;
            const localY = e.clientY - rect.top;
            const preview = railEl.querySelector('.rail-anchor-preview');
            if (!preview) return;
            preview.style.display = 'block';
            preview.style.position = 'absolute';
            preview.style.width = '10px';
            preview.style.height = '10px';
            preview.style.background = '#fff';
            preview.style.border = '2px solid #A61832';
            preview.style.borderRadius = '50%';
            preview.style.pointerEvents = 'none';
            if (railData.orientation === 'vertical') {
                preview.style.left = `${(rect.width/2) - 5}px`;
                preview.style.top = `${localY - 5}px`;
            } else {
                preview.style.left = `${localX - 5}px`;
                preview.style.top = `${(rect.height/2) - 5}px`;
            }

            // store last hover position for precise anchor use later
            this._lastRailHover = { railId, clientX: e.clientX, clientY: e.clientY };
        }

        /** Fallback default anchor for an element (node or rail) */
        getDefaultAnchorForElement(el) {
            if (!el) return 'Continuous';
            if (el.classList.contains('cardmap-rail')) {
                // approximate based on orientation class
                if (el.classList.contains('vertical')) return 'LeftMiddle';
                return 'TopCenter';
            }
            // fallback to top/left heuristics
            return 'Continuous';
        }

        /**
         * Handles node selection with shift-key support.
         */
        handleSelectionClick(e, node) {
            if (!e.shiftKey) {
                this.deselectAllNodes(node.id);
            }

            if (this.selectedNodes.has(node.id)) {
                if (e.shiftKey) {
                    this.selectedNodes.delete(node.id);
                    node.classList.remove('cardmap-node-selected');
                }
            } else {
                this.selectedNodes.add(node.id);
                node.classList.add('cardmap-node-selected');
            }
            // alignment toolbar removed
        }

        /**
         * Handles node clicks when in "Connect Mode".
         */
        handleConnectionClick(e, node) {
            if (!this.firstNode) {
                this.firstNode = node;
                this.firstAnchor = this.getPreciseAnchorFromEvent(e, node);
                node.style.boxShadow = '0 0 0 3px rgba(166,24,50,0.5)';
            } else if (this.firstNode !== node) {
                const sourceId = this.firstNode.id;
                const targetId = node.id;
                
                const exists = (this.mapData.connections || []).some(c => 
                    !this.pendingDeletes.has(c.id) &&
                    ((c.source === sourceId && c.target === targetId) || (c.source === targetId && c.target === sourceId))
                );

                if (exists && !e.altKey) {
                    this.showToast('Connection already exists. Hold Alt to add a parallel connection.');
                    this.firstNode.style.boxShadow = '';
                    this.firstNode = null;
                    return;
                }

                // determine anchors, preferring precise rail hover position if available
                let anchorA = null;
                let anchorB = null;
                const autoAnchors = this.getDirectionalAnchors(this.firstNode, node);
                anchorA = this.firstAnchor || autoAnchors[0];

                if (node.classList && node.classList.contains('cardmap-rail') && this._lastRailHover && this._lastRailHover.railId === node.id) {
                    anchorB = this.getPreciseRailAnchorArray(node, this._lastRailHover.clientX, this._lastRailHover.clientY);
                }
                if (!anchorB) anchorB = this.getPreciseAnchorFromEvent(e, node) || autoAnchors[1];
                
                const sourceNodeData = this.mapData.nodes.find(n => n.id === sourceId) || {};
                const targetNodeData = this.mapData.nodes.find(n => n.id === targetId) || {};
                const connStyle = sourceNodeData.connectionStyle || targetNodeData.connectionStyle || this.config.lineStyle;
                const conn = this.instance.connect({
                    source: sourceId,
                    target: targetId,
                    anchors: [anchorA, anchorB],
                    ...this.getConnectorConfig(connStyle),
                    cssClass: 'cardmap-connector'
                });

                const newId = `conn_${Date.now()}_${Math.floor(Math.random()*10000)}`;
                if (conn) {
                    conn._cardmap_id = newId;
                    try { conn.setParameter && conn.setParameter('user-driven', true); } catch(e) {}
                }
                const savedAnchors = [
                    anchorA,
                    (Array.isArray(anchorB) ? { type: 'precise', value: anchorB } : anchorB)
                ];
                this.mapData.connections.push({ id: newId, source: sourceId, target: targetId, style: connStyle, anchors: savedAnchors });

                // force an immediate repaint so anchors/paths are calculated correctly
                try { this.instance.repaintEverything(); } catch (e) {}

                this.firstNode.style.boxShadow = '';
                this.firstNode = null;
                this.firstAnchor = null;
            }
        }

        /**
         * Deletes a node and its connections.
         */
        deleteNode(node) {
            this.instance.remove(node);
            this.mapData.nodes = this.mapData.nodes.filter(n => n.id !== node.id);
            this.mapData.connections = (this.mapData.connections || []).filter(c => c.source !== node.id && c.target !== node.id);
        }

        /**
         * Creates and renders a new node.
         */
        addNode() {
            const id = `node_${Date.now()}`;
            const newNode = { id, x: 100, y: 100, text: 'New Card', caption: 'Caption', image: '', link: '', target: '_self', style: 'default' };
            this.mapData.nodes.push(newNode);
            this.renderNode(newNode);
        }

        /**
         * Renders a single rail element on the canvas.
         * @param {object} r The rail data object.
         */
        renderRail(r) {
            let railEl = document.getElementById(r.id);
            if (!railEl) {
                railEl = document.createElement('div');
                railEl.id = r.id;
                railEl.className = 'cardmap-rail';
                this.editor.appendChild(railEl);

                const preview = document.createElement('div');
                preview.className = 'rail-snap-preview';
                railEl.appendChild(preview);

                const resizer = document.createElement('div');
                resizer.className = 'rail-resizer';
                railEl.appendChild(resizer);

                resizer.addEventListener('mousedown', (e) => {
                    e.stopPropagation();
                    // record starting map-space coordinates for robust resizing
                    const rect = this.editor.getBoundingClientRect();
                    const mapX = (e.clientX - rect.left - this.offsetX) / this.scale;
                    const mapY = (e.clientY - rect.top - this.offsetY) / this.scale;
                    this.railResizeState = {
                        railId: r.id,
                        startX: e.clientX,
                        startY: e.clientY,
                        startLeft: r.x,
                        startTop: r.y,
                        startWidth: r.width,
                        startHeight: r.height,
                        startMapX: mapX,
                        startMapY: mapY,
                        side: null
                    };
                    // determine which side the user started dragging (simple heuristic)
                    const railRect = railEl.getBoundingClientRect();
                    const localX = e.clientX - railRect.left;
                    const localY = e.clientY - railRect.top;
                    if (r.orientation === 'horizontal') this.railResizeState.side = (localX > railRect.width/2) ? 'right' : 'left';
                    else if (r.orientation === 'vertical') this.railResizeState.side = (localY > railRect.height/2) ? 'bottom' : 'top';
                });

                // make the rail draggable so it can be moved and attached nodes follow
                this.instance.draggable(railEl, {
                    start: (params) => {
                        // capture starting positions for rail and attached nodes
                        const railData = this.mapData.rails.find(rr => rr.id === r.id);
                        if (!railData) return;
                        this.railDragState = {
                            railId: railData.id,
                            startLeft: railData.x,
                            startTop: railData.y,
                            nodeStarts: (this.mapData.nodes || []).filter(n => n.attachedRail === railData.id).map(n => ({ id: n.id, x: n.x, y: n.y }))
                        };
                    },
                    drag: (params) => {
                        const rd = this.railDragState;
                        if (!rd) return;
                        const railData = this.mapData.rails.find(rr => rr.id === rd.railId);
                        if (!railData) return;

                        // params.pos is [left, top]
                        const newLeft = params.pos[0];
                        const newTop = params.pos[1];
                        const dx = newLeft - rd.startLeft;
                        const dy = newTop - rd.startTop;

                        railData.x = newLeft;
                        railData.y = newTop;
                        const dom = document.getElementById(railData.id);
                        if (dom) {
                            dom.style.left = `${railData.x}px`;
                            dom.style.top = `${railData.y}px`;
                        }

                        // move attached nodes by same delta
                        rd.nodeStarts.forEach(ns => {
                            const nodeData = this.mapData.nodes.find(n => n.id === ns.id);
                            const el = document.getElementById(ns.id);
                            if (nodeData && el) {
                                nodeData.x = ns.x + dx;
                                nodeData.y = ns.y + dy;
                                el.style.left = `${nodeData.x}px`;
                                el.style.top = `${nodeData.y}px`;
                            }
                        });

                        this.instance.repaintEverything();
                    },
                    stop: (params) => {
                        // finalize positions and save
                        if (this.railDragState) {
                            // update mapData rails from DOM
                            const rd = this.railDragState;
                            const railData = this.mapData.rails.find(rr => rr.id === rd.railId);
                            if (railData) {
                                railData.x = parseInt(document.getElementById(railData.id).style.left, 10) || railData.x;
                                railData.y = parseInt(document.getElementById(railData.id).style.top, 10) || railData.y;
                            }
                            this.railDragState = null;
                            this.saveMapData();
                        }
                    }
                });

                // clicking a rail should allow selection and also participate in connect mode
                railEl.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.onRailClick(e, railEl, r);
                });
                // element to show precise anchor preview when hovering in connect mode
                const previewDot = document.createElement('div');
                previewDot.className = 'rail-anchor-preview';
                previewDot.style.display = 'none';
                railEl.appendChild(previewDot);
            }

            // apply positioning and thickness based on orientation + size
            railEl.style.left = `${r.x}px`;
            railEl.style.top = `${r.y}px`;
            railEl.style.backgroundColor = this.config.lineColor;
            railEl.classList.toggle('vertical', r.orientation === 'vertical');

            // thickness is stored in r.size; update width/height depending on orientation
            const size = r.size || 8;
            if (r.orientation === 'vertical') {
                railEl.style.width = `${size}px`;
                railEl.style.height = `${r.height || 300}px`;
            } else if (r.orientation === 'diagonal') {
                railEl.style.width = `${r.width || 200}px`;
                railEl.style.height = `${size}px`;
                if (r.angle) railEl.style.transform = `rotate(${r.angle}deg)`;
            } else {
                railEl.style.width = `${r.width || 300}px`;
                railEl.style.height = `${size}px`;
            }

            // keep CSS custom property for legacy styles
            railEl.style.setProperty('--rail-size', `${size}px`);

            // mark selection state
            if (this.selectedRail === r.id) railEl.classList.add('cardmap-rail-selected');
            else railEl.classList.remove('cardmap-rail-selected');
        }

        /** Select a rail by id and update controls */
        selectRail(railId) {
            this.deselectAllNodes();
            this.selectedRail = railId;
            document.querySelectorAll('.cardmap-rail').forEach(el => el.classList.remove('cardmap-rail-selected'));
            const el = document.getElementById(railId);
            if (el) el.classList.add('cardmap-rail-selected');
            const railData = this.mapData.rails.find(r => r.id === railId);
            if (railData) {
                document.getElementById('rail-size').value = railData.size || 8;
            }
        }

        /**
         * Creates and renders a new rail.
         */
        addRail() {
            const orientation = document.getElementById('add-rail-orientation').value;
            const size = parseInt(document.getElementById('rail-size').value, 10) || 10;
            const rail = {
                id: `rail_${Date.now()}`,
                x: this.editor.scrollLeft + 100,
                y: this.editor.scrollTop + 100,
                width: 300,
                height: this.RAIL_HEIGHT,
                orientation: orientation,
                size: size
            };

            if (orientation === 'vertical') {
                // vertical rail thickness is the size
                rail.width = size;
                rail.height = 300;
            }

            this.mapData.rails.push(rail);
            this.renderRail(rail);
            this.saveMapData();
        }

        /**
         * Deletes a rail element.
         */
        deleteRail(railId) {
            const railEl = document.getElementById(railId);
            if (railEl) {
                // remove any jsPlumb connections attached to this element
                const conns = this.instance.getAllConnections().filter(c => c.sourceId === railId || c.targetId === railId);
                conns.forEach(c => {
                    try { this.instance.deleteConnection(c); } catch(e) {}
                });
                // remove from DOM
                try { this.instance.remove(railEl); } catch(e) { railEl.remove(); }
            }

            // clear attachedRail from nodes
            this.mapData.nodes.forEach(n => { if (n.attachedRail === railId) delete n.attachedRail; });

            // remove rail data
            this.mapData.rails = (this.mapData.rails || []).filter(x => x.id !== railId);
            // save map after deletion
            this.saveMapData();
        }

        /**
         * Handles the live resizing of a rail.
         */
        handleRailResize(e) {
            if (!this.railResizeState) return;
            
            const rect = this.editor.getBoundingClientRect();
            const mapX = (e.clientX - rect.left - this.offsetX) / this.scale;
            const mapY = (e.clientY - rect.top - this.offsetY) / this.scale;
            const rs = this.mapData.rails.find(r => r.id === this.railResizeState.railId);
            const dom = document.getElementById(this.railResizeState.railId);
            if (!rs || !dom) return;

            const state = this.railResizeState;

            if (rs.orientation === 'horizontal') {
                if (state.side === 'right') {
                    const newWidth = mapX - state.startLeft;
                    rs.width = Math.max(40, newWidth);
                } else { // left
                    const deltaX = mapX - state.startLeft;
                    const newWidth = state.startWidth - deltaX;
                    if (newWidth > 40) {
                        rs.x = state.startLeft + deltaX;
                        rs.width = newWidth;
                    }
                }
                dom.style.left = `${rs.x}px`;
                dom.style.width = `${rs.width}px`;
            } else if (rs.orientation === 'diagonal') {
                const deltaX = mapX - rs.x;
                const deltaY = mapY - rs.y;
                rs.width = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
                rs.angle = Math.atan2(deltaY, deltaX) * 180 / Math.PI;
                dom.style.width = `${rs.width}px`;
                dom.style.transform = `rotate(${rs.angle}deg)`;
            } else { // vertical
                 if (state.side === 'bottom') {
                    const newHeight = mapY - state.startTop;
                    rs.height = Math.max(40, newHeight);
                } else { // top
                    const deltaY = mapY - state.startTop;
                    const newHeight = state.startHeight - deltaY;
                    if (newHeight > 40) {
                        rs.y = state.startTop + deltaY;
                        rs.height = newHeight;
                    }
                }
                dom.style.top = `${rs.y}px`;
                dom.style.height = `${rs.height}px`;
            }
            this.instance.repaintEverything();
        }

        /**
         * Toggles connect mode.
         */
        toggleConnectMode() {
            this.connectMode = !this.connectMode;
            this.deleteMode = false;
            this.deleteRailMode = false;
            document.getElementById('connect-mode').classList.toggle('button-primary', this.connectMode);
            document.getElementById('delete-node').classList.remove('button-primary');
            this.editor.style.cursor = this.connectMode ? 'crosshair' : 'grab';
            if (!this.connectMode && this.firstNode) {
                this.firstNode.style.boxShadow = '';
                this.firstNode = null;
                this.firstAnchor = null;
            }
        }

        /**
         * Toggles delete mode.
         */
        toggleDeleteMode() {
            this.deleteMode = !this.deleteMode;
            this.connectMode = false;
            this.deleteRailMode = false;
            document.getElementById('delete-node').classList.toggle('button-primary', this.deleteMode);
            document.getElementById('connect-mode').classList.remove('button-primary');
            this.editor.style.cursor = this.deleteMode ? 'not-allowed' : 'grab';
        }

        /**
         * Toggles delete-rail mode which allows clicking rails to delete them.
         */
        toggleDeleteRailMode() {
            this.deleteRailMode = !this.deleteRailMode;
            this.deleteMode = false;
            this.connectMode = false;
            const btn = document.getElementById('delete-rail');
            if (btn) btn.classList.toggle('button-primary', this.deleteRailMode);
            // ensure other mode buttons are visually reset
            const dn = document.getElementById('delete-node'); if (dn) dn.classList.remove('button-primary');
            const cm = document.getElementById('connect-mode'); if (cm) cm.classList.remove('button-primary');
            this.editor.style.cursor = this.deleteRailMode ? 'not-allowed' : 'grab';
        }

        /**
         * Toggles fullscreen mode for the editor.
         */
        toggleFullscreen() {
            if (document.fullscreenElement) {
                document.exitFullscreen();
            } else {
                this.editorWrapper.requestFullscreen();
            }
        }

        /**
         * Collects data and sends it to the server to be saved.
         */
        saveMapData() {
            // Update mapData from the DOM before saving
            this.mapData.nodes.forEach(nodeData => {
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
                    // persist per-node connection style if user set it
                    const connSel = el.querySelector('.card-connection-style');
                    if (connSel) nodeData.connectionStyle = connSel.value;
                }
            });
            
            this.mapData.rails.forEach(railData => {
                const el = document.getElementById(railData.id);
                if(el) {
                    railData.x = parseInt(el.style.left, 10) || 0;
                    railData.y = parseInt(el.style.top, 10) || 0;
                    railData.width = parseInt(el.style.width, 10) || 0;
                    railData.height = parseInt(el.style.height, 10) || 0;
                    // preserve logical size property (thickness)
                    railData.size = railData.size || (railData.orientation === 'vertical' ? railData.width : railData.height || this.RAIL_HEIGHT);
                }
            });

            const connectionsToSave = (this.mapData.connections || []).filter(c => !this.pendingDeletes.has(c.id));
            const dataToSave = {
                nodes: this.mapData.nodes,
                connections: connectionsToSave,
                rails: this.mapData.rails || []
            };

            fetch(this.ajaxUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
                body: new URLSearchParams({
                    action: 'save_cardmap',
                    post_id: this.postId,
                    nonce: this.nonce,
                    data: JSON.stringify(dataToSave)
                })
            }).then(r => r.json()).then(res => {
                if (res && res.success) {
                    if (this.pendingDeletes.size > 0) {
                        this.mapData.connections = connectionsToSave;
                        this.pendingDeletes.clear();
                    }
                    this.showToast('Map saved!');
                } else {
                    this.showToast(`Error saving map: ${res.data || 'Unknown error'}`);
                }
            }).catch(err => {
                console.error(err);
                this.showToast('Saving failed. See console for details.');
            });
        }

        // --- Pan and Zoom Handlers ---
        handlePanStart(e) {
            if (e.target === this.editorWrapper || e.target === this.editor) {
                this.isPanning = true;
                this.panStartCoords.x = e.clientX - this.offsetX;
                this.panStartCoords.y = e.clientY - this.offsetY;
                this.editor.style.cursor = 'grabbing';
            }
        }

        handlePanEnd() {
            this.isPanning = false;
            this.editor.style.cursor = 'grab';
        }

        handlePanMove(e) {
            if (this.isPanning) {
                this.offsetX = e.clientX - this.panStartCoords.x;
                this.offsetY = e.clientY - this.panStartCoords.y;
                this.updateTransform();
            }
        }

        handleZoom(e) {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            const newScale = Math.max(0.2, Math.min(3, this.scale + delta));
            
            const rect = this.editorWrapper.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            const worldX = (mouseX - this.offsetX) / this.scale;
            const worldY = (mouseY - this.offsetY) / this.scale;

            this.offsetX = mouseX - worldX * newScale;
            this.offsetY = mouseY - worldY * newScale;
            this.scale = newScale;
            
            this.updateTransform();
        }

        updateTransform() {
            this.editor.style.transform = `translate(${this.offsetX}px, ${this.offsetY}px) scale(${this.scale})`;
            this.instance.setZoom(this.scale);
        }

        // Alignment and distribution features (manual align) removed per user request.

        /**
         * Auto-arrange nodes when the map first loads. Tries to keep nodes
         * that share a rail aligned, and lays out the rest in a grid while
         * keeping a safe margin from rails.
         */
        autoArrangeOnLoad() {
            const nodes = this.mapData.nodes || [];
            if (!nodes.length) return;

            const margin = 48; // spacing between nodes
            const railSafeMargin = 24; // minimum gap from a rail
            const wrapperW = Math.max(800, this.editorWrapper.clientWidth || 800);

            // First, group nodes attached to rails and align them along the rail
            const rails = this.mapData.rails || [];
            rails.forEach(rail => {
                const attached = nodes.filter(n => n.attachedRail === rail.id);
                if (!attached.length) return;

                // Layout attached nodes along the rail's primary axis
                if (rail.orientation === 'vertical') {
                    // Stack vertically along the rail's Y range, centered on rail.x
                    let y = rail.y + margin;
                    attached.forEach(n => {
                        n.x = rail.x - ( (document.getElementById(n.id)?.offsetWidth || 200) / 2 ) + (rail.size || this.RAIL_HEIGHT) / 2;
                        n.y = y;
                        const el = document.getElementById(n.id);
                        if (el) { el.style.left = `${n.x}px`; el.style.top = `${n.y}px`; }
                        y += (document.getElementById(n.id)?.offsetHeight || 120) + margin;
                    });
                } else {
                    // horizontal or diagonal -> lay out left to right along rail.x..x+width
                    let x = rail.x + margin;
                    attached.forEach(n => {
                        n.x = x;
                        n.y = rail.y - ( (document.getElementById(n.id)?.offsetHeight || 120) / 2 ) + (rail.size || this.RAIL_HEIGHT) / 2;
                        const el = document.getElementById(n.id);
                        if (el) { el.style.left = `${n.x}px`; el.style.top = `${n.y}px`; }
                        x += (document.getElementById(n.id)?.offsetWidth || 200) + margin;
                    });
                }
            });

            // Now layout unattached nodes into a grid to the right of rails if any,
            // otherwise start at margin.
            const unattached = nodes.filter(n => !n.attachedRail);
            let startX = margin;
            // try to place grid to the right of the rightmost rail
            if (rails.length) {
                const rightmost = Math.max(...rails.map(r => r.x + (r.width || 0)));
                startX = Math.max(startX, rightmost + railSafeMargin);
            }

            let x = startX;
            let y = margin;
            let rowH = 0;
            const containerW = wrapperW - margin;

            unattached.forEach(n => {
                const el = document.getElementById(n.id);
                const w = el ? el.offsetWidth : 200;
                const h = el ? el.offsetHeight : 120;

                if (x + w + margin > containerW) {
                    x = startX;
                    y += rowH + margin;
                    rowH = 0;
                }

                // Ensure it's not too close to any rail: if so, nudge vertically
                let tooClose = false;
                for (const r of rails) {
                    if (r.orientation === 'vertical') {
                        const dx = Math.abs((r.x + (r.width || r.size || this.RAIL_HEIGHT)/2) - x);
                        if (dx < railSafeMargin) { tooClose = true; break; }
                    } else {
                        const dy = Math.abs(r.y - y);
                        if (dy < railSafeMargin) { tooClose = true; break; }
                    }
                }

                if (tooClose) y += railSafeMargin;

                n.x = x;
                n.y = y;
                if (el) { el.style.left = `${n.x}px`; el.style.top = `${n.y}px`; }

                x += w + margin;
                rowH = Math.max(rowH, h);
            });

            // After arranging, make sure connections update
            const movedIds = nodes.map(n => n.id);
            this.updateConnectionsAfterMove(movedIds);
        }

        // Alignment functions removed per user request.

        // --- Helper and Utility Methods ---

        // Alignment toolbar removed

        /**
         * Deselects all nodes, optionally ignoring one.
         */
        deselectAllNodes(ignoreId = null) {
            document.querySelectorAll('.cardmap-node-selected').forEach(el => {
                if (el.id !== ignoreId) {
                    el.classList.remove('cardmap-node-selected');
                }
            });
            this.selectedNodes.forEach(id => {
                if (id !== ignoreId) {
                    this.selectedNodes.delete(id);
                }
            });
        }

        /**
         * Gets an array of selected nodes with their DOM elements and data.
         */
        getSelectedNodesWithElements() {
            const nodes = [];
            for (const id of this.selectedNodes) {
                const el = document.getElementById(id);
                const data = this.mapData.nodes.find(n => n.id === id);
                if (el && data) {
                    nodes.push({ id, el, data });
                }
            }
            return nodes;
        }

        /**
         * After moving nodes programmatically, recompute anchors for any connections
         * attached to those nodes so jsPlumb can repaint them correctly.
         * @param {string[]} movedIds
         */
        updateConnectionsAfterMove(movedIds) {
            if (!Array.isArray(movedIds) || movedIds.length === 0) return;

            // For each moved node, find connections and recompute anchors
            movedIds.forEach(id => {
                const el = document.getElementById(id);
                if (!el) return;

                const connections = this.instance.getConnections({ source: id }).concat(this.instance.getConnections({ target: id }));
                connections.forEach(conn => {
                    try {
                        const sourceEl = document.getElementById(conn.sourceId);
                        const targetEl = document.getElementById(conn.targetId);

                        // If either end is a rail element, prefer precise anchors if available
                        const isSourceRail = sourceEl && sourceEl.classList.contains('cardmap-rail');
                        const isTargetRail = targetEl && targetEl.classList.contains('cardmap-rail');

                        if (isSourceRail || isTargetRail) {
                            // Try to preserve any precise anchor saved on the connection metadata
                            if (conn._userAnchor) {
                                conn.setAnchors(conn._userAnchor);
                            } else {
                                // fall back to computing directional anchors based on elements
                                conn.setAnchors(this.getDirectionalAnchors(sourceEl, targetEl));
                            }
                        } else {
                            // Both are normal nodes: use directional anchors so connectors look symmetric
                            conn.setAnchors(this.getDirectionalAnchors(sourceEl, targetEl));
                        }
                    } catch (err) {
                        // ignore per-connection errors and continue
                    }
                });
            });

            // Force a repaint after all anchors updated
            this.instance.repaintEverything();
        }

        /**
         * Displays a short-lived notification message.
         */
        showToast(message, timeout = 2500) {
            const existing = document.getElementById('cardmap-toast');
            if (existing) existing.remove();
            const t = document.createElement('div');
            t.id = 'cardmap-toast';
            t.textContent = message;
            document.body.appendChild(t);
            setTimeout(() => { try { t.remove(); } catch(e){} }, timeout);
        }

        /**
         * Gets the jsPlumb connector configuration for a given style name.
         */
        getConnectorConfig(style) {
            const baseConfig = { stroke: this.config.lineColor, strokeWidth: this.config.lineThickness };
            const overlays = [["Arrow", { width: 10, length: 10, location: 1 }]];
            const styles = {
                'bezier': { connector: ["Bezier", { curviness: 50 }], overlays: [] },
                'straight': { connector: ["Straight"], overlays: [] },
                'flowchart': { connector: ["Flowchart"], overlays: [] },
                'state-machine': { connector: ["StateMachine", { curviness: 20 }], overlays: [] },
                'straight-with-arrows': { connector: ["Straight"], overlays: overlays },
                'flowchart-with-arrows': { connector: ["Flowchart"], overlays: overlays },
                'dashed': { paintStyle: { ...baseConfig, dashstyle: "4 2" }, overlays: [] },
                'dotted': { paintStyle: { ...baseConfig, dashstyle: "1 1" }, overlays: [] }
            };
            const config = styles[style] || styles['straight-with-arrows'];
            return { ...config, paintStyle: config.paintStyle || baseConfig };
        }

        /**
         * Determines the best anchor points based on the relative positions of two elements.
         */
        getDirectionalAnchors(sourceNode, targetNode) {
            const s = sourceNode.getBoundingClientRect();
            const t = targetNode.getBoundingClientRect();
            const dx = (t.left + t.right) / 2 - (s.left + s.right) / 2;
            const dy = (t.top + t.bottom) / 2 - (s.top + s.bottom) / 2;
            // Use explicit anchor names with center/middle to keep consistency
            return Math.abs(dx) > Math.abs(dy)
                ? (dx > 0 ? ["RightMiddle", "LeftMiddle"] : ["LeftMiddle", "RightMiddle"])
                : (dy > 0 ? ["BottomCenter", "TopCenter"] : ["TopCenter", "BottomCenter"]);
        }

        /**
         * Calculates a precise anchor position based on a click event.
         */
        getPreciseAnchorFromEvent(e, el) {
            const wrapperRect = this.editorWrapper.getBoundingClientRect();
            const worldX = (e.clientX - wrapperRect.left - this.offsetX) / this.scale;
            const worldY = (e.clientY - wrapperRect.top - this.offsetY) / this.scale;
            const elX = parseFloat(el.style.left) || 0;
            const elY = parseFloat(el.style.top) || 0;
            const x_in_el = worldX - elX;
            const y_in_el = worldY - elY;

            let visibleHeight = el.offsetHeight;
            if (el.classList.contains('cardmap-node')) {
                const imageWrapper = el.querySelector('.node-image-wrapper');
                const title = el.querySelector('.card-title');
                visibleHeight = (imageWrapper ? imageWrapper.offsetHeight : 0) + (title ? title.offsetHeight : 0);
            }

            const x = x_in_el / el.offsetWidth;
            const y = y_in_el / visibleHeight;

            if (y < 0 || y > 1) return "Continuous";

            const topDist = y, bottomDist = 1 - y, leftDist = x, rightDist = 1 - x;
            const min = Math.min(topDist, bottomDist, leftDist, rightDist);

            if (min === topDist) return "TopCenter";
            if (min === bottomDist) return "BottomCenter";
            if (min === leftDist) return "LeftMiddle";
            return "RightMiddle";
        }

        // --- Diagonal Rail Helpers ---
        distanceToLineSegment(px, py, x1, y1, x2, y2) {
            const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
            if (l2 === 0) return Math.sqrt((px - x1) * (px - x1) + (py - y1) * (py - y1));
            let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
            t = Math.max(0, Math.min(1, t));
            const projX = x1 + t * (x2 - x1);
            const projY = y1 + t * (y2 - y1);
            return Math.sqrt((px - projX) * (px - projX) + (py - projY) * (py - projY));
        }

        projectPointOnLine(px, py, x1, y1, x2, y2) {
            const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
            if (l2 === 0) return { x: x1, y: y1 };
            const t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
            return { x: x1 + t * (x2 - x1), y: y1 + t * (y2 - y1) };
        }
    }

    // Kick off the editor
    document.addEventListener('DOMContentLoaded', () => new CardMapEditor());

})();
