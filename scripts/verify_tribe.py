"""Verify TRIBE v2 environment: check all dependencies, GPU, and model access."""

import os
import sys


def check_pytorch() -> bool:
    try:
        import torch
        print(f"  ✓ PyTorch {torch.__version__}")

        if torch.cuda.is_available():
            print(f"  ✓ CUDA available: {torch.version.cuda}")
            print(f"  ✓ GPU: {torch.cuda.get_device_name(0)}")
        else:
            print("  ⚠ CUDA not available — inference will use CPU (slow)")

        return True
    except ImportError:
        print("  ✗ PyTorch not installed")
        return False


def check_torchvision() -> bool:
    try:
        import torchvision
        print(f"  ✓ torchvision {torchvision.__version__}")
        return True
    except ImportError:
        print("  ✗ torchvision not installed")
        return False


def check_plotting_deps() -> bool:
    ok = True
    for name in ("nibabel", "nilearn", "pyvista", "matplotlib", "scipy"):
        try:
            mod = __import__(name)
            version = getattr(mod, "__version__", "unknown")
            print(f"  ✓ {name} {version}")
        except ImportError:
            print(f"  ✗ {name} not installed")
            ok = False
    return ok


def check_huggingface() -> bool:
    token = os.environ.get("NEUROSCORE_HF_TOKEN") or os.environ.get("HF_TOKEN", "")
    if not token:
        print("  ✗ No HuggingFace token (set NEUROSCORE_HF_TOKEN or HF_TOKEN)")
        return False

    try:
        from huggingface_hub import HfApi
        api = HfApi(token=token)
        user = api.whoami()
        print(f"  ✓ Authenticated as: {user.get('name', user.get('fullname', 'unknown'))}")
        return True
    except ImportError:
        print("  ✗ huggingface-hub not installed")
        return False
    except Exception as e:
        print(f"  ✗ HuggingFace auth failed: {e}")
        return False


def check_tribe_model() -> bool:
    token = os.environ.get("NEUROSCORE_HF_TOKEN") or os.environ.get("HF_TOKEN", "")
    if not token:
        print("  ✗ Skipping model check — no token")
        return False

    try:
        from huggingface_hub import HfApi
        api = HfApi(token=token)
        model_id = "facebook/tribev2"
        info = api.model_info(model_id, token=token)
        print(f"  ✓ Model accessible: {model_id}")
        print(f"  ✓ Last modified: {info.last_modified}")
        return True
    except Exception as e:
        print(f"  ✗ Cannot access facebook/tribev2: {e}")
        print("    → Ensure Meta LLaMA 3.2 license is accepted on huggingface.co")
        return False


def main() -> int:
    print("=== TRIBE v2 Environment Verification ===\n")

    results: dict[str, bool] = {}

    print("[PyTorch]")
    results["pytorch"] = check_pytorch()

    print("\n[torchvision]")
    results["torchvision"] = check_torchvision()

    print("\n[Plotting dependencies]")
    results["plotting"] = check_plotting_deps()

    print("\n[HuggingFace access]")
    results["huggingface"] = check_huggingface()

    print("\n[TRIBE v2 model]")
    results["tribe_model"] = check_tribe_model()

    print("\n=== Results ===")
    all_pass = all(results.values())
    for name, passed in results.items():
        status = "PASS" if passed else "FAIL"
        print(f"  {status}: {name}")

    if all_pass:
        print("\n✓ Environment is ready for TRIBE v2 inference")
    else:
        print("\n✗ Some checks failed — see above for details")

    return 0 if all_pass else 1


if __name__ == "__main__":
    raise SystemExit(main())
