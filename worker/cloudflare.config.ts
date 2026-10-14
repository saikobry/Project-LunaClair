import { bindings, defineConfig } from "cf/config";

// Cloudflare Worker configuration for LunaClair API (isolated in worker/).
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
					entrypoint: "./src/index.ts",
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
					entrypoint: "./src/index.ts",
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
