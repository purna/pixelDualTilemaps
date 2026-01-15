// tile-state-manager.js
// Manages the state of individual tiles in the dual grid system
// Each tile has independent layer data, similar to how frames work in animation

class TileStateManager {
    constructor() {
        this.tileStates = new Map(); // Maps tile index to TileState objects
    }

    /**
     * Initialize storage for all 16 tiles
     */
    initializeTileStorage() {
        for (let i = 0; i < 16; i++) {
            this.tileStates.set(i, new TileState(i));
        }
        console.log('Initialized tile state storage for 16 tiles');
    }

    /**
     * Get the state for a specific tile
     * @param {number} tileIndex - The index of the tile
     * @returns {TileState|null} The tile state or null if not found
     */
    getTileState(tileIndex) {
        return this.tileStates.get(tileIndex) || null;
    }

    /**
     * Save the current state of all canvases for a tile
     * @param {number} tileIndex - The index of the tile
     * @param {Object} canvasElements - Object containing references to canvas elements
     */
    saveTileCanvasState(tileIndex, canvasElements) {
        const tileState = this.getTileState(tileIndex);
        if (!tileState) return;

        tileState.saveCanvasContents(canvasElements);
    }

    /**
     * Restore the canvas state for a tile
     * @param {number} tileIndex - The index of the tile
     * @param {Object} canvasElements - Object containing references to canvas elements
     */
    restoreTileCanvasState(tileIndex, canvasElements) {
        const tileState = this.getTileState(tileIndex);
        if (!tileState) return;

        tileState.restoreCanvasContents(canvasElements);
    }

    /**
     * Save layer data for a tile - CREATES DEEP COPY
     * @param {number} tileIndex - The index of the tile
     * @param {Array} layerData - The layer data to save
     */
    saveTileLayerData(tileIndex, layerData) {
        const tileState = this.getTileState(tileIndex);
        if (!tileState) return;

        // CRITICAL: Create deep copy of layer data to prevent cross-contamination
        // Each layer's canvas data is already a data URL (string), so we create new objects
        tileState.layerData = layerData.map(layer => ({
            id: layer.id,
            name: layer.name,
            visible: layer.visible,
            opacity: layer.opacity,
            canvasData: layer.canvasData  // Data URL string (already a deep copy)
        }));
        
        console.log(`Saved ${layerData.length} layers for tile ${tileIndex}`);
    }

    /**
     * Get layer data for a tile - RETURNS DEEP COPY
     * @param {number} tileIndex - The index of the tile
     * @returns {Array|null} The layer data or null if not found
     */
    getTileLayerData(tileIndex) {
        const tileState = this.getTileState(tileIndex);
        
        if (!tileState || !tileState.layerData) {
            return null;
        }
        
        // CRITICAL: Return a deep copy to prevent modifications affecting stored data
        return tileState.layerData.map(layer => ({
            id: layer.id,
            name: layer.name,
            visible: layer.visible,
            opacity: layer.opacity,
            canvasData: layer.canvasData
        }));
    }

    /**
     * Save tool state for a tile
     * @param {number} tileIndex - The index of the tile
     * @param {Object} toolState - The tool state to save
     */
    saveTileToolState(tileIndex, toolState) {
        const tileState = this.getTileState(tileIndex);
        if (!tileState) return;

        tileState.toolState = { ...toolState };
    }

    /**
     * Get tool state for a tile
     * @param {number} tileIndex - The index of the tile
     * @returns {Object|null} The tool state or null if not found
     */
    getTileToolState(tileIndex) {
        const tileState = this.getTileState(tileIndex);
        return tileState ? { ...tileState.toolState } : null;
    }

    /**
     * Save tilemap state for a tile
     * @param {number} tileIndex - The index of the tile
     * @param {Object} tilemapState - The tilemap state to save
     */
    saveTilemapState(tileIndex, tilemapState) {
        const tileState = this.getTileState(tileIndex);
        if (!tileState) return;

        tileState.tilemapState = { ...tilemapState };
    }

    /**
     * Get tilemap state for a tile
     * @param {number} tileIndex - The index of the tile
     * @returns {Object|null} The tilemap state or null if not found
     */
    getTilemapState(tileIndex) {
        const tileState = this.getTileState(tileIndex);
        return tileState ? { ...tileState.tilemapState } : null;
    }
}

class TileState {
    constructor(tileIndex) {
        this.tileIndex = tileIndex;
        this.canvases = this.createEmptyCanvasSet();
        this.tilemapState = this.createEmptyTilemapState();
        
        // Initialize with default layer structure (like frames do)
        this.layerData = [{
            id: Date.now(),
            name: 'Layer 1',
            visible: true,
            opacity: 1.0,
            canvasData: null  // Will be populated when saved
        }];
        
        this.toolState = {
            currentTool: 'pencil',
            currentColor: '#282828',
            brushSize: 0,
            opacity: 1.0
        };
    }

    /**
     * Create a set of empty canvases for storage
     * @returns {Object} Object containing canvas elements for each position
     */
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

    /**
     * Create empty tilemap state
     * @returns {Object} Object with all tilemap positions set to false
     */
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

    /**
     * Save the contents of all canvases
     * @param {Object} canvasElements - Object containing references to canvas elements
     */
    saveCanvasContents(canvasElements) {
        const positions = Object.keys(this.canvases);
        
        positions.forEach(canvasId => {
            const sourceCanvas = canvasElements[canvasId];
            const storageCanvas = this.canvases[canvasId];
            
            if (sourceCanvas && storageCanvas) {
                const ctx = storageCanvas.getContext('2d');
                ctx.clearRect(0, 0, storageCanvas.width, storageCanvas.height);
                ctx.drawImage(sourceCanvas, 0, 0);
            }
        });
    }

    /**
     * Restore the contents of all canvases
     * @param {Object} canvasElements - Object containing references to canvas elements
     */
    restoreCanvasContents(canvasElements) {
        const positions = Object.keys(this.canvases);
        
        // Clear all canvases first
        positions.forEach(canvasId => {
            const targetCanvas = canvasElements[canvasId];
            if (targetCanvas) {
                const ctx = targetCanvas.getContext('2d');
                ctx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
            }
        });
        
        // Restore saved contents
        positions.forEach(canvasId => {
            const targetCanvas = canvasElements[canvasId];
            const storageCanvas = this.canvases[canvasId];
            
            if (targetCanvas && storageCanvas) {
                const ctx = targetCanvas.getContext('2d');
                ctx.drawImage(storageCanvas, 0, 0);
            }
        });
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TileStateManager, TileState };
}