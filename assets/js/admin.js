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
            document.getElementById('connect-mode').addEventListener('click', this.toggleConnectMode.bind(this));
            document.getElementById('delete-node').addEventListener('click', this.toggleDeleteMode.bind(this));
            document.getElementById('save-map').addEventListener('click', this.saveMapData.bind(this));
            document.getElementById('fullscreen-editor').addEventListener('click', this.toggleFullscreen.bind(this));
            if (this.config.enableAlignButton) {
                document.getElementById('align-nodes').addEventListener('click', this.autoAlignNodes.bind(this));
            }

            this.editorWrapper.addEventListener('mousedown', this.handlePanStart.bind(this));
            this.editorWrapper.addEventListener('mouseup', this.handlePanEnd.bind(this));
            this.editorWrapper.addEventListener('mouseleave', this.handlePanEnd.bind(this));
            this.editorWrapper.addEventListener('mousemove', this.handlePanMove.bind(this));
            this.editorWrapper.addEventListener('wheel', this.handleZoom.bind(this));
            
            this.editorWrapper.addEventListener('click', (e) => {
                if (e.target === this.editorWrapper || e.target === this.editor) {
                    this.deselectAllNodes();
                }
            });

            window.addEventListener('mousemove', this.handleRailResize.bind(this));
            window.addEventListener('mouseup', () => { if (this.railResizeState) this.railResizeState = null; });

            document.getElementById('align-left').addEventListener('click', () => this.alignSelectedNodes('left'));
            document.getElementById('align-center').addEventListener('click', () => this.alignSelectedNodes('center'));
            document.getElementById('align-right').addEventListener('click', () => this.alignSelectedNodes('right'));
            document.getElementById('align-top').addEventListener('click', () => this.alignSelectedNodes('top'));
            document.getElementById('align-middle').addEventListener('click', () => this.alignSelectedNodes('middle'));
            document.getElementById('align-bottom').addEventListener('click', () => this.alignSelectedNodes('bottom'));
            document.getElementById('distribute-horizontal').addEventListener('click', () => this.distributeSelectedNodes('horizontal'));
            document.getElementById('distribute-vertical').addEventListener('click', () => this.distributeSelectedNodes('vertical'));
        }

        /**
         * Renders the initial map data from the server.
         */
        loadInitialData() {
            this.instance.batch(() => {
                (this.mapData.rails || []).forEach(r => this.renderRail(r));
                (this.mapData.nodes || []).forEach(n => this.renderNode(n));
                (this.mapData.connections || []).forEach(c => {
                    if (!c || !c.source || !c.target) return;
                    const sourceEl = document.getElementById(c.source);
                    const targetEl = document.getElementById(c.target);
                    if (!sourceEl || !targetEl) return;

                    const connStyle = c.style || this.config.lineStyle || 'straight';
                    const config = this.getConnectorConfig(connStyle);
                    
                    const conn = this.instance.connect({
                        source: c.source,
                        target: c.target,
                        anchors: c.anchors || this.getDirectionalAnchors(sourceEl, targetEl),
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
                const sourceNode = this.mapData.nodes.find(n => n.id === conn.sourceId);
                const targetNode = this.mapData.nodes.find(n => n.id === conn.targetId);
                const sourceRail = sourceNode && sourceNode.attachedRail ? this.mapData.rails.find(r => r.id === sourceNode.attachedRail) : null;
                const targetRail = targetNode && targetNode.attachedRail ? this.mapData.rails.find(r => r.id === targetNode.attachedRail) : null;

                if (sourceRail || targetRail) {
                    conn._originalAnchors = conn.getAnchors();
                    const rail = sourceRail || targetRail;
                    conn.setAnchors(rail.orientation === 'vertical' ? ["Right", "Left"] : ["Top", "Bottom"]);
                }
            });
        }

        /**
         * Handles the dragging of a node, including rail snapping previews.
         */
        onNodeDrag(params) {
            this.instance.repaintEverything();
            const node = params.el;
            const rails = this.mapData.rails || [];
            let nearest = null;
            let bestDist = Infinity;
            const elLeft = parseFloat(node.style.left) || 0;
            const elCenterX = elLeft + (node.offsetWidth || 240) / 2;

            for (const r of rails) {
                if (elCenterX >= r.x && elCenterX <= (r.x + (r.width || 0))) {
                    const dy = Math.abs((r.y + this.RAIL_SNAP_OFFSET) - (parseFloat(node.style.top) || 0));
                    if (dy < bestDist) {
                        bestDist = dy;
                        nearest = r;
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

                for (const r of rails) {
                    const nodeCenterX = draggedNode.x + (params.el.offsetWidth || 240) / 2;
                    if (nodeCenterX >= r.x && nodeCenterX <= (r.x + (r.width || 0))) {
                        const dy = Math.abs(draggedNode.y - (r.y + this.RAIL_SNAP_OFFSET));
                        if (dy <= this.RAIL_SNAP_THRESHOLD) {
                            snapped = r;
                            break;
                        }
                    }
                }

                if (snapped) {
                    draggedNode.attachedRail = snapped.id;
                    if (snapped.orientation === 'vertical') {
                        draggedNode.x = snapped.x + this.RAIL_SNAP_OFFSET_VERTICAL;
                        params.el.style.left = `${draggedNode.x}px`;
                    } else {
                        draggedNode.y = snapped.y + this.RAIL_SNAP_OFFSET;
                        params.el.style.top = `${draggedNode.y}px`;
                    }
                } else {
                    delete draggedNode.attachedRail;
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

            const connections = this.instance.getConnections({ source: params.el.id }).concat(this.instance.getConnections({ target: params.el.id }));
            connections.forEach(conn => {
                if (conn._originalAnchors) {
                    conn.setAnchors(conn._originalAnchors);
                    delete conn._originalAnchors;
                }
            });

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
            this.updateAlignmentToolbar();
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

                const secondAnchor = this.getPreciseAnchorFromEvent(e, node);
                const autoAnchors = this.getDirectionalAnchors(this.firstNode, node);
                const anchorA = this.firstAnchor || autoAnchors[0];
                const anchorB = secondAnchor || autoAnchors[1];
                
                const conn = this.instance.connect({
                    source: sourceId,
                    target: targetId,
                    anchors: [anchorA, anchorB],
                    ...this.getConnectorConfig(this.config.lineStyle),
                    cssClass: 'cardmap-connector'
                });

                const newId = `conn_${Date.now()}_${Math.floor(Math.random()*10000)}`;
                conn._cardmap_id = newId;
                this.mapData.connections.push({ id: newId, source: sourceId, target: targetId, style: this.config.lineStyle, anchors: [anchorA, anchorB] });
                
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
            if (!r || !r.id || document.getElementById(r.id)) return;
            
            const rail = document.createElement('div');
            rail.className = `cardmap-rail ${r.orientation === 'vertical' ? 'vertical' : ''}`;
            rail.id = r.id;
            rail.dataset.orientation = r.orientation || 'horizontal';

            if (r.orientation === 'vertical') {
                rail.style.left = `${r.x || 40}px`;
                rail.style.top = `${r.y || 40}px`;
                rail.style.height = `${r.height || 400}px`;
                rail.style.width = `${this.RAIL_HEIGHT}px`;
            } else {
                rail.style.left = `${r.x || 40}px`;
                rail.style.top = `${r.y || 40}px`;
                rail.style.width = `${r.width || 400}px`;
                rail.style.height = `${this.RAIL_HEIGHT}px`;
            }

            rail.innerHTML = `
                <div class="rail-handle"></div>
                <div class="rail-resize-handle left"></div>
                <div class="rail-resize-handle right"></div>
                <div class="rail-snap-preview"></div>
            `;

            this.editor.appendChild(rail);

            this.instance.draggable(rail, {
                drag: () => this.instance.repaintEverything(),
                stop: (params) => {
                    const rr = this.mapData.rails.find(x => x.id === params.el.id);
                    if (rr) {
                        rr.x = params.pos[0];
                        rr.y = params.pos[1];
                    }
                    this.instance.repaintEverything();
                }
            });

            rail.querySelector('.left').addEventListener('mousedown', (e) => {
                e.stopPropagation();
                const side = (r.orientation === 'vertical') ? 'top' : 'left';
                this.railResizeState = { railId: r.id, side: side, startX: e.clientX, startLeft: parseFloat(rail.style.left), startWidth: parseFloat(rail.style.width) };
            });
            rail.querySelector('.right').addEventListener('mousedown', (e) => {
                e.stopPropagation();
                const side = (r.orientation === 'vertical') ? 'bottom' : 'right';
                this.railResizeState = { railId: r.id, side: side, startX: e.clientX, startLeft: parseFloat(rail.style.left), startWidth: parseFloat(rail.style.width) };
            });

            rail.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                this.deleteRail(r.id);
            });

            rail.style.zIndex = 1600;
        }

        /**
         * Creates and renders a new rail.
         */
        addRail() {
            const id = `rail_${Date.now()}`;
            const orientation = document.getElementById('add-rail-orientation').value;
            const newRail = { id, x: 150, y: 150, orientation };
            if (orientation === 'vertical') {
                newRail.height = 400;
                newRail.width = this.RAIL_HEIGHT;
            } else {
                newRail.width = 400;
                newRail.height = this.RAIL_HEIGHT;
            }
            this.mapData.rails.push(newRail);
            this.renderRail(newRail);
        }

        /**
         * Deletes a rail element.
         */
        deleteRail(railId) {
            const railEl = document.getElementById(railId);
            if (railEl) this.instance.remove(railEl);
            this.mapData.rails = (this.mapData.rails || []).filter(x => x.id !== railId);
        }

        /**
         * Handles the live resizing of a rail.
         */
        handleRailResize(e) {
            if (!this.railResizeState) return;
            
            const rect = this.editor.getBoundingClientRect();
            const mapX = (e.clientX - rect.left - this.offsetX) / this.scale;
            const rs = this.mapData.rails.find(r => r.id === this.railResizeState.railId);
            const dom = document.getElementById(this.railResizeState.railId);
            if (!rs || !dom) return;

            if (rs.orientation === 'horizontal') {
                if (this.railResizeState.side === 'right') {
                    rs.width = Math.max(40, mapX - rs.x);
                    dom.style.width = `${rs.width}px`;
                } else { // left
                    const newWidth = Math.max(40, (rs.x + rs.width) - mapX);
                    rs.x = mapX;
                    rs.width = newWidth;
                    dom.style.left = `${rs.x}px`;
                    dom.style.width = `${rs.width}px`;
                }
            } else { // vertical
                 if (this.railResizeState.side === 'bottom') {
                    rs.height = Math.max(40, mapX - rs.y);
                    dom.style.height = `${rs.height}px`;
                } else { // top
                    const newHeight = Math.max(40, (rs.y + rs.height) - mapX);
                    rs.y = mapX;
                    rs.height = newHeight;
                    dom.style.top = `${rs.y}px`;
                    dom.style.height = `${rs.height}px`;
                }
            }
            this.instance.repaintEverything();
        }

        /**
         * Toggles connect mode.
         */
        toggleConnectMode() {
            this.connectMode = !this.connectMode;
            this.deleteMode = false;
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
            document.getElementById('delete-node').classList.toggle('button-primary', this.deleteMode);
            document.getElementById('connect-mode').classList.remove('button-primary');
            this.editor.style.cursor = this.deleteMode ? 'not-allowed' : 'grab';
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
                }
            });
            
            this.mapData.rails.forEach(railData => {
                const el = document.getElementById(railData.id);
                if(el) {
                    railData.x = parseInt(el.style.left, 10) || 0;
                    railData.y = parseInt(el.style.top, 10) || 0;
                    railData.width = parseInt(el.style.width, 10) || 0;
                    railData.height = parseInt(el.style.height, 10) || 0;
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

        // --- Alignment and Distribution ---
        
        /**
         * Automatically arranges all nodes in a grid-like layout.
         */
        autoAlignNodes() {
            const nodes = this.mapData.nodes || [];
            if (nodes.length === 0) return;

            const margin = 40;
            let x = margin;
            let y = margin;
            let rowHeight = 0;
            const containerWidth = this.editorWrapper.clientWidth;

            nodes.forEach(nodeData => {
                const el = document.getElementById(nodeData.id);
                if (!el) return;

                const elWidth = el.offsetWidth;
                const elHeight = el.offsetHeight;

                if (x + elWidth + margin > containerWidth) {
                    x = margin;
                    y += rowHeight + margin;
                    rowHeight = 0;
                }

                nodeData.x = x;
                nodeData.y = y;
                el.style.left = `${x}px`;
                el.style.top = `${y}px`;

                x += elWidth + margin;
                rowHeight = Math.max(rowHeight, elHeight);
            });

            this.scale = 1;
            this.offsetX = 0;
            this.offsetY = 0;
            this.updateTransform();
            this.instance.repaintEverything();
        }

        /**
         * Aligns selected nodes to a specified edge.
         * @param {string} edge 'left', 'center', 'right', 'top', 'middle', 'bottom'
         */
        alignSelectedNodes(edge) {
            const selected = this.getSelectedNodesWithElements();
            if (selected.length < 2) return;

            switch (edge) {
                case 'left':
                    const minX = Math.min(...selected.map(n => n.data.x));
                    selected.forEach(n => { n.data.x = minX; n.el.style.left = `${minX}px`; });
                    break;
                case 'center':
                    const avgX = selected.reduce((sum, n) => sum + n.data.x + n.el.offsetWidth / 2, 0) / selected.length;
                    selected.forEach(n => { const newX = avgX - n.el.offsetWidth / 2; n.data.x = newX; n.el.style.left = `${newX}px`; });
                    break;
                case 'right':
                    const maxX = Math.max(...selected.map(n => n.data.x + n.el.offsetWidth));
                    selected.forEach(n => { const newX = maxX - n.el.offsetWidth; n.data.x = newX; n.el.style.left = `${newX}px`; });
                    break;
                case 'top':
                    const minY = Math.min(...selected.map(n => n.data.y));
                    selected.forEach(n => { n.data.y = minY; n.el.style.top = `${minY}px`; });
                    break;
                case 'middle':
                    const avgY = selected.reduce((sum, n) => sum + n.data.y + n.el.offsetHeight / 2, 0) / selected.length;
                    selected.forEach(n => { const newY = avgY - n.el.offsetHeight / 2; n.data.y = newY; n.el.style.top = `${newY}px`; });
                    break;
                case 'bottom':
                    const maxY = Math.max(...selected.map(n => n.data.y + n.el.offsetHeight));
                    selected.forEach(n => { const newY = maxY - n.el.offsetHeight; n.data.y = newY; n.el.style.top = `${newY}px`; });
                    break;
            }
            this.instance.repaintEverything();
        }

        /**
         * Distributes selected nodes evenly.
         * @param {string} direction 'horizontal' or 'vertical'
         */
        distributeSelectedNodes(direction) {
            const selected = this.getSelectedNodesWithElements();
            if (selected.length < 2) return;

            if (direction === 'horizontal') {
                selected.sort((a, b) => a.data.x - b.data.x);
                const minX = selected[0].data.x;
                const maxX = selected[selected.length - 1].data.x + selected[selected.length - 1].el.offsetWidth;
                const totalWidth = selected.reduce((sum, n) => sum + n.el.offsetWidth, 0);
                const gap = (maxX - minX - totalWidth) / (selected.length - 1);
                let currentX = minX;
                selected.forEach(n => {
                    n.data.x = currentX;
                    n.el.style.left = `${currentX}px`;
                    currentX += n.el.offsetWidth + gap;
                });
            } else { // vertical
                selected.sort((a, b) => a.data.y - b.data.y);
                const minY = selected[0].data.y;
                const maxY = selected[selected.length - 1].data.y + selected[selected.length - 1].el.offsetHeight;
                const totalHeight = selected.reduce((sum, n) => sum + n.el.offsetHeight, 0);
                const gap = (maxY - minY - totalHeight) / (selected.length - 1);
                let currentY = minY;
                selected.forEach(n => {
                    n.data.y = currentY;
                    n.el.style.top = `${currentY}px`;
                    currentY += n.el.offsetHeight + gap;
                });
            }
            this.instance.repaintEverything();
        }

        // --- Helper and Utility Methods ---

        /**
         * Shows or hides the alignment toolbar based on selection count.
         */
        updateAlignmentToolbar() {
            const toolbar = document.getElementById('cardmap-alignment-toolbar');
            if (toolbar) {
                toolbar.style.display = this.selectedNodes.size > 1 ? 'flex' : 'none';
            }
        }

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
            this.updateAlignmentToolbar();
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
            return Math.abs(dx) > Math.abs(dy)
                ? (dx > 0 ? ["Right", "Left"] : ["Left", "Right"])
                : (dy > 0 ? ["Bottom", "Top"] : ["Top", "Bottom"]);
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

            if (min === topDist) return "Top";
            if (min === bottomDist) return "Bottom";
            if (min === leftDist) return "Left";
            return "Right";
        }
    }

    // Kick off the editor
    document.addEventListener('DOMContentLoaded', () => new CardMapEditor());

})();
