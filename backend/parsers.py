import subprocess
import json
import shlex

def get_pip_packages():
    """Fetches installed python libraries."""
    try:
        # Avoid shell=True whenever possible for security
        result = subprocess.run(['pip', 'list', '--format=json'], capture_output=True, text=True, check=True)
        return json.loads(result.stdout)
    except Exception:
        return []

def get_snap_packages():
    """Fetches installed snap applications."""
    try:
        result = subprocess.run(['snap', 'list'], capture_output=True, text=True, check=True)
        lines = result.stdout.strip().split('\n')[1:]
        snaps = []
        for line in lines:
            parts = line.split()
            if len(parts) >= 2:
                snaps.append({"name": parts[0], "version": parts[1]})
        return snaps
    except Exception:
        return []

def get_apt_packages():
    """Fetches installed APT packages."""
    try:
        # Querying dpkg-query directly is faster and safer than parsing 'apt list'
        cmd = ["dpkg-query", "-W", "-f=${Package} ${Version}\n"]
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        lines = result.stdout.strip().split('\n')
        return [{"name": p.split()[0], "version": p.split()[1]} for p in lines if len(p.split()) >= 2]
    except Exception:
        return []

def get_package_info(manager: str, name: str):
    """Retrieves detailed metadata for a specific package."""
    # Sanitize input to prevent command injection
    safe_name = shlex.quote(name)
    try:
        if manager == "apt":
            cmd = ["apt-cache", "show", safe_name]
        elif manager == "snap":
            cmd = ["snap", "info", safe_name]
        elif manager == "pip":
            cmd = ["pip", "show", safe_name]
        else:
            return {"details": "Invalid package manager requested."}

        result = subprocess.run(cmd, capture_output=True, text=True)
        return {"details": result.stdout if result.stdout else "No metadata available for this unit."}
    except Exception as e:
        return {"details": f"System Query Error: {str(e)}"}

def remove_package(manager: str, package_name: str, password: str = None):
    """
    Executes a high-privilege removal.
    Uses direct STDIN piping for the password to avoid shell escape vulnerabilities.
    """
    safe_name = shlex.quote(package_name)
    
    try:
        if manager == "pip":
            cmd = ["pip", "uninstall", "-y", safe_name]
        elif manager == "snap":
            cmd = ["sudo", "-S", "snap", "remove", safe_name]
        elif manager == "apt":
            cmd = ["sudo", "-S", "apt", "purge", "-y", safe_name]
        else:
            return {"status": "error", "output": "Unknown Manager"}

        # Military Grade: We pass the password directly to the process's stdin.
        # This ensures the password never appears in the process tree (ps aux).
        result = subprocess.run(
            cmd,
            input=f"{password}\n" if password else None,
            capture_output=True,
            text=True
        )

        combined_log = result.stdout + result.stderr
        return {
            "status": "success" if result.returncode == 0 else "error",
            "output": combined_log
        }
    except Exception as e:
        return {"status": "error", "output": f"Critical Execution Failure: {str(e)}"}