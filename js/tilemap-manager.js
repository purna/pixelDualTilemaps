// tilemap-manager.js
// Manages the 3x3 tilemap grid with active/inactive state and canvas connections

class TilemapManager {
    constructor() {
        this.activeTileStates = new Map(); // Track active/inactive state for each tile
        this.tiles = [];
        this.init();
    }

    init() {
        console.log('Initializing Tilemap Manager...');
        this.setupTilemapGrid();
        this.setupEventListeners();
        this.initializeTileStates();
        this.updateTileDisplays();
        this.ensureCenterTileClean(); // Ensure center tile never has active class
        console.log('Tilemap Manager initialized');
    }

    setupTilemapGrid() {
        const grid = document.getElementById('tilemapGrid');
        if (!grid) return;

        this.tiles = grid.querySelectorAll('.tilemap-square');
        
        // Set up each tile with canvas context
        this.tiles.forEach((tile, index) => {
            const canvas = tile.querySelector('canvas');
            if (canvas) {
                canvas.width = 32;
                canvas.height = 32;
                const ctx = canvas.getContext('2d');
                
                // Initialize with a green background (active state) for non-center tiles
                this.initializeTileCanvas(ctx, index, tile);
            }
        });
    }

    initializeTileCanvas(ctx, tileIndex, tileElement) {
        const row = parseInt(tileElement.dataset.row);
        const col = parseInt(tileElement.dataset.col);
        
        // Center tile (editor canvas) should be transparent with blue outline
        if (row === 1 && col === 1) {
            // Transparent background for center tile
            ctx.clearRect(0, 0, 32, 32);
            
            // Add a blue border to match the tile styling
            ctx.strokeStyle = '#00d9ff';
            ctx.lineWidth = 2;
            ctx.strokeRect(1, 1, 30, 30);
        } else {
            // Start with transparent background - CSS will handle the visual states
            ctx.clearRect(0, 0, 32, 32);
            
            // Only add a very subtle border that won't interfere with CSS styling
            ctx.strokeStyle = 'transparent';
            ctx.lineWidth = 0;
            ctx.strokeRect(0, 0, 32, 32);
        }
    }

    initializeTileStates() {
        // Initialize all tiles as active (true) except center tile
        this.tiles.forEach(tile => {
            const row = parseInt(tile.dataset.row);
            const col = parseInt(tile.dataset.col);
            const canvasId = tile.dataset.canvas;
            
            // Center tile (editor canvas) is not clickable and treated specially
            if (row === 1 && col === 1) {
                this.activeTileStates.set(canvasId, 'center');
            } else {
                // All other tiles start as active (green)
                this.activeTileStates.set(canvasId, true);
            }
        });
    }

    setupEventListeners() {
        this.tiles.forEach(tile => {
            const row = parseInt(tile.dataset.row);
            const col = parseInt(tile.dataset.col);
            
            // Center tile is not clickable
            if (!(row === 1 && col === 1)) {
                tile.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.toggleTileState(tile);
                });
            }
        });

        // Settings button for tilemap
        const settingsBtn = document.getElementById('tilemapSettingsBtn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.showTilemapSettings();
            });
        }
    }

    toggleTileState(tileElement) {
        const canvasId = tileElement.dataset.canvas;
        const currentState = this.activeTileStates.get(canvasId);
        
        // Toggle between active (true) and inactive (false)
        const newState = !currentState;
        this.activeTileStates.set(canvasId, newState);
        
        // Update the visual display
        this.updateTileDisplay(tileElement, newState);
        
        // Update the actual canvas visibility/appearance
        this.updateCanvasAppearance(canvasId, newState);
        
        console.log(`Tile ${canvasId} toggled to:`, newState ? 'active (green)' : 'inactive (checkerboard)');
        
        // Trigger callback
        this.onTileStateChanged(canvasId, newState);
    }

    updateTileDisplay(tileElement, isActive) {
        const row = parseInt(tileElement.dataset.row);
        const col = parseInt(tileElement.dataset.col);
        
        // Center tile should never get the active class
        if (row === 1 && col === 1) {
            // Always remove active class from center tile
            tileElement.classList.remove('active');
            return;
        }
        
        // Remove all state classes
        tileElement.classList.remove('active');
        
        if (isActive) {
            // Active state - green background
            tileElement.classList.add('active');
        }
        // Inactive state - no active class, CSS will handle blue outline and checkerboard
    }

    updateCanvasAppearance(canvasId, isActive) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        // Skip any appearance changes for the editor canvas (center tile)
        if (canvasId === 'editor-canvas') {
            return;
        }

        const container = canvas.parentElement;
        
        if (isActive) {
            // Active: Show the canvas normally, remove any overlays
            canvas.style.opacity = '1';
            canvas.classList.remove('inactive');
            container.style.backgroundImage = ''; // Remove checkerboard
        } else {
            // Inactive: Hide canvas content with checkerboard overlay
            canvas.style.opacity = '0.3';
            canvas.classList.add('inactive');
            
            // Add checkerboard background to show it's inactive
            // Using the same background as tile-grid-container for consistency
            container.style.backgroundImage = '';
            container.style.backgroundColor = 'transparent';
        }
    }

    updateTileDisplays() {
        // Update all tile displays based on current state
        this.tiles.forEach(tile => {
            const canvasId = tile.dataset.canvas;
            const row = parseInt(tile.dataset.row);
            const col = parseInt(tile.dataset.col);
            const state = this.activeTileStates.get(canvasId);
            
            // Center tile should never be considered active
            if (row === 1 && col === 1) {
                this.updateTileDisplay(tile, false); // Force inactive state for center
                this.updateCanvasAppearance(canvasId, false);
                return;
            }
            
            const isActive = state === true;
            this.updateTileDisplay(tile, isActive);
            this.updateCanvasAppearance(canvasId, isActive);
        });
    }

    onTileStateChanged(canvasId, isActive) {
        // Notify other systems about the tile state change
        if (typeof InputHandler !== 'undefined') {
            const message = isActive ? 
                `Activated tile preview` : 
                `Deactivated tile preview - showing checkerboard`;
            InputHandler.showNotification(message, 'info');
        }
    }

    showTilemapSettings() {
        // Show current state summary
        const activeCount = Array.from(this.activeTileStates.values()).filter(state => state === true).length;
        const totalClickable = this.activeTileStates.size - 1; // Exclude center tile

        if (typeof Notifications !== 'undefined') {
            const notifications = new Notifications();
            notifications.info(`Tilemap: ${activeCount}/${totalClickable} tiles active`);
        }
    }

    // Get current state of all tiles
    getAllTileStates() {
        const states = {};
        this.activeTileStates.forEach((state, canvasId) => {
            states[canvasId] = state;
        });
        return states;
    }

    // Set state for a specific tile
    setTileState(canvasId, isActive) {
        if (this.activeTileStates.has(canvasId)) {
            // Don't allow changing the state of the center tile
            if (canvasId === 'editor-canvas') {
                console.log('Cannot change state of center tile (editor-canvas)');
                return;
            }
            
            this.activeTileStates.set(canvasId, isActive);
            
            // Find the corresponding tile element
            const tile = Array.from(this.tiles).find(t => t.dataset.canvas === canvasId);
            if (tile) {
                this.updateTileDisplay(tile, isActive);
                this.updateCanvasAppearance(canvasId, isActive);
            }
        }
    }

    // Get active tiles for export or processing
    getActiveTiles() {
        const activeTiles = [];
        this.activeTileStates.forEach((state, canvasId) => {
            if (state === true) {
                const canvas = document.getElementById(canvasId);
                if (canvas) {
                    activeTiles.push({
                        canvasId,
                        canvas,
                        dataURL: canvas.toDataURL()
                    });
                }
            }
        });
        return activeTiles;
    }

    // Reset all tiles to active state (except center)
    resetAllTiles() {
        this.tiles.forEach(tile => {
            const row = parseInt(tile.dataset.row);
            const col = parseInt(tile.dataset.col);
            const canvasId = tile.dataset.canvas;
            
            if (!(row === 1 && col === 1)) {
                this.setTileState(canvasId, true);
            }
        });
        
        // Ensure center tile never has active class
        this.ensureCenterTileClean();
    }

    // Ensure center tile never has active class
    ensureCenterTileClean() {
        const centerTile = Array.from(this.tiles).find(tile => {
            const row = parseInt(tile.dataset.row);
            const col = parseInt(tile.dataset.col);
            return row === 1 && col === 1;
        });
        
        if (centerTile) {
            centerTile.classList.remove('active');
        }
    }

    // Save state to localStorage
    saveState() {
        const state = this.getAllTileStates();
        localStorage.setItem('tilemapStates', JSON.stringify(state));
    }

    // Load state from localStorage
    loadState() {
        try {
            const saved = localStorage.getItem('tilemapStates');
            if (saved) {
                const state = JSON.parse(saved);
                Object.keys(state).forEach(canvasId => {
                    this.setTileState(canvasId, state[canvasId]);
                });
            }
        } catch (error) {
            console.warn('Failed to load tilemap states:', error);
        }
    }
}

// Create global tilemap manager instance
const tilemapManager = new TilemapManager();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        // Already initialized in constructor, but ensure DOM is ready
        console.log('Tilemap Manager ready');
    });
}

// Load saved state when page loads
window.addEventListener('load', () => {
    tilemapManager.loadState();
});

// Save state before page unload
window.addEventListener('beforeunload', () => {
    tilemapManager.saveState();
});

// Export for module usage if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TilemapManager;
}

/*
TILEMAP MANAGER USAGE:

Initial State:
- All tiles start as ACTIVE (green background) except center tile
- Center tile (editor-canvas) is not clickable and shows transparent background with blue outline
- Clicking any tile toggles between ACTIVE and INACTIVE states

ACTIVE State (Green):
- Tile shows green background
- Corresponding canvas in main grid is fully visible
- No checkerboard overlay

INACTIVE State (Blue outline + Checkerboard):
- Tile shows blue outline with transparent background
- Black checkerboard pattern overlays the tile
- Corresponding canvas in main grid becomes semi-transparent (30% opacity)
- Canvas shows checkerboard pattern to indicate it's inactive

Center Tile (editor-canvas):
- Always shows transparent background with blue outline
- Not clickable (represents the main editing area)
- No overlay effects on the actual editor canvas
- Distinct styling to set it apart from other tiles
- Canvas appearance never changes (always fully visible)

State Persistence:
- Tile states are automatically saved to localStorage
- States are restored when page is reloaded
- Use resetAllTiles() to restore all tiles to active state
*/