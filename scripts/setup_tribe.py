"""Set up TRIBE v2 environment: install dependencies and verify configuration."""

import os
import subprocess
import sys


def run(cmd: list[str], check: bool = True) -> subprocess.CompletedProcess:
    print(f"  → {' '.join(cmd)}")
    return subprocess.run(cmd, check=check)


def main() -> int:
    python = sys.executable
    errors: list[str] = []

    print("=== TRIBE v2 Environment Setup ===\n")

    # 1. Install PyTorch with CUDA support
    print("[1/4] Installing PyTorch with CUDA 12.4 support...")
    result = run(
        [
            python, "-m", "pip", "install",
            "torch>=2.5.1,<2.7", "torchvision>=0.20,<0.22",
            "--index-url", "https://download.pytorch.org/whl/cu124",
        ],
        check=False,
    )
    if result.returncode != 0:
        print("  ⚠ CUDA install failed, falling back to CPU-only PyTorch...")
        run([
            python, "-m", "pip", "install",
            "torch>=2.5.1,<2.7", "torchvision>=0.20,<0.22",
        ])

    # 2. Install TRIBE v2 from source
    print("\n[2/4] Installing TRIBE v2 from facebookresearch/tribev2...")
    result = run(
        [
            python, "-m", "pip", "install",
            "tribev2 @ git+https://github.com/facebookresearch/tribev2.git",
        ],
        check=False,
    )
    if result.returncode != 0:
        errors.append("TRIBE v2 installation failed")

    # 3. Install backend with all dependencies
    print("\n[3/4] Installing backend dependencies...")
    run([python, "-m", "pip", "install", "-e", "../backend"])

    # 4. Verify HuggingFace token
    print("\n[4/4] Checking HuggingFace token...")
    hf_token = os.environ.get("NEUROSCORE_HF_TOKEN") or os.environ.get("HF_TOKEN", "")
    if not hf_token:
        errors.append(
            "No HuggingFace token found. "
            "Set NEUROSCORE_HF_TOKEN or HF_TOKEN in your .env file."
        )
    else:
        print("  ✓ HuggingFace token is set")

    print("\n=== Setup Summary ===")
    if errors:
        for e in errors:
            print(f"  ✗ {e}")
        return 1

    print("  ✓ All dependencies installed")
    print("  Run 'python scripts/verify_tribe.py' to verify the environment")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
