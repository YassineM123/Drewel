# Drewel Admin Panel

## Production deploy

Build and deploy the whole `dist` folder together. The `index.html` file points
to hashed Vite assets, so uploading only `index.html` or only part of `dist`
will leave the app as a blank page.

```bash
npm install
npm run build
```

Upload `drewel-admin-panel/dist/` to the web root configured for
`admin-dreewel.com`, for example:

```bash
rsync -av --delete dist/ user@server:/var/www/drewel-admin-panel/dist/
```

After deploy, verify that the asset referenced by `dist/index.html` is served as
JavaScript, not HTML:

```bash
curl -I https://admin-dreewel.com/assets/<asset-from-dist-index>.js
```

Expected headers include a JavaScript content type. If the response is
`text/html`, the JS file is missing on the server or the server is falling back
to `index.html` for `/assets/*`.
