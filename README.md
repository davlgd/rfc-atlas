# RFC Atlas

RFC Atlas is an interactive, GPU-accelerated map of the RFC series. It places the complete corpus on
a three-dimensional sphere and reveals how documents cite, update, and obsolete one another.

The project is the visual exploration companion to
[`davlgd/ietf-tools`](https://github.com/davlgd/ietf-tools): where that collection provides tools
for working with IETF documents, RFC Atlas makes the RFC corpus and its structure browsable.

The public application is intended for <https://rfc.davlgd.com>.

## Features

- WebGL 2 rendering of thousands of RFCs as a uniform Fibonacci sphere.
- GPU point rendering, orbit controls, inertia, zoom, raycasting, and animated focus.
- Geodesic relationship arcs that follow the sphere instead of crossing its center.
- Search by RFC number, title, author, or keyword.
- Shareable RFC routes and `from`/`to` URL parameters with browser history support.
- Filters for publication range, status, stream, and relationship type.
- One-click relationship visibility control.
- Lists of the latest and most cited RFCs.
- Detailed metadata, abstracts, citation counts, and incoming or outgoing relationships.
- RFC sharing through X, Bluesky, LinkedIn, or a copied canonical link.
- Crawlable RFC pages with links to related documents, structured metadata, and a sitemap.
- Links to Stéphane Bortzmeyer's analysis when his RFC index lists one.
- Adaptive edge detail that preserves context while keeping the global view responsive.

## Data

RFC metadata and the `updates` and `obsoletes` relationships come from the official
[`rfc-index.xml`](https://www.rfc-editor.org/rfc-index.xml). Normative, informative, and
unclassified references come from the public
[IETF Datatracker API](https://datatracker.ietf.org/api/). External analysis links come from the
versioned local `data/bortzmeyer-rfcs.json` artifact.

The data generator normalizes and deduplicates these sources in a local SQLite cache, computes
citation degrees, and atomically writes a self-contained `public/data/graph.json` artifact.
Conditional HTTP requests and cached API data make subsequent refreshes faster and allow offline
artifact reconstruction. The main generator never contacts Bortzmeyer's site.

`npm run data:bortzmeyer` manually rebuilds the local analysis artifact from Bortzmeyer's own
[RFC series indexes](https://www.bortzmeyer.org/rfcs.html). It requests each series index once and
never probes individual article URLs. This refresh is intentionally separate from the main data
update until its automation policy is defined.

`rfc-editor.org/refs/refNNNN.txt` is a bibliographic record for RFC NNNN, not a list of its outgoing
references, so RFC Atlas does not treat those files as graph edges.

## Requirements

- Node.js 24.19.0 or newer.
- A browser with WebGL 2 support.

## Architecture

The browser loads one versioned graph artifact and renders it through React and Three.js. UI state,
URL synchronization, relationship indexing, controls, RFC details, and the WebGL scene are kept in
separate modules. Selecting a document uses pre-indexed incoming and outgoing edges rather than
rescanning the complete relationship list.

Vite builds the static application and runs the SEO pre-renderer after bundling. The pre-renderer
creates a lightweight HTML route for every RFC, including crawlable relationship links, while the
interactive application remains a single client-side experience. Data collection is a separate
Node.js pipeline; `fast-xml-parser` is only required when refreshing source data.

The application has three browser runtime libraries: React, React DOM, and Three.js. Build tools are
kept as production dependencies because deployment installs run the static build from `postinstall`;
development-only analysis, formatting, tests, types, and data tooling remain in `devDependencies`.

## Run locally

```sh
cp .env.example .env
npm ci
npm run dev
```

Open <http://localhost:4173>. The repository includes a generated graph artifact; use
`npm run data:update` whenever you want to refresh it from the official sources.

## Configuration

`VITE_SITE_URL` defines the canonical public URL and the destination of the RFC Atlas logo. The
example configuration targets `https://rfc.davlgd.com`.

`PORT` defines the production server port. `npm start` listens on `0.0.0.0:$PORT`; the local default
is `4173` when the variable is not set.

## Shareable URLs

RFC Atlas reads its initial selection and publication range from the query string. Parameters can be
used independently or combined:

- `?rfc=2263` selects and focuses RFC 2263, then normalizes to `/rfc/2263/`.
- `?from=1990&to=2000` limits the publication range.
- `?rfc=2263&from=1995&to=2005` applies both states.

The application keeps these values in sync as visitors navigate and supports the browser back and
forward buttons. Invalid RFC numbers are ignored; years are clamped to the available dataset and
expanded when necessary to keep the selected RFC visible.

## Commands

- `npm run dev`: start the development server.
- `npm run build`: create the production build in `dist/`.
- `npm start`: serve the production build on all network interfaces.
- `npm run preview`: serve the production build locally.
- `npm run data:bortzmeyer`: manually refresh the local Bortzmeyer analysis index.
- `npm run data:update`: refresh the RFC index and Datatracker relationships.
- `npm run data:offline`: rebuild the graph artifact from local caches.
- `npm run seo:generate`: rebuild the sitemap and crawler metadata from the local graph artifact.
- `npm run data:sample`: generate a smaller graph for local experiments.
- `npm run format`: format maintained source and documentation files.
- `npm run format:check`: verify formatting without changing files.
- `npm run lint`: run ESLint with type-aware rules.
- `npm run deadcode`: detect unused files, exports, and dependencies.
- `npm run typecheck`: run the TypeScript project checks.
- `npm test`: run the unit tests.
- `npm run check`: run every formatting, linting, type, test, and build check.

## Deployment and data updates

The production build is static and can be served by any static hosting platform. It pre-renders one
indexable HTML page per RFC, while the sitemap and crawler directives are regenerated after each
data refresh.

Data refreshes are authoring or CI tasks, not production-server tasks: they require a complete
development installation because the XML parser is deliberately kept out of production installs.
After the local caches have been initialized, refresh and build in a trusted workspace with:

```sh
npm run data:update
npm run build
```

Deploy the resulting `dist/` directory. A production-only installation can build the checked-in
graph artifact and serve it with `npm start`, but it does not contain the tooling required by
`npm run data:update`.

Dependency installation also runs the production build through `postinstall`. Deployment platforms
can therefore install the project and launch it with `npm start`, provided `VITE_SITE_URL` is set.

The generator replaces the public artifact only after a successful refresh, so a failed network
request does not overwrite the latest valid graph.

## License

RFC Atlas is authored by [davlgd](https://github.com/davlgd) and released under the
[MIT License](LICENSE).

The X, Bluesky, and LinkedIn names and logos are trademarks of their respective owners. Their use in
the local sharing controls does not imply endorsement or make them part of the project's MIT license
grant.
