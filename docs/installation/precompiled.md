# Running Pre-compiled Binaries

Jotter is designed to be fully self-contained. You do not need Python, Node.js, or any other build tools installed on your system to run it.

We provide pre-compiled, single-file executables for Windows, Linux, and macOS.

## Installation Steps

1. Go to the [GitHub Releases](https://github.com/simon123h/jotter/releases) page of the repository.
2. Download the packaged executable matching your operating system:
   - **Windows**: `jotter-vX.Y.Z-windows.zip`
   - **Linux**: `jotter-vX.Y.Z-linux.tar.gz`
   - **macOS**: `jotter-vX.Y.Z-macos.tar.gz`
3. Extract the downloaded archive.
4. Run the executable:
   - **Windows**: Double-click `jotter.exe` in the extracted folder.
   - **Linux**: Open your terminal, navigate to the extracted folder, and run:
     ```bash
     chmod +x jotter && ./jotter
     ```
   - **macOS**: Open your terminal, navigate to the extracted folder, and run:
     ```bash
     chmod +x jotter && ./jotter
     ```
     _(Note: You may need to grant execution permissions in macOS System Settings under Security & Privacy if it warns about an unidentified developer.)_

## Post-Launch

Once started, Jotter will:

1. Initialize a local web server (by default on `http://127.0.0.1:8000`).
2. **Automatically open the interface** in your default web browser.
3. Use a folder named `tasks` in your current working directory to store your markdown files. You can configure this behavior (see [Configuration Guide](../user/configuration.md)).
