// floating-panel-manager.js
// Manages floating panels like color history and brush controls

const FloatingPanelManager = {
    init() {
        this.initColorHistory();
        this.initBrushControls();
        console.log('Floating Panel Manager initialized');
    },

    initColorHistory() {
        const historyOverlay = document.querySelector('.floating-color-history');
        if (historyOverlay) {
            this.makeDraggable(historyOverlay);
            this.addGrippyHandle(historyOverlay);
        }
    },

    initBrushControls() {
        const brushControlsOverlay = document.querySelector('.brush-controls-overlay');
        if (brushControlsOverlay) {
            this.makeDraggable(brushControlsOverlay);
            this.addGrippyHandleToBrushControls(brushControlsOverlay);
        }
    },

    makeDraggable(element) {
        let isDragging = false;
        let offsetX, offsetY;

        element.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('color-swatch')) {
                return; // Don't drag when clicking on swatches
            }

            isDragging = true;
            offsetX = e.clientX - element.getBoundingClientRect().left;
            offsetY = e.clientY - element.getBoundingClientRect().top;
            element.style.cursor = 'grabbing';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;

            const x = e.clientX - offsetX;
            const y = e.clientY - offsetY;

            element.style.left = x + 'px';
            element.style.top = y + 'px';
            element.style.transform = 'none';
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
            element.style.cursor = 'move';
        });
    },

    addGrippyHandle(historyOverlay) {
        if (historyOverlay) {
            const grippy = document.createElement('span');
            grippy.className = 'grippy';
            historyOverlay.insertBefore(grippy, historyOverlay.firstChild);
        }
    },

    addGrippyHandleToBrushControls(brushControlsOverlay) {
        if (brushControlsOverlay) {
            const brushControls = brushControlsOverlay.querySelector('.brush-controls');
            if (brushControls) {
                const grippy = document.createElement('span');
                grippy.className = 'grippy';
                brushControls.insertBefore(grippy, brushControls.firstChild);
            }
        }
    }
};

// Export for potential module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { FloatingPanelManager };
}