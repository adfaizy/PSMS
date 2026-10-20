"""
Batch / single-file student photo background removal → white JPEG via remove.bg.

Uses the remove.bg cloud API with bg_color=ffffff so the server returns a
white-background image (no local rembg/ONNX needed).

Install (once):
  pip install requests

Get a key: https://www.remove.bg/api
Set it once (PowerShell):
  $env:REMOVE_BG_API_KEY = "your_key_here"

Examples:
  python scripts/remove_photo_bg.py input.jpg
  python scripts/remove_photo_bg.py input.jpg -o output_white.jpg
  python scripts/remove_photo_bg.py Photos --inplace
  python scripts/remove_photo_bg.py Photos -o Photos_cleaned
  python scripts/remove_photo_bg.py input.jpg --api-key YOUR_KEY
"""

from __future__ import annotations

import argparse
import os
import sys
import time
from pathlib import Path

import requests

IMAGE_EXTS = {".jpg", ".jpeg", ".jpe", ".jfif", ".png", ".webp", ".bmp", ".tif", ".tiff"}
REMOVE_BG_URL = "https://api.remove.bg/v1.0/removebg"


def remove_bg_via_api(input_path: Path, output_path: Path, api_key: str, *, size: str = "auto") -> None:
    with open(input_path, "rb") as image_file:
        file_data = image_file.read()

    # bg_color=ffffff → solid white background from the server
    payload = {
        "size": size,
        "bg_color": "ffffff",
    }
    headers = {"X-Api-Key": api_key}

    response = requests.post(
        REMOVE_BG_URL,
        files={"image_file": (input_path.name, file_data)},
        data=payload,
        headers=headers,
        timeout=120,
    )

    if response.status_code == requests.codes.ok:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        # Prefer .jpg for PSMS Photos/<Class>/<roll>.jpg
        if output_path.suffix.lower() not in {".jpg", ".jpeg"}:
            output_path = output_path.with_suffix(".jpg")
        with open(output_path, "wb") as out_file:
            out_file.write(response.content)
        print(f"Saved: {output_path}")
        return

    raise RuntimeError(f"HTTP {response.status_code}: {response.text[:500]}")


def collect_images(root: Path) -> list[Path]:
    if root.is_file():
        return [root] if root.suffix.lower() in IMAGE_EXTS else []
    return sorted(
        p for p in root.rglob("*") if p.is_file() and p.suffix.lower() in IMAGE_EXTS
    )


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Remove photo background via remove.bg API and save white JPEG."
    )
    parser.add_argument("input", type=Path, help="Image file or folder (e.g. Photos/)")
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        default=None,
        help="Output file/folder (default: <name>_white.jpg next to input, or <folder>_white)",
    )
    parser.add_argument(
        "--inplace",
        action="store_true",
        help="Overwrite originals with white-background JPEGs (folder mode)",
    )
    parser.add_argument(
        "--api-key",
        default=None,
        help="remove.bg API key (default: env REMOVE_BG_API_KEY)",
    )
    parser.add_argument(
        "--size",
        choices=("auto", "preview", "small", "regular", "medium", "hd", "full", "4k"),
        default="auto",
        help="remove.bg size (default: auto)",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=0.35,
        help="Seconds between API calls in folder mode (default: 0.35)",
    )
    args = parser.parse_args()

    api_key = (args.api_key or os.environ.get("REMOVE_BG_API_KEY") or "").strip()
    if not api_key or api_key == "YOUR_API_KEY_HERE":
        print(
            "Missing API key. Set REMOVE_BG_API_KEY or pass --api-key.\n"
            "Get one at https://www.remove.bg/api",
            file=sys.stderr,
        )
        return 1

    src = args.input.resolve()
    if not src.exists():
        print(f"Not found: {src}", file=sys.stderr)
        return 1

    images = collect_images(src)
    if not images:
        print("No images found.", file=sys.stderr)
        return 1

    if src.is_file():
        out = args.output
        if out is None:
            out = src.with_name(f"{src.stem}_white.jpg")
        try:
            print(f"Sending {src.name} to remove.bg…")
            remove_bg_via_api(src, out.resolve(), api_key, size=args.size)
        except Exception as err:
            print(f"Failed {src}: {err}", file=sys.stderr)
            return 1
        return 0

    if args.inplace and args.output:
        print("Use either --inplace or -o, not both.", file=sys.stderr)
        return 1

    out_root = (
        src
        if args.inplace
        else (args.output.resolve() if args.output else src.parent / f"{src.name}_white")
    )

    failed = 0
    for i, img in enumerate(images):
        rel = img.relative_to(src)
        if args.inplace:
            dest = img.with_suffix(".jpg")
        else:
            dest = (out_root / rel).with_suffix(".jpg")
        try:
            print(f"[{i + 1}/{len(images)}] {rel}")
            remove_bg_via_api(img, dest, api_key, size=args.size)
            if args.inplace and dest != img and img.suffix.lower() != ".jpg":
                img.unlink(missing_ok=True)
        except Exception as err:
            failed += 1
            print(f"Failed {img}: {err}", file=sys.stderr)
        if i + 1 < len(images) and args.delay > 0:
            time.sleep(args.delay)

    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
