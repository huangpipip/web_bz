# Repository Guidelines

## Project Structure & Module Organization
`src/` contains the application code. UI components live in `src/components/` (`BzCanvas.tsx`, `KPathEditor.tsx`, `SpecialPointTable.tsx`). Core Brillouin-zone, POSCAR parsing, K-path, math, and sample-data logic lives in `src/lib/`. Entry points are `src/main.tsx`, `src/App.tsx`, and `src/styles.css`. Tests are colocated with library modules as `src/lib/*.test.ts`. Root config files include `vite.config.ts`, `tsconfig.json`, `package.json`, and `index.html`.

## Build, Test, and Development Commands
- `npm install`: install dependencies from `package-lock.json`.
- `npm run dev`: start the Vite dev server for local development.
- `npm run dev -- --host 127.0.0.1 --port 4173`: run on a fixed local URL when browser testing.
- `npm run build`: type-check with TypeScript and create a production build in `dist/`.
- `npm run preview`: serve the production build locally.
- `npm run test`: run the Vitest suite once.

## Coding Style & Naming Conventions
Use TypeScript with React function components and typed props. Match the existing style: 2-space indentation, double quotes, semicolons, and small helper functions for repeated logic. Use `PascalCase` for React component files and exported components, `camelCase` for functions and variables, and descriptive names for domain logic (`computeBrillouinZone`, `resolveKPathPoints`). Keep CSS selectors scoped to the existing layout blocks in `src/styles.css`.

## Testing Guidelines
This project uses `vitest`. Add or update tests whenever you change parsing, math, geometry, or K-path behavior. Keep tests next to the module they cover and name them `*.test.ts`. Prefer deterministic assertions using fixed sample inputs from `src/lib/samples.ts`, and verify observable geometry counts, coordinates, and error handling.

## Commit & Pull Request Guidelines
Recent history uses short, imperative commit subjects such as `Rework layout into sidebar and full-height viewer`. Follow that pattern: one-line summary, capitalized, focused on user-visible or structural change. For pull requests, include:
- a short description of what changed and why
- notes about verification (`npm run build`, `npm run test`)
- screenshots or screen recordings for UI/layout changes
- linked issue or task reference when applicable

## Contributor Notes
Prefer browser-only solutions. Do not add server dependencies for features that can remain local in the Vite client. When changing geometry logic, verify both the visual output and the associated `src/lib` tests.
