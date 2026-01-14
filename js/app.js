// app.js
// Main application initialization and coordination

const App = {
    initialized: false,
    tutorialConfig: null,
    tutorialSystem: null,
    
    async init() {
        if (this.initialized) {
            console.warn('App already initialized');
            return;
        }
        
        console.log('Initializing Seamless Tilemap Editor Pro...');
        
        try {
            // Initialize core modules in order
            await this.initializeModules();
            
            // Set up global event handlers
            this.setupGlobalHandlers();
            
            // Load autosave if available
            this.loadAutosave();
            
            // Start auto-save
            FileManager.startAutoSave();
            
            this.initialized = true;
            
            console.log('Seamless Tilemap Editor Pro initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize application:', error);
            if (typeof InputHandler !== 'undefined') {
                InputHandler.showNotification('Failed to initialize application', 'error');
            }
        }
    },
    
    async initializeModules() {
        // Initialize DOM first
        DOM.init();

        // Initialize core functionality
        TilemapCore.init();

        // Initialize managers
        PaletteManager.init();
        LayerManager.init();

        // After layers are initialized, update the previews to ensure canvas loads immediately
        if (typeof TilemapCore !== 'undefined' && TilemapCore.updatePreviews) {
            console.log('Updating previews after layer initialization to ensure immediate canvas loading');
            TilemapCore.updatePreviews();
        } else {
            console.warn('TilemapCore.updatePreviews not available');
        }

        ToolManager.init();
        FileManager.init();
        SettingsManager.init();
        ZoomManager.init();

        // Initialize dual grid manager
        if (typeof dualGridManager !== 'undefined') {
            await dualGridManager.init();
        } else {
            console.warn('Dual grid manager not available');
        }

        // Initialize UI and Input handlers
        UIManager.init();
        InputHandler.init();

        // Initialize tutorial system
        this.initializeTutorialSystem();

        // Update initial UI state
        State.updateUI();
        ToolManager.updateActivePresetButton(State.brushSize);
        FileManager.updateHistoryButtons();

        console.log('All modules initialized');
    },
    
    setupGlobalHandlers() {
        // Handle window resize
        window.addEventListener('resize', this.handleResize.bind(this));
        
        // Handle visibility change (for auto-save)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                FileManager.autoSave();
            }
        });
        
        // Handle before unload (save confirmation)
        window.addEventListener('beforeunload', (e) => {
            if (State.hasUnsavedChanges) {
                e.preventDefault();
                e.returnValue = '';
            }
        });
        
        // Handle drag and drop files
        document.addEventListener('dragover', (e) => {
            e.preventDefault();
        });
        
        document.addEventListener('drop', (e) => {
            e.preventDefault();
            this.handleFileDrop(e);
        });
        
        // Handle keyboard shortcuts globally
        document.addEventListener('keydown', this.handleGlobalKeydown.bind(this));
    },
    
    handleResize() {
        // Recalculate canvas positions if needed
        // For now, just update UI elements that depend on window size
        State.updateUI();
    },
    
    handleFileDrop(e) {
        const files = e.dataTransfer.files;
        
        if (files.length > 0) {
            const file = files[0];
            
            if (file.type.startsWith('image/')) {
                // Import image
                FileManager.importImage();
            } else if (file.name.endsWith('.json')) {
                // Load project
                FileManager.loadFromFile(file);
            }
        }
    },
    
    handleGlobalKeydown(e) {
        const key = e.key.toLowerCase();
        const ctrl = e.ctrlKey || e.metaKey;
        
        // Prevent default for handled shortcuts
        const handledKeys = ['b', 'e', 'i', 'l', 's', 'o', 'z', 'y'];
        
        if (handledKeys.includes(key) || (ctrl && handledKeys.includes(key))) {
            e.preventDefault();
        }
        
        // Handle specific shortcuts
        switch (key) {
            case 'escape':
                // Cancel current operation
                State.setDrawing(false);
                break;
                
            case 'delete':
            case 'backspace':
                // Clear canvas with delete key
                if (confirm('Clear the entire canvas? This action cannot be undone.')) {
                    TilemapCore.clearCanvas();
                    State.saveState();
                }
                break;
        }
    },
    
    loadAutosave() {
        const loaded = FileManager.loadAutoSave();
        if (loaded) {
            if (typeof Notifications !== 'undefined') {
                const notifications = new Notifications();
                notifications.info('Auto-saved project loaded');
            }
        }
    },
    
    
    // Tutorial system initialization
    initializeTutorialSystem() {
        // Initialize tutorial config
        this.tutorialConfig = new TutorialConfig();

        // Initialize tutorial system
        this.tutorialSystem = new TutorialSystem(this);

        // Initialize tutorial system after DOM is ready
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
            this.tutorialSystem.init();
        } else {
            document.addEventListener('DOMContentLoaded', () => {
                this.tutorialSystem.init();
            });
        }
    },

    // Public API methods
    getState() {
        return {
            initialized: this.initialized,
            currentTool: State.currentTool,
            hasUnsavedChanges: State.hasUnsavedChanges,
            layerCount: State.layers.length
        };
    },
    
    exportProject(format = 'png') {
        FileManager.exportProject(format);
    },
    
    importProject() {
        FileManager.loadProject();
    },
    
    reset() {
        if (confirm('Reset the application? This will clear all data.')) {
            // Clear autosave
            FileManager.clearAutoSave();
            
            // Reload page
            location.reload();
        }
    }
};

// Initialize application when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => App.init());
} else {
    App.init();
}

// Export for potential module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { App, State, DOM, TilemapCore, PaletteManager, LayerManager, ToolManager, FileManager, InputHandler, UIManager };
}