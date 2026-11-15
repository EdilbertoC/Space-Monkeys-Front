# figma-make-app

React + Vite + Tailwind CSS project running inside Figma Make.

## Development Server

A Vite development server is **already running** on `$PORT` (default 8443). You don't need to start it manually.

- Preview URL: The user can access the running app through the preview panel
- Hot reload: Changes to source files are reflected immediately

## Project Structure

This is the canonical project structure. Start with task-relevant files below. Only follow imports or inspect other files when required, when a documented path is missing, or when the repository contradicts this guide.

- `src/main.tsx` - React entrypoint; imports global styles and mounts `src/app/App.tsx` into the `#root` element
- `src/app/App.tsx` - Primary application composition and existing demonstration UI
- `src/app/components/` - Controlled workspace presentation components
- `src/app/navigation.ts` - Typed navigation names, icons and page titles
- `src/app/api.ts` - Configured HTTP client and feature service instances
- `src/shared/styles/index.css` - Global CSS entrypoint and Tailwind CSS v4 import
- `src/shared/api/` - HTTP transport, generated schemas, errors, and request hook
- `src/shared/lib/` and `src/shared/constants/` - Shared browser utilities and geography options
- `src/features/` - History, live, system, map, sensors, and isolated prevention demo
- `contracts/openapi.yaml` - Backend contract; regenerate schemas with `npm run api:generate`
- `docs/backend-integration.md` - API responsibilities, scientific conventions and integration limits
- `index.html` - Vite HTML shell containing the `#root` element and loading `src/main.tsx`
- `package.json` - Project dependencies and the Vite build, development, preview, and formatting scripts
- `vite.config.ts` - Vite configuration with React, Tailwind CSS v4, and Figma Make plugins plus the `@` alias for `src`
- `.mise.toml` - Toolchain versions for Node.js

## Dependencies

- Runtime: React 19 and React DOM 19
- Styling: Tailwind CSS v4 with the `@tailwindcss/vite` plugin
- Build tooling: Vite 8, TypeScript 5.7, and `@vitejs/plugin-react`
- Formatting: oxfmt

Run `npm run typecheck`, `npm test`, `npm run api:check`, `npm run format:check`, and `npm run build` after refactoring. No linter is configured. Keep the explicit stylesheet import order in `src/main.tsx` and the lazy calendar entrypoint; it preserves the existing cascade. Do not format generated schemas or change CSS solely for code cleanup.

## Styling

This project uses **Tailwind CSS v4** through the `@tailwindcss/vite` plugin configured in `vite.config.ts`. `src/shared/styles/index.css` imports Tailwind with `@import 'tailwindcss';`. Use Tailwind utility classes directly in JSX and put global CSS or Tailwind v4 theme customization there. This scaffold does not need a Tailwind config file or PostCSS config.

`src/main.tsx` imports `src/shared/styles/index.css`, so global font wiring belongs there. Keep CSS `@import` statements first, then add any `@font-face` rules and font-family defaults there.

Tailwind emits utility classes in `@layer utilities`, and CSS outside any cascade layer overrides every layer regardless of specificity. Put global element styles, such as resets and defaults for `body`, headings, `button`, or `input`, inside `@layer base { ... }` so utility classes on those elements still apply. Tailwind's Preflight already applies `box-sizing: border-box`, removes default margins, and sets `font: inherit` on form controls, so do not repeat those rules.
