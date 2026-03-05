/**
 * ═══════════════════════════════════════════════════════════════════
 * ServiceNow NextExperience — Data Provider Layer
 * Handles Table API queries, aggregation, and D3 data transforms
 * ═══════════════════════════════════════════════════════════════════
 *
 * This module sits between the ServiceNow platform data layer and
 * the D3 visualization components. It uses the @servicenow/now-experience
 * HTTP effect to query the Table API and Aggregate API, then transforms
 * raw records into the node/link/matrix structures each viz expects.
 */

import { createHttpEffect } from '@servicenow/ui-effect-http';

// ─── API Endpoints ──────────────────────────────────────────────
const TABLE_API = '/api/now/table';
const AGGREGATE_API = '/api/now/stats';

// ─── Shared Fetch Effect Creator ────────────────────────────────

/**
 * Creates an HTTP effect config for querying the ServiceNow Table API.
 *
 * @param {string} table       - Table name (e.g. 'incident')
 * @param {string} fields      - Comma-separated field list
 * @param {string} query       - Encoded query string
 * @param {number} limit       - Record limit (default 10000)
 * @returns {object}           - Effect config for createHttpEffect
 */
export function createTableQuery(table, fields, query = '', limit = 10000) {
    const params = {
        sysparm_table: table,
        sysparm_fields: fields,
        sysparm_query: query,
        sysparm_limit: limit,
        sysparm_display_value: 'true'
    };

    return {
        method: 'GET',
        url: `${TABLE_API}/${table}`,
        params,
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        }
    };
}

/**
 * Creates an aggregate query for count/sum/avg grouped by fields.
 */
export function createAggregateQuery(table, groupBy, query = '', aggregation = 'COUNT') {
    return {
        method: 'GET',
        url: `${AGGREGATE_API}/${table}`,
        params: {
            sysparm_query: query,
            sysparm_group_by: groupBy,
            sysparm_count: aggregation === 'COUNT' ? 'true' : 'false',
            sysparm_sum_fields: aggregation === 'SUM' ? groupBy.split(',').pop() : '',
            sysparm_avg_fields: aggregation === 'AVERAGE' ? groupBy.split(',').pop() : '',
            sysparm_display_value: 'true'
        },
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        }
    };
}


// ═══════════════════════════════════════════════════════════════════
// DATA TRANSFORMERS — Raw API → D3 Data Structures
// ═══════════════════════════════════════════════════════════════════

/**
 * SANKEY TRANSFORMER
 * Converts grouped records into { nodes: [], links: [] }
 *
 * Input: Array of records with sourceField, intermediateField, targetField
 * Output: { nodes: [{name}], links: [{source, target, value}] }
 */
export function transformToSankey(records, sourceField, intermediateField, targetField) {
    const nodeSet = new Set();
    const linkMap = new Map();

    records.forEach(record => {
        const src = record[sourceField]?.display_value || record[sourceField] || 'Unknown';
        const tgt = record[targetField]?.display_value || record[targetField] || 'Unknown';
        const mid = intermediateField
            ? (record[intermediateField]?.display_value || record[intermediateField] || 'Unknown')
            : null;

        nodeSet.add(src);
        nodeSet.add(tgt);
        if (mid) nodeSet.add(mid);

        if (mid) {
            // Source → Intermediate link
            const key1 = `${src}|||${mid}`;
            linkMap.set(key1, (linkMap.get(key1) || 0) + 1);
            // Intermediate → Target link
            const key2 = `${mid}|||${tgt}`;
            linkMap.set(key2, (linkMap.get(key2) || 0) + 1);
        } else {
            // Direct Source → Target link
            const key = `${src}|||${tgt}`;
            linkMap.set(key, (linkMap.get(key) || 0) + 1);
        }
    });

    const nodes = Array.from(nodeSet).map(name => ({ name }));
    const nodeIndex = new Map(nodes.map((n, i) => [n.name, i]));

    const links = Array.from(linkMap.entries()).map(([key, value]) => {
        const [source, target] = key.split('|||');
        return {
            source: nodeIndex.get(source),
            target: nodeIndex.get(target),
            value
        };
    });

    return { nodes, links };
}


/**
 * PARALLEL SETS TRANSFORMER
 * Converts records into dimensional categorical data
 *
 * Input: Array of records + dimension field names
 * Output: { dimensions: [], categories: {}, records: [{dim1, dim2, ..., value}] }
 */
export function transformToParallelSets(records, dimensionFields, maxCategories = 8) {
    const dimensions = dimensionFields;
    const categories = {};
    const combos = new Map();

    // Extract unique categories per dimension
    dimensions.forEach(dim => {
        const counts = {};
        records.forEach(r => {
            const val = r[dim]?.display_value || r[dim] || 'Unknown';
            counts[val] = (counts[val] || 0) + 1;
        });

        // Keep top N categories, group rest as 'Other'
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        const topCats = sorted.slice(0, maxCategories).map(([name]) => name);
        if (sorted.length > maxCategories) topCats.push('Other');
        categories[dim] = topCats;
    });

    // Build combo counts
    records.forEach(r => {
        const combo = dimensions.map(dim => {
            const val = r[dim]?.display_value || r[dim] || 'Unknown';
            return categories[dim].includes(val) ? val : 'Other';
        });
        const key = combo.join('|||');
        combos.set(key, (combos.get(key) || 0) + 1);
    });

    // Convert combos to record array
    const transformedRecords = Array.from(combos.entries()).map(([key, value]) => {
        const values = key.split('|||');
        const record = { value };
        dimensions.forEach((dim, i) => { record[dim] = values[i]; });
        return record;
    });

    return { dimensions, categories, records: transformedRecords };
}


/**
 * RADIAL / SUNBURST TRANSFORMER
 * Converts flat records into a hierarchical tree structure
 *
 * Input: Array of records + hierarchy field names
 * Output: { name: 'root', children: [{ name, children: [...], value }] }
 */
export function transformToHierarchy(records, hierarchyFields, valueField = null, rootLabel = 'Root') {
    const root = { name: rootLabel, children: [] };

    records.forEach(record => {
        let current = root;

        hierarchyFields.forEach((field, depth) => {
            const val = record[field]?.display_value || record[field] || 'Unknown';
            let child = current.children.find(c => c.name === val);

            if (!child) {
                child = { name: val, children: [] };
                current.children.push(child);
            }

            // At the deepest level, set the value
            if (depth === hierarchyFields.length - 1) {
                if (valueField && record[valueField]) {
                    child.value = (child.value || 0) + parseFloat(record[valueField]) || 1;
                } else {
                    child.value = (child.value || 0) + 1;
                }
                delete child.children; // Leaf nodes don't need children array
            }

            current = child;
        });
    });

    // Prune empty children arrays
    function prune(node) {
        if (node.children && node.children.length === 0) {
            delete node.children;
            node.value = node.value || 1;
        } else if (node.children) {
            node.children.forEach(prune);
        }
    }
    prune(root);

    return root;
}


/**
 * EDGE BUNDLING TRANSFORMER
 * Converts nodes + relationships into clustered hierarchy + connections
 *
 * Input: Node records with groupField/labelField, relationship records with parent/child refs
 * Output: { hierarchy: {name, children: [{name, children}]}, connections: [[srcId, tgtId]] }
 */
export function transformToEdgeBundle(nodeRecords, relRecords, groupField, labelField, parentField, childField) {
    const groups = {};

    nodeRecords.forEach(record => {
        const group = record[groupField]?.display_value || record[groupField] || 'Ungrouped';
        const label = record[labelField]?.display_value || record[labelField] || record.sys_id;
        const id = record.sys_id;

        if (!groups[group]) groups[group] = [];
        groups[group].push({ id, label, fullName: `${group}.${label}` });
    });

    const hierarchy = {
        name: 'Platform',
        children: Object.entries(groups).map(([groupName, items]) => ({
            name: groupName,
            children: items.map(item => ({
                name: item.fullName,
                displayName: item.label,
                sysId: item.id
            }))
        }))
    };

    // Build sys_id → fullName lookup
    const idToName = new Map();
    Object.values(groups).flat().forEach(item => {
        idToName.set(item.id, item.fullName);
    });

    const connections = relRecords
        .map(rel => {
            const parentId = rel[parentField]?.value || rel[parentField];
            const childId = rel[childField]?.value || rel[childField];
            return [idToName.get(parentId), idToName.get(childId)];
        })
        .filter(([s, t]) => s && t); // Only include connections where both nodes exist

    return { hierarchy, connections };
}


/**
 * CHORD TRANSFORMER
 * Converts interaction records into a square matrix
 *
 * Input: Array of records with sourceField and targetField
 * Output: { labels: [], matrix: [][] }
 */
export function transformToChordMatrix(records, sourceField, targetField, maxEntities = 12) {
    const pairCounts = new Map();
    const entityCounts = new Map();

    records.forEach(record => {
        const src = record[sourceField]?.display_value || record[sourceField] || 'Unknown';
        const tgt = record[targetField]?.display_value || record[targetField] || 'Unknown';

        if (src === tgt) return; // Skip self-referencing

        entityCounts.set(src, (entityCounts.get(src) || 0) + 1);
        entityCounts.set(tgt, (entityCounts.get(tgt) || 0) + 1);

        const key = `${src}|||${tgt}`;
        pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
    });

    // Get top N entities by total involvement
    const sortedEntities = Array.from(entityCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, maxEntities)
        .map(([name]) => name);

    const labels = sortedEntities;
    const n = labels.length;
    const matrix = Array.from({ length: n }, () => Array(n).fill(0));
    const labelIndex = new Map(labels.map((l, i) => [l, i]));

    pairCounts.forEach((count, key) => {
        const [src, tgt] = key.split('|||');
        const si = labelIndex.get(src);
        const ti = labelIndex.get(tgt);
        if (si !== undefined && ti !== undefined) {
            matrix[si][ti] = count;
        }
    });

    return { labels, matrix };
}


// ═══════════════════════════════════════════════════════════════════
// ACTION HANDLERS — Wire into component lifecycle
// ═══════════════════════════════════════════════════════════════════

/**
 * Standard action types used across all viz components
 */
export const DATA_ACTIONS = {
    FETCH_STARTED: 'SN_D3_DATA#FETCH_STARTED',
    FETCH_SUCCESS: 'SN_D3_DATA#FETCH_SUCCESS',
    FETCH_ERROR: 'SN_D3_DATA#FETCH_ERROR',
    FETCH_NODES_SUCCESS: 'SN_D3_DATA#FETCH_NODES_SUCCESS',
    FETCH_RELS_SUCCESS: 'SN_D3_DATA#FETCH_RELS_SUCCESS'
};

/**
 * Creates the standard set of HTTP effects for a single-table viz component.
 * Used by Sankey, Parallel Sets, Radial, and Chord.
 */
export function createSingleTableEffects(componentTag, transformFn) {
    return {
        [`${componentTag}#CONNECTED`]: ({ properties, dispatch }) => {
            dispatch(DATA_ACTIONS.FETCH_STARTED);
        },

        [DATA_ACTIONS.FETCH_STARTED]: createHttpEffect(
            (coeffects) => {
                const { properties } = coeffects;
                const fields = getFieldsFromProperties(properties);
                return createTableQuery(
                    properties.table,
                    fields,
                    properties.encodedQuery || ''
                );
            },
            {
                successActionType: DATA_ACTIONS.FETCH_SUCCESS,
                errorActionType: DATA_ACTIONS.FETCH_ERROR
            }
        ),

        [DATA_ACTIONS.FETCH_SUCCESS]: ({ action, updateState, properties }) => {
            const records = action.payload?.result || [];
            const transformedData = transformFn(records, properties);
            updateState({ data: transformedData, loading: false, error: null });
        },

        [DATA_ACTIONS.FETCH_ERROR]: ({ action, updateState }) => {
            console.error('D3 Viz data fetch error:', action.payload);
            updateState({ loading: false, error: action.payload?.message || 'Data fetch failed' });
        }
    };
}


/**
 * Creates HTTP effects for two-table components (Edge Bundling).
 * Fetches nodes first, then relationships.
 */
export function createDualTableEffects(componentTag, transformFn) {
    return {
        [`${componentTag}#CONNECTED`]: ({ dispatch }) => {
            dispatch(DATA_ACTIONS.FETCH_STARTED);
        },

        [DATA_ACTIONS.FETCH_STARTED]: createHttpEffect(
            (coeffects) => {
                const { properties } = coeffects;
                return createTableQuery(
                    properties.nodesTable,
                    `sys_id,${properties.groupField},${properties.labelField}`,
                    properties.nodesEncodedQuery || ''
                );
            },
            {
                successActionType: DATA_ACTIONS.FETCH_NODES_SUCCESS,
                errorActionType: DATA_ACTIONS.FETCH_ERROR
            }
        ),

        [DATA_ACTIONS.FETCH_NODES_SUCCESS]: ({ action, updateState, dispatch }) => {
            updateState({ nodeRecords: action.payload?.result || [] });
            dispatch(DATA_ACTIONS.FETCH_RELS_SUCCESS + '_TRIGGER');
        },

        [DATA_ACTIONS.FETCH_RELS_SUCCESS + '_TRIGGER']: createHttpEffect(
            (coeffects) => {
                const { properties } = coeffects;
                return createTableQuery(
                    properties.relationshipTable,
                    `${properties.parentField},${properties.childField}`,
                    properties.relsEncodedQuery || ''
                );
            },
            {
                successActionType: DATA_ACTIONS.FETCH_RELS_SUCCESS,
                errorActionType: DATA_ACTIONS.FETCH_ERROR
            }
        ),

        [DATA_ACTIONS.FETCH_RELS_SUCCESS]: ({ action, state, updateState, properties }) => {
            const relRecords = action.payload?.result || [];
            const nodeRecords = state.nodeRecords || [];
            const transformedData = transformFn(nodeRecords, relRecords, properties);
            updateState({ data: transformedData, loading: false, error: null });
        },

        [DATA_ACTIONS.FETCH_ERROR]: ({ action, updateState }) => {
            console.error('D3 Viz data fetch error:', action.payload);
            updateState({ loading: false, error: action.payload?.message || 'Data fetch failed' });
        }
    };
}


// ─── Utility ────────────────────────────────────────────────────

function getFieldsFromProperties(properties) {
    const fields = new Set();
    ['sourceField', 'intermediateField', 'targetField', 'valueField',
     'colorDimension', 'sourceField', 'targetField'].forEach(key => {
        if (properties[key]) fields.add(properties[key]);
    });

    // Handle dimensions array (Parallel Sets)
    if (properties.dimensions) {
        try {
            const dims = JSON.parse(properties.dimensions);
            dims.forEach(d => fields.add(d));
        } catch (e) { /* not a JSON array, skip */ }
    }

    // Handle hierarchy fields (Radial)
    if (properties.hierarchyFields) {
        try {
            const hf = JSON.parse(properties.hierarchyFields);
            hf.forEach(f => fields.add(f));
        } catch (e) { /* skip */ }
    }

    return Array.from(fields).filter(Boolean).join(',');
}
