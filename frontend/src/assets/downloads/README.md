# Downloads (stable public installers)

Installers are produced by `scripts/package-collect-downloads.sh` during CI/package
and land under the production web tree as:

- `/downloads/documentos-vaticanos.apk`
- `/downloads/documentos-vaticanos-linux.AppImage`
- `/downloads/documentos-vaticanos-windows.exe`
- `/downloads/manifest.json`

Binaries are **not** committed here (too large). Only `manifest.json` may be
refreshed in-repo as a stub; real bits are injected into `dist/` by packaging.
