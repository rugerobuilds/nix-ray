import subprocess
import webbrowser
import time
import sys
import os

# Configuration
PORT = 8000
HOST = "127.0.0.1"
BACKEND_DIR = "backend"

def launch():
    print("\n" + "═"*45)
    print("      NIX-RAY // SYSTEM INITIALIZATION      ")
    print("═"*45)

    # 1. Start the Backend
    # REMOVED stdout=subprocess.PIPE to let the strings leak into the terminal
    print(f"[+] Booting Core API on {HOST}:{PORT}...")
    
    try:
        backend_process = subprocess.Popen(
            [sys.executable, "-m", "uvicorn", "main:app", "--host", HOST, "--port", str(PORT)],
            cwd=BACKEND_DIR
            # We don't redirect stdout/stderr here so you can see the key!
        )
    except Exception as e:
        print(f"[!] CRITICAL FAILURE: Could not start backend. {e}")
        return

    # 2. Wait for the server to bind and print the Session Key
    time.sleep(2)

    # 3. Open the Dashboard URL
    dashboard_url = f"http://{HOST}:{PORT}"
    print(f"[+] Deploying Interface: {dashboard_url}")
    
    webbrowser.open(dashboard_url)

    print("\n[!] NIX-RAY IS OPERATIONAL.")
    print("[!] Use [Ctrl+C] to terminate the session.")
    print("═"*45 + "\n")

    try:
        backend_process.wait()
    except KeyboardInterrupt:
        print("\n\n[!] TERMINATION SIGNAL RECEIVED.")
        print("[!] Decommissioning NIX-RAY Core...")
        backend_process.terminate()
        backend_process.wait()
        print("[+] System Offline.\n")
        sys.exit(0)

if __name__ == "__main__":
    launch()