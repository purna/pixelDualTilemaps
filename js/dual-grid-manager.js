// dual-grid-manager.js - FIXED VERSION
// Now each of the 16 tiles stores its own canvas state

class DualGridManager {
    constructor() {
        this.tiles = [];
        this.selectedTile = null;
        this.tileSize = 32;
        this.gridSize = 4;
        this.dualGridData = null;
        this.frameCanvases = [];
        this.frameCanvasesContainer = null;
        
        // NEW: Store separate canvas data for each of the 16 tiles
        this.tileCanvasStates = new Map(); // Maps tile index to canvas states
        
        this.init();
    }

    async init() {
        console.log('Initializing Dual Grid Manager...');
        await this.loadDualGridData();
        this.setupDualGridUI();
        this.setupEventListeners();
        
        // Initialize canvas storage for all 16 tiles
        this.initializeTileCanvasStorage();
        
        console.log('Dual Grid Manager initialized');
    }

    // NEW: Initialize storage for all 16 tiles
    initializeTileCanvasStorage() {
        for (let i = 0; i < 16; i++) {
            // Create storage object for this tile
            this.tileCanvasStates.set(i, {
                // Store the state of each of the 9 canvases
                canvases: this.createEmptyCanvasSet(),
                tilemapState: this.createEmptyTilemapState(),
                // Store the layer data from State
                layerData: null,
                // Store current tool and color for this tile
                toolState: {
                    currentTool: 'pencil',
                    currentColor: '#282828',
                    brushSize: 0,
                    opacity: 1.0
                }
            });
        }
        console.log('Initialized canvas storage for 16 tiles');
    }

    // NEW: Create a set of empty canvases for storage
    createEmptyCanvasSet() {
        const positions = [
            'preview-0-0', 'preview-0-1', 'preview-0-2',
            'preview-1-0', 'editor-canvas', 'preview-1-2',
            'preview-2-0', 'preview-2-1', 'preview-2-2'
        ];
        
        const canvasSet = {};
        positions.forEach(canvasId => {
            const canvas = document.createElement('canvas');
            canvas.width = Config.CANVAS_SIZE || 512;
            canvas.height = Config.CANVAS_SIZE || 512;
            canvasSet[canvasId] = canvas;
        });
        
        return canvasSet;
    }

    // NEW: Create empty tilemap state
    createEmptyTilemapState() {
        return {
            'top-left': false,
            'top-center': false,
            'top-right': false,
            'middle-left': false,
            'middle-right': false,
            'bottom-left': false,
            'bottom-center': false,
            'bottom-right': false
        };
    }

    // MODIFIED: Save current canvas state before switching tiles
    saveCurrentTileState() {
        if (this.selectedTile === null) return;
        
        const tileIndex = parseInt(this.selectedTile.dataset.index);
        const state = this.tileCanvasStates.get(tileIndex);
        
        if (!state) return;
        
        // Save ALL canvas contents including the editor canvas
        const positions = [
            'preview-0-0', 'preview-0-1', 'preview-0-2',
            'preview-1-0', 'editor-canvas', 'preview-1-2',
            'preview-2-0', 'preview-2-1', 'preview-2-2'
        ];
        
        positions.forEach(canvasId => {
            const sourceCanvas = document.getElementById(canvasId);
            if (sourceCanvas && state.canvases[canvasId]) {
                const ctx = state.canvases[canvasId].getContext('2d');
                ctx.clearRect(0, 0, state.canvases[canvasId].width, state.canvases[canvasId].height);
                ctx.drawImage(sourceCanvas, 0, 0);
            }
        });
        
        // Save the layer data from State
        if (typeof State !== 'undefined' && State.layers) {
            state.layerData = State.layers.map(layer => ({
                id: layer.id,
                name: layer.name,
                visible: layer.visible,
                opacity: layer.opacity,
                canvasData: layer.canvas ? layer.canvas.toDataURL() : null
            }));
        }
        
        console.log(`Saved canvas state for tile ${tileIndex} (including editor canvas and ${state.layerData?.length || 0} layers)`);
    }

    // NEW: Restore canvas state for a tile
    restoreTileState(tileIndex) {
        const state = this.tileCanvasStates.get(tileIndex);
        
        if (!state) {
            console.warn(`No state found for tile ${tileIndex}`);
            return;
        }
        
        // First, restore the layer data to State
        if (typeof State !== 'undefined' && state.layerData) {
            // Clear current layers
            State.layers = [];
            
            // Restore layers from saved data
            state.layerData.forEach(layerData => {
                const canvas = document.createElement('canvas');
                canvas.width = Config.CANVAS_SIZE || 512;
                canvas.height = Config.CANVAS_SIZE || 512;
                
                const layer = {
                    id: layerData.id,
                    name: layerData.name,
                    visible: layerData.visible,
                    opacity: layerData.opacity,
                    canvas: canvas
                };
                
                // Restore canvas data
                if (layerData.canvasData) {
                    const img = new Image();
                    img.onload = () => {
                        const ctx = canvas.getContext('2d');
                        ctx.clearRect(0, 0, canvas.width, canvas.height);
                        ctx.drawImage(img, 0, 0);
                        
                        // Update the display after image loads
                        if (typeof TilemapCore !== 'undefined' && TilemapCore.updatePreviews) {
                            TilemapCore.updatePreviews();
                        }
                    };
                    img.src = layerData.canvasData;
                } else {
                    // Clear canvas if no data
                    const ctx = canvas.getContext('2d');
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                }
                
                State.layers.push(layer);
            });
            
            // Ensure active layer index is valid
            if (State.activeLayerIndex >= State.layers.length) {
                State.activeLayerIndex = Math.max(0, State.layers.length - 1);
            }
            
            // Update layer UI
            if (typeof LayerManager !== 'undefined' && LayerManager.renderList) {
                LayerManager.renderList();
            }
        }
        
        // Restore tool state for this tile
        if (typeof State !== 'undefined' && state.toolState) {
            State.currentTool = state.toolState.currentTool;
            State.currentColor = state.toolState.currentColor;
            State.brushSize = state.toolState.brushSize;
            State.opacity = state.toolState.opacity;
            
            // Update UI to reflect the restored tool state
            if (typeof ToolManager !== 'undefined') {
                ToolManager.updateToolUI();
                ToolManager.updateBrushSizeLabel();
                ToolManager.updateBrushSizePresets(State.currentTool);
                ToolManager.updateActivePresetButton(State.brushSize);
                ToolManager.updatePanelBrushDisplay(State.brushSize);
            }
        }
        
        // Clear ALL canvases
        const allPositions = [
            'preview-0-0', 'preview-0-1', 'preview-0-2',
            'preview-1-0', 'editor-canvas', 'preview-1-2',
            'preview-2-0', 'preview-2-1', 'preview-2-2'
        ];
        
        allPositions.forEach(canvasId => {
            const canvas = document.getElementById(canvasId);
            if (canvas) {
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
        });
        
        // Restore ALL saved canvas contents
        allPositions.forEach(canvasId => {
            const targetCanvas = document.getElementById(canvasId);
            if (targetCanvas && state.canvases[canvasId]) {
                const ctx = targetCanvas.getContext('2d');
                ctx.drawImage(state.canvases[canvasId], 0, 0);
            }
        });
        
        // Restore tilemap states
        if (typeof tilemapManager !== 'undefined') {
            const mapPositionToCanvas = {
                'top-left': 'preview-0-0',
                'top-center': 'preview-0-1',
                'top-right': 'preview-0-2',
                'middle-left': 'preview-1-0',
                'middle-right': 'preview-1-2',
                'bottom-left': 'preview-2-0',
                'bottom-center': 'preview-2-1',
                'bottom-right': 'preview-2-2'
            };
            
            Object.entries(mapPositionToCanvas).forEach(([position, canvasId]) => {
                tilemapManager.setTileState(canvasId, state.tilemapState[position]);
            });
        }
        
        console.log(`Restored canvas state for tile ${tileIndex} (including editor canvas, ${state.layerData?.length || 0} layers, and tool state)`);
    }

    selectTile(tileElement) {
        // Save the current tile's state before switching
        this.saveCurrentTileState();
        
        // Remove selection from previous tile
        if (this.selectedTile) {
            this.selectedTile.classList.remove('selected');
        }

        // Select new tile
        this.selectedTile = tileElement;
        this.selectedTile.classList.add('selected');

        const tileIndex = parseInt(tileElement.dataset.index);
        console.log('Selected tile:', tileIndex);

        // Get tile data from dual grid
        const tileData = this.dualGridData.tiles.find(tile => tile.index === tileIndex);
        if (tileData) {
            console.log('Tile data:', tileData);
            
            // Restore the canvas state for this tile
            this.restoreTileState(tileIndex);
            
            // Update the tilemap display based on saved state
            this.updateTilemapDisplay(tileData);
            
            // Load the frame for this tile
            this.loadFrameForTile(tileData);
            
            // Display the frame in the main editor canvas
            this.displayFrameInEditor(tileData);
            
            // Show the frame canvas for this tile
            this.showFrameCanvas(tileIndex);
        }
    }

    updateTilemapDisplay(tileData) {
        console.log('Updating tilemap display for:', tileData.name);

        const tileIndex = tileData.index;
        const state = this.tileCanvasStates.get(tileIndex);
        
        if (!state) return;

        // Get the maps configuration
        const maps = tileData.maps;

        // Save the tilemap state
        state.tilemapState = { ...maps };

        // Map positions to canvas IDs for the 3x3 grid
        const mapPositionToCanvas = {
            'top-left': 'preview-0-0',
            'top-center': 'preview-0-1',
            'top-right': 'preview-0-2',
            'middle-left': 'preview-1-0',
            'middle-right': 'preview-1-2',
            'bottom-left': 'preview-2-0',
            'bottom-center': 'preview-2-1',
            'bottom-right': 'preview-2-2'
        };

        // Update the tilemap manager to reflect the selected tile's state
        if (typeof tilemapManager !== 'undefined') {
            Object.entries(mapPositionToCanvas).forEach(([position, canvasId]) => {
                tilemapManager.setTileState(canvasId, maps[position]);
            });
        }
    }

    // Rest of your existing methods remain the same...
    async loadDualGridData() {
        try {
            const response = await fetch('json/4x4_dual_grid.json');
            if (!response.ok) {
                throw new Error('Failed to load dual grid data');
            }
            this.dualGridData = await response.json();
            console.log('Dual grid data loaded:', this.dualGridData);
            
            this.tilesetImage = new Image();
            this.tilesetImage.src = 'gfx/tileset.png';
        } catch (error) {
            console.error('Error loading dual grid data:', error);
            this.dualGridData = {
                tilemap_type: "4x4_dual_grid",
                total_tiles: 16,
                tiles: []
            };
            for (let i = 0; i < 16; i++) {
                this.dualGridData.tiles.push({
                    index: i,
                    position: `row_${Math.floor(i/4)}_col_${i%4}`,
                    name: `tile_${i}`,
                    overlaps: [],
                    neighbors: {
                        "top-left": false,
                        "top-right": false,
                        "bottom-left": false,
                        "bottom-right": false
                    },
                    maps: {
                        "top-left": false,
                        "top-center": false,
                        "top-right": false,
                        "middle-left": false,
                        "middle-right": false,
                        "bottom-left": false,
                        "bottom-center": false,
                        "bottom-right": false
                    }
                });
            }
        }
    }

    setupDualGridUI() {
        const existingContainer = document.getElementById('dual-grid-container');
        if (existingContainer) {
            console.log('Dual grid already exists, removing it first');
            existingContainer.remove();
        }

        const tilemapPanel = document.getElementById('panel-tilemap');
        
        if (!tilemapPanel) {
            console.error('Tilemap panel not found');
            return;
        }

        const dualGridContainer = document.createElement('div');
        dualGridContainer.id = 'dual-grid-container';
        dualGridContainer.className = 'dual-grid-container';

        const title = document.createElement('div');
        title.className = 'dual-grid-title';
        title.textContent = 'Dual Grid Tiles';

        const grid = document.createElement('div');
        grid.className = 'dual-grid';
        grid.style.gridTemplateColumns = `repeat(${this.gridSize}, ${this.tileSize}px)`;
        grid.style.gridTemplateRows = `repeat(${this.gridSize}, ${this.tileSize}px)`;

        for (let i = 0; i < this.gridSize * this.gridSize; i++) {
            const tile = document.createElement('div');
            tile.className = 'dual-grid-tile';
            tile.dataset.index = i;
            tile.dataset.row = Math.floor(i / this.gridSize);
            tile.dataset.col = i % this.gridSize;

            const canvas = document.createElement('canvas');
            canvas.width = this.tileSize;
            canvas.height = this.tileSize;
            canvas.className = 'dual-grid-canvas';

            this.drawTileContent(canvas, i);

            const info = document.createElement('div');
            info.className = 'dual-grid-tile-info';
            info.textContent = i;

            tile.appendChild(canvas);
            tile.appendChild(info);
            grid.appendChild(tile);
            this.tiles.push(tile);
        }

        dualGridContainer.appendChild(title);
        dualGridContainer.appendChild(grid);

        const tilemapGrid = document.getElementById('tilemapGrid');
        if (tilemapGrid) {
            const tilemapContainer = tilemapGrid.closest('.tilemap-container');
            if (tilemapContainer) {
                tilemapContainer.appendChild(dualGridContainer);
            } else {
                tilemapPanel.appendChild(dualGridContainer);
            }
        } else {
            tilemapPanel.appendChild(dualGridContainer);
        }

        this.addDualGridCSS();
        this.setupFrameCanvases();
    }

    setupEventListeners() {
        this.tiles.forEach(tile => {
            tile.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.selectTile(tile);
            });
        });

        this.addTileSizeControl();
        this.preventTilemapSquareSelection();
    }

    addDualGridCSS() {
        const style = document.createElement('style');
        style.textContent = `
            .dual-grid-container {
                margin: 15px 0;
                display: flex;
                flex-direction: column;
                align-items: center;
            }

            .dual-grid-title {
                font-size: 11px;
                text-transform: uppercase;
                color: var(--accent-tertiary);
                margin-bottom: 8px;
                letter-spacing: 0.5px;
                text-align: center;
                width: 100%;
            }

            .dual-grid {
                display: grid;
                gap: 2px;
                background: var(--bg-medium);
                padding: 4px;
                border-radius: 4px;
                border: 1px solid var(--border-color);
                width: fit-content;
            }

            .dual-grid-tile {
                position: relative;
                cursor: pointer;
                transition: all 0.2s ease;
                border: 1px solid var(--border-color);
                overflow: hidden;
            }

            .dual-grid-tile:hover {
                border-color: var(--accent-tertiary);
                box-shadow: 0 0 4px rgba(0, 217, 255, 0.3);
            }

            .dual-grid-tile.selected {
                background: var(--accent-primary);
                border-color: var(--accent-primary);
                box-shadow: 0 0 6px var(--border-glow);
            }

            .dual-grid-tile.has-frame {
                border: 2px solid var(--accent-secondary);
                box-shadow: 0 0 4px var(--border-glow);
            }

            .dual-grid-canvas {
                width: 100%;
                height: 100%;
                image-rendering: pixelated;
                image-rendering: crisp-edges;
            }

            .dual-grid-tile-info {
                position: absolute;
                bottom: 2px;
                right: 2px;
                font-size: 8px;
                color: var(--text-primary);
                background: rgba(0, 0, 0, 0.5);
                padding: 1px 3px;
                border-radius: 2px;
            }

            .dual-grid-controls {
                margin-top: 10px;
                display: flex;
                gap: 10px;
                align-items: center;
                width: 100%;
            }

            .tile-size-control {
                display: flex;
                align-items: center;
                gap: 5px;
                flex: 1;
            }

            .tile-size-input {
                width: 60px;
                padding: 4px;
                background: var(--bg-light);
                border: 1px solid var(--border-color);
                color: var(--text-primary);
                border-radius: 4px;
            }

            .tile-size-label {
                font-size: 11px;
                color: var(--text-secondary);
            }

            .dual-grid-apply-btn {
                padding: 4px 8px;
                font-size: 10px;
            }

            .frame-canvases-container {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                pointer-events: none;
                z-index: 1000;
                display: none;
            }

            .frame-canvas {
                position: absolute;
                image-rendering: pixelated;
                image-rendering: crisp-edges;
                border: 2px solid var(--accent-secondary);
                box-shadow: 0 0 10px rgba(0, 217, 255, 0.5);
                opacity: 0;
                transition: opacity 0.3s ease;
            }

            .frame-canvas.visible {
                opacity: 1;
            }
        `;
        document.head.appendChild(style);
    }

    addTileSizeControl() {
        const controls = document.createElement('div');
        controls.className = 'dual-grid-controls';

        const sizeControl = document.createElement('div');
        sizeControl.className = 'tile-size-control';

        const label = document.createElement('span');
        label.className = 'tile-size-label';
        label.textContent = 'Dual Grid Size:';

        const input = document.createElement('input');
        input.type = 'number';
        input.className = 'tile-size-input';
        input.value = this.tileSize;
        input.min = '8';
        input.max = '128';

        const applyBtn = document.createElement('button');
        applyBtn.className = 'btn dual-grid-apply-btn';
        applyBtn.textContent = 'Apply';
        applyBtn.addEventListener('click', () => {
            const newSize = parseInt(input.value);
            if (newSize >= 8 && newSize <= 128) {
                this.resizeTiles(newSize);
            }
        });

        sizeControl.appendChild(label);
        sizeControl.appendChild(input);
        controls.appendChild(sizeControl);
        controls.appendChild(applyBtn);

        const dualGridContainer = document.getElementById('dual-grid-container');
        if (dualGridContainer) {
            dualGridContainer.appendChild(controls);
        }
    }

    preventTilemapSquareSelection() {
        const tilemapSquares = document.querySelectorAll('.tilemap-square');
        tilemapSquares.forEach(square => {
            square.style.pointerEvents = 'none';
        });
    }

    drawCheckerboard(ctx, width, height) {
        const size = 8;
        
        for (let y = 0; y < height; y += size) {
            for (let x = 0; x < width; x += size) {
                ctx.fillStyle = ((x + y) / size) % 2 === 0 ? '#333333' : '#555555';
                ctx.fillRect(x, y, size, size);
            }
        }
    }

    resizeTiles(newSize) {
        this.tileSize = newSize;

        const grid = document.querySelector('.dual-grid');
        if (grid) {
            grid.style.gridTemplateColumns = `repeat(${this.gridSize}, ${this.tileSize}px)`;
            grid.style.gridTemplateRows = `repeat(${this.gridSize}, ${this.tileSize}px)`;
        }

        this.tiles.forEach(tile => {
            const canvas = tile.querySelector('canvas');
            if (canvas) {
                canvas.width = this.tileSize;
                canvas.height = this.tileSize;
                
                const ctx = canvas.getContext('2d');
                ctx.strokeStyle = '#00d9ff';
                ctx.lineWidth = 1;
                ctx.strokeRect(0, 0, this.tileSize, this.tileSize);
                
                const tileIndex = parseInt(tile.dataset.index);
                this.drawTileContent(canvas, tileIndex);
            }
        });

        console.log(`Resized tiles to ${this.tileSize}px`);
        
        if (this.selectedTile) {
            const tileIndex = parseInt(this.selectedTile.dataset.index);
            const tileData = this.dualGridData.tiles.find(tile => tile.index === tileIndex);
            if (tileData) {
                this.updateTilemapDisplay(tileData);
            }
        }
    }

    drawTileContent(canvas, tileIndex) {
        const ctx = canvas.getContext('2d');
        const tileData = this.dualGridData.tiles[tileIndex];
        
        if (tileData) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            ctx.strokeStyle = '#00d9ff';
            ctx.lineWidth = 1;
            ctx.strokeRect(0, 0, canvas.width, canvas.height);
            
            if (this.tilesetImage && this.tilesetImage.complete) {
                const tileRow = Math.floor(tileIndex / 4);
                const tileCol = tileIndex % 4;
                const tileX = tileCol * 64;
                const tileY = tileRow * 64;
                
                ctx.drawImage(
                    this.tilesetImage,
                    tileX, tileY, 64, 64,
                    0, 0, canvas.width, canvas.height
                );
            } else {
                const centerX = canvas.width / 2;
                const centerY = canvas.height / 2;
                const size = Math.min(canvas.width, canvas.height) * 0.8;
                
                ctx.fillStyle = '#00ff41';
                ctx.fillRect(centerX - size/2, centerY - size/2, size, size);
                
                ctx.fillStyle = '#ffffff';
                ctx.font = '8px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(tileIndex.toString(), centerX, centerY);
            }
            
            ctx.fillStyle = '#ffffff';
            ctx.font = '8px Arial';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'bottom';
            ctx.fillText(tileIndex, canvas.width - 2, canvas.height - 2);
        }
    }

    getSelectedTileData() {
        if (!this.selectedTile) return null;
        
        const tileIndex = parseInt(this.selectedTile.dataset.index);
        return this.dualGridData.tiles.find(tile => tile.index === tileIndex);
    }

    getAllTilesData() {
        return this.dualGridData;
    }

    loadFrameForTile(tileData) {
        console.log('Loading frame for tile:', tileData.name);
        
        const frame = {
            tileIndex: tileData.index,
            tileName: tileData.name,
            tileData: tileData,
            timestamp: Date.now(),
            canvasImage: null
        };
        
        tileData.frame = frame;
        this.captureCanvasFrame(tileData);
        this.updateFrameDisplay(tileData);
    }

    captureCanvasFrame(tileData) {
        const editorCanvas = document.getElementById('editor-canvas');
        if (editorCanvas) {
            const frameCanvas = document.createElement('canvas');
            frameCanvas.width = editorCanvas.width;
            frameCanvas.height = editorCanvas.height;
            
            const frameCtx = frameCanvas.getContext('2d');
            frameCtx.drawImage(editorCanvas, 0, 0);
            
            tileData.frame.canvasImage = frameCanvas;
            
            console.log('Captured frame for tile:', tileData.name);
        }
    }

    updateFrameDisplay(tileData) {
        if (!tileData.frame) return;
        
        console.log('Displaying frame for tile:', tileData.name);
        
        const tileElement = this.tiles.find(tile =>
            parseInt(tile.dataset.index) === tileData.index
        );
        
        if (tileElement) {
            tileElement.classList.add('has-frame');
            
            const info = tileElement.querySelector('.dual-grid-tile-info');
            if (info) {
                info.textContent = `${tileData.index} (Frame)`;
            }
            
            this.updateTileCanvas(tileElement, tileData);
        }
    }

    updateTileCanvas(tileElement, tileData) {
        const canvas = tileElement.querySelector('canvas');
        if (canvas && tileData.frame && tileData.frame.canvasImage) {
            const ctx = canvas.getContext('2d');
            
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            ctx.drawImage(
                tileData.frame.canvasImage,
                0, 0, tileData.frame.canvasImage.width, tileData.frame.canvasImage.height,
                0, 0, canvas.width, canvas.height
            );
            
            ctx.strokeStyle = '#00d9ff';
            ctx.lineWidth = 1;
            ctx.strokeRect(0, 0, canvas.width, canvas.height);
            
            ctx.fillStyle = '#ffffff';
            ctx.font = '8px Arial';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'bottom';
            ctx.fillText(tileData.index, canvas.width - 2, canvas.height - 2);
        }
    }

    displayFrameInEditor(tileData) {
        if (!tileData.frame || !tileData.frame.canvasImage) {
            console.log('No frame image available for tile:', tileData.name);
            return;
        }
        
        console.log('Displaying frame in editor for tile:', tileData.name);
        
        const editorCanvas = document.getElementById('editor-canvas');
        if (editorCanvas) {
            const editorCtx = editorCanvas.getContext('2d');
            
            editorCtx.clearRect(0, 0, editorCanvas.width, editorCanvas.height);
            
            editorCtx.drawImage(
                tileData.frame.canvasImage,
                0, 0, tileData.frame.canvasImage.width, tileData.frame.canvasImage.height,
                0, 0, editorCanvas.width, editorCanvas.height
            );
            
            console.log('Frame displayed in editor canvas');
        }
    }

    setupFrameCanvases() {
        const mainCanvas = document.getElementById('editor-canvas');
        if (!mainCanvas) {
            console.error('Main editor canvas not found');
            return;
        }

        this.frameCanvasesContainer = document.createElement('div');
        this.frameCanvasesContainer.id = 'frame-canvases-container';
        this.frameCanvasesContainer.className = 'frame-canvases-container';

        const mainCanvasRect = mainCanvas.getBoundingClientRect();
        this.frameCanvasesContainer.style.width = `${mainCanvasRect.width}px`;
        this.frameCanvasesContainer.style.height = `${mainCanvasRect.height}px`;

        for (let i = 0; i < 16; i++) {
            const frameCanvas = document.createElement('canvas');
            frameCanvas.id = `frame-canvas-${i}`;
            frameCanvas.className = 'frame-canvas';
            frameCanvas.width = mainCanvas.width;
            frameCanvas.height = mainCanvas.height;
            frameCanvas.dataset.tileIndex = i;
            
            frameCanvas.style.left = '0';
            frameCanvas.style.top = '0';
            frameCanvas.style.width = `${mainCanvas.width}px`;
            frameCanvas.style.height = `${mainCanvas.height}px`;
            
            this.frameCanvasesContainer.appendChild(frameCanvas);
            this.frameCanvases.push(frameCanvas);
        }

        document.body.appendChild(this.frameCanvasesContainer);
    }

    showFrameCanvas(tileIndex) {
        if (!this.frameCanvasesContainer) return;

        this.frameCanvases.forEach(canvas => {
            canvas.classList.remove('visible');
        });

        const frameCanvas = this.frameCanvases[tileIndex];
        if (frameCanvas) {
            frameCanvas.classList.add('visible');
            this.centerFrameCanvas(frameCanvas);
            this.updateFrameCanvasContent(tileIndex);
        }
    }

    centerFrameCanvas(frameCanvas) {
        const mainCanvas = document.getElementById('editor-canvas');
        if (!mainCanvas) return;

        const mainCanvasRect = mainCanvas.getBoundingClientRect();
        const frameCanvasRect = frameCanvas.getBoundingClientRect();

        const centerX = (window.innerWidth - frameCanvasRect.width) / 2;
        const centerY = (window.innerHeight - frameCanvasRect.height) / 2;

        frameCanvas.style.position = 'fixed';
        frameCanvas.style.left = `${centerX}px`;
        frameCanvas.style.top = `${centerY}px`;
        frameCanvas.style.zIndex = '1001';
    }

    updateFrameCanvasContent(tileIndex) {
        const tileData = this.dualGridData.tiles[tileIndex];
        if (!tileData || !tileData.frame || !tileData.frame.canvasImage) return;

        const frameCanvas = this.frameCanvases[tileIndex];
        if (!frameCanvas) return;

        const ctx = frameCanvas.getContext('2d');
        
        ctx.clearRect(0, 0, frameCanvas.width, frameCanvas.height);
        
        ctx.drawImage(
            tileData.frame.canvasImage,
            0, 0, tileData.frame.canvasImage.width, tileData.frame.canvasImage.height,
            0, 0, frameCanvas.width, frameCanvas.height
        );
        
        ctx.strokeStyle = '#00d9ff';
        ctx.lineWidth = 2;
        ctx.strokeRect(0, 0, frameCanvas.width, frameCanvas.height);
        
        ctx.fillStyle = '#ffffff';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(`Tile ${tileIndex}`, frameCanvas.width / 2, 10);
    }
}

// Create global dual grid manager instance
const dualGridManager = new DualGridManager();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = DualGridManager;
}