/**
 * ═══════════════════════════════════════════════════════════════════
 * sn-d3-radial-sunburst
 * NextExperience UI Component — Radial Sunburst Visualization
 * ═══════════════════════════════════════════════════════════════════
 */

import { createCustomElement } from '@servicenow/ui-core';
import { snabbdom } from '@servicenow/ui-renderer-snabbdom';
import * as d3 from 'd3';

import { createSingleTableEffects, transformToHierarchy } from '../../data-providers/dataProvider';
import { SN_BRAND, getColorScheme, getDashboardContainerStyles, getLoadingStyles, getErrorStyles } from '../../shared/brandPalette';
import { TooltipManager } from '../../shared/tooltipManager';

const COMPONENT_TAG = 'sn-d3-radial-sunburst';

createCustomElement(COMPONENT_TAG, {
    renderer: { type: snabbdom },

    initialState: { data: null, loading: true, error: null },

    properties: {
        table: { default: 'cmdb_ci' },
        hierarchyFields: { default: '["sys_class_name","subcategory","name"]' },
        valueField: { default: '' },
        encodedQuery: { default: '' },
        maxDepth: { default: 4 },
        colorScheme: { default: 'servicenow' },
        centerLabel: { default: '' },
        height: { default: 520 },
        enableZoom: { default: true }
    },

    view(state, { dispatch, properties }) {
        const { data, loading, error } = state;
        const containerStyles = getDashboardContainerStyles();
        containerStyles.height = `${properties.height}px`;

        if (loading) {
            return <div style={containerStyles}><div style={getLoadingStyles()}>Loading hierarchy data...</div></div>;
        }
        if (error) {
            return <div style={containerStyles}><div style={getErrorStyles()}><span>⚠ {error}</span></div></div>;
        }

        return (
            <div style={containerStyles}>
                <div
                    className="radial-container"
                    hook-insert={(vnode) => renderSunburst(vnode.elm, data, properties, dispatch)}
                    hook-update={(_, vnode) => renderSunburst(vnode.elm, data, properties, dispatch)}
                    hook-destroy={(vnode) => { if (vnode.elm.__tooltip) vnode.elm.__tooltip.destroy(); }}
                />
            </div>
        );
    },

    actionHandlers: {
        ...createSingleTableEffects(COMPONENT_TAG, (records, properties) => {
            const fields = JSON.parse(properties.hierarchyFields);
            return transformToHierarchy(
                records, fields, properties.valueField || null,
                properties.centerLabel || properties.table
            );
        })
    }
});


function renderSunburst(container, data, properties, dispatch) {
    if (!data || !container) return;
    d3.select(container).selectAll('*').remove();

    const size = Math.min(container.clientWidth || 520, properties.height - 20);
    const radius = size / 2 - 10;

    const svg = d3.select(container).append('svg')
        .attr('width', size).attr('height', size);
    const g = svg.append('g').attr('transform', `translate(${size / 2},${size / 2})`);

    const tooltip = new TooltipManager(container);
    container.__tooltip = tooltip;

    const root = d3.hierarchy(data)
        .sum(d => d.value || 0)
        .sort((a, b) => b.value - a.value);

    d3.partition().size([2 * Math.PI, radius])(root);

    const colors = getColorScheme(properties.colorScheme);
    const topLevelNames = (root.children || []).map(c => c.data.name);
    const colorScale = d3.scaleOrdinal().domain(topLevelNames).range(colors);

    const getColor = (d) => {
        let node = d;
        while (node.depth > 1) node = node.parent;
        return colorScale(node.data.name);
    };

    const arc = d3.arc()
        .startAngle(d => d.x0)
        .endAngle(d => d.x1)
        .padAngle(0.008)
        .padRadius(radius / 3)
        .innerRadius(d => d.y0)
        .outerRadius(d => d.y1 - 1);

    g.selectAll('path')
        .data(root.descendants().filter(d => d.depth > 0 && d.depth <= properties.maxDepth))
        .join('path')
        .attr('d', arc)
        .attr('fill', d => getColor(d))
        .attr('fill-opacity', d => 0.9 - d.depth * 0.12)
        .attr('stroke', SN_BRAND.infiniteBlue)
        .attr('stroke-width', 1.5)
        .style('cursor', 'pointer')
        .on('mouseenter', function (event, d) {
            d3.select(this).attr('fill-opacity', 1).attr('stroke', SN_BRAND.wasabi).attr('stroke-width', 2);
            const path = d.ancestors().reverse().slice(1).map(a => a.data.name).join(' > ');
            tooltip.show(event, d.data.name, [
                `Path: ${path}`,
                d.value ? `Count: ${d.value.toLocaleString()}` : ''
            ].filter(Boolean));
        })
        .on('mouseleave', function (event, d) {
            d3.select(this)
                .attr('fill-opacity', 0.9 - d.depth * 0.12)
                .attr('stroke', SN_BRAND.infiniteBlue)
                .attr('stroke-width', 1.5);
            tooltip.hide();
        })
        .on('click', function (event, d) {
            dispatch('SN_D3_RADIAL#SEGMENT_CLICKED', {
                path: d.ancestors().reverse().slice(1).map(a => a.data.name).join(' > '),
                value: d.value,
                depth: d.depth
            });
        });

    // Center label
    if (properties.centerLabel || data.name) {
        g.append('text').attr('text-anchor', 'middle').attr('dy', '-0.2em')
            .text(properties.centerLabel || data.name)
            .attr('fill', SN_BRAND.wasabi).attr('font-size', 16).attr('font-weight', 700)
            .attr('font-family', "'ServiceNow Sans', Calibri, sans-serif");
    }

    // Arc labels for wide enough segments
    g.selectAll('.arc-label')
        .data(root.descendants().filter(d => d.depth > 0 && d.x1 - d.x0 > 0.12 && d.depth <= properties.maxDepth))
        .join('text')
        .attr('class', 'arc-label')
        .attr('transform', d => {
            const angle = (d.x0 + d.x1) / 2;
            const r = (d.y0 + d.y1) / 2;
            const rotate = (angle * 180 / Math.PI) - 90 + (angle > Math.PI ? 180 : 0);
            return `translate(${Math.sin(angle) * r},${-Math.cos(angle) * r}) rotate(${rotate})`;
        })
        .attr('text-anchor', 'middle').attr('dy', '0.35em')
        .text(d => d.data.name)
        .attr('fill', SN_BRAND.white).attr('font-size', 9)
        .attr('font-family', "'ServiceNow Sans', Calibri, sans-serif")
        .attr('pointer-events', 'none');
}
