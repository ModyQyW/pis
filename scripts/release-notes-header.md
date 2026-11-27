## Download

Download one file from the table below. `update-*.json`, `SHA256SUMS`, any `.delta` files, and the macOS/Windows `.tar.gz` files are for the in-app updater; you do not need them.

| System                     | File                                                                                                                               |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| macOS, Apple Silicon       | [pis-PISVERSION-arm64.dmg](https://github.com/__REPO__/releases/download/v__VERSION__/pis-__VERSION__-arm64.dmg)                   |
| macOS, Intel               | [pis-PISVERSION-amd64.dmg](https://github.com/__REPO__/releases/download/v__VERSION__/pis-__VERSION__-amd64.dmg)                   |
| Windows, x64               | [pis-setup-PISVERSION-amd64.exe](https://github.com/__REPO__/releases/download/v__VERSION__/pis-setup-__VERSION__-amd64.exe)       |
| Windows, ARM64             | [pis-setup-PISVERSION-arm64.exe](https://github.com/__REPO__/releases/download/v__VERSION__/pis-setup-__VERSION__-arm64.exe)       |
| Linux, Debian/Ubuntu x64   | [pis___VERSION___amd64.deb](https://github.com/__REPO__/releases/download/v__VERSION__/pis___VERSION___amd64.deb)                  |
| Linux, Debian/Ubuntu ARM64 | [pis___VERSION___arm64.deb](https://github.com/__REPO__/releases/download/v__VERSION__/pis___VERSION___arm64.deb)                  |
| Linux, Fedora/RHEL x64     | [pis-PISVERSION-1.x86_64.rpm](https://github.com/__REPO__/releases/download/v__VERSION__/pis-__VERSION__-1.x86_64.rpm)             |
| Linux, Fedora/RHEL ARM64   | [pis-PISVERSION-1.aarch64.rpm](https://github.com/__REPO__/releases/download/v__VERSION__/pis-__VERSION__-1.aarch64.rpm)           |
| Linux, portable x64        | [pis-PISVERSION-linux-amd64.tar.gz](https://github.com/__REPO__/releases/download/v__VERSION__/pis-__VERSION__-linux-amd64.tar.gz) |
| Linux, portable ARM64      | [pis-PISVERSION-linux-arm64.tar.gz](https://github.com/__REPO__/releases/download/v__VERSION__/pis-__VERSION__-linux-arm64.tar.gz) |

Or install the latest release from a terminal:

```sh
# macOS and Linux
curl -fsSL https://github.com/__REPO__/releases/latest/download/install.sh | sh
```

```powershell
# Windows
irm https://github.com/__REPO__/releases/latest/download/install.ps1 | iex
```

If PiS is already installed, use its update prompt; do not download the installer again.

PiS needs `pi >= 1.6 < 2` and a signed-in provider. The macOS build is ad-hoc signed and the Windows installer is unsigned; the [install guide](https://pis.modyqyw.top/guide/install) covers the first-launch prompts.

## What's changed
