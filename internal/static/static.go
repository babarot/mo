package static

import "embed"

//go:generate sh -c "cd ../frontend && pnpm install --frozen-lockfile && pnpm run build"

//go:embed all:dist
var Frontend embed.FS
