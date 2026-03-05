/**
 * ═══════════════════════════════════════════════════════════════════
 * ServiceNow Brand Palette & Visualization Color Schemes
 * ═══════════════════════════════════════════════════════════════════
 */

export const SN_BRAND = {
    infiniteBlue: '#032D42',
    darkTeal: '#044355',
    wasabi: '#63DF4E',
    white: '#FFFFFF',
    lightGray: '#F4F4F4',
    medGray: '#D3D3D3',
    snGreen: '#81B5A1'
};

export const COLOR_SCHEMES = {
    servicenow: [
        '#63DF4E', '#81B5A1', '#4EC8DB', '#F2A93B', '#E8655A',
        '#9B7FE6', '#58C4A7', '#FF8A5C', '#5DADE2', '#F7DC6F',
        '#BB8FCE', '#48C9B0', '#EC7063', '#85C1E9', '#F0B27A'
    ],
    categorical: [
        '#4EC8DB', '#F2A93B', '#E8655A', '#63DF4E', '#9B7FE6',
        '#FF8A5C', '#58C4A7', '#F7DC6F', '#BB8FCE', '#5DADE2',
        '#48C9B0', '#EC7063', '#85C1E9', '#F0B27A', '#81B5A1'
    ],
    sequential: [
        '#E8F8E4', '#C1F0B5', '#8AE574', '#63DF4E', '#4BC23A',
        '#3A9E2E', '#2A7A22', '#1A5616', '#0A320A', '#042004'
    ],
    diverging: [
        '#E8655A', '#EC8A7F', '#F0AFA4', '#F4D4C9', '#F4F4F4',
        '#C1E8D9', '#8DD4BD', '#58C4A7', '#81B5A1', '#63DF4E'
    ]
};

/**
 * Returns the appropriate color array for a given scheme name.
 */
export function getColorScheme(schemeName) {
    return COLOR_SCHEMES[schemeName] || COLOR_SCHEMES.servicenow;
}

/**
 * Returns a CSS styles object for the component container,
 * using the ServiceNow dark dashboard theme.
 */
export function getDashboardContainerStyles() {
    return {
        background: SN_BRAND.infiniteBlue,
        color: SN_BRAND.white,
        fontFamily: "'ServiceNow Sans', Calibri, sans-serif",
        borderRadius: '8px',
        padding: '16px',
        position: 'relative',
        overflow: 'hidden'
    };
}

/**
 * Returns styles for the tooltip element.
 */
export function getTooltipStyles() {
    return {
        position: 'absolute',
        background: SN_BRAND.infiniteBlue,
        color: SN_BRAND.white,
        padding: '8px 14px',
        borderRadius: '6px',
        fontSize: '12px',
        fontFamily: "'ServiceNow Sans', Calibri, sans-serif",
        boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
        border: `1px solid ${SN_BRAND.wasabi}40`,
        pointerEvents: 'none',
        zIndex: 9999,
        maxWidth: '260px',
        lineHeight: '1.5'
    };
}

/**
 * Loading spinner styles.
 */
export function getLoadingStyles() {
    return {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        minHeight: '200px',
        color: SN_BRAND.wasabi,
        fontFamily: "'ServiceNow Sans', Calibri, sans-serif",
        fontSize: '14px'
    };
}

/**
 * Error state styles.
 */
export function getErrorStyles() {
    return {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        minHeight: '200px',
        color: '#E8655A',
        fontFamily: "'ServiceNow Sans', Calibri, sans-serif",
        fontSize: '13px',
        flexDirection: 'column',
        gap: '8px'
    };
}
