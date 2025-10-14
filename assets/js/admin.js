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
                lineStyle: 'straight-with-arrows', // Default connection style
                availableLineStyles: this.parseJson(cardmap_admin_data.available_line_styles, {}),
                lineColor: cardmap_admin_data.line_color,
                lineThickness: cardmap_admin_data.line_thickness,
                showRailThickness: !!cardmap_admin_data.show_rail_thickness,
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
            this.deleteConnectionMode = false;
            this.deleteConnectionFirstNode = null;
            this.deleteMode = false;
            this.firstNode = null;
            this.firstAnchor = null;

            this.railResizeState = null;
            this.railSettingsPinned = false;
            // timestamp to ignore click events immediately after dragging a rail
            this._lastRailDraggedAt = 0;
            this._lastEscapeAt = 0;
            this._lastConnectionClickAt = 0;
            this._saveTimeout = null;
            this._resizeTimeout = null;

            // History and undo/redo system
            this.historyStack = [];
            this.historyIndex = -1;
            this.maxHistorySize = 50;
            this.isUndoRedoOperation = false;

            // Grid system
            this.gridSize = 20;
            this.snapToGrid = true;
            
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
            this.initKeyboardShortcuts();
            this.loadInitialData();

            // Add direct double-click handler to SVG container as backup
            this.initDirectConnectionHandlers();

            // Show help tooltip for connection deletion
            this.showConnectionHelp();

            // Add resize listener for fullscreen changes
            window.addEventListener('resize', this.handleWindowResize.bind(this));
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
         * Initialize direct connection event handlers as backup for jsPlumb events.
         */
        initDirectConnectionHandlers() {
            // Add double-click handler directly to the editor container
            this.editor.addEventListener('dblclick', (e) => {
                // Check if the double-click was on a connection SVG element
                if (e.target && (e.target.classList.contains('jtk-connector') || e.target.closest('.jtk-connector'))) {

                    // Find the connection that was clicked
                    const connections = this.instance.getAllConnections();
                    let clickedConnection = null;

                    for (const conn of connections) {
                        try {
                            const connEl = conn.canvas || (conn.getConnector && conn.getConnector().canvas);
                            if (connEl && connEl.contains(e.target)) {
                                clickedConnection = conn;
                                break;
                            }
                        } catch (err) {
                            // Ignore errors when checking connection elements
                        }
                    }

                    if (clickedConnection) {
                        // Simulate the same deletion logic as the jsPlumb handler
                        const connId = clickedConnection._cardmap_id;
                        if (connId) {
                            this.pendingDeletes.add(connId);
                            this.mapData.connections = (this.mapData.connections || []).filter(c => c.id !== connId);

                            try {
                                this.instance.deleteConnection(clickedConnection);
                                this.saveMapData();
                                this.showToast('Connection deleted');
                            } catch (err) {
                                this.showToast('Error deleting connection');
                            }
                        }
                    } else {
                    }
                }
            });

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
                
                // Add context menu event to new connections
                this.addConnectionContextMenu(info.connection);
                
                this.saveMapData();
            });

            // Add hover effects for connections to indicate they can be double-clicked to delete
            this.instance.bind("connectionMouseover", (conn, originalEvent) => {
                try {
                    const connEl = conn.canvas || (conn.getConnector && conn.getConnector().canvas);
                    if (connEl) {
                        connEl.style.cursor = 'pointer';
                        connEl.classList.add('connection-hover');
                    }
                } catch (err) {
                    // Silently handle hover effect errors
                }
            });

            this.instance.bind("connectionMouseout", (conn, originalEvent) => {
                try {
                    const connEl = conn.canvas || (conn.getConnector && conn.getConnector().canvas);
                    if (connEl) {
                        connEl.style.cursor = '';
                        connEl.classList.remove('connection-hover');
                    }
                } catch (err) {
                    // Silently handle hover effect errors
                }
            });
            this.instance.bind('click', (conn, originalEvent) => {
                console.debug('jsPlumb connection clicked', { deleteMode: this.deleteConnectionMode, connId: conn && conn._cardmap_id });

                // Prevent single-click from interfering with double-click
                const now = Date.now();
                if (now - this._lastConnectionClickAt < 300) { // 300ms double-click window
                    return;
                }
                this._lastConnectionClickAt = now;

                if (this.deleteConnectionMode) {
                    const connId = conn._cardmap_id;
                    if (connId) {
                        this.pendingDeletes.add(connId);
                        // remove from mapData
                        this.mapData.connections = (this.mapData.connections || []).filter(c => c.id !== connId);
                        
                        // Save to history
                        this.saveToHistory(`Deleted connection ${connId}`);
                        
                        // remove connection from jsPlump canvas
                        try { this.instance.deleteConnection(conn); } catch (e) { try { conn.detach(); } catch (err) {} }
                        // update UI classes for remaining connections
                        this.updateDeleteConnectionUI();
                        // save changes
                        this.saveMapData();
                        this.showToast('Connection deleted');
                    }
                }
            });

            // double-clicking a connection will delete it immediately (user action)
            this.instance.bind('dblclick', (conn, originalEvent) => {
                try {

                    // Prevent interference from single-click handlers
                    if (originalEvent) {
                        originalEvent.preventDefault();
                        originalEvent.stopPropagation();
                    }

                    const connId = conn && conn._cardmap_id;
                    if (!connId) {
                        this.showToast('Error: Connection ID not found');
                        return;
                    }


                    // Mark for deletion in our data
                    this.pendingDeletes.add(connId);
                    const originalCount = this.mapData.connections.length;
                    this.mapData.connections = (this.mapData.connections || []).filter(c => c.id !== connId);
                    const newCount = this.mapData.connections.length;

                    // Save to history
                    this.saveToHistory(`Deleted connection ${connId}`);

                    // Delete the connection from jsPlumb with better error handling
                    let deleted = false;
                    try {
                        deleted = this.instance.deleteConnection(conn);
                    } catch (e) {
                        try {
                            conn.detach();
                            deleted = true;
                        } catch (detachErr) {
                            // Silently handle detach errors
                        }
                    }

                    if (deleted) {
                        this.saveMapData();
                        this.showToast('Connection deleted');
                    } else {
                        this.showToast('Error deleting connection');
                    }
                } catch (err) {
                    this.showToast('Error deleting connection');
                }
            });
        }

        /**
         * Sets up all DOM event listeners for the editor UI.
         */
        initEventListeners() {
            document.getElementById('undo-action').addEventListener('click', this.undo.bind(this));
            document.getElementById('redo-action').addEventListener('click', this.redo.bind(this));
            document.getElementById('history-toggle').addEventListener('click', this.toggleHistoryPanel.bind(this));
            document.getElementById('clear-history').addEventListener('click', this.clearHistory.bind(this));
            document.getElementById('add-node').addEventListener('click', this.addNode.bind(this));
            document.getElementById('add-rail').addEventListener('click', this.addRail.bind(this));
            // railSize input may be omitted if rail thickness is disabled in settings
            this.railSizeInput = document.getElementById('rail-size');
            if (this.railSizeInput) {
                this.railSizeInput.addEventListener('change', (e) => {
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
            }
            document.getElementById('connect-mode').addEventListener('click', this.toggleConnectMode.bind(this));
            document.getElementById('delete-node').addEventListener('click', this.toggleDeleteMode.bind(this));
            const deleteConnBtn = document.getElementById('delete-connection');
            if (deleteConnBtn) deleteConnBtn.addEventListener('click', this.toggleDeleteConnectionMode.bind(this));
            document.getElementById('save-map').addEventListener('click', this.saveMapData.bind(this));
            document.getElementById('fullscreen-editor').addEventListener('click', this.toggleFullscreen.bind(this));

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

            // Global keyboard handling for pinning/unpinning rail settings (double Escape to pin)
            window.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' || e.key === 'Esc') {
                    const now = Date.now();
                    if (now - this._lastEscapeAt < 400) {
                        // Toggle pin state
                        this.railSettingsPinned = !this.railSettingsPinned;
                        // If unpinning, hide all settings
                        if (!this.railSettingsPinned) {
                            document.querySelectorAll('.rail-settings').forEach(s => s.style.display = 'none');
                        }
                    } else {
                        // single Escape: hide settings only if not pinned
                        if (!this.railSettingsPinned) {
                            document.querySelectorAll('.rail-settings').forEach(s => s.style.display = 'none');
                        }
                    }
                    this._lastEscapeAt = now;
                }
            });

            // Alignment controls removed
            const deleteRailBtn = document.getElementById('delete-rail');
            if (deleteRailBtn) deleteRailBtn.addEventListener('click', this.toggleDeleteRailMode.bind(this));

            // Auto-align button
            const autoAlignBtn = document.getElementById('auto-align-cards');
            if (autoAlignBtn) autoAlignBtn.addEventListener('click', this.autoAlignCards.bind(this));

            // Align on rail button
            const alignOnRailBtn = document.getElementById('align-on-rail');
            if (alignOnRailBtn) alignOnRailBtn.addEventListener('click', this.alignCardsOnRail.bind(this));

            // Prevent default context menu on editor wrapper to allow connection context menu
            this.editorWrapper.addEventListener('contextmenu', (e) => {
                // Only prevent if this is likely a connection right-click
                const target = e.target;
                if (target && (target.tagName === 'svg' || target.closest('svg') || target.classList.contains('_jsPlumb_connector'))) {
                    e.preventDefault();
                }
            });

            // note: connection click/dblclick handlers are registered in initJsPlumb()
        }

        /**
         * Initializes keyboard shortcuts for the editor.
         */
        initKeyboardShortcuts() {
            document.addEventListener('keydown', (e) => {
                // Don't interfere with input fields or contenteditable elements
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' ||
                    e.target.contentEditable === 'true') {
                    return;
                }

                // Ctrl+Z - Undo
                if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                    e.preventDefault();
                    this.undo();
                    return;
                }

                // Ctrl+Y - Redo
                if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
                    e.preventDefault();
                    this.redo();
                    return;
                }

                // Delete key - Delete selected nodes
                if (e.key === 'Delete' && this.selectedNodes.size > 0) {
                    e.preventDefault();
                    this.deleteSelectedNodes();
                    return;
                }

                // Arrow keys - Nudge selected nodes
                if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                    e.preventDefault();
                    this.nudgeSelectedNodes(e.key, e.shiftKey ? 10 : 1); // Shift+arrow for larger movement
                    return;
                }

                // Escape key - Deselect all
                if (e.key === 'Escape') {
                    e.preventDefault();
                    this.deselectAllNodes();
                    this.connectMode = false;
                    this.deleteMode = false;
                    this.deleteRailMode = false;
                    this.deleteConnectionMode = false;
                    document.getElementById('connect-mode').classList.remove('button-primary');
                    document.getElementById('delete-node').classList.remove('button-primary');
                    this.editor.style.cursor = 'grab';
                    return;
                }
            });
        }

        /**
         * Saves current state to history for undo/redo functionality.
         */
        saveToHistory(action = 'Unknown action') {
            if (this.isUndoRedoOperation) return; // Don't save history during undo/redo operations

            // Create a deep copy of current state
            const state = {
                nodes: JSON.parse(JSON.stringify(this.mapData.nodes || [])),
                connections: JSON.parse(JSON.stringify(this.mapData.connections || [])),
                rails: JSON.parse(JSON.stringify(this.mapData.rails || [])),
                action: action,
                timestamp: Date.now()
            };

            // Remove any history after current index (when user made new changes after undo)
            if (this.historyIndex < this.historyStack.length - 1) {
                this.historyStack = this.historyStack.slice(0, this.historyIndex + 1);
            }

            // Add new state
            this.historyStack.push(state);
            this.historyIndex++;

            // Limit history size
            if (this.historyStack.length > this.maxHistorySize) {
                this.historyStack.shift();
                this.historyIndex--;
            }

            this.updateHistoryUI();
        }

        /**
         * Restores the editor state from history.
         */
        restoreFromHistory(state) {
            this.isUndoRedoOperation = true;

            try {
                // Clear current elements
                this.instance.reset();

                // Restore nodes
                this.mapData.nodes = JSON.parse(JSON.stringify(state.nodes));
                state.nodes.forEach(node => this.renderNode(node));

                // Restore rails
                this.mapData.rails = JSON.parse(JSON.stringify(state.rails));
                state.rails.forEach(rail => this.renderRail(rail));

                // Restore connections
                this.mapData.connections = JSON.parse(JSON.stringify(state.connections));
                state.connections.forEach(conn => {
                    if (!conn || !conn.source || !conn.target) return;

                    const sourceEl = document.getElementById(conn.source);
                    const targetEl = document.getElementById(conn.target);
                    if (!sourceEl || !targetEl) return;

                    const config = this.getConnectorConfig(conn.style || 'normal');
                    const connection = this.instance.connect({
                        source: conn.source,
                        target: conn.target,
                        anchors: conn.anchors || this.computeAnchorsBetweenElements(sourceEl, targetEl),
                        ...config,
                        cssClass: 'cardmap-connector'
                    });

                    if (connection) {
                        connection._cardmap_id = conn.id || `conn_${Date.now()}_${Math.floor(Math.random()*10000)}`;
                        this.addConnectionContextMenu(connection);
                    }
                });

                this.instance.repaintEverything();

            } catch (error) {
                console.error('Error restoring from history:', error);
                this.showToast('Error restoring state');
            } finally {
                this.isUndoRedoOperation = false;
            }
        }

        /**
         * Undo the last action.
         */
        undo() {
            if (this.historyIndex > 0) {
                this.historyIndex--;
                const previousState = this.historyStack[this.historyIndex];
                this.restoreFromHistory(previousState);
                this.showToast(`Undid: ${previousState.action}`);
                this.updateHistoryUI();
            } else {
                this.showToast('Nothing to undo');
            }
        }

        /**
         * Redo the next action.
         */
        redo() {
            if (this.historyIndex < this.historyStack.length - 1) {
                this.historyIndex++;
                const nextState = this.historyStack[this.historyIndex];
                this.restoreFromHistory(nextState);
                this.showToast(`Redid: ${nextState.action}`);
                this.updateHistoryUI();
            } else {
                this.showToast('Nothing to redo');
            }
        }

        /**
         * Updates the undo/redo button states and history panel.
         */
        updateHistoryUI() {
            const undoBtn = document.getElementById('undo-action');
            const redoBtn = document.getElementById('redo-action');
            
            // Update button states
            undoBtn.disabled = this.historyIndex <= 0;
            redoBtn.disabled = this.historyIndex >= this.historyStack.length - 1;
            
            // Update history panel if it's visible
            const historyPanel = document.getElementById('history-panel');
            if (historyPanel && historyPanel.style.display !== 'none') {
                this.updateHistoryPanel();
            }
        }

        /**
         * Toggles the history panel visibility.
         */
        toggleHistoryPanel() {
            const historyPanel = document.getElementById('history-panel');
            if (historyPanel.style.display === 'none' || historyPanel.style.display === '') {
                historyPanel.style.display = 'block';
                this.updateHistoryPanel();
                
                // Close panel when clicking outside
                setTimeout(() => {
                    document.addEventListener('click', this.closeHistoryPanelOutside.bind(this));
                }, 100);
            } else {
                historyPanel.style.display = 'none';
                document.removeEventListener('click', this.closeHistoryPanelOutside.bind(this));
            }
        }

        /**
         * Closes history panel when clicking outside.
         */
        closeHistoryPanelOutside(e) {
            const historyDropdown = e.target.closest('.cardmap-history-dropdown');
            if (!historyDropdown) {
                const historyPanel = document.getElementById('history-panel');
                historyPanel.style.display = 'none';
                document.removeEventListener('click', this.closeHistoryPanelOutside.bind(this));
            }
        }

        /**
         * Updates the history panel content.
         */
        updateHistoryPanel() {
            const historyList = document.getElementById('history-list');
            
            if (this.historyStack.length === 0) {
                historyList.innerHTML = '<div class="history-empty">No history available</div>';
                return;
            }

            let html = '';
            this.historyStack.forEach((state, index) => {
                const isCurrent = index === this.historyIndex;
                const isFuture = index > this.historyIndex;
                const time = new Date(state.timestamp).toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                });
                
                html += `
                    <div class="history-item ${isCurrent ? 'current' : ''} ${isFuture ? 'future' : ''}" 
                         data-index="${index}">
                        <div class="history-item-content">
                            <div class="history-item-action">${state.action}</div>
                            <div class="history-item-time">${time}</div>
                        </div>
                        <div class="history-item-index">${index + 1}</div>
                    </div>
                `;
            });
            
            historyList.innerHTML = html;
            
            // Add click handlers for history items
            historyList.querySelectorAll('.history-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    const targetIndex = parseInt(e.currentTarget.dataset.index);
                    this.goToHistoryIndex(targetIndex);
                });
            });
        }

        /**
         * Go to a specific history index.
         */
        goToHistoryIndex(targetIndex) {
            if (targetIndex < 0 || targetIndex >= this.historyStack.length) return;
            
            this.historyIndex = targetIndex;
            const state = this.historyStack[targetIndex];
            this.restoreFromHistory(state);
            this.showToast(`Jumped to: ${state.action}`);
            this.updateHistoryUI();
        }

        /**
         * Clears the entire history.
         */
        clearHistory() {
            if (confirm('Are you sure you want to clear the entire history? This cannot be undone.')) {
                this.historyStack = [];
                this.historyIndex = -1;
                this.updateHistoryUI();
                this.showToast('History cleared');
                document.getElementById('history-panel').style.display = 'none';
            }
        }

        /**
         * Deletes all selected nodes.
         */
        deleteSelectedNodes() {
            if (this.selectedNodes.size === 0) return;

            this.saveToHistory(`Deleted ${this.selectedNodes.size} node(s)`);

            this.selectedNodes.forEach(nodeId => {
                const nodeEl = document.getElementById(nodeId);
                if (nodeEl) {
                    this.instance.remove(nodeEl);
                    this.mapData.nodes = this.mapData.nodes.filter(n => n.id !== nodeId);
                    this.mapData.connections = (this.mapData.connections || []).filter(c =>
                        c.source !== nodeId && c.target !== nodeId
                    );
                }
            });

            this.selectedNodes.clear();
            this.saveMapData();
            this.showToast(`Deleted ${this.selectedNodes.size} node(s)`);
        }

        /**
         * Nudges selected nodes by a given amount.
         */
        nudgeSelectedNodes(direction, distance) {
            if (this.selectedNodes.size === 0) return;

            this.saveToHistory(`Nudged ${this.selectedNodes.size} node(s)`);

            let deltaX = 0, deltaY = 0;
            switch (direction) {
                case 'ArrowUp': deltaY = -distance; break;
                case 'ArrowDown': deltaY = distance; break;
                case 'ArrowLeft': deltaX = -distance; break;
                case 'ArrowRight': deltaX = distance; break;
            }

            this.selectedNodes.forEach(nodeId => {
                const nodeData = this.mapData.nodes.find(n => n.id === nodeId);
                const nodeEl = document.getElementById(nodeId);
                if (nodeData && nodeEl) {
                    nodeData.x = nodeData.x + deltaX;
                    nodeData.y = nodeData.y + deltaY;

                    nodeEl.style.left = `${nodeData.x}px`;
                    nodeEl.style.top = `${nodeData.y}px`;
                }
            });

            this.instance.repaintEverything();
            this.saveMapData();
        }

        /**
         * Toggles grid snap functionality.
         */
        toggleGridSnap() {
            this.snapToGrid = !this.snapToGrid;
            this.showToast(`Grid snap ${this.snapToGrid ? 'enabled' : 'disabled'}`);

            // Update visual indicator
            this.editor.classList.toggle('grid-snap-enabled', this.snapToGrid);

            // If turning on grid snap, snap all selected nodes to grid
            if (this.snapToGrid && this.selectedNodes.size > 0) {
                this.snapSelectedNodesToGrid();
            }
        }

        /**
         * Handles window resize events (fullscreen, etc.).
         */
        handleWindowResize() {
            // Debounce resize updates if needed in the future
        }

        /**
         * Snaps selected nodes to the grid.
         */
        snapSelectedNodesToGrid() {
            this.selectedNodes.forEach(nodeId => {
                const nodeData = this.mapData.nodes.find(n => n.id === nodeId);
                const nodeEl = document.getElementById(nodeId);
                if (nodeData && nodeEl) {
                    nodeData.x = Math.round(nodeData.x / this.gridSize) * this.gridSize;
                    nodeData.y = Math.round(nodeData.y / this.gridSize) * this.gridSize;
                    nodeEl.style.left = `${nodeData.x}px`;
                    nodeEl.style.top = `${nodeData.y}px`;
                }
            });
            this.instance.repaintEverything();
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
            // Also log rail appearance properties if present
            
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

                    // Get connection style priority: connection's own style > source's style > target's style > global default
                    let connStyle = c.style;
                    if (!connStyle) {
                        const sourceNodeData = this.mapData.nodes.find(n => n.id === c.source) || {};
                        const targetNodeData = this.mapData.nodes.find(n => n.id === c.target) || {};
                        const sourceRailData = this.mapData.rails.find(r => r.id === c.source) || {};
                        const targetRailData = this.mapData.rails.find(r => r.id === c.target) || {};
                        connStyle = sourceNodeData.connectionStyle || sourceRailData.connectionStyle || targetNodeData.connectionStyle || targetRailData.connectionStyle || this.config.lineStyle || 'normal';
                    }
                    const config = this.getConnectorConfig(connStyle);
                    
                    // normalize saved anchors: allow {type:'precise',value:[x,y,ox,oy]} entries
                    let anchors = null;
                    if (Array.isArray(c.anchors)) {
                        anchors = c.anchors.map(a => {
                            if (a && typeof a === 'object' && a.type === 'precise' && Array.isArray(a.value)) return a.value;
                            return a;
                        });
                    }
                    if (!anchors) {
                        anchors = c.anchors || this.computeAnchorsBetweenElements(sourceEl, targetEl);
                    }

                    const conn = this.instance.connect({
                        source: c.source,
                        target: c.target,
                        anchors: anchors,
                        ...config,
                        cssClass: 'cardmap-connector'
                    });
                    if (conn) {
                        conn._cardmap_id = c.id || `conn_${Date.now()}_${Math.floor(Math.random()*10000)}`;
                        this.addConnectionContextMenu(conn);
                    }
                });
            });
            
            // Save initial state to history after loading
            setTimeout(() => {
                this.saveToHistory('Initial state');
                this.updateHistoryUI();
            }, 200);
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
                    <button class="button button-primary edit-image" type="button">
                        <span class="dashicons dashicons-format-image" style="font-size: 16px; margin-top: 4px;"></span>
                        Select Image
                    </button>
                    <button class="button duplicate-card" type="button" title="Duplicate this card">
                        <span class="dashicons dashicons-admin-page"></span>
                        Duplicate Card
                    </button>
                    <label>Card Link</label>
                    <input class="card-link-input" placeholder="https://example.com" value="${ n.link || '' }" />
                    <label>Link Target</label>
                    <select class="card-link-target">
                        <option value="_self" ${ !n.target || n.target === '_self' ? 'selected' : '' }>Same Window</option>
                        <option value="_blank" ${ n.target === '_blank' ? 'selected' : '' }>New Window</option>
                    </select>
                    <label>Card Style</label>
                    <select class="card-node-style">${styleOptions}</select>
                    <label>Connection Style</label>
                    <select class="card-connection-style">
                        ${ Object.keys(this.config.availableLineStyles).map(k => `<option value="${k}">${this.config.availableLineStyles[k]}</option>` ).join('') }
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

            // Duplicate card button
            node.querySelector('.duplicate-card').addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                this.duplicateCard(node.id);
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
                // Set initial value - use saved connectionStyle or fall back to global default
                
                const initialValue = nodeData.connectionStyle || this.config.lineStyle;
                connStyleSelect.value = initialValue;
                
                connStyleSelect.addEventListener('change', (e) => {

                    nodeData.connectionStyle = connStyleSelect.value;

                    // Update existing connections that involve this node (both as source and target)
                    const sourceConns = this.instance.getConnections({ source: node.id });
                    const targetConns = this.instance.getConnections({ target: node.id });

                    let updatedConnections = 0;

                    // Update connections where this node is the source
                    sourceConns.forEach(c => {
                        const newStyle = nodeData.connectionStyle || this.config.lineStyle;
                        const config = this.getConnectorConfig(newStyle);
                        try {
                            c.setPaintStyle && c.setPaintStyle(config.paintStyle);
                            if (config.connector) c.setConnector && c.setConnector(config.connector);

                            // Update overlays (arrows, etc.)
                            c.removeAllOverlays && c.removeAllOverlays();
                            if (config.overlays && Array.isArray(config.overlays)) {
                                config.overlays.forEach(overlay => c.addOverlay && c.addOverlay(overlay));
                            }

                            // Update the mapData to reflect the style change
                            const connData = this.mapData.connections.find(conn => conn.id === c._cardmap_id);
                            if (connData) {
                                connData.style = newStyle;
                            }
                            updatedConnections++;
                        } catch (err) {
                            console.error('Error updating SOURCE connection style:', err);
                        }
                    });

                    // Update connections where this node is the target (only if target node doesn't have its own style)
                    targetConns.forEach(c => {
                        const sourceNodeId = c.sourceId;
                        const sourceNodeData = this.mapData.nodes.find(n => n.id === sourceNodeId) || {};
                        // Only update if the source node doesn't have its own connection style
                        if (!sourceNodeData.connectionStyle) {
                            const newStyle = nodeData.connectionStyle || this.config.lineStyle;
                            const config = this.getConnectorConfig(newStyle);
                            try {
                                c.setPaintStyle && c.setPaintStyle(config.paintStyle);
                                if (config.connector) c.setConnector && c.setConnector(config.connector);

                                // Update overlays (arrows, etc.)
                                c.removeAllOverlays && c.removeAllOverlays();
                                if (config.overlays && Array.isArray(config.overlays)) {
                                    config.overlays.forEach(overlay => c.addOverlay && c.addOverlay(overlay));
                                }

                                // Update the mapData to reflect the style change
                                const connData = this.mapData.connections.find(conn => conn.id === c._cardmap_id);
                                if (connData) connData.style = newStyle;
                                updatedConnections++;
                            } catch (err) {
                                console.error('Error updating TARGET connection style:', err);
                            }
                        }
                    });

                    // Force repaint to ensure visual changes are applied
                    this.instance.repaintEverything();

                    // Show user feedback
                    this.showToast(`Connection style updated to: ${this.config.availableLineStyles[connStyleSelect.value]}`);

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
         * Opens the node inspector (settings panel) for the given node.
         * @param {HTMLElement} node The node element.
         */
        openNodeInspector(node) {
            node.classList.toggle('settings-visible');
        }

        /**
         * Handles the start of a node drag operation.
         */
        onNodeDragStart(params) {
            const connections = this.instance.getConnections({ source: params.el.id }).concat(this.instance.getConnections({ target: params.el.id }));
            connections.forEach(conn => {
                // Store original anchors at the start of any drag
                // Store original anchors safely
                try {
                    conn._originalAnchors = conn.getAnchors ? conn.getAnchors() : conn.anchors;
                } catch (e) {
                    conn._originalAnchors = conn.anchors || ['Continuous', 'Continuous'];
                }
            });
        }

        /**
         * Handles the dragging of a node, including rail snapping previews.
         */
        onNodeDrag(params) {
            this.instance.repaintEverything();
            const node = params.el;
            const draggedNode = this.mapData.nodes.find(n => n.id === node.id);

            // Update connections dynamically as the node moves
            const connections = this.instance.getConnections({ source: node.id }).concat(this.instance.getConnections({ target: node.id }));
            
            connections.forEach(conn => {
                try {
                    const sourceEl = document.getElementById(conn.sourceId);
                    const targetEl = document.getElementById(conn.targetId);
                    
                    if (!sourceEl || !targetEl) return;
                    
                    const sourceIsRail = sourceEl.classList.contains('cardmap-rail');
                    const targetIsRail = targetEl.classList.contains('cardmap-rail');
                    
                    // If connected to a rail, calculate dynamic anchor position on the rail
                    if (sourceIsRail || targetIsRail) {
                        const railEl = sourceIsRail ? sourceEl : targetEl;
                        const nodeEl = sourceIsRail ? targetEl : sourceEl;
                        const railData = this.mapData.rails.find(r => r.id === railEl.id);
                        
                        if (railData) {
                            // Calculate the best anchor point on the rail based on node position
                            const nodeRect = nodeEl.getBoundingClientRect();
                            const railRect = railEl.getBoundingClientRect();
                            const editorRect = this.editor.getBoundingClientRect();
                            
                            // Convert to editor coordinates
                            const nodeCenterX = (nodeRect.left + nodeRect.right) / 2 - editorRect.left;
                            const nodeCenterY = (nodeRect.top + nodeRect.bottom) / 2 - editorRect.top;
                            const railLeft = railRect.left - editorRect.left;
                            const railTop = railRect.top - editorRect.top;
                            
                            let railAnchor;
                            
                            if (railData.orientation === 'vertical') {
                                // For vertical rails, calculate Y position along the rail
                                const relativeY = Math.max(0, Math.min(1, (nodeCenterY - railTop) / railRect.height));
                                railAnchor = [0.5, relativeY, 0, 0]; // Center X, dynamic Y
                            } else {
                                // For horizontal rails, calculate X position along the rail
                                const relativeX = Math.max(0, Math.min(1, (nodeCenterX - railLeft) / railRect.width));
                                railAnchor = [relativeX, 0.5, 0, 0]; // Dynamic X, center Y
                            }
                            
                            // Determine which anchor to update (source or target)
                            if (sourceIsRail) {
                                const targetAnchor = this.getDirectionalAnchors(targetEl, sourceEl)[0];
                                conn.setAnchors([railAnchor, targetAnchor]);
                            } else {
                                const sourceAnchor = this.getDirectionalAnchors(sourceEl, targetEl)[0];
                                conn.setAnchors([sourceAnchor, railAnchor]);
                            }
                        }
                    } else if (draggedNode && draggedNode.attachedRail) {
                        // If the node is on a rail, use simplified anchors
                        const rail = this.mapData.rails.find(r => r.id === draggedNode.attachedRail);
                        if (rail) {
                            const simpleAnchors = rail.orientation === 'vertical' ? ["LeftMiddle", "RightMiddle"] : ["TopCenter", "BottomCenter"];
                            conn.setAnchors(simpleAnchors);
                        }
                    }
                } catch (e) {
                    console.warn('Could not update anchors during drag:', e);
                }
            });

            const rails = this.mapData.rails || [];
            let nearest = null;
            let bestDist = Infinity;
            const elLeft = parseFloat(node.style.left) || 0;
            const elTop = parseFloat(node.style.top) || 0;
            const elCenterX = elLeft + (node.offsetWidth || 192) / 2;
            const elCenterY = elTop + (node.offsetHeight || 240) / 2;

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
                        const nodeCenterY = draggedNode.y + (params.el.offsetHeight || 240) / 2;
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
                        const nodeCenterX = draggedNode.x + (params.el.offsetWidth || 192) / 2;
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
                    connections.forEach(c => {
                        try {
                            if (c.setAnchors) {
                                c.setAnchors(anchors);
                            }
                        } catch (e) {
                            console.warn('Could not set anchors:', e);
                        }
                    });

                } else {
                    delete draggedNode.attachedRail;
                    // Restore original or directional anchors when not on a rail
                    connections.forEach(conn => {
                        if (conn._originalAnchors) {
                            try {
                                try {
                                    if (conn.setAnchors && conn._originalAnchors) {
                                        conn.setAnchors(conn._originalAnchors);
                                    }
                                } catch (e) {
                                    console.warn('Could not restore anchors:', e);
                                }
                            } catch (e) {
                                console.warn('Could not restore anchors:', e);
                            }
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
            if (this.deleteConnectionMode) {
                this.handleDeleteConnectionClick(e, node);
                return;
            }
            if (this.connectMode) {
                this.handleConnectionClick(e, node);
            } else if (this.deleteMode) {
                this.deleteNode(node);
            } else {
                this.handleSelectionClick(e, node);
            }
        }

        /** Handle node clicks when in delete-connection mode */
        handleDeleteConnectionClick(e, node) {
            if (!this.deleteConnectionFirstNode) {
                this.deleteConnectionFirstNode = node;
                node.style.boxShadow = '0 0 0 3px rgba(200,30,30,0.5)';
                return;
            }

            // if clicked same node, clear selection
            if (this.deleteConnectionFirstNode === node) {
                this.deleteConnectionFirstNode.style.boxShadow = '';
                this.deleteConnectionFirstNode = null;
                return;
            }

            const sourceId = this.deleteConnectionFirstNode.id;
            const targetId = node.id;

            // find matching connection(s)
            const conns = (this.mapData.connections || []).filter(c =>
                !this.pendingDeletes.has(c.id) && ((c.source === sourceId && c.target === targetId) || (c.source === targetId && c.target === sourceId))
            );

            if (conns.length === 0) {
                this.showToast('No connection between these cards.');
                this.deleteConnectionFirstNode.style.boxShadow = '';
                this.deleteConnectionFirstNode = null;
                return;
            }

            // delete found connections
            conns.forEach(c => {
                this.pendingDeletes.add(c.id);
                try { const jsConn = this.instance.getConnections({ source: c.source, target: c.target })[0]; if (jsConn) this.instance.deleteConnection(jsConn); } catch (err) {}
            });

            // remove from mapData
            this.mapData.connections = (this.mapData.connections || []).filter(c => !this.pendingDeletes.has(c.id));
            this.saveMapData();

            this.deleteConnectionFirstNode.style.boxShadow = '';
            this.deleteConnectionFirstNode = null;
        }

        /** Convert screen event to world coordinates inside the editor */
        getWorldCoordsFromEvent(e) {
            if (!this.editorWrapper) {
                return { x: e.clientX, y: e.clientY };
            }
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

            // If not in connect mode, select the rail and show settings only after two clicks
            if (!this.connectMode) {
                this.selectRail(railEl.id);
                const now = Date.now();
                if (this._lastRailClickedId === railEl.id && (now - this._lastRailClickAt) < 400) {
                    // second quick click -> toggle settings visibility (respect pin)
                    const settings = railEl.querySelector('.rail-settings');
                    if (settings) {
                        if (settings.style.display === 'block') {
                            if (!this.railSettingsPinned) settings.style.display = 'none';
                        } else {
                            this.positionRailSettings(railEl, settings, railData);
                            settings.style.display = 'block';
                        }
                    }
                    this._lastRailClickedId = null;
                    this._lastRailClickAt = 0;
                } else {
                    // record this as first click and await a potential second
                    this._lastRailClickedId = railEl.id;
                    this._lastRailClickAt = now;
                    setTimeout(() => {
                        // clear after timeout if no second click
                        if (this._lastRailClickedId === railEl.id) {
                            this._lastRailClickedId = null;
                        }
                    }, 450);
                }
                return;
            }

            // In connect mode: treat a rail click similarly to a node click
                // Ignore clicks that happen immediately after a rail drag to avoid accidental auto-connections
                if (Date.now() - (this._lastRailDraggedAt || 0) < 300) {
                    // just clear selection and bail
                    this.selectRail(railEl.id);
                    return;
                }

                if (!this.firstNode) {
                // Use rail element as firstNode
                this.firstNode = railEl;
                // Use the same coordinate system as nodes for consistency
                this.firstAnchor = this.getPreciseAnchorFromEvent(e, railEl);
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
                const [a, b] = this.computeAnchorsBetweenElements(this.firstNode, railEl, null, e);
                anchorA = this.firstAnchor || a;
                anchorB = this.firstAnchor ? (b || this.getRailAnchorFromEvent(e, railEl, railData)) : b;

                // choose connection style: prefer source's connectionStyle then target's then global
                const sourceNodeData = this.mapData.nodes.find(n => n.id === sourceId) || {};
                const targetNodeData = this.mapData.nodes.find(n => n.id === targetId) || {};
                const sourceRailData = this.mapData.rails.find(r => r.id === sourceId) || {};
                const targetRailData = this.mapData.rails.find(r => r.id === targetId) || {};
                const connStyle = sourceNodeData.connectionStyle || sourceRailData.connectionStyle || targetNodeData.connectionStyle || targetRailData.connectionStyle || this.config.lineStyle;
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
                    this.addConnectionContextMenu(conn);
                    try { conn.setParameter && conn.setParameter('user-driven', true); } catch(e) {}
                }
                // store anchors; convert precise arrays to a serializable representation
                const savedAnchors = [
                    (Array.isArray(anchorA) ? { type: 'precise', value: anchorA } : anchorA),
                    (Array.isArray(anchorB) ? { type: 'precise', value: anchorB } : anchorB)
                ];
                this.mapData.connections.push({ id: newId, source: sourceId, target: targetId, style: connStyle, anchors: savedAnchors });

                // Save to history
                this.saveToHistory(`Connected ${sourceId} to ${targetId}`);

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
            
            try {
                // Use precise anchor calculation for exact positioning on rails
                const preciseAnchor = this.getPreciseRailAnchorArray(railEl, e.clientX, e.clientY);
                if (preciseAnchor && Array.isArray(preciseAnchor)) {
                    return preciseAnchor;
                }
            } catch (err) {
                console.warn('Failed to get precise rail anchor, falling back to positional:', err);
            }
            
            // Fallback to positional anchoring
            const rect = railEl.getBoundingClientRect();
            const localX = e.clientX - rect.left;
            const localY = e.clientY - rect.top;
            
            if (railData.orientation === 'vertical') {
                // For vertical rails, fix X to center (0.5) and keep Y precise where clicked
                const relY = Math.max(0, Math.min(1, localY / rect.height));
                return [0.5, relY, 0, 0];
            } else if (railData.orientation === 'horizontal') {
                // For horizontal rails, fix Y to center (0.5) and keep X precise where clicked
                const relX = Math.max(0, Math.min(1, localX / rect.width));
                return [relX, 0.5, 0, 0];
            }
            
            // For diagonal or unknown orientation, use precise positioning
            const relX = Math.max(0, Math.min(1, localX / rect.width));
            const relY = Math.max(0, Math.min(1, localY / rect.height));
            return [relX, relY, 0, 0];
        }

        /** Return a precise relative anchor array for a rail element given client coords */
        getPreciseRailAnchorArray(railEl, clientX, clientY) {
            if (!railEl) return null;

            try {
                // Convert client coordinates to world coordinates using the same method as other functions
                const worldCoords = this.screenToWorld(clientX, clientY);
                if (!worldCoords) {
                    throw new Error('Failed to convert screen coordinates to world coordinates');
                }
                
                // Get the rail data to get its world position and dimensions
                const railId = railEl.id;
                const railData = this.mapData.rails.find(r => r.id === railId);
                if (!railData) {
                    console.warn('Rail data not found for element:', railId);
                    return [0.5, 0.5, 0, 0];
                }

                // Validate required rail data properties
                if (typeof railData.x !== 'number' || typeof railData.y !== 'number') {
                    throw new Error(`Invalid rail position: x=${railData.x}, y=${railData.y}`);
                }

                // Get rail dimensions with fallbacks
                const railWidth = railData.width || 
                    (railData.orientation === 'vertical' ? (railData.size || 8) : 300);
                const railHeight = railData.height || 
                    (railData.orientation === 'horizontal' ? (railData.size || 8) : 300);

                if (railWidth <= 0 || railHeight <= 0) {
                    throw new Error(`Invalid rail dimensions: width=${railWidth}, height=${railHeight}`);
                }

                // Calculate position relative to rail's world position
                let relX = (worldCoords.x - railData.x) / railWidth;
                let relY = (worldCoords.y - railData.y) / railHeight;

                // Clamp to element bounds
                relX = Math.max(0, Math.min(1, relX));
                relY = Math.max(0, Math.min(1, relY));

                // jsPlumb accepts [x, y, ox, oy] anchor arrays where x,y are relative (0-1)
                return [relX, relY, 0, 0];
            } catch (error) {
                console.error('Error in getPreciseRailAnchorArray:', {
                    error: error.message,
                    railEl: railEl?.id,
                    clientX, 
                    clientY,
                    railData: railData ? {id: railData.id, x: railData.x, y: railData.y, orientation: railData.orientation} : 'null',
                    worldCoords: worldCoords
                });
                return [0.5, 0.5, 0, 0]; // Fallback to center of rail
            }
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

            const preview = railEl.querySelector('.rail-anchor-preview');
            if (!preview) return;

            try {
                // Get rail element's bounding rectangle in screen coordinates
                const railRect = railEl.getBoundingClientRect();

                // Calculate position relative to rail element
                const localX = e.clientX - railRect.left;
                const localY = e.clientY - railRect.top;

                preview.style.display = 'block';
                preview.style.position = 'absolute';
                preview.style.width = '10px';
                preview.style.height = '10px';
                preview.style.background = '#fff';
                preview.style.border = '2px solid #A61832';
                preview.style.borderRadius = '50%';
                preview.style.pointerEvents = 'none';

                if (railData.orientation === 'vertical') {
                    preview.style.left = `${(railRect.width/2) - 5}px`;
                    preview.style.top = `${localY - 5}px`;
                } else {
                    preview.style.left = `${localX - 5}px`;
                    preview.style.top = `${(railRect.height/2) - 5}px`;
                }

                // store last hover position for precise anchor use later
                this._lastRailHover = { railId, clientX: e.clientX, clientY: e.clientY };
            } catch (error) {
                console.warn('Error positioning rail anchor preview:', error);
                // Fallback positioning
                if (railData.orientation === 'vertical') {
                    preview.style.left = `${(railEl.offsetWidth/2) - 5}px`;
                    preview.style.top = '50%';
                } else {
                    preview.style.left = '50%';
                    preview.style.top = `${(railEl.offsetHeight/2) - 5}px`;
                }
                preview.style.display = 'block';
            }
        }

        /** Fallback default anchor for an element (node or rail) */
        getDefaultAnchorForElement(el) {
            if (!el) return 'RightMiddle';
            
            if (el.classList.contains('cardmap-rail')) {
                const railData = this.mapData.rails.find(r => r.id === el.id);
                if (railData) {
                    // Use appropriate anchor based on rail orientation
                    if (railData.orientation === 'vertical') {
                        return 'RightMiddle';
                    } else if (railData.orientation === 'horizontal') {
                        return 'BottomCenter';
                    }
                }
                // Fallback based on class if no data found
                if (el.classList.contains('vertical')) return 'RightMiddle';
                return 'BottomCenter';
            }
            
            // For cards/nodes, use right side as default (most common connection direction)
            return 'RightMiddle';
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
            try {

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

                    // determine anchors, preferring precise coordinates
                    let anchorA = null;
                    let anchorB = null;

                    const [a, b] = this.computeAnchorsBetweenElements(this.firstNode, node, null, e);
                    anchorA = this.firstAnchor || a;
                    anchorB = b;


                    const sourceNodeData = this.mapData.nodes.find(n => n.id === sourceId) || {};
                    const targetNodeData = this.mapData.nodes.find(n => n.id === targetId) || {};
                    const sourceRailData = this.mapData.rails.find(r => r.id === sourceId) || {};
                    const targetRailData = this.mapData.rails.find(r => r.id === targetId) || {};
                    const connStyle = sourceNodeData.connectionStyle || sourceRailData.connectionStyle || targetNodeData.connectionStyle || targetRailData.connectionStyle || this.config.lineStyle;

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
                        this.addConnectionContextMenu(conn);
                        try { conn.setParameter && conn.setParameter('user-driven', true); } catch(e) {}
                    }
                    const savedAnchors = [
                        (Array.isArray(anchorA) ? { type: 'precise', value: anchorA } : anchorA),
                        (Array.isArray(anchorB) ? { type: 'precise', value: anchorB } : anchorB)
                    ];
                    this.mapData.connections.push({ id: newId, source: sourceId, target: targetId, style: connStyle, anchors: savedAnchors });

                    // Save to history
                    this.saveToHistory(`Connected ${sourceId} to ${targetId}`);

                    // force an immediate repaint so anchors/paths are calculated correctly
                    try { this.instance.repaintEverything(); } catch (e) {}

                    this.firstNode.style.boxShadow = '';
                    this.firstNode = null;
                    this.firstAnchor = null;
                }

            } catch (error) {
                console.error('Error in handleConnectionClick:', error);
                this.showToast('Error creating connection: ' + error.message);
                // Reset connection state on error
                if (this.firstNode) {
                    this.firstNode.style.boxShadow = '';
                    this.firstNode = null;
                    this.firstAnchor = null;
                }
            }
        }

        /**
         * Deletes a node and its connections.
         */
        deleteNode(node) {
            this.saveToHistory(`Deleted node: ${node.id}`);
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
            this.saveToHistory('Added node');
        }

        /**
         * Duplicates a card/node with all its properties.
         * @param {string} nodeId The ID of the node to duplicate.
         */
        duplicateCard(nodeId) {
            // Find the original node data
            const originalNode = this.mapData.nodes.find(n => n.id === nodeId);
            if (!originalNode) {
                this.showToast('Card not found!', 'error');
                return;
            }

            // Create a new unique ID
            const newId = `node_${Date.now()}`;

            // Create a deep copy of the node with a new ID and offset position
            const duplicatedNode = {
                ...originalNode,
                id: newId,
                x: originalNode.x + 50, // Offset by 50px right
                y: originalNode.y + 50, // Offset by 50px down
            };

            // Add to map data
            this.mapData.nodes.push(duplicatedNode);

            // Render the new node
            this.renderNode(duplicatedNode);

            // Copy connections from the original node (optional - keeps connections)
            const originalConnections = this.mapData.connections.filter(
                c => c.source === nodeId || c.target === nodeId
            );

            originalConnections.forEach(conn => {
                const newConnId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                const newConn = {
                    ...conn,
                    id: newConnId,
                    source: conn.source === nodeId ? newId : conn.source,
                    target: conn.target === nodeId ? newId : conn.target,
                };

                this.mapData.connections.push(newConn);

                // Render the connection
                setTimeout(() => {
                    const sourceEl = document.getElementById(newConn.source);
                    const targetEl = document.getElementById(newConn.target);
                    
                    if (sourceEl && targetEl) {
                        const style = newConn.style || this.config.lineStyle;
                        const config = this.getConnectorConfig(style);
                        
                        const connection = this.instance.connect({
                            source: sourceEl,
                            target: targetEl,
                            anchors: newConn.anchors || this.getDirectionalAnchors(sourceEl, targetEl),
                            ...config,
                            paintStyle: config.paintStyle
                        });

                        if (connection) {
                            connection._cardmap_id = newConnId;
                            this.addConnectionContextMenu(connection);
                        }
                    }
                }, 100);
            });

            // Save to history
            this.saveToHistory(`Duplicated card: ${originalNode.text || 'Untitled'}`);
            
            // Show success message
            this.showToast(`Card duplicated successfully!`, 'success');
            
            // Auto-save
            this.scheduleAutoSave();
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

                // The visible bar that represents rail thickness — can be hidden
                const railBar = document.createElement('div');
                railBar.className = 'rail-bar';
                railEl.appendChild(railBar);

                const resizer = document.createElement('div');
                // Add two resizers: one at the end and one at the start so user can resize from both corners
                const resizerStart = document.createElement('div');
                const resizerEnd = document.createElement('div');
                resizerStart.className = 'rail-resizer rail-resizer-start';
                resizerEnd.className = 'rail-resizer rail-resizer-end';
                railEl.appendChild(resizerStart);
                railEl.appendChild(resizerEnd);

                const bindResizerDown = (resizerEl, isStart) => {
                    resizerEl.addEventListener('mousedown', (e) => {
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
                        side: null,
                        isStart
                    };
                    // determine which side the user started dragging (simple heuristic)
                    const railRect = railEl.getBoundingClientRect();
                    const localX = e.clientX - railRect.left;
                    const localY = e.clientY - railRect.top;
                    // If user clicked the start resizer, treat as left/top, else right/bottom
                    if (r.orientation === 'horizontal') this.railResizeState.side = isStart ? 'left' : 'right';
                    else if (r.orientation === 'vertical') this.railResizeState.side = isStart ? 'top' : 'bottom';
                });
                };
                bindResizerDown(resizerStart, true);
                bindResizerDown(resizerEnd, false);

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
                            // record drag timestamp so subsequent click events can be ignored
                            this._lastRailDraggedAt = Date.now();
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

                // Add connection style settings to rail
                const railSettings = document.createElement('div');
                railSettings.className = 'rail-settings';
                // Use absolute positioning so panel appears near the rail itself (inside scaled editor)
                // We'll compute X/Y on hover; start hidden off-screen.
                railSettings.style.cssText = 'position:absolute;left:-9999px;top:-9999px;background:rgba(0,0,0,0.95);color:white;padding:12px;border-radius:6px;font-size:13px;display:none;white-space:nowrap;z-index:999999;border:2px solid #666;box-shadow:0 4px 12px rgba(0,0,0,0.6);min-width:180px;';
                
                const optionsHtml = Object.keys(this.config.availableLineStyles || {}).map(k => `<option value="${k}">${this.config.availableLineStyles[k]}</option>` ).join('');
                railSettings.innerHTML = `
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                        <div style="font-weight:bold;color:#ffeb3b;">🛤️ Rail Settings</div>
                        <button class="rail-settings-close" title="Close" style="background:transparent;border:none;color:#fff;font-size:14px;cursor:pointer;padding:2px 6px;">✕</button>
                    </div>
                    <div style="margin-bottom:5px;font-size:11px;color:#ccc;">Rail ID: ${r.id}</div>
                    <label style="display:block;margin-bottom:5px;font-weight:bold;">Connection Style:</label>
                    <select class="rail-connection-style" style="font-size:12px;background:white;color:black;padding:4px;border-radius:3px;width:150px;">
                        ${optionsHtml}
                    </select>
                    <hr style="border:0;border-top:1px solid rgba(255,255,255,0.08);margin:8px 0">
                    <label style="display:block;margin-bottom:5px;font-weight:bold;">Rail Appearance</label>
                    <div style="display:flex;gap:6px;align-items:center;margin-bottom:6px;">
                        <select class="rail-appearance-style" style="font-size:12px;padding:4px;border-radius:3px;">
                            <option value="solid">Solid</option>
                            <option value="dash-heavy">Dashed (heavy)</option>
                            <option value="dash-subtle">Dashed (subtle)</option>
                            <option value="dotted">Dotted</option>
                            <option value="double-line">Double line</option>
                            <option value="striped">Striped</option>
                            <option value="gradient">Gradient</option>
                            <option value="embossed">Embossed</option>
                        </select>
                        <input type="color" class="rail-color-input" title="Rail color" style="width:34px;height:28px;padding:0;border-radius:4px;border:1px solid #444;" />
                        <input type="number" class="rail-thickness-input" min="1" max="200" style="width:64px;padding:4px;border-radius:3px;border:1px solid #444;" />
                    </div>
                    <div style="margin-top:4px;font-size:11px;color:#ccc;">Change rail thickness, color, and visual style (solid/dashed/dotted).</div>
                    <div style="margin-top:8px;font-size:11px;color:#ccc;">💡 Click twice on the rail to open settings; press Esc to hide. Double-Escape pins/unpins settings.</div>
                `;
                railEl.appendChild(railSettings);
                // Do not show settings on hover; settings are shown after two clicks (see onRailClick logic)

                // Handle rail connection style changes
                const railConnStyleSelect = railSettings.querySelector('.rail-connection-style');
                if (railConnStyleSelect) {
                    // Set initial value - use saved connectionStyle or fall back to global default
                    const initialValue = r.connectionStyle || this.config.lineStyle;
                    railConnStyleSelect.value = initialValue;
                    
                    railConnStyleSelect.addEventListener('change', () => {
                        r.connectionStyle = railConnStyleSelect.value;

                        // Update existing connections involving this rail
                        const allConnections = this.instance.getAllConnections();
                        const railConnections = allConnections.filter(conn => {
                            const sourceMatch = conn.sourceId === r.id || (conn.source && conn.source.id === r.id);
                            const targetMatch = conn.targetId === r.id || (conn.target && conn.target.id === r.id);
                            return sourceMatch || targetMatch;
                        });

                        let updatedCount = 0;

                        railConnections.forEach(c => {
                            const newStyle = r.connectionStyle || this.config.lineStyle;
                            const config = this.getConnectorConfig(newStyle);
                            try {
                                if (c.setPaintStyle && config.paintStyle) {
                                    c.setPaintStyle(config.paintStyle);
                                }
                                if (c.setConnector && config.connector) {
                                    c.setConnector(config.connector);
                                }
                                if (c.removeAllOverlays) c.removeAllOverlays();
                                if (config.overlays && Array.isArray(config.overlays)) {
                                    config.overlays.forEach(overlay => { if (c.addOverlay) c.addOverlay(overlay); });
                                }
                                const connData = this.mapData.connections.find(conn => conn.id === c._cardmap_id);
                                if (connData) {
                                    connData.style = newStyle;
                                    updatedCount++;
                                }
                            } catch (err) {
                                console.error('Error updating rail connection style:', err);
                            }
                        });

                        // Force repaint to ensure visual changes are applied
                        this.instance.repaintEverything();

                        // Show user feedback
                        this.showToast(`Rail connection style updated to: ${this.config.availableLineStyles[railConnStyleSelect.value]}`);

                        this.saveMapData();
                    });
                }

                // Rail appearance controls (style, color, thickness)
                    const railAppearanceSelect = railSettings.querySelector('.rail-appearance-style');
                const railColorInput = railSettings.querySelector('.rail-color-input');
                const railThicknessInput = railSettings.querySelector('.rail-thickness-input');
                const railSettingsClose = railSettings.querySelector('.rail-settings-close');

                if (railSettingsClose) {
                    railSettingsClose.addEventListener('click', (ev) => {
                        ev.stopPropagation();
                        // hide and unpin
                        railSettings.style.display = 'none';
                        this.railSettingsPinned = false;
                    });
                }

                if (railAppearanceSelect) {
                    railAppearanceSelect.value = r.railStyle || 'solid';
                    railColorInput.value = r.railColor || this.config.lineColor || '#A61832';
                    railThicknessInput.value = r.size || 8;

                    // Changing the visual appearance of the rail should NOT change connection styles.
                    // Connection style is controlled separately via the "Connection Style" select.
                    railAppearanceSelect.addEventListener('change', () => {
                        r.railStyle = railAppearanceSelect.value;
                        // update DOM attribute immediately and re-render the rail visuals
                        const dom = document.getElementById(r.id);
                        if (dom) dom.setAttribute('data-rail-style', r.railStyle);
                        this.renderRail(r);
                        this.saveMapData();
                    });

                    railColorInput.addEventListener('input', () => {
                        r.railColor = railColorInput.value;
                        // update DOM attribute and visible rail only; do not change connector styles
                        const dom = document.getElementById(r.id);
                        if (dom) dom.setAttribute('data-rail-color', r.railColor);
                        this.renderRail(r);
                        this.saveMapData();
                    });

                    // Update thickness live on input and debounce saving to avoid excessive requests
                    railThicknessInput.addEventListener('input', () => {
                        const newSize = parseInt(railThicknessInput.value, 10) || 8;
                        r.size = newSize;
                        if (r.orientation === 'vertical') r.width = newSize;
                        else r.height = newSize;
                        const dom = document.getElementById(r.id);
                        if (dom) dom.setAttribute('data-rail-size', r.size);
                        this.renderRail(r);
                        if (this.instance && this.instance.repaintEverything) this.instance.repaintEverything();
                        if (this._saveTimeout) clearTimeout(this._saveTimeout);
                        this._saveTimeout = setTimeout(() => { this.saveMapData(); this._saveTimeout = null; }, 450);
                    });
                }
            }

            // apply positioning based on orientation + size
            railEl.style.left = `${r.x}px`;
            railEl.style.top = `${r.y}px`;
            railEl.classList.toggle('vertical', r.orientation === 'vertical');

            // ensure DOM reflects any saved appearance properties
            if (r.railStyle) railEl.setAttribute('data-rail-style', r.railStyle);
            if (r.railColor) railEl.setAttribute('data-rail-color', r.railColor);
            if (r.size) railEl.setAttribute('data-rail-size', r.size);

            // set bar appearance (color, dashed/dotted/solid)
            const railBarEl = railEl.querySelector('.rail-bar');
            // Ensure the outer rail container doesn't paint a default solid background
            // so that the inner .rail-bar is fully visible for all styles.
            try { railEl.style.background = 'transparent'; } catch(e) {}
            if (railBarEl) {
                const color = r.railColor || this.config.lineColor || '#A61832';
                const style = r.railStyle || 'solid';
                const thickness = Math.max(1, r.size || 8);
                // reset
                railBarEl.style.backgroundImage = '';
                railBarEl.style.backgroundColor = '';
                railBarEl.style.border = 'none';
                railBarEl.style.boxShadow = '';

                // helper to set repeating gradient with orientation
                const setRepeat = (col, sizePx, gapPx) => {
                    if (r.orientation === 'vertical') {
                        railBarEl.style.backgroundImage = `repeating-linear-gradient(180deg, ${col} 0 ${sizePx}px, transparent ${sizePx}px ${sizePx + gapPx}px)`;
                    } else {
                        railBarEl.style.backgroundImage = `repeating-linear-gradient(90deg, ${col} 0 ${sizePx}px, transparent ${sizePx}px ${sizePx + gapPx}px)`;
                    }
                    railBarEl.style.backgroundRepeat = 'repeat';
                    railBarEl.style.backgroundSize = 'auto';
                    railBarEl.style.backgroundColor = 'transparent';
                };

                switch (style) {
                    case 'solid':
                        railBarEl.style.backgroundColor = color;
                        break;
                    case 'dash-heavy':
                        // chunky dashes
                        setRepeat(color, Math.max(6, thickness * 1.2), Math.max(8, thickness * 1.5));
                        break;
                    case 'dash-subtle':
                        // thin subtle dashes
                        setRepeat(color, Math.max(3, Math.floor(thickness / 1.5)), Math.max(6, thickness * 1.2));
                        break;
                    case 'dotted':
                        // small dots
                        setRepeat(color, Math.max(2, Math.floor(thickness / 2)), Math.max(4, Math.floor(thickness / 1.5)));
                        break;
                    case 'double-line':
                        // two parallel lines using background linear-gradients
                        if (r.orientation === 'vertical') {
                            railBarEl.style.backgroundImage = `linear-gradient(${color} 0 0), linear-gradient(${color} 0 0)`;
                            railBarEl.style.backgroundSize = `${Math.max(1, Math.floor(thickness/3))}px 100%, ${Math.max(1, Math.floor(thickness/3))}px 100%`;
                            railBarEl.style.backgroundPosition = `0 10%, 0 70%`;
                        } else {
                            railBarEl.style.backgroundImage = `linear-gradient(${color} 0 0), linear-gradient(${color} 0 0)`;
                            railBarEl.style.backgroundSize = `100% ${Math.max(1, Math.floor(thickness/3))}px, 100% ${Math.max(1, Math.floor(thickness/3))}px`;
                            railBarEl.style.backgroundPosition = `10% 0, 70% 0`;
                        }
                        railBarEl.style.backgroundRepeat = 'no-repeat';
                        break;
                    case 'striped':
                        // diagonal stripe overlay
                        if (r.orientation === 'vertical') {
                            railBarEl.style.backgroundImage = `linear-gradient(135deg, ${color} 25%, rgba(0,0,0,0) 25%, rgba(0,0,0,0) 50%, ${color} 50%, ${color} 75%, rgba(0,0,0,0) 75%, rgba(0,0,0,0) 100%)`;
                        } else {
                            railBarEl.style.backgroundImage = `linear-gradient(45deg, ${color} 25%, rgba(0,0,0,0) 25%, rgba(0,0,0,0) 50%, ${color} 50%, ${color} 75%, rgba(0,0,0,0) 75%, rgba(0,0,0,0) 100%)`;
                        }
                        railBarEl.style.backgroundSize = `${Math.max(8, thickness*2)}px ${Math.max(8, thickness*2)}px`;
                        railBarEl.style.backgroundRepeat = 'repeat';
                        break;
                    case 'gradient':
                        // subtle gradient using the chosen color as base
                        railBarEl.style.backgroundImage = `linear-gradient(90deg, ${color} 0%, rgba(255,255,255,0.08) 50%, ${color} 100%)`;
                        railBarEl.style.backgroundRepeat = 'no-repeat';
                        break;
                    case 'embossed':
                        // use a shadow to give embossed effect
                        railBarEl.style.backgroundColor = color;
                        railBarEl.style.boxShadow = r.orientation === 'vertical' ? `inset -2px 0 4px rgba(255,255,255,0.15), inset 2px 0 6px rgba(0,0,0,0.2)` : `inset 0 -2px 4px rgba(255,255,255,0.15), inset 0 2px 6px rgba(0,0,0,0.2)`;
                        break;
                    default:
                        railBarEl.style.backgroundColor = color;
                }
            }

            // thickness is stored in r.size; update width/height depending on orientation

            const size = r.size || 8;
            // Position and size the inner bar rather than the container so we can hide it
            if (r.orientation === 'vertical') {
                railEl.style.width = `${size}px`;
                railEl.style.height = `${r.height || 300}px`;
                if (railBarEl) {
                    railBarEl.style.width = `${size}px`;
                    railBarEl.style.height = `${r.height || 300}px`;
                }
            } else if (r.orientation === 'diagonal') {
                railEl.style.width = `${r.width || 200}px`;
                railEl.style.height = `${size}px`;
                if (r.angle) railEl.style.transform = `rotate(${r.angle}deg)`;
                if (railBarEl) {
                    railBarEl.style.width = `${r.width || 200}px`;
                    railBarEl.style.height = `${size}px`;
                }
            } else {
                railEl.style.width = `${r.width || 300}px`;
                railEl.style.height = `${size}px`;
                if (railBarEl) {
                    railBarEl.style.width = `${r.width || 300}px`;
                    railBarEl.style.height = `${size}px`;
                }
            }

            // keep CSS custom property for legacy styles
            railEl.style.setProperty('--rail-size', `${size}px`);

            // mark selection state
            if (this.selectedRail === r.id) railEl.classList.add('cardmap-rail-selected');
            else railEl.classList.remove('cardmap-rail-selected');

            // Show or hide the visible thickness according to config
            if (!this.config.showRailThickness) {
                railEl.classList.add('rail-thickness-hidden');
            } else {
                railEl.classList.remove('rail-thickness-hidden');
            }
        }

        /** Select a rail by id and update controls */
        selectRail(railId) {
            this.deselectAllNodes();
            this.selectedRail = railId;
            document.querySelectorAll('.cardmap-rail').forEach(el => el.classList.remove('cardmap-rail-selected'));
            const el = document.getElementById(railId);
            if (el) el.classList.add('cardmap-rail-selected');
            const railData = this.mapData.rails.find(r => r.id === railId);
            if (railData && this.railSizeInput) {
                this.railSizeInput.value = railData.size || 8;
            }
            // Do NOT show settings on single-click; settings are shown only after a second quick click
            // leave any rail-settings visibility to the double-click handler in onRailClick
            if (el && !this.railSettingsPinned) {
                const s = el.querySelector('.rail-settings');
                if (s) s.style.display = 'none';
            }
        }

        /**
         * Position the floating rail settings panel adjacent to the rail element.
         * Attempts to place it above (preferred) or to the right if insufficient space.
         */
        positionRailSettings(railEl, settingsEl, railData) {
            if (!railEl || !settingsEl) return;
            // Ensure settings are measurable
            settingsEl.style.left = '-9999px';
            settingsEl.style.top = '-9999px';
            settingsEl.style.display = 'block';

            // Because the editor is scaled & translated, compute positions in editor coordinates
            const editorRect = this.editor.getBoundingClientRect();
            const railRect = railEl.getBoundingClientRect();

            // Convert rail top/left from viewport back into editor local (pre-transform) space.
            // Current transform: translate(offsetX, offsetY) scale(scale)
            const localX = (railRect.left - editorRect.left) / this.scale;
            const localY = (railRect.top - editorRect.top) / this.scale;
            const localW = railRect.width / this.scale;
            const localH = railRect.height / this.scale;

            const panelRect = settingsEl.getBoundingClientRect();
            const panelW = panelRect.width / this.scale;
            const panelH = panelRect.height / this.scale;

            // Default: place above center of rail
            let targetX = localX + (localW / 2) - (panelW / 2);
            let targetY = localY - panelH - 12; // 12px gap

            // If above goes out of top bounds, place below
            if (targetY < 0) {
                targetY = localY + localH + 12;
            }
            // Clamp horizontally within editor bounds
            const editorWidth = (this.editor.scrollWidth || this.editor.clientWidth || 2000);
            if (targetX < 0) targetX = 8;
            if (targetX + panelW > editorWidth) targetX = editorWidth - panelW - 8;

            // Apply coordinates in editor's transformed space
            settingsEl.style.left = `${targetX}px`;
            settingsEl.style.top = `${targetY}px`;
        }

        /**
         * Creates and renders a new rail.
         */
        addRail() {
            const orientation = document.getElementById('add-rail-orientation').value;
            const size = this.railSizeInput ? (parseInt(this.railSizeInput.value, 10) || 10) : 10;
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
            this.saveToHistory('Added rail');
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
            this.saveToHistory(`Deleted rail: ${railId}`);
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
                // Update .rail-bar width to match
                const railBarEl = dom.querySelector('.rail-bar');
                if (railBarEl) railBarEl.style.width = `${rs.width}px`;
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
                // Update .rail-bar height to match
                const railBarEl = dom.querySelector('.rail-bar');
                if (railBarEl) railBarEl.style.height = `${rs.height}px`;
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
         * Auto-aligns cards that are positioned close to each other.
         * Groups cards by horizontal or vertical proximity and aligns them proportionally.
         */
        autoAlignCards() {
            // Save current state for undo
            this.saveToHistory('Auto-align cards');

            // Get all card nodes (exclude rails)
            const cards = this.mapData.nodes.filter(node => !node.is_rail);
            
            if (cards.length < 2) {
                this.showToast('Need at least 2 cards to align');
                return;
            }

            // Threshold for considering cards "close" to each other (in pixels)
            const HORIZONTAL_THRESHOLD = 80; // Cards within this Y-range are considered horizontally aligned
            const VERTICAL_THRESHOLD = 80;   // Cards within this X-range are considered vertically aligned
            
            let alignedCount = 0;

            // Find horizontal groups (cards with similar Y positions)
            const horizontalGroups = this.groupCardsByProximity(cards, 'y', HORIZONTAL_THRESHOLD);
            
            // Align each horizontal group
            horizontalGroups.forEach(group => {
                if (group.length >= 2) {
                    this.alignHorizontalGroup(group);
                    alignedCount += group.length;
                }
            });

            // Find vertical groups (cards with similar X positions)
            const verticalGroups = this.groupCardsByProximity(cards, 'x', VERTICAL_THRESHOLD);
            
            // Align each vertical group
            verticalGroups.forEach(group => {
                if (group.length >= 2) {
                    this.alignVerticalGroup(group);
                    alignedCount += group.length;
                }
            });

            if (alignedCount > 0) {
                // Re-render all nodes
                cards.forEach(node => {
                    const el = document.getElementById(node.id);
                    if (el) {
                        el.style.left = node.x + 'px';
                        el.style.top = node.y + 'px';
                    }
                });

                // Repaint connections
                this.instance.repaintEverything();
                
                // Save changes
                this.saveMapData();
                
                this.showToast(`Auto-aligned ${Math.floor(alignedCount / 2)} groups of cards`);
            } else {
                this.showToast('No cards were close enough to align');
            }
        }

        /**
         * Groups cards by proximity along a specific axis.
         * @param {Array} cards - Array of card nodes
         * @param {string} axis - 'x' or 'y'
         * @param {number} threshold - Maximum distance for cards to be in the same group
         * @returns {Array} Array of card groups
         */
        groupCardsByProximity(cards, axis, threshold) {
            if (cards.length === 0) return [];

            // Sort cards by the specified axis
            const sorted = [...cards].sort((a, b) => a[axis] - b[axis]);
            
            const groups = [];
            let currentGroup = [sorted[0]];

            for (let i = 1; i < sorted.length; i++) {
                const current = sorted[i];
                const previous = sorted[i - 1];
                
                // Check if current card is within threshold of the previous card
                if (Math.abs(current[axis] - previous[axis]) <= threshold) {
                    currentGroup.push(current);
                } else {
                    // Start a new group if we have at least 2 cards
                    if (currentGroup.length >= 2) {
                        groups.push(currentGroup);
                    }
                    currentGroup = [current];
                }
            }

            // Don't forget the last group
            if (currentGroup.length >= 2) {
                groups.push(currentGroup);
            }

            return groups;
        }

        /**
         * Aligns a group of cards horizontally (same Y position).
         * Calculates the average Y and sets all cards to that position.
         * @param {Array} group - Array of card nodes to align
         */
        alignHorizontalGroup(group) {
            if (group.length < 2) return;

            // Calculate the average Y position
            const avgY = group.reduce((sum, node) => sum + node.y, 0) / group.length;
            
            // Set all cards in the group to the average Y position
            group.forEach(node => {
                node.y = Math.round(avgY);
            });
        }

        /**
         * Aligns a group of cards vertically (same X position).
         * Calculates the average X and sets all cards to that position.
         * @param {Array} group - Array of card nodes to align
         */
        alignVerticalGroup(group) {
            if (group.length < 2) return;

            // Calculate the average X position
            const avgX = group.reduce((sum, node) => sum + node.x, 0) / group.length;
            
            // Set all cards in the group to the average X position
            group.forEach(node => {
                node.x = Math.round(avgX);
            });
        }

        /**
         * Aligns cards along a selected rail with equal spacing.
         * Distributes cards evenly along the rail's length.
         */
        alignCardsOnRail() {
            // Check if a rail is selected
            if (!this.selectedRail) {
                this.showToast('⚠️ Please select a rail first', 'warning');
                return;
            }

            // Get the rail data
            const railId = this.selectedRail;
            const rail = this.mapData.rails.find(r => r.id === railId);
            
            if (!rail) {
                this.showToast('⚠️ Rail not found', 'error');
                return;
            }

            // Find all connections involving this rail
            const railConnections = this.mapData.connections.filter(conn => {
                return conn.source === railId || conn.target === railId;
            });

            if (railConnections.length === 0) {
                this.showToast('ℹ️ No cards connected to this rail', 'info');
                return;
            }

            // Extract unique card IDs connected to this rail
            const cardIds = new Set();
            railConnections.forEach(conn => {
                if (conn.source === railId) {
                    cardIds.add(conn.target);
                } else {
                    cardIds.add(conn.source);
                }
            });

            if (cardIds.size < 2) {
                this.showToast('ℹ️ Need at least 2 cards to align', 'info');
                return;
            }

            // Save state for undo
            this.saveToHistory();

            // Get card nodes
            const cards = Array.from(cardIds).map(id => {
                return this.mapData.nodes.find(n => n.id === id);
            }).filter(Boolean);

            // Determine rail orientation
            const isVertical = rail.orientation === 'vertical';
            
            // Sort cards by position along the rail
            if (isVertical) {
                cards.sort((a, b) => a.y - b.y);
            } else {
                cards.sort((a, b) => a.x - b.x);
            }

            // Calculate rail dimensions
            const railStart = isVertical ? rail.y : rail.x;
            const railEnd = railStart + (isVertical ? rail.height : rail.width);
            const railLength = railEnd - railStart;

            // Calculate spacing
            const numCards = cards.length;
            const spacing = railLength / (numCards + 1);

            // Position cards evenly along the rail
            cards.forEach((card, index) => {
                const position = railStart + spacing * (index + 1);
                
                if (isVertical) {
                    // For vertical rails, adjust Y position
                    card.y = Math.round(position - (card.height || 100) / 2);
                    // Keep X aligned with rail
                    card.x = Math.round(rail.x + (rail.width / 2) - (card.width || 200) / 2);
                } else {
                    // For horizontal rails, adjust X position
                    card.x = Math.round(position - (card.width || 200) / 2);
                    // Keep Y aligned with rail
                    card.y = Math.round(rail.y + (rail.height / 2) - (card.height || 100) / 2);
                }
            });

            // Update connection anchors for precision
            railConnections.forEach(conn => {
                const cardNode = this.mapData.nodes.find(n => 
                    n.id === (conn.source === railId ? conn.target : conn.source)
                );
                
                if (!cardNode) return;

                if (isVertical) {
                    // For vertical rails, anchor should be at precise Y position
                    const cardCenterY = cardNode.y + (cardNode.height || 100) / 2;
                    const relativeY = (cardCenterY - rail.y) / rail.height;
                    const anchorY = Math.max(0, Math.min(1, relativeY));
                    
                    if (conn.source === railId) {
                        conn.anchors.source = [0.5, anchorY];
                    } else {
                        conn.anchors.target = [0.5, anchorY];
                    }
                } else {
                    // For horizontal rails, anchor should be at precise X position
                    const cardCenterX = cardNode.x + (cardNode.width || 200) / 2;
                    const relativeX = (cardCenterX - rail.x) / rail.width;
                    const anchorX = Math.max(0, Math.min(1, relativeX));
                    
                    if (conn.source === railId) {
                        conn.anchors.source = [anchorX, 0.5];
                    } else {
                        conn.anchors.target = [anchorX, 0.5];
                    }
                }
            });

            // Re-render the canvas
            this.renderCanvas();
            
            // Repaint connections
            if (this.jsPlumbInstance) {
                this.jsPlumbInstance.repaintEverything();
            }

            // Auto-save
            if (this.autoSaveEnabled) {
                this.debouncedSave();
            }

            this.showToast(`✅ Aligned ${cards.length} cards on rail`, 'success');
        }

        /** Toggle delete-connection mode which allows clicking links to delete them */
        toggleDeleteConnectionMode() {
            this.deleteConnectionMode = !this.deleteConnectionMode;
            // turning on delete connection mode should disable other modes
            if (this.deleteConnectionMode) {
                this.deleteMode = false;
                this.deleteRailMode = false;
                this.connectMode = false;
            }
            const btn = document.getElementById('delete-connection');
            if (btn) btn.classList.toggle('button-primary', this.deleteConnectionMode);
            // visual cue on connectors
            this.updateDeleteConnectionUI();
            const dn = document.getElementById('delete-node'); if (dn) dn.classList.remove('button-primary');
            const dr = document.getElementById('delete-rail'); if (dr) dr.classList.remove('button-primary');
            const cm = document.getElementById('connect-mode'); if (cm) cm.classList.remove('button-primary');
            this.editor.style.cursor = this.deleteConnectionMode ? 'not-allowed' : (this.connectMode ? 'crosshair' : 'grab');
        }

        /** Update visual state of connections when delete mode toggles */
        updateDeleteConnectionUI() {
            const conns = this.instance.getAllConnections();
            conns.forEach(c => {
                try {
                    const el = c.canvas || (c.getConnector && c.getConnector().canvas) || null;
                    if (this.deleteConnectionMode) {
                        if (el && el.classList) el.classList.add('deletable-conn');
                    } else {
                        if (el && el.classList) el.classList.remove('deletable-conn');
                    }
                } catch (err) {}
            });
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
            // Save to history before making changes
            this.saveToHistory('Modified map data');

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
                    if (connSel) {
                        nodeData.connectionStyle = connSel.value;
                    } else {
                    }
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
                    railData.size = railData.size || (railData.orientation === 'vertical' ? railData.width : (railData.height || this.RAIL_HEIGHT));
                    // persist rail connection style if user set it
                    const railConnSel = el.querySelector('.rail-connection-style');
                    if (railConnSel) {
                        railData.connectionStyle = railConnSel.value;
                    } else {
                    }
                    // Persist visual appearance controls (style, color, thickness)
                    const railAppearanceSel = el.querySelector('.rail-appearance-style');
                    if (railAppearanceSel) {
                        railData.railStyle = railAppearanceSel.value;
                    } else {
                        // leave existing value
                    }
                    const railColorInput = el.querySelector('.rail-color-input');
                    if (railColorInput) {
                        railData.railColor = railColorInput.value;
                    }
                    const railThicknessInput = el.querySelector('.rail-thickness-input');
                    if (railThicknessInput) {
                        const newSize = parseInt(railThicknessInput.value, 10);
                        if (!isNaN(newSize) && newSize > 0) {
                            railData.size = newSize;
                            if (railData.orientation === 'vertical') {
                                railData.width = newSize;
                            } else {
                                railData.height = newSize;
                            }
                        }
                    }
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
            try {
                this.editor.style.transform = `translate(${this.offsetX}px, ${this.offsetY}px) scale(${this.scale})`;
                this.instance.setZoom(this.scale);
            } catch (error) {
                console.error('Error in updateTransform:', error);
            }
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
                        n.x = rail.x - ( (document.getElementById(n.id)?.offsetWidth || 192) / 2 ) + (rail.size || this.RAIL_HEIGHT) / 2;
                        n.y = y;
                        const el = document.getElementById(n.id);
                        if (el) { el.style.left = `${n.x}px`; el.style.top = `${n.y}px`; }
                        y += (document.getElementById(n.id)?.offsetHeight || 240) + margin;
                    });
                } else {
                    // horizontal or diagonal -> lay out left to right along rail.x..x+width
                    let x = rail.x + margin;
                    attached.forEach(n => {
                        n.x = x;
                        n.y = rail.y - ( (document.getElementById(n.id)?.offsetHeight || 240) / 2 ) + (rail.size || this.RAIL_HEIGHT) / 2;
                        const el = document.getElementById(n.id);
                        if (el) { el.style.left = `${n.x}px`; el.style.top = `${n.y}px`; }
                        x += (document.getElementById(n.id)?.offsetWidth || 192) + margin;
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
                const w = el ? el.offsetWidth : 192;
                const h = el ? el.offsetHeight : 240;

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
         * Show help tooltip for connection deletion.
         */
        showConnectionHelp() {
            // Show a one-time help message about double-clicking connections
            const helpShown = localStorage.getItem('cardmap-connection-help-shown');
            if (!helpShown) {
                setTimeout(() => {
                    this.showToast('💡 Tip: Double-click connection lines to delete them', 5000);
                    localStorage.setItem('cardmap-connection-help-shown', 'true');
                }, 2000); // Show after 2 seconds
            }
        }

        /**
         * Gets the jsPlumb connector configuration for a given style name.
         */
        getConnectorConfig(style) {
            const baseConfig = { stroke: this.config.lineColor, strokeWidth: this.config.lineThickness };
            // Arrow overlay with proper styling - must be recreated each time to avoid reference issues
            const createArrowOverlay = () => ["Arrow", { 
                width: 12, 
                length: 12, 
                location: 1, 
                foldback: 0.8, 
                fill: this.config.lineColor, 
                stroke: this.config.lineColor,
                strokeWidth: 1
            }];
            const dashedConfig = { ...baseConfig, dashstyle: "4 2", strokeDasharray: "4 2" };
            const dottedConfig = { ...baseConfig, dashstyle: "1 4", strokeDasharray: "1 4" };
            
            // Normalize style name - handle old/incorrect naming conventions
            let normalizedStyle = style;
            // Handle old style names with incorrect prefixes
            if (style && typeof style === 'string') {
                normalizedStyle = style
                    .replace(/^flowchart-straight-with-arrows$/, 'straight-with-arrows')
                    .replace(/^straight-arrows$/, 'straight-with-arrows')
                    .replace(/^flowchart-arrows$/, 'flowchart-with-arrows')
                    .replace(/^rounded-flowchart$/, 'flowchart')
                    .replace(/^curved-bezier$/, 'bezier')
                    .replace(/^rounded-bezier$/, 'bezier')
                    .replace(/^parallel$/, 'straight')
                    .replace(/^diagonal$/, 'straight');
            }
            
            const styles = {
                'normal': { connector: ["Straight"], overlays: [] },
                'straight': { connector: ["Straight"], overlays: [] },
                'bezier': { connector: ["Bezier", { curviness: 50 }], overlays: [] },
                'flowchart': { connector: ["Flowchart"], overlays: [] },
                'state-machine': { connector: ["StateMachine", { curviness: 20 }], overlays: [] },
                'straight-with-arrows': { connector: ["Straight"], overlays: [createArrowOverlay()] },
                'flowchart-with-arrows': { connector: ["Flowchart"], overlays: [createArrowOverlay()] },
                'flowchart-with-arrows-dashed': { connector: ["Flowchart"], paintStyle: dashedConfig, overlays: [createArrowOverlay()] },
                'bezier-with-arrows': { connector: ["Bezier", { curviness: 50 }], overlays: [createArrowOverlay()] },
                'dashed': { connector: ["Straight"], paintStyle: dashedConfig, overlays: [] },
                'dotted': { connector: ["Straight"], paintStyle: dottedConfig, overlays: [] },
                'dashed-with-arrows': { connector: ["Straight"], paintStyle: dashedConfig, overlays: [createArrowOverlay()] },
                'dotted-with-arrows': { connector: ["Straight"], paintStyle: dottedConfig, overlays: [createArrowOverlay()] }
            };
            
            // Use normalized style or default to straight
            const config = styles[normalizedStyle] || styles['straight'];
            console.log('getConnectorConfig - input:', style, 'normalized:', normalizedStyle, 'has overlays:', config.overlays.length);
            return { ...config, paintStyle: config.paintStyle || baseConfig };
        }

        /**
         * Determines the best anchor points based on the relative positions of two elements.
         * Always uses cardinal directions (top, right, bottom, left) for consistent edge snapping.
         */
        getDirectionalAnchors(sourceNode, targetNode) {
            const s = sourceNode.getBoundingClientRect();
            const t = targetNode.getBoundingClientRect();
            
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

        /**
         * Calculates anchor position based on a click event.
         * For rails, this ensures connections attach exactly where clicked.
         * For cards, snaps to the nearest edge for consistent positioning.
         */
        getPreciseAnchorFromEvent(e, el) {
            if (!el || !e || typeof e.clientX !== 'number' || !this.editorWrapper) {
                return "Continuous";
            }

            try {
                const isRail = el.classList.contains('cardmap-rail');
                
                // Get the element's bounding rectangle in screen coordinates
                const elRect = el.getBoundingClientRect();
                
                // Account for any pan/zoom transformations in the editor
                const editorRect = this.editor.getBoundingClientRect();
                const editorStyle = window.getComputedStyle(this.editor);
                const transform = editorStyle.transform;
                
                // Convert click coordinates to be relative to the element
                let relativeX = e.clientX - elRect.left;
                let relativeY = e.clientY - elRect.top;
                
                // Apply inverse transformation if editor is transformed
                if (transform && transform !== 'none') {
                    // Parse transform matrix and apply inverse
                    const matrix = new DOMMatrix(transform);
                    if (matrix.a !== 0 && matrix.d !== 0) {
                        const scale = matrix.a; // Assuming uniform scaling
                        relativeX = relativeX / scale;
                        relativeY = relativeY / scale;
                    }
                }

                // Check if click is within element bounds (with small tolerance for edge cases)
                const tolerance = 10; // Increased tolerance for better edge detection
                if (relativeX < -tolerance || relativeY < -tolerance || 
                    relativeX > elRect.width + tolerance || relativeY > elRect.height + tolerance) {
                    console.warn('Click outside element bounds, using fallback');
                    return "Continuous";
                }

                // For rails, keep precise positioning
                if (isRail) {
                    let x = Math.max(0, Math.min(1, relativeX / elRect.width));
                    let y = Math.max(0, Math.min(1, relativeY / elRect.height));
                    
                    const railData = this.mapData.rails.find(r => r.id === el.id);
                    if (railData) {
                        if (railData.orientation === 'vertical') {
                            // For vertical rails, fix x to center (0.5) and keep y precise along the rail length
                            x = 0.5;
                            // y stays precise - wherever the user clicked
                        } else if (railData.orientation === 'horizontal') {
                            // For horizontal rails, fix y to center (0.5) and keep x precise along the rail length
                            y = 0.5;
                            // x stays precise - wherever the user clicked
                        }
                        // For diagonal rails, keep both x and y precise
                    }
                    
                    return [x, y, 0, 0];
                }

                // For cards, snap to the nearest edge for consistent positioning
                // Calculate distances to each edge
                const distanceToTop = relativeY;
                const distanceToBottom = elRect.height - relativeY;
                const distanceToLeft = relativeX;
                const distanceToRight = elRect.width - relativeX;
                
                // Find the closest edge with a small bias towards horizontal connections
                const horizontalBias = 0.9; // Slight preference for left/right connections
                const minDistance = Math.min(
                    distanceToTop, 
                    distanceToBottom, 
                    distanceToLeft * horizontalBias, 
                    distanceToRight * horizontalBias
                );
                
                let anchorName;
                if (minDistance === distanceToTop) {
                    anchorName = "TopCenter";
                } else if (minDistance === distanceToBottom) {
                    anchorName = "BottomCenter";
                } else if (minDistance === distanceToLeft * horizontalBias) {
                    anchorName = "LeftMiddle";
                } else {
                    anchorName = "RightMiddle";
                }

                return anchorName;
            } catch (err) {
                console.warn('Error in getPreciseAnchorFromEvent:', err);
                return "Continuous";
            }
        }

        /**
         * Calculates precise anchor position when clicking on ruler canvas.
         * Uses direct element coordinates for accurate positioning.
         */
        getPreciseAnchorFromRulerEvent(e, el) {
            if (!el || !e) {
                console.warn('Missing elements for ruler coordinate calculation');
                return "Continuous";
            }

            try {
                // Get the element's bounding rectangle in screen coordinates
                const elRect = el.getBoundingClientRect();

                // Convert click coordinates to be relative to the element
                const relativeX = e.clientX - elRect.left;
                const relativeY = e.clientY - elRect.top;

                // Check if click is within element bounds
                if (relativeX < 0 || relativeY < 0 || relativeX > elRect.width || relativeY > elRect.height) {
                    return "Continuous";
                }

                // Calculate relative position within element (0-1)
                const x = relativeX / elRect.width;
                const y = relativeY / elRect.height;

                // Determine which edge is closest to the click point
                const topDist = y;
                const bottomDist = 1 - y;
                const leftDist = x;
                const rightDist = 1 - x;
                const min = Math.min(topDist, bottomDist, leftDist, rightDist);

                let result;
                if (min === topDist) result = "TopCenter";
                else if (min === bottomDist) result = "BottomCenter";
                else if (min === leftDist) result = "LeftMiddle";
                else result = "RightMiddle";

                return result;
            } catch (error) {
                console.error('Error in getPreciseAnchorFromRulerEvent:', error);
                return "Continuous";
            }
        }

        /**
         * Compute deterministic anchors for a connection between two elements.
         * If sourceEvent/targetEvent are provided and inside their elements, prefers precise anchors.
         * If target is a rail and a precise hover is available, returns a precise anchor array for the rail.
         */
        computeAnchorsBetweenElements(sourceEl, targetEl, sourceEvent, targetEvent) {
            // prefer precise anchors derived from the click events
            let anchorA = null;
            let anchorB = null;

            if (sourceEvent) {
                const a = this.getPreciseAnchorFromEvent(sourceEvent, sourceEl);
                if (a && a !== 'Continuous') anchorA = a;
            }
            if (targetEvent) {
                // Use precise anchor from event for all elements (nodes and rails)
                const b = this.getPreciseAnchorFromEvent(targetEvent, targetEl);
                if (b && b !== 'Continuous') anchorB = b;
            }

            // fallback to directional anchors if any side is missing
            if (!anchorA || !anchorB) {
                try {
                    const dir = this.getDirectionalAnchors(sourceEl, targetEl);
                    if (!anchorA) anchorA = dir[0];
                    if (!anchorB) anchorB = dir[1];
                } catch (err) {
                    if (!anchorA) anchorA = this.getDefaultAnchorForElement(sourceEl);
                    if (!anchorB) anchorB = this.getDefaultAnchorForElement(targetEl);
                }
            }

            return [anchorA, anchorB];
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

        /**
         * Add context menu event to a connection
         */
        addConnectionContextMenu(connection) {
            const connEl = connection.canvas || (connection.getConnector && connection.getConnector().canvas);
            if (connEl) {
                // Create a unique handler for this connection
                const contextMenuHandler = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.showConnectionContextMenu(connection, e);
                };
                
                // Remove old handler if it exists
                if (connEl._contextMenuHandler) {
                    connEl.removeEventListener('contextmenu', connEl._contextMenuHandler);
                }
                
                // Add new handler
                connEl.addEventListener('contextmenu', contextMenuHandler);
                connEl._contextMenuHandler = contextMenuHandler;
                
                console.log('Context menu attached to connection:', connection._cardmap_id);
            }
        }

        /**
         * Show context menu for individual connection styling
         */
        showConnectionContextMenu(connection, event) {
            // Remove any existing context menu
            this.hideConnectionContextMenu();

            const connId = connection._cardmap_id;
            if (!connId) return;

            // Find connection data
            const connData = this.mapData.connections.find(c => c.id === connId);
            if (!connData) return;

            // Create context menu
            const menu = document.createElement('div');
            menu.className = 'connection-context-menu';
            menu.style.cssText = `
                position: fixed;
                left: ${event.clientX}px;
                top: ${event.clientY}px;
                background: white;
                border: 1px solid #ccc;
                border-radius: 4px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.2);
                padding: 8px;
                z-index: 10000;
                min-width: 200px;
                font-size: 13px;
            `;

            const currentStyle = connData.style || 'normal';
            
            menu.innerHTML = `
                <div style="font-weight: bold; margin-bottom: 8px; color: #333;">Connection Style</div>
                <select class="connection-style-select" style="width: 100%; margin-bottom: 8px;">
                    ${Object.keys(this.config.availableLineStyles).map(k => 
                        `<option value="${k}" ${k === currentStyle ? 'selected' : ''}>${this.config.availableLineStyles[k]}</option>`
                    ).join('')}
                </select>
                <div style="text-align: right;">
                    <button class="apply-connection-style" style="background: #0073aa; color: white; border: none; padding: 4px 12px; border-radius: 3px; cursor: pointer; margin-right: 4px;">Apply</button>
                    <button class="cancel-connection-style" style="background: #ddd; color: #333; border: none; padding: 4px 12px; border-radius: 3px; cursor: pointer;">Cancel</button>
                </div>
            `;

            document.body.appendChild(menu);
            this.currentConnectionMenu = { menu, connection, connData };

            // Add event listeners
            menu.querySelector('.apply-connection-style').addEventListener('click', () => {
                const newStyle = menu.querySelector('.connection-style-select').value;
                this.applyConnectionStyle(connection, connData, newStyle);
                this.hideConnectionContextMenu();
            });

            menu.querySelector('.cancel-connection-style').addEventListener('click', () => {
                this.hideConnectionContextMenu();
            });

            // Close menu when clicking outside
            setTimeout(() => {
                const outsideClickHandler = (event) => {
                    if (this.currentConnectionMenu && !this.currentConnectionMenu.menu.contains(event.target)) {
                        this.hideConnectionContextMenu();
                        document.removeEventListener('click', outsideClickHandler);
                    }
                };
                document.addEventListener('click', outsideClickHandler);
            }, 10);
        }

        /**
         * Hide connection context menu
         */
        hideConnectionContextMenu() {
            if (this.currentConnectionMenu) {
                this.currentConnectionMenu.menu.remove();
                this.currentConnectionMenu = null;
            }
        }

        /**
         * Hide context menu when clicking outside
         */
        hideConnectionContextMenuOnOutsideClick(event) {
            if (this.currentConnectionMenu && !this.currentConnectionMenu.menu.contains(event.target)) {
                this.hideConnectionContextMenu();
            }
        }

        /**
         * Apply new style to individual connection
         */
        applyConnectionStyle(connection, connData, newStyle) {
            try {
                console.log('=== Applying style:', newStyle, 'to connection:', connection._cardmap_id);
                
                // Update connection data
                connData.style = newStyle;
                
                // Apply visual changes to the connection
                const config = this.getConnectorConfig(newStyle);
                console.log('Config for style:', config);
                
                // Clear existing overlays FIRST before changing anything
                if (connection.removeAllOverlays) {
                    const existingOverlays = connection.getOverlays ? connection.getOverlays() : [];
                    console.log('Existing overlays before removal:', existingOverlays);
                    connection.removeAllOverlays();
                }
                
                // Reset paint style to base config FIRST to clear any dash/dot styles
                const basePaintStyle = { 
                    stroke: this.config.lineColor, 
                    strokeWidth: this.config.lineThickness,
                    strokeDasharray: "0",  // Reset to solid line
                    dashstyle: "0"         // Reset jsPlumb dash style
                };
                if (connection.setPaintStyle) {
                    connection.setPaintStyle(basePaintStyle);
                    console.log('Reset base paint style');
                }
                
                // Update connector type
                if (config.connector && connection.setConnector) {
                    connection.setConnector(config.connector);
                    console.log('Connector set to:', config.connector);
                }
                
                // Now apply the actual new paint style (if different from base)
                if (config.paintStyle && connection.setPaintStyle) {
                    connection.setPaintStyle(config.paintStyle);
                    console.log('Paint style set to:', config.paintStyle);
                }
                
                // Add new overlays (arrows, etc.)
                if (config.overlays && Array.isArray(config.overlays) && config.overlays.length > 0) {
                    console.log('Adding', config.overlays.length, 'overlays:', JSON.stringify(config.overlays));
                    config.overlays.forEach((overlay, index) => {
                        if (connection.addOverlay) {
                            try {
                                console.log('Adding overlay', index, ':', overlay);
                                const result = connection.addOverlay(overlay);
                                console.log('Overlay', index, 'added successfully, result:', result);
                            } catch (e) {
                                console.error('Error adding overlay', index, ':', e);
                            }
                        }
                    });
                    const finalOverlays = connection.getOverlays ? connection.getOverlays() : [];
                    console.log('Connection overlays after adding:', finalOverlays);
                } else {
                    console.log('No overlays to add. Config.overlays:', config.overlays);
                }
                
                // Re-attach context menu listener since canvas element may have been replaced
                setTimeout(() => {
                    this.addConnectionContextMenu(connection);
                }, 100);
                
                // Force multiple repaints to ensure arrows appear
                setTimeout(() => {
                    if (connection.repaint) connection.repaint();
                    this.instance.repaintEverything();
                }, 10);
                
                setTimeout(() => {
                    if (connection.repaint) connection.repaint();
                    this.instance.repaintEverything();
                }, 100);
                
                // Save changes
                this.saveMapData();
                
                // Save to history
                this.saveToHistory(`Changed connection style to ${this.config.availableLineStyles[newStyle]}`);
                
                // Show feedback
                this.showToast(`Connection style changed to: ${this.config.availableLineStyles[newStyle]}`);
                
            } catch (error) {
                console.error('Error applying connection style:', error);
                this.showToast('Error applying connection style');
            }
        }
    }

    // Kick off the editor
    document.addEventListener('DOMContentLoaded', () => new CardMapEditor());

})();
