# ServiceNow NextExperience — Advanced D3.js Visualization Components

## Deployment & Implementation Guide

---

### Project Overview

This component package adds five advanced D3.js visualization types to ServiceNow's NextExperience UI Builder as selectable dashboard widgets. Each visualization is a fully self-contained custom element that queries the ServiceNow Table API and renders interactive, brand-compliant D3 graphics.

| Component | Tag Name | Dashboard Use Case |
|-----------|----------|-------------------|
| Sankey Diagram | `sn-d3-sankey-diagram` | Ticket routing flows, process handoffs, change volume |
| Parallel Sets | `sn-d3-parallel-sets` | Multi-dimensional incident analysis, SLA breakdown |
| Radial Sunburst | `sn-d3-radial-sunburst` | CMDB hierarchy, org charts, category distribution |
| Edge Bundling | `sn-d3-edge-bundling` | Module integrations, CI dependencies, service maps |
| Chord Diagram | `sn-d3-chord-diagram` | Cross-team interactions, department collaboration |

---

### Prerequisites

Before starting deployment, ensure the following:

- **ServiceNow CLI** (`@servicenow/cli`) installed globally: `npm install -g @servicenow/cli`
- **Node.js** 18+ and npm 9+
- **Instance admin access** to a ServiceNow instance (Vancouver+ recommended, Washington DC+ ideal)
- **Developer role** (`sn_admin` or `admin`) on the target instance
- **Scoped application** created or available for the `x_snc_d3_adv_viz` scope

---

### Project Structure

```
sn-d3-viz-components/
├── package.json                          # Dependencies and build scripts
├── now-ui.json                           # Component registry (5 components)
├── src/
│   ├── components/
│   │   ├── sankey/index.js               # Sankey Diagram component
│   │   ├── parallel-sets/index.js        # Parallel Sets component
│   │   ├── radial-sunburst/index.js      # Radial Sunburst component
│   │   ├── edge-bundling/index.js        # Edge Bundling component
│   │   └── chord-diagram/index.js        # Chord Diagram component
│   ├── shared/
│   │   ├── brandPalette.js               # ServiceNow colors and theme constants
│   │   └── tooltipManager.js             # Shared tooltip utility
│   └── data-providers/
│       └── dataProvider.js               # Table API queries + D3 transforms
├── config/                               # Environment configs (add per-instance)
└── docs/                                 # This guide and supplementary docs
```

---

### Step 1 — Authenticate the CLI

Run this once per instance to store credentials:

```bash
snc configure profile set \
  --host https://YOUR-INSTANCE.service-now.com \
  --username admin \
  --password YOUR_PASSWORD
```

Alternatively, use OAuth tokens for CI/CD pipelines:

```bash
snc configure profile set \
  --host https://YOUR-INSTANCE.service-now.com \
  --client-id YOUR_CLIENT_ID \
  --client-secret YOUR_CLIENT_SECRET
```

Verify connectivity:

```bash
snc ui-component whoami
```

---

### Step 2 — Install Dependencies

From the project root:

```bash
cd sn-d3-viz-components
npm install
```

This installs the Now Experience framework, D3.js, and all build tooling. D3 is bundled into the component package itself (not loaded from a CDN) to avoid Content Security Policy issues on the instance.

---

### Step 3 — Local Development

Start the local dev server to preview components before deployment:

```bash
npm run dev
```

This launches a local rendering environment at `http://localhost:8081` where you can interact with each component using mock data. The mock data is already embedded in the data providers — swap `createHttpEffect` calls with static returns for local testing.

---

### Step 4 — Deploy to Instance

Build and push all five components to your target instance:

```bash
npm run build
npm run deploy
```

The deploy command pushes the component bundle to the `sys_ux_lib_component` table on your instance. Each component appears as a separate entry.

If deploying to a specific scope:

```bash
snc ui-component deploy --scope x_snc_d3_adv_viz --force
```

---

### Step 5 — Register in UI Builder

After deployment, the components automatically appear in the **UI Builder** widget palette under the **Analytics** category. To use them:

1. Open **UI Builder** from the Application Navigator
2. Open or create a dashboard/workspace page
3. In the component panel, search for "D3" — all five components appear
4. Drag any component onto your canvas
5. In the **Properties** panel on the right, configure the data source fields

---

### Component Configuration Reference

#### Sankey Diagram Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `table` | string | `incident` | Source table name |
| `sourceField` | string | `category` | Left-column node field |
| `intermediateField` | string | `assignment_group` | Middle-column node field (optional) |
| `targetField` | string | `state` | Right-column node field |
| `valueAggregation` | enum | `count` | count, sum, or average |
| `encodedQuery` | string | (empty) | ServiceNow encoded query filter |
| `maxNodes` | integer | 10 | Max nodes per column |
| `colorScheme` | enum | `servicenow` | servicenow, categorical, sequential, diverging |
| `height` | integer | 440 | Pixel height |
| `showLabels` | boolean | true | Display node labels |

**Example configuration — Incident routing flow:**
- table: `incident`
- sourceField: `category`
- intermediateField: `assignment_group`
- targetField: `state`
- encodedQuery: `sys_created_on>=javascript:gs.beginningOfLastMonth()`

#### Parallel Sets Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `table` | string | `incident` | Source table |
| `dimensions` | JSON string | `["priority","category","sla_due","state"]` | Ordered field axes |
| `colorDimension` | string | `priority` | Field to base ribbon colors on |
| `maxCategories` | integer | 8 | Max categories per axis before "Other" |

#### Radial Sunburst Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `table` | string | `cmdb_ci` | Hierarchical data table |
| `hierarchyFields` | JSON string | `["sys_class_name","subcategory","name"]` | Fields defining tree levels |
| `valueField` | string | (empty) | Numeric field for sizing (count-based if empty) |
| `centerLabel` | string | (empty) | Label in the center of the ring |
| `enableZoom` | boolean | true | Click-to-zoom support |

#### Hierarchical Edge Bundling Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `nodesTable` | string | `cmdb_ci_service` | Table containing entities |
| `groupField` | string | `service_classification` | Field for ring clustering |
| `labelField` | string | `name` | Display label field |
| `relationshipTable` | string | `cmdb_rel_ci` | Table with edges/connections |
| `parentField` | string | `parent` | Source reference field |
| `childField` | string | `child` | Target reference field |
| `bundleTension` | number | 0.85 | Curve bundling tightness (0–1) |

#### Chord Diagram Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `table` | string | `interaction` | Interaction records table |
| `sourceField` | string | `assigned_to.department` | Source entity field |
| `targetField` | string | `opened_by.department` | Target entity field |
| `maxEntities` | integer | 12 | Max entities before "Other" |
| `padAngle` | number | 0.04 | Gap between chord arcs |

---

### Event Handling — Wiring Actions to Other Components

Each visualization dispatches click events that other NextExperience components can subscribe to. This enables drill-down workflows where clicking a Sankey node filters a list widget, or clicking a chord ribbon opens a record detail.

**Available Actions:**

| Component | Action | Payload |
|-----------|--------|---------|
| Sankey | `SN_D3_SANKEY#NODE_CLICKED` | `{ nodeName, nodeValue, column }` |
| Sankey | `SN_D3_SANKEY#LINK_CLICKED` | `{ sourceName, targetName, value }` |
| Parallel Sets | `SN_D3_PARALLEL#RIBBON_CLICKED` | `{ fromDimension, fromValue, toDimension, toValue, count }` |
| Radial | `SN_D3_RADIAL#SEGMENT_CLICKED` | `{ path, value, depth }` |
| Edge Bundling | `SN_D3_EDGE#NODE_CLICKED` | `{ nodeId, group, connectionCount }` |
| Chord | `SN_D3_CHORD#GROUP_CLICKED` | `{ entityName, totalValue }` |
| Chord | `SN_D3_CHORD#RIBBON_CLICKED` | `{ sourceName, targetName, sourceToTargetValue, targetToSourceValue }` |

**In UI Builder**, wire these events to target components using the Events panel. For example, `SN_D3_SANKEY#NODE_CLICKED → Set filter on List widget → encodedQuery: category=${nodeName}`.

---

### Data Architecture

The data flow works as follows:

```
  ┌──────────────────┐     ┌────────────────────┐     ┌─────────────────┐
  │  UI Builder       │     │  Data Provider      │     │  D3 Renderer    │
  │  (Properties)     │────▷│  (Table API Query)  │────▷│  (SVG Output)   │
  │                   │     │                     │     │                 │
  │  table: incident  │     │  GET /api/now/table │     │  Sankey layout  │
  │  sourceField: ... │     │  → Transform to     │     │  + Interactive  │
  │  encodedQuery:... │     │    D3 data shape    │     │    tooltips     │
  └──────────────────┘     └────────────────────┘     └─────────────────┘
```

Each component follows this lifecycle:

1. **CONNECTED** event fires when the component mounts
2. Component dispatches `FETCH_STARTED` which triggers the HTTP effect
3. Table API returns records as JSON
4. The appropriate transform function converts flat records into D3-ready structures (nodes/links, hierarchy, matrix)
5. The SNABB virtual DOM renders an empty container with a `hook-insert`
6. D3 takes over the DOM node and renders the SVG visualization
7. User interactions dispatch events back to the NextExperience framework

---

### Performance Considerations

These components query the Table API with a default limit of 10,000 records. For tables with millions of rows, always apply an `encodedQuery` filter to scope the data down. Recommended strategies:

- Time-box queries using `sys_created_on>=javascript:gs.beginningOfLast90Days()`
- Filter to specific assignment groups, categories, or business services
- For the Chord diagram, aggregate at the department or group level rather than individual users
- For the Sunburst, limit `maxDepth` to 3–4 levels to keep the ring readable

For very large datasets (100K+ records), consider creating a **Scripted REST API** that performs server-side aggregation and returns pre-computed node/link structures. Update the data provider to call your custom endpoint instead of the Table API.

---

### Troubleshooting

**Components don't appear in UI Builder**
Verify the deploy completed successfully with `snc ui-component list`. Check that the scope `x_snc_d3_adv_viz` is active on the instance.

**"Content Security Policy" errors in browser console**
D3 is bundled into the component package, so CDN issues shouldn't occur. If you see CSP errors, check that inline SVG rendering is allowed in your instance's CSP policy (System Properties → `glide.security.content_security_policy`).

**Empty visualizations / "Data Error" state**
Confirm the configured table and fields exist on your instance. Test the query manually in REST API Explorer: `GET /api/now/table/{table}?sysparm_fields={fields}&sysparm_limit=10`.

**Slow rendering on large datasets**
Reduce the record limit via `encodedQuery` filters. For Sankey and Parallel Sets, set `maxNodes` / `maxCategories` lower to reduce visual complexity.

---

### Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-03-05 | Initial release — 5 visualization types |

---

*ServiceNow Confidential — For Internal Use Only*

*© 2026 ServiceNow, Inc. All rights reserved.*
