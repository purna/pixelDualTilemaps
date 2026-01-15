//  - FIXED VERSION
// Now each of the 16 tiles stores its own canvas state

class DualGridManager {
    constructor() {
        this.tiles = [];
        this.selectedTile = null;
        this.tileSize = Config.TILE_DIM;
        this.gridSize = 4;
        this.dualGridData = null;
        this.frameCanvases = [];
        this.frameCanvasesContainer = null;
        
        // Tile state manager for handling canvas state of each tile
        this.tileStateManager = new TileStateManager();
        
        this.init();
    }

    async init() {
        console.log('Initializing Dual Grid Manager...');
        await this.loadDualGridData();
        this.setupDualGridUI();
        this.setupEventListeners();
        
        // Initialize tile state storage for all 16 tiles
        this.tileStateManager.initializeTileStorage();
        
        console.log('Dual Grid Manager initialized');
    }

   // MODIFIED: Save current canvas state before switching tiles
   saveCurrentTileState() {
       if (this.selectedTile === null) return;
       
       const tileIndex = parseInt(this.selectedTile.dataset.index);
       
       // Ensure State.layers is initialized
       this.ensureStateLayersInitialized();
       
       // Save canvas contents using the tile state manager
       this.tileStateManager.saveTileCanvasState(tileIndex, this.getCanvasElements());
       
       // Save DEEP COPY of layer data from State (not references)
       if (typeof State !== 'undefined' && State.layers) {
           const layerData = State.layers.map(layer => {
               // Create a new canvas and copy the pixel data
               const canvasDataURL = layer.canvas ? layer.canvas.toDataURL() : null;
               
               return {
                   id: layer.id,
                   name: layer.name,
                   visible: layer.visible,
                   opacity: layer.opacity,
                   canvasData: canvasDataURL
               };
           });
           
           this.tileStateManager.saveTileLayerData(tileIndex, layerData);
       }
       
       // Save tool state for this tile
       if (typeof State !== 'undefined') {
           const toolState = {
               currentTool: State.currentTool || 'pencil',
               currentColor: State.currentColor || '#282828',
               brushSize: State.brushSize || 0,
               opacity: State.opacity || 1.0
           };
           this.tileStateManager.saveTileToolState(tileIndex, toolState);
       }
       
       console.log(`Saved canvas state for tile ${tileIndex} with ${State.layers ? State.layers.length : 0} layers`);
   }

    // NEW: Restore canvas state for a tile
    async restoreTileState(tileIndex) {
        const tileState = this.tileStateManager.getTileState(tileIndex);
        
        if (!tileState) {
            console.warn(`No state found for tile ${tileIndex}`);
            return;
        }
        
        // First, clear all canvases immediately to prevent showing old content
        const canvasElements = this.getCanvasElements();
        Object.values(canvasElements).forEach(canvas => {
            if (canvas) {
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
        });
        
        // Clear the layer data in State
        let layerData = this.tileStateManager.getTileLayerData(tileIndex);
        
        // If no saved layer data exists, this is a fresh tile - create default layer
        if (!layerData && typeof State !== 'undefined') {
            layerData = [{
                id: Date.now(),
                name: 'Layer 1',
                visible: true,
                opacity: 1.0,
                canvasData: null
            }];
            console.log(`Created default layer for fresh tile ${tileIndex}`);
        }
        
        // Ensure State.layers is initialized
        this.ensureStateLayersInitialized();
        
        if (typeof State !== 'undefined' && layerData) {
            // Clear current layers
            State.layers = [];
            
            // Create an array of promises for image loading
            const imageLoadPromises = [];
            
            // Restore layers from saved data
            layerData.forEach(layerData => {
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
                
                // Clear canvas first
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                
                // Restore canvas data
                if (layerData.canvasData) {
                    const imagePromise = new Promise((resolve) => {
                        const img = new Image();
                        img.onload = () => {
                            ctx.clearRect(0, 0, canvas.width, canvas.height);
                            ctx.drawImage(img, 0, 0);
                            resolve();
                        };
                        img.onerror = () => {
                            console.error('Failed to load layer image');
                            resolve(); // Resolve anyway to not block
                        };
                        img.src = layerData.canvasData;
                    });
                    imageLoadPromises.push(imagePromise);
                }
                
                State.layers.push(layer);
            });
            
            // Wait for all images to load
            await Promise.all(imageLoadPromises);
            
            // Now update the display after all images are loaded
            if (typeof TilemapCore !== 'undefined' && TilemapCore.updatePreviews) {
                TilemapCore.updatePreviews();
            }
            
            // Ensure active layer index is valid
            if (State.activeLayerIndex >= State.layers.length) {
                State.activeLayerIndex = Math.max(0, State.layers.length - 1);
            }
            
            // Update layer UI
            if (typeof LayerManager !== 'undefined' && LayerManager.renderLayers) {
                LayerManager.renderLayers();
            }
        }
        
        // Restore tool state for this tile
        const toolState = this.tileStateManager.getTileToolState(tileIndex);
        if (typeof State !== 'undefined' && toolState) {
            State.currentTool = toolState.currentTool;
            State.currentColor = toolState.currentColor;
            State.brushSize = toolState.brushSize;
            State.opacity = toolState.opacity;
            
            // Update UI to reflect the restored tool state
            if (typeof ToolManager !== 'undefined') {
                ToolManager.updateToolUI();
                ToolManager.updateBrushSizeLabel();
                ToolManager.updateBrushSizePresets(State.currentTool);
                ToolManager.updateActivePresetButton(State.brushSize);
                ToolManager.updatePanelBrushDisplay(State.brushSize);
            }
        }
        
        // Restore canvas contents using the tile state manager
        this.tileStateManager.restoreTileCanvasState(tileIndex, this.getCanvasElements());
        
        // Restore tilemap states
        const tilemapState = this.tileStateManager.getTilemapState(tileIndex);
        if (typeof tilemapManager !== 'undefined' && tilemapState) {
            // Reuse the mapPositionToCanvas constant from the class
            const mapPositionToCanvas = this.getMapPositionToCanvas();
            
            Object.entries(mapPositionToCanvas).forEach(([position, canvasId]) => {
                tilemapManager.setTileState(canvasId, tilemapState[position]);
            });
        }
        
        console.log(`Restored canvas state for tile ${tileIndex}`);
    }
    
    /**
     * Helper method to ensure State.layers is properly initialized
     */
    ensureStateLayersInitialized() {
        if (typeof State !== 'undefined' && !State.layers) {
            State.layers = [];
        }
    }

    async selectTile(tileElement) {
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
            
            // Show loading message
            this.showLoadingMessage();
            
            // Restore the canvas state for this tile
            await this.restoreTileState(tileIndex);
            
            // Update the tilemap display based on saved state
            this.updateTilemapDisplay(tileData);
            
            // Load the frame for this tile
            this.loadFrameForTile(tileData);
            
            // Display the frame in the main editor canvas
            this.displayFrameInEditor(tileData);
            
            // Show the frame canvas for this tile
            this.showFrameCanvas(tileIndex);
            
            // Hide loading message
            this.hideLoadingMessage();
        }
    }

    updateTilemapDisplay(tileData) {
        console.log('Updating tilemap display for:', tileData.name);

        const tileIndex = tileData.index;
        const tileState = this.tileStateManager.getTileState(tileIndex);
        
        if (!tileState) return;

        // Get the maps configuration
        const maps = tileData.maps;

        // Save the tilemap state using the tile state manager
        this.tileStateManager.saveTilemapState(tileIndex, maps);

        // Map positions to canvas IDs for the 3x3 grid
        const mapPositionToCanvas = this.getMapPositionToCanvas();

        // Update the tilemap manager to reflect the selected tile's state
        if (typeof tilemapManager !== 'undefined') {
            Object.entries(mapPositionToCanvas).forEach(([position, canvasId]) => {
                tilemapManager.setTileState(canvasId, maps[position]);
            });
        }
    }

    /**
     * Get the mapping of tilemap positions to canvas IDs
     * @returns {Object} Mapping of tilemap positions to canvas IDs
     */
    getMapPositionToCanvas() {
        return {
            'top-left': 'preview-0-0',
            'top-center': 'preview-0-1',
            'top-right': 'preview-0-2',
            'middle-left': 'preview-1-0',
            'middle-right': 'preview-1-2',
            'bottom-left': 'preview-2-0',
            'bottom-center': 'preview-2-1',
            'bottom-right': 'preview-2-2'
        };
    }

    /**
     * Get references to all canvas elements
     * @returns {Object} Object containing references to all canvas elements
     */
    getCanvasElements() {
        return {
            'preview-0-0': document.getElementById('preview-0-0'),
            'preview-0-1': document.getElementById('preview-0-1'),
            'preview-0-2': document.getElementById('preview-0-2'),
            'preview-1-0': document.getElementById('preview-1-0'),
            'editor-canvas': document.getElementById('editor-canvas'),
            'preview-1-2': document.getElementById('preview-1-2'),
            'preview-2-0': document.getElementById('preview-2-0'),
            'preview-2-1': document.getElementById('preview-2-1'),
            'preview-2-2': document.getElementById('preview-2-2')
        };
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
        this.setupLoadingMessage();
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
    // Styles have been moved to css/dual-grid.css
    // This method is kept for backward compatibility but does nothing
    console.log('Dual grid styles are now in css/dual-grid.css');
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

    setupLoadingMessage() {
        // Create loading message overlay
        this.loadingMessage = document.createElement('div');
        this.loadingMessage.id = 'dual-grid-loading';
        this.loadingMessage.className = 'dual-grid-loading';
        this.loadingMessage.style.display = 'none';
        
        const message = document.createElement('div');
        message.className = 'loading-message';
        message.textContent = 'Loading tile...';
        
        this.loadingMessage.appendChild(message);
        document.body.appendChild(this.loadingMessage);
    }

    showLoadingMessage() {
        if (this.loadingMessage) {
            this.loadingMessage.style.display = 'flex';
        }
    }

    hideLoadingMessage() {
        if (this.loadingMessage) {
            this.loadingMessage.style.display = 'none';
        }
    }

    // NEW: Create a new instance of the current tile application
    addNewFrames() {
        console.log('Creating new instance of current tile application');

        // Get the currently selected tile
        const currentTileIndex = this.selectedTile ? parseInt(this.selectedTile.dataset.index) : 0;
        const currentTileData = this.dualGridData.tiles[currentTileIndex];

        if (!currentTileData) {
            console.error('No tile selected or tile data not found');
            if (typeof Notifications !== 'undefined') {
                const notifications = new Notifications();
                notifications.error('No tile selected. Please select a tile first.');
            }
            return;
        }

        // Save the current state of the selected tile
        this.saveCurrentTileState();

        // Find an available slot for the new instance (look for first empty slot)
        let newTileIndex = -1;
        for (let i = 0; i < 16; i++) {
            const tileData = this.dualGridData.tiles[i];
            
            // Check if this tile has no frame (is empty)
            if (!tileData.frame || !tileData.frame.canvasImage) {
                newTileIndex = i;
                break;
            }
        }

        // If no empty slots, find the next available index beyond current tiles
        if (newTileIndex === -1) {
            newTileIndex = this.dualGridData.tiles.length;
            if (newTileIndex >= 16) {
                if (typeof Notifications !== 'undefined') {
                    const notifications = new Notifications();
                    notifications.error('Maximum 16 tiles reached. Cannot create more.');
                }
                return;
            }
        }

        // Create a new tile data object based on the current tile
        const newTileData = {
            index: newTileIndex,
            position: `row_${Math.floor(newTileIndex/4)}_col_${newTileIndex%4}`,
            name: `tile_${newTileIndex}`,
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
        };

        // Add the new tile to the dual grid data
        if (newTileIndex >= this.dualGridData.tiles.length) {
            this.dualGridData.tiles.push(newTileData);
        } else {
            this.dualGridData.tiles[newTileIndex] = newTileData;
        }

        // The tile state manager already initializes the tile state, no need to do it here

        // Create a new frame for this tile
        this.loadFrameForTile(newTileData);

        // Update the dual grid UI to show the new tile
        this.updateDualGridUI();

        // Select the new tile
        const newTileElement = this.tiles[newTileIndex];
        if (newTileElement) {
            this.selectTile(newTileElement);
        }

        console.log(`Created new tile instance at index ${newTileIndex}`);

        // Show success notification
        if (typeof Notifications !== 'undefined') {
            const notifications = new Notifications();
            notifications.success(`Created new tile instance at position ${newTileIndex}`);
        }
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