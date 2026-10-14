import { bindings, defineConfig } from "cf/config";

/**
 * Secret-like files were detected but not read or migrated: .dev.vars, .env.staging, .kilo\worktrees\narrow-hourglass\.env.staging. Only `secrets.required` entries are migrated.
 * @see https://developers.cloudflare.com/workers/configuration/secrets/
 */

/**
 * Wrangler environments are selected through ctx.mode and the cf --mode flag.
 * @see https://developers.cloudflare.com/workers/wrangler/environments/
 */

// Cloudflare Worker configuration for LunaClair (migrated from wrangler.jsonc).
// NOTE: D1 migrations are run via CLI flags in `cf`:
// cf d1 migrations apply <database_id> --dir worker/migrations --pattern "worker/migrations/*/migration.sql"

export default defineConfig((ctx) => {
	switch (ctx.mode) {
		case "staging": {
			return {
				worker: {
					name: "api-staging",
					compatibilityDate: "2026-07-30",
					compatibilityFlags: [
						"nodejs_compat",
					],
					entrypoint: "./worker/src/index.ts",
					observability: {
						enabled: true,
					},
					env: {
						CORS_ORIGINS: bindings.text(""),
						AI_DISABLED_MODELS: bindings.text(""),
						AI_CHAT_DISABLED: bindings.text("false"),
						DB: bindings.d1({
							name: "lunaclair_staging",
							id: "86cbd170-3bc7-4bd1-82d3-b880057ff870",
						}),
						AI: bindings.ai({
							dev: {
								remote: true,
							},
						}),
					},
				},
			};
		}
		default: {
			return {
				worker: {
					name: "api",
					compatibilityDate: "2026-07-30",
					compatibilityFlags: [
						"nodejs_compat",
					],
					entrypoint: "./worker/src/index.ts",
					observability: {
						enabled: true,
					},
					env: {
						CORS_ORIGINS: bindings.text(""),
						AI_DISABLED_MODELS: bindings.text(""),
						AI_CHAT_DISABLED: bindings.text("false"),
						DB: bindings.d1({
							name: "lunaclair",
							id: "c3548105-43de-46f0-9f87-9480d774b808",
						}),
						AI: bindings.ai({
							dev: {
								remote: true,
							},
						}),
					},
				},
			};
		}
	}
});
