# mpesa2csv

A desktop application built with Tauri, React, and TypeScript that converts M-PESA statement PDFs to CSV/XLSX files.

## Features

- Convert M-PESA statement PDF files to CSV/XLSX Files
- Handle password-protected PDF files
- Process the data locally - your statements never leave your computer
- Modern and user-friendly interface

## Privacy Notice

This application processes all data locally on your device. No data is sent to any external servers.

## Installation

### Pre-built Binaries

Download the latest release for your operating system from the [Releases](https://github.com/DavidAmunga/mpesa2csv/releases) page:

- **Windows**: Download the `.exe` installer
- **macOS**: Download the `.dmg` file (separate versions for Intel and Apple Silicon)
- **Linux**: Download the `.AppImage` (portable) or `.deb` package

### Auto-Updates

The application includes automatic update functionality. When a new version is available, you'll be prompted to update directly from within the app.

### Building from Source

1. Clone the repository

   ```bash
   git clone https://github.com/DavidAmunga/mpesa2csv.git
   cd mpesa2csv
   ```

2. Install dependencies

   ```bash
   pnpm install
   ```

3. Run in development mode

   ```bash
   pnpm run tauri dev
   ```

4. Build for production
   ```bash
   pnpm run tauri build
   ```

## Usage

1. Launch the application
2. Click on "Select PDF File" or drag and drop your M-PESA statement PDF into the application
3. If your PDF is password-protected, enter the password when prompted
4. The application will process your statement and display a summary
5. Click "Download CSV" to save the CSV file to your computer

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or newer)
- [Rust](https://www.rust-lang.org/tools/install) (v1.70 or newer)
- [pnpm](https://pnpm.io/) (v8 or newer)
- [Tauri CLI](https://tauri.app/v1/api/cli/)

### Technology Stack

- [Tauri](https://tauri.app/) - Framework for building desktop applications
- [React](https://reactjs.org/) - UI library
- [TypeScript](https://www.typescriptlang.org/) - Type-safe JavaScript
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
- [PDF.js](https://mozilla.github.io/pdf.js/) - PDF parsing library
- [PapaParse](https://www.papaparse.com/) - CSV generation library

## Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details on how to get started.

### Quick Start for Contributors

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature-name`
3. Make your changes and test locally
4. Submit a pull request using our [PR template](.github/pull_request_template.md)

## License

MIT

## Acknowledgements

- [M-PESA](https://www.safaricom.co.ke/personal/m-pesa) by Safaricom
