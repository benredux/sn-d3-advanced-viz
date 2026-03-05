/**
 * ═══════════════════════════════════════════════════════════════════
 * Shared Tooltip Manager
 * Works with SNABB virtual DOM (NextExperience rendering engine)
 * ═══════════════════════════════════════════════════════════════════
 */

import { getTooltipStyles } from './brandPalette';
import { SN_BRAND } from './brandPalette';

/**
 * Creates and manages a tooltip DOM element positioned near the cursor.
 * Designed for use inside D3 mouse event handlers within
 * NextExperience SNABB-rendered components.
 */
export class TooltipManager {
    constructor(containerEl) {
        this.container = containerEl;
        this.el = null;
        this._createTooltipElement();
    }

    _createTooltipElement() {
        this.el = document.createElement('div');
        Object.assign(this.el.style, getTooltipStyles());
        this.el.style.display = 'none';
        this.container.appendChild(this.el);
    }

    /**
     * Show tooltip with structured content.
     * @param {MouseEvent} event  - Mouse event for positioning
     * @param {string}     title  - Bold title line
     * @param {string[]}   lines  - Array of detail lines
     */
    show(event, title, lines = []) {
        let html = '';
        if (title) {
            html += `<div style="color:${SN_BRAND.wasabi};font-weight:700;margin-bottom:3px">${title}</div>`;
        }
        lines.forEach(line => {
            html += `<div style="opacity:0.9">${line}</div>`;
        });
        this.el.innerHTML = html;

        // Position relative to container
        const rect = this.container.getBoundingClientRect();
        const x = event.clientX - rect.left + 14;
        const y = event.clientY - rect.top - 10;

        this.el.style.left = `${x}px`;
        this.el.style.top = `${y}px`;
        this.el.style.display = 'block';
    }

    /**
     * Hide the tooltip.
     */
    hide() {
        this.el.style.display = 'none';
    }

    /**
     * Remove the tooltip element from the DOM.
     */
    destroy() {
        if (this.el && this.el.parentNode) {
            this.el.parentNode.removeChild(this.el);
        }
    }
}
