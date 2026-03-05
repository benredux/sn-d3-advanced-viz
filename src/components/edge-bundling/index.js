/**
 * ═══════════════════════════════════════════════════════════════════
 * sn-d3-edge-bundling
 * NextExperience UI Component — Hierarchical Edge Bundling
 * ═══════════════════════════════════════════════════════════════════
 */

import { createCustomElement } from '@servicenow/ui-core';
import { snabbdom } from '@servicenow/ui-renderer-snabbdom';
import * as d3 from 'd3';

import { createDualTableEffects, transformToEdgeBundle } from '../../data-providers/dataProvider';
import { SN_BRAND, getColorScheme, getDashboardContainerStyles, getLoadingStyles, getErrorStyles } from '../../shared/brandPalette';
import { TooltipManager } from '../../shared/tooltipManager';

const COMPONENT_TAG = 'sn-d3-edge-bundling';

createCustomElement(COMPONENT_TAG, {
    renderer: { type: snabbdom },

    initialState: { data: null, nodeRecords: [], loading: true, error: null, tension: 0.85 },

    properties: {
        nodesTable: { default: 'cmdb_ci_service' },
        groupField: { default: 'service_classification' },
        labelField: { default: 'name' },
        relationshipTable: { default: 'cmdb_rel_ci' },
        parentField: { default: 'parent' },
        childField: { default: 'child' },
        nodesEncodedQuery: { default: '' },
        relsEncodedQuery: { default: '' },
        bundleTension: { default: 0.85 },
        height: { default: 560 },
        showTensionControl: { default: true }
    },

    view(state, { dispatch, updateState, properties }) {
        const { data, loading, error, tension } = state;
        const containerStyles = getDashboardContainerStyles();
        containerStyles.height = `${properties.height}px`;

        if (loading) {
            return <div style={containerStyles}><div style={getLoadingStyles()}>Loading dependency data...</div></div>;
        }
        if (error) {
            return <div style={containerStyles}><div style={getErrorStyles()}><span>⚠ {error}</span></div></div>;
        }

        return (
            <div style={containerStyles}>
                {properties.showTensionControl && (
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px',
                        fontFamily: "'ServiceNow Sans', Calibri, sans-serif", fontSize: '11px', color: SN_BRAND.medGray
                    }}>
                        <span>Bundle Tension</span>
                        <input type="range" min="0" max="1" step="0.05"
                            attrs={{ value: tension }}
                            style={{ accentColor: SN_BRAND.wasabi, width: '120px' }}
                            on-input={(e) => updateState({ tension: parseFloat(e.target.value) })}
                        />
                        <span style={{ color: SN_BRAND.wasabi, fontWeight: '600' }}>{tension.toFixed(2)}</span>
                    </div>
                )}
                <div
                    className="edge-bundle-container"
                    hook-insert={(vnode) => renderEdgeBundle(vnode.elm, data, { ...properties, bundleTension: tension }, dispatch)}
                    hook-update={(_, vnode) => renderEdgeBundle(vnode.elm, data, { ...properties, bundleTension: tension }, dispatch)}
                    hook-destroy={(vnode) => { if (vnode.elm.__tooltip) vnode.elm.__tooltip.destroy(); }}
                />
            </div>
        );
    },

    actionHandlers: {
        ...createDualTableEffects(COMPONENT_TAG, (nodeRecords, relRecords, properties) => {
            return transformToEdgeBundle(
                nodeRecords, relRecords,
                properties.groupField, properties.labelField,
                properties.parentField, properties.childField
            );
        })
    }
});


function renderEdgeBundle(container, data, properties, dispatch) {
    if (!data || !container) return;
    d3.select(container).selectAll('*').remove();

    const size = Math.min(container.clientWidth || 560, properties.height - 60);
    const radius = size / 2 - 80;

    const svg = d3.select(container).append('svg').attr('width', size).attr('height', size);
    const g = svg.append('g').attr('transform', `translate(${size / 2},${size / 2})`);

    const tooltip = new TooltipManager(container);
    container.__tooltip = tooltip;

    const { hierarchy, connections } = data;
    const root = d3.hierarchy(hierarchy);
    d3.cluster().size([360, radius])(root);

    const leaves = root.leaves();
    const leafMap = {};
    leaves.forEach(l => { leafMap[l.data.name] = l; });

    const colors = getColorScheme(properties.colorScheme);
    const groupNames = (root.children || []).map(c => c.data.name);
    const groupColors = {};
    groupNames.forEach((name, i) => { groupColors[name] = colors[i % colors.length]; });

    const tension = properties.bundleTension;
    const line = d3.lineRadial()
        .curve(d3.curveBundle.beta(tension))
        .radius(d => d.y)
        .angle(d => (d.x / 180) * Math.PI);

    const linkData = connections
        .filter(([s, t]) => leafMap[s] && leafMap[t])
        .map(([s, t]) => ({ source: leafMap[s], target: leafMap[t], path: leafMap[s].path(leafMap[t]) }));

    // Draw links
    g.selectAll('.bundle-link')
        .data(linkData)
        .join('path')
        .attr('class', 'bundle-link')
        .attr('d', d => line(d.path))
        .attr('fill', 'none')
        .attr('stroke', SN_BRAND.wasabi)
        .attr('stroke-opacity', 0.2)
        .attr('stroke-width', 1.5)
        .style('cursor', 'pointer')
        .on('mouseenter', function (event, d) {
            d3.select(this).attr('stroke-opacity', 0.85).attr('stroke-width', 2.5);
            const srcLabel = d.source.data.displayName || d.source.data.name.split('.')[1];
            const tgtLabel = d.target.data.displayName || d.target.data.name.split('.')[1];
            tooltip.show(event, 'Integration Link', [`${srcLabel} ↔ ${tgtLabel}`]);
        })
        .on('mouseleave', function () {
            d3.select(this).attr('stroke-opacity', 0.2).attr('stroke-width', 1.5);
            tooltip.hide();
        });

    // Draw nodes
    const nodeG = g.selectAll('.bundle-node')
        .data(leaves)
        .join('g')
        .attr('class', 'bundle-node')
        .attr('transform', d => `rotate(${d.x - 90}) translate(${d.y + 8},0)`)
        .style('cursor', 'pointer');

    nodeG.append('circle')
        .attr('r', 4)
        .attr('fill', d => groupColors[d.parent?.data.name] || SN_BRAND.medGray);

    nodeG.append('text')
        .attr('dy', '0.35em')
        .attr('x', d => d.x < 180 ? 10 : -10)
        .attr('text-anchor', d => d.x < 180 ? 'start' : 'end')
        .attr('transform', d => d.x >= 180 ? 'rotate(180)' : null)
        .text(d => d.data.displayName || d.data.name.split('.')[1])
        .attr('fill', SN_BRAND.white)
        .attr('font-size', 10)
        .attr('font-family', "'ServiceNow Sans', Calibri, sans-serif")
        .attr('opacity', 0.85);

    // Node hover: highlight connected links
    nodeG.on('mouseenter', function (event, d) {
        const connected = new Set();
        linkData.forEach(l => {
            if (l.source === d) connected.add(l.target.data.name);
            if (l.target === d) connected.add(l.source.data.name);
        });
        g.selectAll('.bundle-link')
            .attr('stroke-opacity', l => (l.source === d || l.target === d) ? 0.85 : 0.04)
            .attr('stroke-width', l => (l.source === d || l.target === d) ? 2.5 : 1);
        tooltip.show(event, d.data.displayName || d.data.name.split('.')[1], [
            `Module: ${d.parent?.data.name}`,
            `Connections: ${connected.size}`
        ]);
    }).on('mouseleave', function () {
        g.selectAll('.bundle-link').attr('stroke-opacity', 0.2).attr('stroke-width', 1.5);
        tooltip.hide();
    }).on('click', function (event, d) {
        const connected = linkData.filter(l => l.source === d || l.target === d);
        dispatch('SN_D3_EDGE#NODE_CLICKED', {
            nodeId: d.data.sysId || d.data.name,
            group: d.parent?.data.name,
            connectionCount: connected.length
        });
    });

    // Group arcs
    const groupLeaves = {};
    leaves.forEach(l => {
        const gName = l.parent?.data.name;
        if (gName) {
            if (!groupLeaves[gName]) groupLeaves[gName] = [];
            groupLeaves[gName].push(l);
        }
    });

    Object.entries(groupLeaves).forEach(([gName, gLeaves]) => {
        const angles = gLeaves.map(l => (l.x / 180) * Math.PI);
        const arcPath = d3.arc()
            .innerRadius(radius + 24).outerRadius(radius + 30)
            .startAngle(d3.min(angles) - 0.04).endAngle(d3.max(angles) + 0.04);
        g.append('path').attr('d', arcPath()).attr('fill', groupColors[gName]).attr('opacity', 0.6);

        const midAngle = (d3.min(angles) + d3.max(angles)) / 2;
        const labelR = radius + 46;
        g.append('text')
            .attr('x', Math.sin(midAngle) * labelR).attr('y', -Math.cos(midAngle) * labelR)
            .attr('text-anchor', 'middle').attr('dy', '0.35em')
            .text(gName).attr('fill', groupColors[gName])
            .attr('font-size', 12).attr('font-weight', 700)
            .attr('font-family', "'ServiceNow Sans', Calibri, sans-serif");
    });
}
