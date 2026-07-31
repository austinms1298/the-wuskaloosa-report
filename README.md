# The Wuskaloosa Report

A Vite-powered static blog with Decap CMS and Cloudflare Pages deployment.

## Start the website

```bash
npm install
npm run dev
```

Open the local URL shown by Vite, normally `http://localhost:5173`.

## Use Decap CMS locally

Open a second Terminal window in the project folder and run:

```bash
npm run cms
```

Keep `npm run dev` running in the first window, then visit:

`http://localhost:5173/admin/`

## Build for Cloudflare Pages

```bash
npm run build
```

Cloudflare Pages settings:

- Framework preset: Vite
- Build command: `npm run build`
- Build output directory: `dist`

## Before live CMS login works

Decap's GitHub backend requires a GitHub OAuth proxy. Update `public/admin/config.yml` with the proxy URL after that worker is configured. All CMS users must have push access to the GitHub repository.
