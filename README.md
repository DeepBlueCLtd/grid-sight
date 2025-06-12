# Grid-Sight

A lightweight, zero-dependency library for enriching HTML tables with data visualization and analysis tools.

## Features

- Automatic table detection on web pages
- Heatmap visualization for numeric data
- Z-score outlier detection
- Per-table configuration
- Zero dependencies
- Accessibility-focused design
- Works with or without a build system
- Small footprint (~2.5KB gzipped)

## Installation

### Via CDN (Recommended for simple use cases)

```html
<script src="https://cdn.jsdelivr.net/npm/@deepbluec/grid-sight/dist/grid-sight.iife.js"></script>
```

### Via npm/yarn

```bash
# Using npm
npm install @deepbluec/grid-sight

# Or using yarn
yarn add @deepbluec/grid-sight
```

### Manual Installation

1. Download the latest release from the [releases page](https://github.com/DeepBlueCLtd/grid-sight/releases)
2. Include the script in your HTML:

```html
<script src="path/to/grid-sight.iife.js"></script>
```

## Usage

### Basic Usage

Include the script and let Grid-Sight automatically process all valid tables on the page:

```html
<!-- Your HTML -->
<table id="my-table">
  <!-- Table content -->
</table>

<!-- Include Grid-Sight -->
<script src="path/to/grid-sight.iife.js"></script>
```

### Programmatic Usage

```javascript
// Process a specific table
const table = document.getElementById('my-table');
window.gridSight.processTable(table);

// Process all tables on the page
window.gridSight.init();
```

## Demo

A demo is included in the `public/demo` directory. You can view it by:

1. Cloning the repository
2. Running `yarn install` and `yarn build`
3. Opening `dist/demo/index.html` in your browser

Or by using the development server:

```bash
yarn dev
```

Then navigate to http://localhost:5173/demo/

## Building from Source

### Prerequisites

- Node.js 16+ (LTS recommended)
- Yarn 1.22+ or npm 8+

### Build Commands

```bash
# Install dependencies
yarn install

# Build the library
yarn build

# Start development server
yarn dev

# Run tests
yarn test

# Run end-to-end tests
yarn test:e2e

# Build and preview production build
yarn build
yarn preview
```

## API Reference

### `window.gridSight.init()`

Scans the document for tables and processes all valid ones.

### `window.gridSight.processTable(table: HTMLTableElement, options?: object): HTMLTableElement`

Processes a single table.

**Parameters:**
- `table`: The HTML table element to process
- `options`: Optional configuration object
  - `id`: Custom ID for the table (auto-generated if not provided)
  - `applyStyles`: Whether to apply default styles (default: `true`)
  - `onComplete`: Callback function when processing is complete

**Returns:** The processed table element

### `window.gridSight.isValidTable(table: HTMLTableElement): boolean`

Checks if a table is valid for processing.

**Parameters:**
- `table`: The HTML table element to validate

**Returns:** `true` if the table is valid, `false` otherwise

## Browser Support

Grid-Sight works in all modern browsers, including:
- Chrome (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)
- Edge (latest 2 versions)

## Contributing

Contributions are welcome! Please read our [Contributing Guidelines](CONTRIBUTING.md) for details.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

Grid-Sight will automatically detect and enhance tables on your page.

## License

MIT