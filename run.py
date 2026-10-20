"""
Launcher script for AICTE Integrated Complaint Management Dashboard (ICMD)
"""
import sys
import os
import uvicorn

# Ensure backend directory is in python path
backend_dir = os.path.join(os.path.dirname(__file__), "backend")
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    print("=" * 70)
    print("   AICTE ICMD - Integrated Complaint Management Dashboard")
    print(f"   Local Server starting at: http://127.0.0.1:{port}")
    print(f"   Mobile & Network URL:     http://localhost:{port}")
    print("   Press Ctrl+C to terminate.")
    print("=" * 70)
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False, app_dir=backend_dir)
