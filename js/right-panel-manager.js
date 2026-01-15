// right-panel-manager.js
// Right panel management functionality

const RightPanelManager = {
    init() {
        console.log('Initializing Right Panel Manager...');
        this.setupSectionToggles();
        console.log('Right Panel Manager initialized successfully');
    },

    setupSectionToggles() {
        // Add event listeners to all section toggle buttons
        const toggleButtons = document.querySelectorAll('.section-toggle');
        toggleButtons.forEach(button => {
            button.addEventListener('click', () => {
                const targetId = button.getAttribute('data-target');
                this.toggleSection(targetId);
            });
        });

        // Add event listeners to all section headers for clicking
        const sectionHeaders = document.querySelectorAll('.section-header');
        sectionHeaders.forEach(header => {
            header.addEventListener('click', (e) => {
                // Only toggle if clicking on the header itself, not on buttons or other controls
                if (e.target === header || e.target.closest('.label-group')) {
                    const button = header.querySelector('.section-toggle');
                    if (button) {
                        const targetId = button.getAttribute('data-target');
                        this.toggleSection(targetId);
                    }
                }
            });
        });
    },

    /**
     * Toggle panel section - updated to work with dropins-container
     */
    toggleSection(sectionId) {
        // Find the section in the entire document (not just dropins-container)
        const section = document.getElementById(sectionId);
        if (!section) {
            console.warn(`Section not found: ${sectionId}`);
            return;
        }

        // Find the parent panel-section element to toggle the minimized class
        const panelSection = section.closest('.panel-section');
        if (panelSection) {
            panelSection.classList.toggle('minimized');
        } else {
            // Fallback to original behavior if no panel-section parent found
            section.classList.toggle('minimized');
        }

        // Find the toggle button that controls this section
        const button = document.querySelector(`[data-target="${sectionId}"]`);
        if (button) {
            const icon = button.querySelector('i');
            // Check if the panel section is minimized (or the section itself if no parent)
            const isMinimized = panelSection ? panelSection.classList.contains('minimized') : section.classList.contains('minimized');
            if (isMinimized) {
                icon.className = 'fas fa-plus';
            } else {
                icon.className = 'fas fa-minus';
            }
        } else {
            console.warn(`Toggle button not found for section: ${sectionId}`);
        }
    }
};

// Export for potential module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { RightPanelManager };
}