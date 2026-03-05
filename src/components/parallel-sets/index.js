/**
 * ═══════════════════════════════════════════════════════════════════
 * sn-d3-parallel-sets
 * NextExperience UI Component — Parallel Sets Visualization
 * ═══════════════════════════════════════════════════════════════════
 */

import { createCustomElement } from '@servicenow/ui-core';
import { snabbdom } from '@servicenow/ui-renderer-snabbdom';
import * as d3 from 'd3';

import { createSingleTableEffects, transformToParallelSets } from '../../data-providers/dataProvider';
import { SN_BRAND, getColorScheme, getDashboardContainerStyles, getLoadingStyles, getErrorStyles } from '../../shared/brandPalette';
import { TooltipManager } from '../../shared/tooltipManager';

const COMPONENT_TAG = 'sn-d3-parallel-sets';

createCustomElement(COMPONENT_TAG, {
    renderer: { type: snabbdom },

    initialState: { data: null, loading: true, error: null },

    properties: {
        table: { default: 'incident' },
        dimensions: { default: '["priority","category","sla_due","state"]' },
        colorDimension: { default: 'priority' },
        encodedQuery: { default: '' },
        maxCategories: { default: 8 },
        colorScheme: { default: 'servicenow' },
        height: { default: 440 }
    },

    view(state, { dispatch, properties }) {
        const { data, loading, error } = state;
        const containerStyles = getDashboardContainerStyles();
        containerStyles.height = `${properties.height}px`;

        if (loading) {
            return <div style={containerStyles}><div style={getLoadingStyles()}>Loading Parallel Sets data...</div></div>;
        }
        if (error) {
            return <div style={containerStyles}><div style={getErrorStyles()}><span>⚠ {error}</span></div></div>;
        }

        return (
            <div style={containerStyles}>
                <div
                    className="parallel-sets-container"
                    hook-insert={(vnode) => renderParallelSets(vnode.elm, data, properties, dispatch)}
                    hook-update={(_, vnode) => renderParallelSets(vnode.elm, data, properties, dispatch)}
                    hook-destroy={(vnode) => { if (vnode.elm.__tooltip) vnode.elm.__tooltip.destroy(); }}
                />
            </div>
        );
    },

    actionHandlers: {
        ...createSingleTableEffects(COMPONENT_TAG, (records, properties) => {
            const dims = JSON.parse(properties.dimensions);
            return transformToParallelSets(records, dims, properties.maxCategories);
        })
    }
});


function renderParallelSets(container, data, properties, dispatch) {
    if (!data || !container) return;
    d3.select(container).selectAll('*').remove();

    const width = container.clientWidth || 760;
    const height = properties.height - 40;
    const margin = { top: 36, right: 30, bottom: 20, left: 30 };
    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;

    const svg = d3.select(container).append('svg').attr('width', width).attr('height', height);
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const tooltip = new TooltipManager(container);
    container.__tooltip = tooltip;

    const { dimensions, categories, records } = data;
    const colors = getColorScheme(properties.colorScheme);
    const barWidth = 22;

    const xScale = d3.scalePoint().domain(dimensions).range([0, w]).padding(0.08);
    const colorDim = properties.colorDimension || dimensions[0];
    const colorCats = categories[colorDim] || [];
    const colorScale = d3.scaleOrdinal().domain(colorCats).range(colors);

    // Calculate bar positions per dimension
    const dimPositions = {};
    dimensions.forEach(dim => {
        const cats = categories[dim];
        const catTotals = {};
        cats.forEach(c => {
            catTotals[c] = d3.sum(records.filter(r => r[dim] === c), r => r.value);
        });
        const total = d3.sum(Object.values(catTotals));
        const padding = 8;
        const available = h - (cats.length - 1) * padding;
        let y = 0;
        dimPositions[dim] = {};
        cats.forEach(c => {
            const barH = total > 0 ? (catTotals[c] / total) * available : available / cats.length;
            dimPositions[dim][c] = { y0: y, y1: y + barH, total: catTotals[c] || 1, used: 0 };
            y += barH + padding;
        });
    });

    // Draw ribbons between adjacent dimensions
    for (let di = 0; di < dimensions.length - 1; di++) {
        const dimA = dimensions[di];
        const dimB = dimensions[di + 1];
        const x0 = xScale(dimA) + barWidth / 2;
        const x1 = xScale(dimB) - barWidth / 2;

        const groups = {};
        records.forEach(r => {
            const key = `${r[dimA]}||${r[dimB]}`;
            if (!groups[key]) groups[key] = { a: r[dimA], b: r[dimB], value: 0, colorVal: r[colorDim] };
            groups[key].value += r.value;
        });

        Object.values(dimPositions[dimA]).forEach(p => (p.used = 0));
        Object.values(dimPositions[dimB]).forEach(p => (p.used = 0));

        Object.values(groups).forEach(grp => {
            const posA = dimPositions[dimA][grp.a];
            const posB = dimPositions[dimB][grp.b];
            if (!posA || !posB) return;

            const ratioA = (posA.y1 - posA.y0) / posA.total;
            const ratioB = (posB.y1 - posB.y0) / posB.total;
            const hA = grp.value * ratioA;
            const hB = grp.value * ratioB;
            const ya = posA.y0 + posA.used;
            const yb = posB.y0 + posB.used;
            posA.used += hA;
            posB.used += hB;

            const path = d3.path();
            path.moveTo(x0, ya);
            path.bezierCurveTo(x0 + (x1 - x0) * 0.45, ya, x1 - (x1 - x0) * 0.45, yb, x1, yb);
            path.lineTo(x1, yb + hB);
            path.bezierCurveTo(x1 - (x1 - x0) * 0.45, yb + hB, x0 + (x1 - x0) * 0.45, ya + hA, x0, ya + hA);
            path.closePath();

            g.append('path')
                .attr('d', path.toString())
                .attr('fill', colorScale(grp.colorVal))
                .attr('fill-opacity', 0.25)
                .style('cursor', 'pointer')
                .on('mouseenter', function (event) {
                    d3.select(this).attr('fill-opacity', 0.55);
                    tooltip.show(event, `${grp.a} → ${grp.b}`, [`Count: ${grp.value.toLocaleString()}`]);
                })
                .on('mouseleave', function () {
                    d3.select(this).attr('fill-opacity', 0.25);
                    tooltip.hide();
                })
                .on('click', function () {
                    dispatch('SN_D3_PARALLEL#RIBBON_CLICKED', {
                        fromDimension: dimA, fromValue: grp.a,
                        toDimension: dimB, toValue: grp.b,
                        count: grp.value
                    });
                });
        });
    }

    // Draw dimension bars and labels
    dimensions.forEach(dim => {
        const x = xScale(dim);
        Object.entries(dimPositions[dim]).forEach(([cat, pos]) => {
            g.append('rect')
                .attr('x', x - barWidth / 2).attr('y', pos.y0)
                .attr('width', barWidth).attr('height', pos.y1 - pos.y0)
                .attr('fill', SN_BRAND.wasabi).attr('rx', 3).attr('opacity', 0.85);

            if (pos.y1 - pos.y0 > 18) {
                g.append('text')
                    .attr('x', x - barWidth / 2 - 6).attr('y', (pos.y0 + pos.y1) / 2)
                    .attr('dy', '0.35em').attr('text-anchor', 'end')
                    .text(cat).attr('fill', SN_BRAND.white)
                    .attr('font-size', 10).attr('font-family', "'ServiceNow Sans', Calibri, sans-serif")
                    .attr('opacity', 0.85);
            }
        });

        g.append('text').attr('x', x).attr('y', -14).attr('text-anchor', 'middle')
            .text(dim).attr('fill', SN_BRAND.wasabi)
            .attr('font-size', 12).attr('font-weight', 700)
            .attr('font-family', "'ServiceNow Sans', Calibri, sans-serif");
    });
}
