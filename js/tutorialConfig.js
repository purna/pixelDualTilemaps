/**
 * Tutorial Configuration System
 *
 * This file defines the tutorial steps configuration and provides
 * an easy-to-use interface for setting up tutorials.
 */

/*
Config Seettings
arrowPositionOverride
Vertical Arrows (top/bottom): 'top-third', 'middle-third', 'bottom-third'
Horizontal Arrows (left/right): 'left-third', 'center-third', 'right-third'
Center Position: 'center' (default)
*/

class TutorialConfig {
    constructor() {
        // Default tutorial configuration
        this.tutorials = {
            'main': {
                enabled: true,
                steps: [
                    {
                        id: 'welcome',
                        elementId: 'editor-canvas',
                        position: 'center',
                        arrowPosition: 'none',
                        arrowPositionOverride: 'center',
                        marginOverride: '0',
                        heading: 'Welcome to Seamless Tilemap Editor Pro!',
                        content: 'This tutorial will guide you through creating seamless tile patterns. The 3x3 grid allows you to draw patterns that repeat perfectly.',
                        showNext: true,
                        showSkip: true
                    },
                    {
                        id: 'toolbar',
                        elementId: 'tool-buttons',
                        position: 'left',
                        arrowPosition: 'right',
                        arrowPositionOverride: 'middle-third',
                        marginOverride: '20px',
                        heading: 'Drawing Tools',
                        content: 'Use these tools to create your tile patterns: Pencil (P), Brush (B), Eraser (E), and Color Picker (I). Each tool has keyboard shortcuts for quick access.',
                        showNext: true,
                        showSkip: true
                    },
                    {
                        id: 'seamless-drawing',
                        elementId: 'editor-canvas',
                        position: 'center',
                        arrowPosition: 'none',
                        marginOverride: '10px',
                        heading: 'Seamless Drawing Technique',
                        content: 'Click and drag across the 9 tiles to create seamless patterns. Your drawing will automatically wrap around the edges to create perfect repeating tiles.',
                        showNext: true,
                        showSkip: true
                    },
                    {
                        id: 'tilemap-grid',
                        elementId: 'tilemapGrid',
                        position: 'bottom',
                        arrowPosition: 'top',
                        marginOverride: '15px',
                        heading: 'Tilemap Grid Control',
                        content: 'This 3x3 grid shows how your pattern repeats. Click any tile to toggle it active/inactive. Active tiles (green) contribute to your final pattern, while inactive tiles (checkerboard) are excluded.',
                        showNext: true,
                        showSkip: true
                    },
                    {
                        id: 'color-palette',
                        elementId: 'panel-palette',
                        position: 'right',
                        arrowPosition: 'left',
                        marginOverride: '30px',
                        heading: 'Color Palette Management',
                        content: 'Choose colors using the color picker or import palettes from Coolors URLs. Save your favorite colors to your palette for quick access during your workflow.',
                        showNext: true,
                        showSkip: true
                    },
                    {
                        id: 'layers-system',
                        elementId: 'panel-layers',
                        position: 'right',
                        arrowPosition: 'left',
                        arrowPositionOverride: 'top-third',
                        marginOverride: '40px',
                        heading: 'Advanced Layer System',
                        content: 'Create complex tile patterns using multiple layers. Add, remove, reorder, and toggle visibility of layers. Each layer can be edited independently and combined for sophisticated designs.',
                        showNext: true,
                        showSkip: true
                    },
                    {
                        id: 'export-options',
                        elementId: 'exportBtn',
                        position: 'top',
                        arrowPosition: 'bottom',
                        marginOverride: '20px',
                        heading: 'Export Your Tile Patterns',
                        content: 'When your seamless tile is complete, use the Export button to save as PNG or create sprite sheets. Your patterns are ready for use in game engines, web design, or any project requiring repeating textures.',
                        showNext: true,
                        showSkip: true
                    },
                    {
                        id: 'pro-tips',
                        elementId: 'editor-canvas',
                        position: 'center',
                        arrowPosition: 'none',
                        marginOverride: '10px',
                        heading: 'Pro Tips for Perfect Tiles',
                        content: '• Use the Color Picker (I) to sample colors from your artwork\n• Hold Shift while drawing for straight lines\n• Toggle layers to create complex patterns\n• Remember: seamless tiles work best with symmetrical designs\n• Export at higher resolutions for crisp game textures',
                        showNext: false,
                        showSkip: true
                    }
                ]
            }
        };

        // Current tutorial state
        this.currentTutorial = 'main';
        this.currentStep = 0;
        this.isActive = false;
        this.showHints = true;
    }

    /**
     * Add a new tutorial
     * @param {string} tutorialId - Unique identifier for the tutorial
     * @param {Object} config - Tutorial configuration
     */
    addTutorial(tutorialId, config) {
        this.tutorials[tutorialId] = config;
    }

    /**
     * Get tutorial by ID
     * @param {string} tutorialId - Tutorial identifier
     * @returns {Object|null} Tutorial configuration or null if not found
     */
    getTutorial(tutorialId) {
        return this.tutorials[tutorialId] || null;
    }

    /**
     * Get current step in current tutorial
     * @returns {Object|null} Current step or null if no active tutorial
     */
    getCurrentStep() {
        const tutorial = this.getTutorial(this.currentTutorial);
        if (!tutorial || !tutorial.steps || this.currentStep >= tutorial.steps.length) {
            return null;
        }
        return tutorial.steps[this.currentStep];
    }

    /**
     * Move to next step
     * @returns {Object|null} Next step or null if tutorial is complete
     */
    nextStep() {
        const tutorial = this.getTutorial(this.currentTutorial);
        if (!tutorial || !tutorial.steps) return null;

        this.currentStep++;
        if (this.currentStep >= tutorial.steps.length) {
            // Tutorial complete
            return null;
        }
        return this.getCurrentStep();
    }

    /**
     * Move to previous step
     * @returns {Object|null} Previous step or null if at beginning
     */
    prevStep() {
        if (this.currentStep <= 0) return null;
        this.currentStep--;
        return this.getCurrentStep();
    }

    /**
     * Reset tutorial to first step
     */
    resetTutorial() {
        this.currentStep = 0;
    }

    /**
     * Start a specific tutorial
     * @param {string} tutorialId - Tutorial to start
     */
    startTutorial(tutorialId) {
        if (this.tutorials[tutorialId]) {
            this.currentTutorial = tutorialId;
            this.currentStep = 0;
            this.isActive = true;
        }
    }

    /**
     * Stop current tutorial
     */
    stopTutorial() {
        this.isActive = false;
    }

    /**
     * Check if tutorial is active
     * @returns {boolean} True if tutorial is active
     */
    isTutorialActive() {
        return this.isActive;
    }

    /**
     * Get position class for tutorial step
     * @param {string} position - Position value from step config
     * @returns {string} CSS class for positioning
     */
    getPositionClass(position) {
        switch (position) {
            case 'top': return 'tutorial-top';
            case 'bottom': return 'tutorial-bottom';
            case 'left': return 'tutorial-left';
            case 'right': return 'tutorial-right';
            case 'center': return 'tutorial-center';
            default: return 'tutorial-right';
        }
    }
}

// Export for use in other modules
const tutorialConfig = new TutorialConfig();