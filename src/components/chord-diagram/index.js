
/**
 * ═══════════════════════════════════════════════════════════════════
 * sn-d3-chord-diagram
 * NextExperience UI Component — Chord Diagram Visualization
 * ═══════════════════════════════════════════════════════════════════
 */

import { createCustomElement } from '@servicenow/ui-core';
import { snabbdom } from '@servicenow/ui-renderer-snabbdom';
import * as d3 from 'd3';

import { createSingleTableEffects, transformToChordMatrix } from '../../data-providers/dataProvider';
import { SN_BRAND, getColorScheme, getDashboardContainerStyles, getLoadingStyles, getErrorStyles } from '../../shared/brandPalette';
import { TooltipManager } from '../../shared/tooltipManager';

const COMPONENT_TAG = 'sn-d3-chord-diagram';

createCustomElement(COMPONENT_TAG, {
    renderer: { type: snabbdom },

    initialState: { data: null, loading: true, error: null },

    properties: {
        table: { default: 'interaction' },
        sourceField: { default: 'assigned_to.department' },
        targetField: { default: 'opened_by.department' },
        valueAggregation: { default: 'count' },
        valueField: { default: '' },
        encodedQuery: { default: '' },
        maxEntities: { default: 12 },
        colorScheme: { default: 'servicenow' },
        height: { default: 540 },
        padAngle: { default: 0.04 }
    },

    view(state, { dispatch, properties }) {
        const { data, loading, error } = state;
        const containerStyles = getDashboardContainerStyles();
        containerStyles.height = `${properties.height}px`;

        if (loading) {
            return <div style={containerStyles}><div style={getLoadingStyles()}>Loading interaction data...</div></div>;
        }
        if (error) {
            return <div style={containerStyles}><div style={getErrorStyles()}><span>⚠ {error}</span></div></div>;
        }

        return (
            <div style={containerStyles}>
                <div
                    className="chord-container"
                    hook-insert={(vnode) => renderChord(vnode.elm, data, properties, dispatch)}
                    hook-update={(_, vnode) => renderChord(vnode.elm, data, properties, dispatch)}
                    hook-destroy={(vnode) => { if (vnode.elm.__tooltip) vnode.elm.__tooltip.destroy(); }}
                />
            </div>
        );
    },

    actionHandlers: {
        ...createSingleTableEffects(COMPONENT_TAG, (records, properties) => {
            return transformToChordMatrix(
                records,
                properties.sourceField,
                properties.targetField,
                properties.maxEntities
            );
        })
    }
});


function renderChord(container, data, properties, dispatch) {
    if (!data || !container) return;
    d3.select(container).selectAll('*').remove();

    const size = Math.min(container.clientWidth || 540, properties.height - 20);
    const outerRadius = size / 2 - 70;
    const innerRadius = outerRadius - 20;

    const svg = d3.select(container).append('svg').attr('width', size).attr('height', size);
    const g = svg.append('g').attr('transform', `translate(${size / 2},${size / 2})`);

    const tooltip = new TooltipManager(container);
    container.__tooltip = tooltip;

    const { labels, matrix } = data;
    if (!labels.length) return;

    const colors = getColorScheme(properties.colorScheme);
    const colorScale = d3.scaleOrdinal().domain(d3.range(labels.length)).range(colors);

    const chord = d3.chord().padAngle(properties.padAngle).sortSubgroups(d3.descending);
    const chords = chord(matrix);

    const arc = d3.arc().innerRadius(innerRadius).outerRadius(outerRadius);
    const ribbon = d3.ribbon().radius(innerRadius - 2);

    // Ribbons
    g.selectAll('.chord-ribbon')
        .data(chords)
        .join('path')
        .attr('class', 'chord-ribbon')
        .attr('d', ribbon)
        .attr('fill', d => colorScale(d.source.index))
        .attr('fill-opacity', 0.25)
        .style('cursor', 'pointer')
        .on('mouseenter', function (event, d) {
            d3.select(this).attr('fill-opacity', 0.6);
            tooltip.show(event, `${labels[d.source.index]} ↔ ${labels[d.target.index]}`, [
                `${labels[d.source.index]} → ${labels[d.target.index]}: ${d.source.value.toLocaleString()}`,
                `${labels[d.target.index]} → ${labels[d.source.index]}: ${d.target.value.toLocaleString()}`
            ]);
        })
        .on('mouseleave', function () {
            d3.select(this).attr('fill-opacity', 0.25);
            tooltip.hide();
        })
        .on('click', function (event, d) {
            dispatch('SN_D3_CHORD#RIBBON_CLICKED', {
                sourceName: labels[d.source.index],
                targetName: labels[d.target.index],
                sourceToTargetValue: d.source.value,
                targetToSourceValue: d.target.value
            });
        });

    // Group arcs
    const groupG = g.selectAll('.chord-group')
        .data(chords.groups)
        .join('g')
        .attr('class', 'chord-group')
        .style('cursor', 'pointer');

    groupG.append('path')
        .attr('d', arc)
        .attr('fill', d => colorScale(d.index))
        .attr('stroke', SN_BRAND.infiniteBlue)
        .attr('stroke-width', 1.5)
        .on('mouseenter', function (event, d) {
            d3.select(this).attr('stroke', SN_BRAND.wasabi).attr('stroke-width', 2);
            g.selectAll('.chord-ribbon')
                .attr('fill-opacity', r => (r.source.index === d.index || r.target.index === d.index) ? 0.6 : 0.06);
            tooltip.show(event, labels[d.index], [`Total Interactions: ${d.value.toLocaleString()}`]);
        })
        .on('mouseleave', function () {
            d3.select(this).attr('stroke', SN_BRAND.infiniteBlue).attr('stroke-width', 1.5);
            g.selectAll('.chord-ribbon').attr('fill-opacity', 0.25);
            tooltip.hide();
        })
        .on('click', function (event, d) {
            dispatch('SN_D3_CHORD#GROUP_CLICKED', {
                entityName: labels[d.index],
                totalValue: d.value
            });
        });

    // Labels
    groupG.append('text')
        .each(function (d) { d.angle = (d.startAngle + d.endAngle) / 2; })
        .attr('dy', '0.35em')
        .attr('transform', d =>
            `rotate(${(d.angle * 180 / Math.PI) - 90}) translate(${outerRadius + 12}) ${d.angle > Math.PI ? 'rotate(180)' : ''}`
        )
        .attr('text-anchor', d => d.angle > Math.PI ? 'end' : 'start')
        .text(d => labels[d.index])
        .attr('fill', SN_BRAND.white)
        .attr('font-size', 11)
        .attr('font-weight', 600)
        .attr('font-family', "'ServiceNow Sans', Calibri, sans-serif")
        .attr('opacity', 0.9);
}
