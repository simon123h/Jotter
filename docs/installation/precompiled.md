# Running Pre-compiled Binaries

Jotter is designed to be fully self-contained. You do not need Python, Node.js, or any other build tools installed on your system to run it.

We provide pre-compiled, single-file executables for Windows, Linux, and macOS.

## Which binary should I use?

The release package contains two different versions of Jotter:

- **`jotter-desktop` (Recommended for most users)**: This is a standalone desktop application. It opens in its own window and behaves like a regular desktop tool (similar to Obsidian or Trello).
- **`jotter-server`**: This is a lightweight CLI/server version. It runs in your terminal and starts a web server. Use this if you want to run Jotter on a headless server, inside Docker, or simply prefer using your own web browser.

## Installation Steps

1. Go to the [GitHub Releases](https://github.com/simon123h/jotter/releases) page of the repository.
2. Download the packaged archive matching your operating system.
3. Extract the downloaded archive.
4. Run the executable:
   - **Windows**: Double-click `jotter-desktop.exe` for the app window, or run `jotter-server.exe` in a command prompt for the server mode.
   - **Linux / macOS**: Open your terminal, navigate to the extracted folder, and run:
     ```bash
     chmod +x jotter*
     ./jotter-desktop  # For the desktop app
     # OR
     ./jotter-server   # For the server mode
     ```

## Post-Launch

- If you run **`jotter-desktop`**, the application window will open immediately.
- If you run **`jotter-server`**, it will initialize a local web server (default: `http://localhost:8000`) and **automatically open** your default web browser to that address.
