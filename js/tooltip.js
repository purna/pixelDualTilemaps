// tooltip.js
// Professional tooltip system integrated with the tilemap editor
class Tooltip {
    constructor() {
        this.tooltip = null;
        this.currentTarget = null;
        this.hideTimer = null;
        this.isEnabled = true;
        this.createTooltip();
        this.setupSettingsIntegration();
    }

    createTooltip() {
        this.tooltip = document.createElement('div');
        this.tooltip.className = 'custom-tooltip';
        
        // Style the tooltip to match the application's design system
        Object.assign(this.tooltip.style, {
            position: 'absolute',
            background: 'rgba(10, 10, 30, 0.96)',
            color: '#e0e7ff',
            padding: '12px 16px',
            borderRadius: '8px',
            fontSize: '13px',
            fontFamily: "'Inter', sans-serif",
            lineHeight: '1.5',
            pointerEvents: 'none',
            zIndex: '99999',
            opacity: '0',
            transition: 'opacity 0.2s ease, transform 0.2s ease',
            transform: 'translateY(8px)',
            maxWidth: '320px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
            border: '1px solid rgba(0, 255, 65, 0.3)',
            backdropFilter: 'blur(12px)',
            whiteSpace: 'pre-line',
            wordWrap: 'break-word'
        });

        document.body.appendChild(this.tooltip);

        // Handle tooltip hover to prevent hiding when mouse is over tooltip
        this.tooltip.addEventListener('mouseenter', () => {
            clearTimeout(this.hideTimer);
            this.tooltip.style.pointerEvents = 'auto';
        });

        this.tooltip.addEventListener('mouseleave', () => {
            this.hide();
        });
    }

    setupSettingsIntegration() {
        // Listen for settings changes to enable/disable tooltips
        if (typeof SettingsManager !== 'undefined') {
            // Check initial state
            this.updateEnabledState();
            
            // Set up observer for settings changes
            const checkSettings = () => {
                this.updateEnabledState();
            };
            
            // Check settings periodically and on settings modal open/close
            setInterval(checkSettings, 1000);
            
            // Also check when settings modal opens
            document.addEventListener('click', (e) => {
                if (e.target.id === 'settingsBtn' || e.target.closest('#settingsBtn')) {
                    setTimeout(checkSettings, 100);
                }
            });
        }
    }

    updateEnabledState() {
        if (typeof SettingsManager !== 'undefined' && SettingsManager.settings) {
            this.isEnabled = SettingsManager.settings.showTooltips !== false;
        }
    }

    show(text, element) {
        // Check if tooltips are enabled in settings
        this.updateEnabledState();
        if (!this.isEnabled) return;

        clearTimeout(this.hideTimer);
        this.currentTarget = element;
        
        // Process text with markdown-like formatting
        this.tooltip.innerHTML = this.formatText(text);
        
        // Show tooltip with animation
        this.tooltip.style.opacity = '1';
        this.tooltip.style.transform = 'translateY(0)';
        this.tooltip.style.pointerEvents = 'auto';
        
        this.positionTooltip(element);
    }

    formatText(text) {
        if (!text) return '';
        
        return text
            .replace(/\\n/g, '\n') // Convert escaped newlines to actual newlines first
            .replace(/\n/g, '<br>') // Then convert newlines to HTML breaks
            .replace(/\*\*(.*?)\*\*/g, '<strong style="color:#00ff41; font-weight:600;">$1</strong>')
            .replace(/--(.*?)--/g, '<em style="color:#00d9ff;">$1</em>')
            .replace(/`(.*?)`/g, '<code style="background:rgba(255,255,255,0.1); padding:2px 4px; border-radius:3px; font-family:monospace;">$1</code>');
    }

    positionTooltip(element) {
        if (!element) return;
        
        const rect = element.getBoundingClientRect();
        const tooltipRect = this.tooltip.getBoundingClientRect();
        
        let top = rect.bottom + 12 + window.scrollY;
        let left = rect.left + rect.width / 2 + window.scrollX - tooltipRect.width / 2;
        
        // Adjust if tooltip would go off screen
        if (top + tooltipRect.height > window.innerHeight + window.scrollY - 20) {
            top = rect.top + window.scrollY - tooltipRect.height - 12;
        }
        
        if (left < 10) left = 10;
        if (left + tooltipRect.width > window.innerWidth - 20) {
            left = window.innerWidth - tooltipRect.width - 20;
        }
        
        this.tooltip.style.top = top + 'px';
        this.tooltip.style.left = left + 'px';
    }

    hide() {
        this.hideTimer = setTimeout(() => {
            this.tooltip.style.opacity = '0';
            this.tooltip.style.transform = 'translateY(8px)';
            this.tooltip.style.pointerEvents = 'none';
            this.currentTarget = null;
        }, 150);
    }

    // Static method to show tooltip easily
    static show(text, element) {
        if (window.tooltipInstance) {
            window.tooltipInstance.show(text, element);
        }
    }

    // Enable/disable tooltips programmatically
    setEnabled(enabled) {
        this.isEnabled = enabled;
        if (!enabled) {
            this.hide();
        }
    }
}

// Create global tooltip instance
const tooltip = new Tooltip();
window.tooltipInstance = tooltip;

// Auto-initialize tooltips when DOM is ready
function initializeTooltips() {
    document.querySelectorAll('[data-tooltip]').forEach(el => {
        el.style.cursor = 'help';
        
        el.addEventListener('mouseenter', (e) => {
            const text = el.getAttribute('data-tooltip');
            if (text) {
                tooltip.show(text, el);
            }
        });
        
        el.addEventListener('mouseleave', () => {
            if (!tooltip.tooltip.matches(':hover')) {
                tooltip.hide();
            }
        });
        
        // Support for touch devices
        el.addEventListener('touchstart', (e) => {
            const text = el.getAttribute('data-tooltip');
            if (text) {
                e.preventDefault();
                tooltip.show(text, el);
            }
        });
    });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeTooltips);
} else {
    initializeTooltips();
}

// Export for module usage if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Tooltip;
}