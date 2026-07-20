"""PyInstaller entry point for the standalone PhotoRounds.exe (windowed GUI).

`--selftest` imports the full pipeline and exits 0 without opening a window,
so CI can verify the frozen bundle actually contains everything.
"""

import sys


def _selftest() -> int:
    import photorounds.ops                    # noqa: F401
    from photorounds.core import (            # noqa: F401
        convert, dates, dedupe, hashing, organize, quality, resize, rounds, scan, tools,
    )
    from PIL import Image

    im = Image.new("RGB", (32, 24), (10, 20, 30))
    h = hashing.dhash_image(im)
    assert isinstance(h, int)
    tools.has_heif()
    tools.has_rawpy()
    return 0


if __name__ == "__main__":
    if "--selftest" in sys.argv:
        sys.exit(_selftest())
    from photorounds.gui import main
    sys.exit(main())
