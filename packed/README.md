# Packed game assets

`assets.b64.NN` is a split base64 gzip of a tar that contains `public/game/**`.

`npm install` runs `scripts/unpack-assets.mjs` and restores the PNG/JPEG sprites,
tiles, and backgrounds. Rebuild the pack after changing art:

```bash
node scripts/pack-assets.mjs
```
