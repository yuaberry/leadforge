#!/usr/bin/env python3
"""
Gera um arquivo .icns válido (contêiner Apple Icon Image) a partir do PNG
1024x1024 do LeadForge.

O `convert` do ImageMagick apenas renomeia o PNG — o macOS exige o contêiner
ICNS real com os blocos de tamanho específicos. Este script monta o formato
correto: magic 'icns' + tamanho total + blocos [tipo(4) | tamanho(4) | dados].
"""
import struct
import sys
from pathlib import Path

from PIL import Image

# (tipo ICNS, lado em px) — tamanhos exigidos pelo macOS.
BLOCKS = [
    (b"icp4", 16),
    (b"icp5", 32),
    (b"icp6", 64),
    (b"ic07", 128),
    (b"ic08", 256),
    (b"ic09", 512),
    (b"ic10", 1024),
    (b"ic11", 32),   # 16@2x
    (b"ic12", 64),   # 32@2x
    (b"ic13", 256),  # 128@2x
    (b"ic14", 512),  # 256@2x
]


def png_bytes(img: Image.Image, size: int) -> bytes:
    """PNG RGBA no tamanho pedido, com fallback de reamostragem."""
    resized = img.resize((size, size), Image.LANCZOS)
    import io

    buf = io.BytesIO()
    resized.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def main() -> int:
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("icons/icon.png")
    dst = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("icons/icon.icns")

    if not src.exists():
        print(f"ERRO: {src} não encontrado", file=sys.stderr)
        return 1

    with Image.open(src) as img:
        img = img.convert("RGBA")

        blocks = b""
        for icns_type, size in BLOCKS:
            data = png_bytes(img, size)
            blocks += icns_type + struct.pack(">I", len(data) + 8) + data

    payload = b"icns" + struct.pack(">I", len(blocks) + 8) + blocks
    dst.write_bytes(payload)

    # Validação: relê e confere estrutura + magic.
    raw = dst.read_bytes()
    if raw[:4] != b"icns":
        print("ERRO: magic inválido", file=sys.stderr)
        return 1
    total = struct.unpack(">I", raw[4:8])[0]
    if total != len(raw):
        print(f"ERRO: tamanho declarado {total} != real {len(raw)}", file=sys.stderr)
        return 1

    off, count = 8, 0
    while off < len(raw):
        length = struct.unpack(">I", raw[off + 4 : off + 8])[0]
        off += length
        count += 1

    print(f"OK: {dst} ({len(raw)} bytes, {count} blocos)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
