# Grid-Sight

A library for enriching HTML tables with data visualization and analysis tools.

## Features

- Automatic table detection on web pages
- Heatmap visualization for numeric data
- Z-score outlier detection
- Per-table configuration
- Accessibility-focused design

## Getting Started

### Installation

```bash
# Clone the repository
git clone https://github.com/DeepBlueCLtd/grid-sight.git
cd grid-sight

# Install dependencies
yarn install
```

### Development

```bash
# Start the development server
yarn dev
```

This will start a development server at http://localhost:5173 with the demo page.

### Building

```bash
# Build the library
yarn build
```

The built files will be in the `dist` directory.

## Usage

Include the built JavaScript file in your HTML:

```html
<script src="path/to/grid-sight.js"></script>
```

Grid-Sight will automatically detect and enhance tables on your page.

## License

MIT