#!/usr/bin/env python
"""
Wrapper script to run the XTTS server with automatic dependency installation.
This script ensures TTS is installed before starting the server.
"""
import os
import subprocess
import sys
from pathlib import Path

# Change to the script's directory so relative imports work
SCRIPT_DIR = Path(__file__).parent.resolve()
os.chdir(SCRIPT_DIR)

def check_dependencies():
    """Check if required dependencies are installed."""
    try:
        import TTS
        import transformers
        return True
    except ImportError:
        return False

def install_dependencies():
    """Install required dependencies from requirements.txt."""
    print('[XTTS] Missing dependencies. Installing from requirements.txt...', file=sys.stderr)
    try:
        subprocess.check_call([
            sys.executable, '-m', 'pip', 'install', '-r', 'requirements.txt'
        ])
        print('[XTTS] Dependencies installed successfully.', file=sys.stderr)
        return True
    except subprocess.CalledProcessError as e:
        print(f'[XTTS] Failed to install dependencies: {e}', file=sys.stderr)
        return False

def main():
    """Main entry point."""
    # Check if dependencies are installed, install if needed
    if not check_dependencies():
        if not install_dependencies():
            sys.exit(1)
    
    # Import and run the server (will use sys.argv from parent process)
    import xtts_server
    xtts_server.main()

if __name__ == '__main__':
    main()

