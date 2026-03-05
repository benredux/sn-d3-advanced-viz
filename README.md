# ServiceNow NextExperience — Advanced D3.js Visualizations

Custom UI components that add five advanced D3.js visualization types to the ServiceNow NextExperience dashboard builder.

![ServiceNow](https://img.shields.io/badge/ServiceNow-Zurich+-032D42?style=flat&logo=servicenow&logoColor=white)
![D3.js](https://img.shields.io/badge/D3.js-v7-F9A03C?style=flat&logo=d3dotjs&logoColor=white)
![License](https://img.shields.io/badge/License-Internal-63DF4E)

---

## Visualizations

| Component | Tag | Use Case |
|-----------|-----|----------|
| **Sankey Diagram** | `sn-d3-sankey-diagram` | Ticket routing, process flow, change volume |
| **Parallel Sets** | `sn-d3-parallel-sets` | Multi-dimensional incident analysis, SLA breakdown |
| **Radial Sunburst** | `sn-d3-radial-sunburst` | CMDB hierarchy, org structure, category distribution |
| **Edge Bundling** | `sn-d3-edge-bundling` | Module integrations, CI dependencies, service maps |
| **Chord Diagram** | `sn-d3-chord-diagram` | Cross-team interactions, department collaboration |

All components are fully interactive (hover tooltips, click events), configurable via UI Builder properties, and styled to ServiceNow brand standards.

---

## Quick Start

```bash
# Install dependencies
npm install

# Local development preview
npm run dev

# Build and deploy to your instance
snc configure profile set --host https://YOUR-INSTANCE.service-now.com
npm run build
npm run deploy
```

## Project Structure

```
├── now-ui.json                    # Component registry for UI Builder
├── package.json
├── src/
│   ├── components/
│   │   ├── sankey/index.js
│   │   ├── parallel-sets/index.js
│   │   ├── radial-sunburst/index.js
│   │   ├── edge-bundling/index.js
│   │   └── chord-diagram/index.js
│   ├── shared/
│   │   ├── brandPalette.js        # ServiceNow colors and themes
│   │   └── tooltipManager.js      # Shared tooltip utility
│   └── data-providers/
│       └── dataProvider.js        # Table API queries + D3 transforms
└── docs/
    └── DEPLOYMENT-GUIDE.md        # Full deployment walkthrough
```

## ServiceNow IDE + Build Agent

To deploy via the ServiceNow IDE and Build Agent:

1. Connect this repo to your IDE workspace via GitHub integration
2. Use Build Agent to adapt components to the Fluent framework if targeting Zurich+
3. Build & Deploy from the IDE

See [docs/DEPLOYMENT-GUIDE.md](docs/DEPLOYMENT-GUIDE.md) for detailed instructions.

## Configuration

Each component exposes properties in UI Builder for no-code configuration:

- **Data source** — table name, field mappings, encoded query filters
- **Appearance** — color scheme, height, label visibility
- **Behavior** — max nodes/categories, aggregation type, zoom controls

Click events are dispatched as NextExperience actions for wiring drill-down workflows between dashboard widgets.

---

## Prerequisites

- ServiceNow instance (Zurich or later recommended)
- ServiceNow CLI (`npm install -g @servicenow/cli`)
- Node.js 18+
- Admin or developer role on target instance

---

*ServiceNow Confidential — For Internal Use Only*
