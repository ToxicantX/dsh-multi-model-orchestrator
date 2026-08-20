window.__ModuleLoader__.load({ id: "dsh-multi-model-orchestrator", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;
//#region rolldown:runtime
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
	if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
		key = keys[i];
		if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
			get: ((k) => from[k]).bind(null, key),
			enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
		});
	}
	return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", {
	value: mod,
	enumerable: true
}) : target, mod));

//#endregion
let react = require("react");
react = __toESM(react);
let react_jsx_runtime = require("react/jsx-runtime");
react_jsx_runtime = __toESM(react_jsx_runtime);

//#region src/config.js
const AGENT_ID = /^[a-z][a-z0-9_-]{0,47}$/u;
const MAX_AGENT_COUNT = 3;
const DEFAULT_AGENT_DESCRIPTION = "Implement and adjust the assigned code scope, add or update focused tests, inspect your diff, and run the checks that cover your changes before handoff. Report changed files, commands and results, risks, and blockers to the primary Agent; never claim completion when a required check fails.";

//#endregion
//#region client/state.ts
let nextRenderKey = 0;
function createRenderKey() {
	nextRenderKey += 1;
	return "agent-" + nextRenderKey;
}
function createAgentDraft() {
	return {
		id: "",
		provider: "",
		model: "",
		description: DEFAULT_AGENT_DESCRIPTION,
		reasoningEffort: void 0,
		maxTokens: void 0,
		renderKey: createRenderKey()
	};
}
function withRenderKey(agent) {
	return {
		...agent,
		renderKey: createRenderKey()
	};
}
function catalogOptions(groups) {
	return groups.flatMap((group) => group.models.map((model) => ({
		provider: group.id,
		providerName: group.name,
		model: model.id,
		modelName: model.name,
		...model.reasoning === void 0 ? {} : { reasoning: {
			efforts: model.reasoning.efforts.map((effort) => ({ ...effort })),
			...model.reasoning.defaultEffort === void 0 ? {} : { defaultEffort: model.reasoning.defaultEffort }
		} }
	})));
}
function validationMessage(t, key, fallback, index) {
	const text = t === void 0 ? fallback : t(key);
	return index === void 0 ? text : text + " " + (index + 1);
}
function validateAgents(agents, options, t) {
	if (agents.length > MAX_AGENT_COUNT) return validationMessage(t, "agentCountExceeded", "Agents must not exceed " + MAX_AGENT_COUNT + ".");
	const ids = /* @__PURE__ */ new Set();
	for (const [index, agent] of agents.entries()) {
		const id = agent.id.trim();
		if (!AGENT_ID.test(id)) return validationMessage(t, "invalidAgentId", "Agent has an invalid ID.", index);
		if (ids.has(id)) return validationMessage(t, "duplicateAgentId", "Agent IDs must be unique.");
		ids.add(id);
		if (!agent.provider || !agent.model) return validationMessage(t, "modelRequired", "Every agent must select a model.");
		const selected = options?.find((option) => option.provider === agent.provider && option.model === agent.model);
		if (options !== void 0 && selected === void 0) return validationMessage(t, "modelUnavailable", "Agent uses a model that is no longer available.", index);
		if (agent.reasoningEffort !== void 0 && !selected?.reasoning?.efforts.some((effort) => effort.id === agent.reasoningEffort)) return validationMessage(t, "unsupportedReasoning", "Agent has an unsupported reasoning effort.", index);
		if (agent.maxTokens !== void 0 && (!Number.isSafeInteger(agent.maxTokens) || agent.maxTokens < 1)) return validationMessage(t, "maxTokensPositive", "Max tokens must be a positive integer.");
	}
}
function cleanAgents(agents) {
	return agents.map((agent) => ({
		id: agent.id.trim(),
		provider: agent.provider,
		model: agent.model,
		...agent.description.trim() === "" ? {} : { description: agent.description.trim() },
		...agent.reasoningEffort === void 0 ? {} : { reasoningEffort: agent.reasoningEffort },
		...agent.maxTokens === void 0 ? {} : { maxTokens: agent.maxTokens }
	}));
}

//#endregion
//#region client/SettingsOrchestratorSection.tsx
const SETTINGS_ENDPOINT = "/plugins/dsh-multi-model-orchestrator/settings";
async function settingsRequest(init, signal) {
	const response = await fetch(SETTINGS_ENDPOINT, {
		...init,
		signal
	});
	const value = await response.json();
	if (!response.ok) throw new Error(value.error ?? "Agent settings request failed");
	return value;
}
function hydrateAgent(agent) {
	return withRenderKey({
		id: String(agent.id ?? ""),
		provider: String(agent.provider ?? ""),
		model: String(agent.model ?? ""),
		description: String(agent.description ?? ""),
		...agent.reasoningEffort === void 0 ? {} : { reasoningEffort: String(agent.reasoningEffort) },
		...agent.maxTokens === void 0 ? {} : { maxTokens: Number(agent.maxTokens) }
	});
}
const shell = {
	padding: "4px 0 28px",
	maxWidth: 920
};
const toolbar = {
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: 12,
	marginBottom: 16,
	flexWrap: "wrap"
};
const list = {
	display: "grid",
	gap: 10
};
const card = {
	border: "1px solid var(--border-color, #d8dce3)",
	borderRadius: 8,
	padding: 14,
	background: "var(--panel-bg, transparent)"
};
const grid = {
	display: "grid",
	gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))",
	gap: 12
};
const field = {
	display: "grid",
	gap: 6,
	minWidth: 0
};
const control = {
	boxSizing: "border-box",
	width: "100%",
	minHeight: 36,
	border: "1px solid var(--border-color, #c9ced8)",
	borderRadius: 6,
	padding: "7px 9px",
	color: "inherit",
	background: "var(--input-bg, transparent)",
	font: "inherit"
};
const selectControl = {
	...control,
	colorScheme: "light dark"
};
const nativeOption = {
	color: "CanvasText",
	backgroundColor: "Canvas"
};
const actions = {
	display: "flex",
	justifyContent: "flex-end",
	gap: 8,
	marginTop: 12
};
const button = {
	minHeight: 36,
	minWidth: 88,
	border: "1px solid var(--border-color, #c9ced8)",
	borderRadius: 6,
	padding: "7px 12px",
	color: "inherit",
	background: "var(--button-bg, transparent)",
	cursor: "pointer"
};
const primary = {
	...button,
	background: "var(--accent-color, #1769e0)",
	borderColor: "var(--accent-color, #1769e0)",
	color: "#fff"
};
const iconButton = {
	...button,
	minWidth: 36,
	width: 36,
	padding: 0,
	fontSize: 20,
	lineHeight: 1
};
function modelValue(agent) {
	return JSON.stringify([agent.provider, agent.model]);
}
function SettingsOrchestratorSection({ api, t }) {
	const [status, setStatus] = (0, react.useState)("loading");
	const [error, setError] = (0, react.useState)(null);
	const [notice, setNotice] = (0, react.useState)(null);
	const [agents, setAgents] = (0, react.useState)([]);
	const [groups, setGroups] = (0, react.useState)([]);
	const [writable, setWritable] = (0, react.useState)(false);
	const [dirty, setDirty] = (0, react.useState)(false);
	const alive = (0, react.useRef)(false);
	const requestId = (0, react.useRef)(0);
	const activeController = (0, react.useRef)(null);
	const options = (0, react.useMemo)(() => catalogOptions(groups), [groups]);
	function beginRequest() {
		activeController.current?.abort();
		const controller = new AbortController();
		activeController.current = controller;
		return {
			controller,
			id: ++requestId.current
		};
	}
	function applyIfCurrent(id, callback) {
		if (alive.current && id === requestId.current) callback();
	}
	async function load() {
		const { controller, id } = beginRequest();
		setStatus("loading");
		setError(null);
		setNotice(null);
		try {
			const [settingsValue, modelsResponse] = await Promise.all([settingsRequest(void 0, controller.signal), api.llm.models({})]);
			if (!modelsResponse.result.ok) throw new Error(modelsResponse.result.error.message);
			const modelGroups = modelsResponse.result.value.groups;
			const stored = Array.isArray(settingsValue.agents) ? settingsValue.agents : [];
			applyIfCurrent(id, () => {
				setAgents(stored.map(hydrateAgent));
				setGroups(modelGroups);
				setWritable(true);
				setDirty(false);
				setStatus("ready");
			});
		} catch (cause) {
			if (cause instanceof DOMException && cause.name === "AbortError") return;
			applyIfCurrent(id, () => {
				setError(cause instanceof Error ? cause.message : String(cause));
				setStatus("error");
			});
		} finally {
			if (activeController.current === controller) activeController.current = null;
		}
	}
	(0, react.useEffect)(() => {
		alive.current = true;
		load();
		return () => {
			alive.current = false;
			requestId.current += 1;
			activeController.current?.abort();
			activeController.current = null;
		};
	}, []);
	(0, react.useEffect)(() => {
		const handler = (event) => {
			if (!dirty) return;
			event.preventDefault();
			event.returnValue = "";
		};
		window.addEventListener("beforeunload", handler);
		return () => window.removeEventListener("beforeunload", handler);
	}, [dirty]);
	function markChanged() {
		setDirty(true);
		setError(null);
		setNotice(null);
	}
	function update(index, patch) {
		setAgents((current) => current.map((agent, position) => position === index ? {
			...agent,
			...patch
		} : agent));
		markChanged();
	}
	function add() {
		setAgents((current) => current.length >= MAX_AGENT_COUNT ? current : [...current, createAgentDraft()]);
		markChanged();
	}
	function remove(index) {
		setAgents((current) => current.filter((_, position) => position !== index));
		markChanged();
	}
	async function save() {
		const validation = validateAgents(agents, options, t);
		if (validation !== void 0) {
			setError(validation);
			setNotice(null);
			return;
		}
		const { controller, id } = beginRequest();
		setStatus("saving");
		setError(null);
		setNotice(null);
		try {
			const saved = await settingsRequest({
				method: "PUT",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ agents: cleanAgents(agents) })
			}, controller.signal);
			applyIfCurrent(id, () => {
				if (Array.isArray(saved.agents)) setAgents(saved.agents.map(hydrateAgent));
				setDirty(false);
				setStatus("ready");
				setNotice(t("saved"));
			});
		} catch (cause) {
			if (cause instanceof DOMException && cause.name === "AbortError") return;
			applyIfCurrent(id, () => {
				setError(cause instanceof Error ? cause.message : String(cause));
				setStatus("ready");
			});
		} finally {
			if (activeController.current === controller) activeController.current = null;
		}
	}
	if (status === "loading") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
		style: shell,
		children: t("loading")
	});
	if (status === "error") return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		style: shell,
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
			role: "alert",
			children: error
		}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
			style: button,
			onClick: () => void load(),
			children: t("retry")
		})]
	});
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		style: shell,
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: toolbar,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
					style: {
						margin: 0,
						fontSize: 20
					},
					children: t("title")
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					style: button,
					onClick: add,
					disabled: !writable || status === "saving" || agents.length >= MAX_AGENT_COUNT,
					title: t("add"),
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							"aria-hidden": "true",
							children: "+"
						}),
						" ",
						t("add")
					]
				})]
			}),
			agents.length > MAX_AGENT_COUNT && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				role: "status",
				children: t("legacyAgentLimit")
			}),
			options.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				role: "status",
				children: t("noModels")
			}),
			agents.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				role: "status",
				children: t("empty")
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				style: list,
				children: agents.map((agent, index) => {
					const selectedModel = options.find((option) => option.provider === agent.provider && option.model === agent.model);
					const reasoning = selectedModel?.reasoning;
					const stale = agent.provider !== "" && agent.model !== "" && selectedModel === void 0;
					return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: card,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: grid,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									style: field,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("id") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										style: control,
										value: agent.id,
										maxLength: 48,
										onChange: (event) => update(index, { id: event.target.value }),
										disabled: !writable || status === "saving"
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									style: field,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("model") }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
										style: selectControl,
										value: modelValue(agent),
										"aria-invalid": stale || void 0,
										title: stale ? t("unavailableModel") : selectedModel === void 0 ? t("chooseModel") : selectedModel.modelName + " (" + selectedModel.model + ")",
										onChange: (event) => {
											const [provider = "", model = ""] = JSON.parse(event.target.value);
											update(index, {
												provider,
												model,
												reasoningEffort: void 0
											});
										},
										disabled: !writable || status === "saving",
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
												style: nativeOption,
												value: JSON.stringify(["", ""]),
												children: t("chooseModel")
											}),
											stale && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("option", {
												style: nativeOption,
												value: modelValue(agent),
												children: [
													t("unavailableModel"),
													": ",
													agent.provider,
													"/",
													agent.model
												]
											}),
											groups.map((group) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("optgroup", {
												style: nativeOption,
												label: group.name,
												children: group.models.map((model) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("option", {
													style: nativeOption,
													value: JSON.stringify([group.id, model.id]),
													children: [
														model.name,
														" (",
														model.id,
														")"
													]
												}, model.id))
											}, group.id))
										]
									})]
								}),
								reasoning !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									style: field,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("reasoningEffort") }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
										style: selectControl,
										value: agent.reasoningEffort ?? "",
										title: agent.reasoningEffort === void 0 ? t("modelDefault") : reasoning.efforts.find((effort) => effort.id === agent.reasoningEffort)?.name ?? agent.reasoningEffort,
										onChange: (event) => update(index, { reasoningEffort: event.target.value === "" ? void 0 : event.target.value }),
										disabled: !writable || status === "saving",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("option", {
											style: nativeOption,
											value: "",
											children: [t("modelDefault"), reasoning.defaultEffort === void 0 ? "" : " (" + (reasoning.efforts.find((effort) => effort.id === reasoning.defaultEffort)?.name ?? reasoning.defaultEffort) + ")"]
										}), reasoning.efforts.map((effort) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											style: nativeOption,
											value: effort.id,
											children: effort.name
										}, effort.id))]
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									style: {
										...field,
										gridColumn: "1 / -1"
									},
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("description") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
										style: {
											...control,
											resize: "vertical",
											minHeight: 72
										},
										value: agent.description,
										onChange: (event) => update(index, { description: event.target.value }),
										disabled: !writable || status === "saving"
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									style: field,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("maxTokens") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										style: control,
										type: "number",
										min: "1",
										step: "1",
										value: agent.maxTokens ?? "",
										onChange: (event) => update(index, { maxTokens: event.target.value === "" ? void 0 : Number(event.target.value) }),
										disabled: !writable || status === "saving"
									})]
								})
							]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							style: actions,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								style: iconButton,
								onClick: () => remove(index),
								disabled: !writable || status === "saving",
								"aria-label": t("remove"),
								title: t("remove"),
								children: "×"
							})
						})]
					}, agent.renderKey);
				})
			}),
			error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				role: "alert",
				style: { color: "var(--danger-color, #c93434)" },
				children: error
			}),
			notice && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				role: "status",
				children: notice
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				style: {
					...actions,
					marginTop: 18
				},
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					style: primary,
					onClick: () => void save(),
					disabled: !writable || !dirty || status === "saving",
					"aria-busy": status === "saving",
					children: status === "saving" ? t("saving") : t("save")
				})
			})
		]
	});
}

//#endregion
//#region client/presetCatalog.ts
const LEGACY_PRESET_ID = "orchestrator";
const ORCHESTRATOR_PRESET_NAME = "Multi-model orchestrator";
function hideLegacyPresetFromCatalog(api) {
	const originalList = api.list;
	const filteredList = async function(input) {
		const response = await originalList.call(this, input);
		if (!response.result.ok) return response;
		return {
			...response,
			result: {
				...response.result,
				value: {
					...response.result.value,
					presets: response.result.value.presets.filter((preset) => !(preset.id === LEGACY_PRESET_ID && preset.name === ORCHESTRATOR_PRESET_NAME))
				}
			}
		};
	};
	api.list = filteredList;
	return () => {
		if (api.list === filteredList) api.list = originalList;
	};
}

//#endregion
//#region client/index.ts
const NS = "settings.orchestrator";
const zh = {
	nav: "Agent 编排",
	title: "Agent 编排",
	loading: "正在加载…",
	retry: "重试",
	add: "添加 Agent",
	noModels: "DSH 当前没有可用模型，请先在“模型”中完成配置。",
	empty: "尚未配置 Agent。",
	id: "Agent ID",
	model: "模型",
	chooseModel: "选择已配置模型",
	unavailableModel: "当前模型不可用",
	description: "开发职责",
	reasoningEffort: "推理等级（可选）",
	modelDefault: "使用模型默认值",
	maxTokens: "最大输出 Token（可选）",
	remove: "删除 Agent",
	save: "保存",
	saving: "正在保存…",
	saved: "配置已保存。",
	legacyAgentLimit: "此旧配置超过 3 个 Agent。当前仅启用前 3 个；请删除多余 Agent 后保存。",
	agentCountExceeded: "Agent 数量不能超过 3 个。",
	invalidAgentId: "Agent ID 无效，位置：",
	duplicateAgentId: "Agent ID 必须唯一。",
	modelRequired: "每个 Agent 都必须选择模型。",
	modelUnavailable: "配置的模型当前不可用，Agent 位置：",
	unsupportedReasoning: "推理等级不受所选模型支持，Agent 位置：",
	maxTokensPositive: "最大输出 Token 必须是正整数。"
};
const en = {
	nav: "Agent orchestration",
	title: "Agent orchestration",
	loading: "Loading…",
	retry: "Retry",
	add: "Add agent",
	noModels: "No DSH models are available. Configure a model first.",
	empty: "No agents configured.",
	id: "Agent ID",
	model: "Model",
	chooseModel: "Choose a configured model",
	unavailableModel: "Unavailable configured model",
	description: "Development scope",
	reasoningEffort: "Reasoning effort (optional)",
	modelDefault: "Use model default",
	maxTokens: "Maximum output tokens (optional)",
	remove: "Remove agent",
	save: "Save",
	saving: "Saving…",
	saved: "Configuration saved.",
	legacyAgentLimit: "This legacy roster exceeds 3 Agents. Only the first 3 are active; remove the extras before saving.",
	agentCountExceeded: "No more than 3 agents can be configured.",
	invalidAgentId: "The Agent ID is invalid at position:",
	duplicateAgentId: "Agent IDs must be unique.",
	modelRequired: "Every agent must select a model.",
	modelUnavailable: "The configured model is unavailable at Agent position:",
	unsupportedReasoning: "The reasoning effort is unsupported at Agent position:",
	maxTokensPositive: "Maximum output tokens must be a positive integer."
};
const inject = [
	"slots",
	"locale",
	"connection"
];
function apply(ctx) {
	ctx.effect(() => ctx.locale.register(NS, {
		zh,
		en
	}), "multi-model-orchestrator: locale");
	const connection = ctx.get("connection");
	ctx.effect(() => hideLegacyPresetFromCatalog(connection.api.agentPresets), "multi-model-orchestrator: hide legacy preset");
	const t = ctx.locale.bind(NS);
	ctx.slots.inject("settings.section", () => ctx.slots.register({
		name: "settings.section",
		id: "orchestrator",
		order: 15,
		label: () => t("nav"),
		inject: () => ({
			api: connection.api,
			t
		})
	}, SettingsOrchestratorSection));
}

//#endregion
exports.apply = apply;
exports.catalogOptions = catalogOptions;
exports.cleanAgents = cleanAgents;
exports.inject = inject;
exports.validateAgents = validateAgents;
return module.exports; } });
//# sourceMappingURL=client.js.map