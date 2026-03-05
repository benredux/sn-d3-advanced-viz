/**
 * ═══════════════════════════════════════════════════════════════════
 * sn-d3-sankey-diagram
 * NextExperience UI Component — Sankey Flow Visualization
 * ═══════════════════════════════════════════════════════════════════
 *
 * Renders a D3 Sankey diagram showing flow volume between categories.
 * Data is fetched from the ServiceNow Table API based on configured
 * table, sourceField, intermediateField, and targetField properties.
 *
 * Usage in UI Builder:
 *   Drag "D3 Sankey Diagram" from the Analytics category.
 *   Configure: table=incident, sourceField=category,
 *              intermediateField=assignment_group, targetField=state
 */

import { createCustomElement } from '@servicenow/ui-core';
import { snabbdom } from '@servicenow/ui-renderer-snabbdom';
import * as d3 from 'd3';

import { createSingleTableEffects, transformToSankey } from '../../data-providers/dataProvider';
import { SN_BRAND, getColorScheme, getDashboardContainerStyles, getLoadingStyles, getErrorStyles } from '../../shared/brandPalette';
import { TooltipManager } from '../../shared/tooltipManager';

const COMPONENT_TAG = 'sn-d3-sankey-diagram';

createCustomElement(COMPONENT_TAG, {
    renderer: { type: snabbdom },

    initialState: {
        data: null,
        loading: true,
        error: null
    },

    properties: {
        table: { default: 'incident' },
        sourceField: { default: 'category' },
        intermediateField: { default: 'assignment_group' },
        targetField: { default: 'state' },
        valueAggregation: { default: 'count' },
        valueField: { default: '' },
        encodedQuery: { default: '' },
        maxNodes: { default: 10 },
        colorScheme: { default: 'servicenow' },
        height: { default: 440 },
        showLabels: { default: true },
        showValues: { default: true }
    },

    view(state, { dispatch, updateState, properties }) {
        const { data, loading, error } = state;
        const containerStyles = getDashboardContainerStyles();
        containerStyles.height = `${properties.height}px`;

        if (loading) {
            return (
                <div style={containerStyles}>
                    <div style={getLoadingStyles()}>Loading Sankey data...</div>
                </div>
            );
        }

        if (error) {
            return (
                <div style={containerStyles}>
                    <div style={getErrorStyles()}>
                        <span>⚠ Data Error</span>
                        <span>{error}</span>
                    </div>
                </div>
            );
        }

        return (
            <div style={containerStyles}>
                <div
                    className="sankey-container"
                    hook-insert={(vnode) => renderSankey(vnode.elm, data, properties, dispatch)}
                    hook-update={(oldVnode, vnode) => renderSankey(vnode.elm, data, properties, dispatch)}
                    hook-destroy={(vnode) => cleanupSankey(vnode.elm)}
                />
            </div>
        );
    },

    actionHandlers: {
        ...createSingleTableEffects(COMPONENT_TAG, (records, properties) => {
            return transformToSankey(
                records,
                properties.sourceField,
                properties.intermediateField,
                properties.targetField
            );
        })
    }
});


// ─── D3 Rendering Logic ─────────────────────────────────────────

function renderSankey(container, data, properties, dispatch) {
    if (!data || !container) return;

    // Clear previous render
    d3.select(container).selectAll('*').remove();

    const width = container.clientWidth || 760;
    const height = properties.height - 40;
    const margin = { top: 20, right: 20, bottom: 20, left: 20 };
    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;

    const svg = d3.select(container)
        .append('svg')
        .attr('width', width)
        .attr('height', height);

    const g = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    const tooltip = new TooltipManager(container);
    container.__tooltip = tooltip;

    const { nodes, links } = data;
    if (!nodes.length) return;

    const colors = getColorScheme(properties.colorScheme);
    const colorScale = d3.scaleOrdinal().domain(d3.range(nodes.length)).range(colors);

    // ── Sankey Layout (manual) ──────────────────────────────────
    const nodeWidth = 18;
    const nodePadding = 14;

    // Identify columns by connectivity
    const nodeObjs = nodes.map((n, i) => ({
        ...n, id: i, sourceLinks: [], targetLinks: []
    }));
    links.forEach(l => {
        nodeObjs[l.source].sourceLinks.push(l);
        nodeObjs[l.target].targetLinks.push(l);
    });
    nodeObjs.forEach(n => {
        n.value = Math.max(
            d3.sum(n.sourceLinks, l => l.value),
            d3.sum(n.targetLinks, l => l.value)
        ) || 1;
    });

    // Assign columns
    const colAssign = new Map();
    nodeObjs.forEach(n => {
        if (n.targetLinks.length === 0) colAssign.set(n.id, 0);
    });
    let changed = true;
    while (changed) {
        changed = false;
        links.forEach(l => {
            const srcCol = colAssign.get(l.source);
            if (srcCol !== undefined) {
                const current = colAssign.get(l.target);
                const proposed = srcCol + 1;
                if (current === undefined || proposed > current) {
                    colAssign.set(l.target, proposed);
                    changed = true;
                }
            }
        });
    }

    const maxCol = Math.max(...colAssign.values());
    const columns = Array.from({ length: maxCol + 1 }, () => []);
    nodeObjs.forEach(n => {
        const col = colAssign.get(n.id) ?? 0;
        columns[col].push(n.id);
    });

    const colPositions = columns.map((_, i) =>
        i === 0 ? 0 : i === columns.length - 1 ? w - nodeWidth : (w - nodeWidth) * i / maxCol
    );

    // Vertical positioning per column
    columns.forEach((col, ci) => {
        const totalVal = d3.sum(col, id => nodeObjs[id].value);
        const totalPad = (col.length - 1) * nodePadding;
        const scale = totalVal > 0 ? (h - totalPad) / totalVal : 1;
        let y = 0;
        col.forEach(id => {
            nodeObjs[id].x0 = colPositions[ci];
            nodeObjs[id].x1 = colPositions[ci] + nodeWidth;
            nodeObjs[id].y0 = y;
            nodeObjs[id].y1 = y + nodeObjs[id].value * scale;
            y = nodeObjs[id].y1 + nodePadding;
        });
    });

    // Link vertical positions
    links.forEach(l => {
        const sn = nodeObjs[l.source];
        const tn = nodeObjs[l.target];
        const sScale = (sn.y1 - sn.y0) / (sn.value || 1);
        const tScale = (tn.y1 - tn.y0) / (tn.value || 1);
        let sy = sn.y0, ty = tn.y0;
        sn.sourceLinks.forEach(sl => {
            if (sl === l) l.sy = sy;
            sy += sl.value * sScale;
        });
        tn.targetLinks.forEach(tl => {
            if (tl === l) l.ty = ty;
            ty += tl.value * tScale;
        });
        l.sWidth = l.value * sScale;
        l.tWidth = l.value * tScale;
    });

    // ── Draw Links ──────────────────────────────────────────────
    g.selectAll('.sn-link')
        .data(links)
        .join('path')
        .attr('class', 'sn-link')
        .attr('d', d => {
            const x0 = nodeObjs[d.source].x1;
            const x1 = nodeObjs[d.target].x0;
            const xi = d3.interpolateNumber(x0, x1);
            return `M${x0},${d.sy}
                    C${xi(0.5)},${d.sy} ${xi(0.5)},${d.ty} ${x1},${d.ty}
                    L${x1},${d.ty + d.tWidth}
                    C${xi(0.5)},${d.ty + d.tWidth} ${xi(0.5)},${d.sy + d.sWidth} ${x0},${d.sy + d.sWidth}
                    Z`;
        })
        .attr('fill', d => colorScale(d.source))
        .attr('fill-opacity', 0.3)
        .attr('stroke', 'none')
        .style('cursor', 'pointer')
        .on('mouseenter', function (event, d) {
            d3.select(this).attr('fill-opacity', 0.55);
            tooltip.show(event,
                `${nodeObjs[d.source].name} → ${nodeObjs[d.target].name}`,
                [`Volume: ${d.value.toLocaleString()}`]
            );
        })
        .on('mousemove', function (event) {
            tooltip.show(event);
        })
        .on('mouseleave', function () {
            d3.select(this).attr('fill-opacity', 0.3);
            tooltip.hide();
        })
        .on('click', function (event, d) {
            dispatch('SN_D3_SANKEY#LINK_CLICKED', {
                sourceName: nodeObjs[d.source].name,
                targetName: nodeObjs[d.target].name,
                value: d.value
            });
        });

    // ── Draw Nodes ──────────────────────────────────────────────
    g.selectAll('.sn-node')
        .data(nodeObjs)
        .join('rect')
        .attr('class', 'sn-node')
        .attr('x', d => d.x0)
        .attr('y', d => d.y0)
        .attr('width', nodeWidth)
        .attr('height', d => Math.max(d.y1 - d.y0, 2))
        .attr('fill', (d, i) => colorScale(i))
        .attr('rx', 3)
        .style('cursor', 'pointer')
        .on('mouseenter', function (event, d) {
            d3.select(this).attr('stroke', SN_BRAND.wasabi).attr('stroke-width', 2);
            tooltip.show(event, d.name, [`Total: ${d.value.toLocaleString()}`]);
        })
        .on('mouseleave', function () {
            d3.select(this).attr('stroke', 'none');
            tooltip.hide();
        })
        .on('click', function (event, d) {
            dispatch('SN_D3_SANKEY#NODE_CLICKED', {
                nodeName: d.name,
                nodeValue: d.value,
                column: String(colAssign.get(d.id))
            });
        });

    // ── Labels ──────────────────────────────────────────────────
    if (properties.showLabels) {
        g.selectAll('.sn-label')
            .data(nodeObjs)
            .join('text')
            .attr('class', 'sn-label')
            .attr('x', d => d.x0 < w / 2 ? d.x1 + 8 : d.x0 - 8)
            .attr('y', d => (d.y0 + d.y1) / 2)
            .attr('dy', '0.35em')
            .attr('text-anchor', d => d.x0 < w / 2 ? 'start' : 'end')
            .text(d => d.name)
            .attr('fill', SN_BRAND.white)
            .attr('font-size', 11)
            .attr('font-family', "'ServiceNow Sans', Calibri, sans-serif")
            .attr('font-weight', 600)
            .attr('opacity', 0.9);
    }
}

function cleanupSankey(container) {
    if (container.__tooltip) {
        container.__tooltip.destroy();
    }
}
