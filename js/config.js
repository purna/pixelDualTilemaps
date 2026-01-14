// config.js
// Configuration constants for the Seamless Tilemap Editor

const Config = {
    // Canvas settings
    TILE_DIM: 32,           // 32 logical pixels per tile
    PIXEL_SIZE: 16,         // 16 screen pixels per logical pixel
    CANVAS_SIZE: 32 * 16,   // 512px
    
    // Drawing settings
    DEFAULT_BRUSH_SIZE: 0,
    DRAW_COLOR: '#282828', // Dark gray for brush
    ERASE_COLOR: 'transparent', // Transparent for eraser
    
    // UI settings
    PALETTE_SIZE: 20,
    MAX_LAYERS: 10,
    
    // File handling
    SAVE_FORMAT: 'json',
    AUTOSAVE_INTERVAL: 30000, // 30 seconds
};