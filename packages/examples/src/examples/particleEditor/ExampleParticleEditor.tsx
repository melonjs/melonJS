/**
 * melonJS — particle editor.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 *
 * Pick an effect, a texture and a camera on the left, tune every emitter
 * setting on the right, watch it live in the middle, and copy the code (or
 * the JSON) from the bottom. Successor to the 2014 particle editor of the
 * archived https://github.com/melonjs/examples repository, whose effects are
 * the first presets.
 */
import {
	type ChangeEvent,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { createExampleComponent } from "../utils";
import "./editor.css";
import {
	DEFAULT_EFFECT,
	type Effect,
	type Field,
	GROUPS,
	sameValue,
} from "./fields";
import { type Motion, PRESETS } from "./presets";
import { createPreview, type Preview } from "./preview";
import { randomState } from "./random";
import {
	type Background,
	type CameraKind,
	type EditorState,
	fromJSON,
	fromPreset,
	type Language,
	type Sprite,
	toCode,
	toJSON,
} from "./state";
import { BUILT_IN, builtIn, download, loadFile } from "./textures";

const imageOf = (state: EditorState) => {
	return state.texture === "sprite"
		? state.sprite?.image
		: builtIn(state.texture).image;
};

// ---- the bridge between the React panels and the engine preview ----------
// The preview is started by `createExampleComponent`, which owns the engine's
// life on this page; the panels reach it through these.
let latest: EditorState = fromPreset(PRESETS[0], "2d", "dark", true);
let preview: Preview | undefined;
const whenReady: ((p: Preview) => void)[] = [];
const fromPreview = {
	angle: (_degrees: number) => {},
	offset: (_x: number, _y: number) => {},
	error: (_message: string | undefined) => {},
};

const PreviewHost = createExampleComponent(async () => {
	try {
		preview = await createPreview(latest, imageOf(latest), {
			angle: (degrees) => {
				fromPreview.angle(degrees);
			},
			offset: (x, y) => {
				fromPreview.offset(x, y);
			},
			error: (message) => {
				fromPreview.error(message);
			},
		});
	} catch (e) {
		fromPreview.error(
			`The preview could not start on this renderer: ${e instanceof Error ? e.message : String(e)}`,
		);
		return;
	}
	for (const ready of whenReady.splice(0)) {
		ready(preview);
	}
	return () => {
		preview?.destroy();
	};
});

const usePreview = () => {
	const [ready, setReady] = useState(preview);
	useEffect(() => {
		if (!ready) {
			whenReady.push(setReady);
		}
	}, [ready]);
	return ready;
};

// ---- small controls -------------------------------------------------------

const Segmented = <T extends string>({
	value,
	options,
	onChange,
	disabled,
}: {
	value: T;
	options: [T, string][];
	onChange: (value: T) => void;
	disabled?: (value: T) => boolean;
}) => {
	return (
		<div className="pe-seg">
			{options.map(([option, label]) => {
				return (
					<button
						type="button"
						key={option}
						className={option === value ? "on" : ""}
						disabled={disabled?.(option)}
						onClick={() => {
							onChange(option);
						}}
					>
						{label}
					</button>
				);
			})}
		</div>
	);
};

const FieldRow = ({
	field,
	value,
	off,
	onChange,
}: {
	field: Field;
	value: Effect[keyof Effect];
	off: boolean;
	onChange: (value: Effect[keyof Effect]) => void;
}) => {
	const changed = !sameValue(value, DEFAULT_EFFECT[field.key]);
	const reset = (
		<button
			type="button"
			className="pe-reset"
			title="Back to the default"
			onClick={() => {
				onChange(DEFAULT_EFFECT[field.key]);
			}}
		>
			↺
		</button>
	);
	const label = (
		<label htmlFor={`pe-${field.key}`} title={field.help}>
			{field.label}
			{field.only3d && <span className="pe-tag">3D</span>}
		</label>
	);
	const className = `pe-row${changed ? " changed" : ""}${off ? " off" : ""}`;

	switch (field.kind) {
		case "number": {
			const n = value as number;
			return (
				<div className={className} title={field.help}>
					{label}
					<span className="pe-value">
						<input
							id={`pe-${field.key}`}
							type="number"
							min={field.min}
							max={field.max}
							step={field.step}
							value={n}
							onChange={(e) => {
								const v = Number(e.target.value);
								if (e.target.value !== "" && Number.isFinite(v)) {
									onChange(Math.min(field.max, Math.max(field.min, v)));
								}
							}}
						/>
						<span className="pe-unit">{field.unit ?? ""}</span>
						{reset}
					</span>
					<input
						type="range"
						aria-label={field.label}
						min={field.min}
						max={field.max}
						step={field.step}
						value={n}
						onChange={(e) => {
							onChange(Number(e.target.value));
						}}
					/>
				</div>
			);
		}
		case "boolean":
			return (
				<div className={className} title={field.help}>
					{label}
					<span className="pe-value">
						<input
							id={`pe-${field.key}`}
							type="checkbox"
							checked={value as boolean}
							onChange={(e) => {
								onChange(e.target.checked);
							}}
						/>
						{reset}
					</span>
				</div>
			);
		case "color":
			return (
				<div className={className} title={field.help}>
					{label}
					<span className="pe-value">
						<input
							id={`pe-${field.key}`}
							type="color"
							value={toHex(value as string)}
							onChange={(e) => {
								onChange(e.target.value);
							}}
						/>
						{reset}
					</span>
				</div>
			);
		case "colors": {
			const colors = value as string[] | undefined;
			return (
				<div className={className} title={field.help}>
					{label}
					<span className="pe-value">
						{colors ? (
							<button
								type="button"
								className="pe-button"
								onClick={() => {
									onChange(undefined);
								}}
							>
								Remove
							</button>
						) : (
							<button
								type="button"
								className="pe-button"
								onClick={() => {
									onChange(["#ffffff", "#ffb04a", "#501408"]);
								}}
							>
								Add
							</button>
						)}
					</span>
					{colors && (
						<div className="pe-colors">
							{colors.map((color, i) => {
								return (
									<input
										// biome-ignore lint/suspicious/noArrayIndexKey: colors repeat, and the position is what identifies one
										key={i}
										type="color"
										aria-label={`color ${i + 1}`}
										value={toHex(color)}
										onChange={(e) => {
											const next = [...colors];
											next[i] = e.target.value;
											onChange(next);
										}}
									/>
								);
							})}
							<button
								type="button"
								className="pe-button"
								title="Add a color"
								onClick={() => {
									onChange([...colors, colors[colors.length - 1]]);
								}}
							>
								+
							</button>
							<button
								type="button"
								className="pe-button"
								title="Remove the last color"
								disabled={colors.length < 2}
								onClick={() => {
									onChange(colors.slice(0, -1));
								}}
							>
								−
							</button>
						</div>
					)}
				</div>
			);
		}
		case "select":
			return (
				<div className={className} title={field.help}>
					{label}
					<span className="pe-value">
						<select
							id={`pe-${field.key}`}
							value={value as string}
							onChange={(e) => {
								onChange(e.target.value);
							}}
						>
							{field.options.map((option) => {
								return (
									<option key={option} value={option}>
										{option}
									</option>
								);
							})}
						</select>
						{reset}
					</span>
				</div>
			);
	}
};

/** a CSS color as `#rrggbb`, which a color input needs */
const toHex = (css: string) => {
	if (/^#[0-9a-f]{6}$/i.test(css)) {
		return css;
	}
	const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(css);
	if (short) {
		return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`;
	}
	return "#ffffff";
};

const RENDERERS: [string, string][] = [
	["auto", "Auto"],
	["webgpu", "WebGPU"],
	["webgl", "WebGL"],
	["canvas", "Canvas"],
];

/** the renderer's `type`, as people know it */
const rendererLabel = (type: string | undefined) => {
	switch (type) {
		case undefined:
			return "…";
		case "CANVAS":
			return "Canvas";
		case "WebGL2":
			return "WebGL 2";
		default:
			return type;
	}
};

const currentRenderer = () => {
	const query = globalThis.location.hash.split("?")[1] ?? "";
	return new URLSearchParams(query).get("renderer") ?? "auto";
};

const chooseRenderer = (name: string) => {
	const [path] = globalThis.location.hash.split("?");
	globalThis.location.hash =
		name === "auto" ? path : `${path}?renderer=${name}`;
	globalThis.location.reload();
};

const saveText = (text: string, name: string, type: string) => {
	const a = document.createElement("a");
	a.href = URL.createObjectURL(new Blob([text], { type }));
	a.download = name;
	a.click();
	setTimeout(() => {
		URL.revokeObjectURL(a.href);
	}, 1000);
};

type Tab = "effect" | "properties" | "code";

// ---- the editor -------------------------------------------------------------

const Editor = () => {
	const [state, setState] = useState<EditorState>(latest);
	const [preset, setPreset] = useState(PRESETS[0].id);
	/** what the effect list shows when the effect is not a preset */
	const [custom, setCustom] = useState("From a file");
	const [paused, setPaused] = useState(false);
	const [error, setError] = useState<string | undefined>();
	const [output, setOutput] = useState<"code" | "json">("code");
	const [language, setLanguage] = useState<Language>("ts");
	const [copied, setCopied] = useState(false);
	const [tab, setTab] = useState<Tab>("properties");
	const [notice, setNotice] = useState<string | undefined>();
	/** whether the effect was changed since its preset was loaded */
	const edited = useRef(false);
	const live = usePreview();
	const spriteInput = useRef<HTMLInputElement>(null);
	const jsonInput = useRef<HTMLInputElement>(null);

	// move the engine's stage into the middle column before it is measured
	useLayoutEffect(() => {
		const body = document.body;
		body.classList.add("pe-open");
		// the site's top bar wraps on a narrow screen: sit under it, whatever
		// its height
		const topbar = document.querySelector<HTMLElement>(".example-topbar");
		const fit = () => {
			if (topbar) {
				body.style.setProperty("--pe-top", `${topbar.offsetHeight}px`);
			}
		};
		fit();
		const observer = new ResizeObserver(fit);
		if (topbar) {
			observer.observe(topbar);
		}
		return () => {
			observer.disconnect();
			body.classList.remove("pe-open");
			body.style.removeProperty("--pe-top");
		};
	}, []);

	// hand the preview every change, and keep the latest for its first start
	useEffect(() => {
		latest = state;
		live?.apply(state, imageOf(state));
	}, [state, live]);

	useEffect(() => {
		live?.setPaused(paused);
	}, [paused, live]);

	useEffect(() => {
		fromPreview.angle = (degrees) => {
			edited.current = true;
			setState((s) => {
				return { ...s, effect: { ...s.effect, angle: degrees } };
			});
		};
		fromPreview.offset = (x, y) => {
			edited.current = true;
			setState((s) => {
				return { ...s, offset: { x, y } };
			});
		};
		fromPreview.error = setError;
	}, []);

	const setEffect = useCallback(
		(key: keyof Effect, value: Effect[keyof Effect]) => {
			edited.current = true;
			setState((s) => {
				return { ...s, effect: { ...s.effect, [key]: value } };
			});
		},
		[],
	);

	const choosePreset = (id: string) => {
		const found = PRESETS.find((p) => {
			return p.id === id;
		});
		if (found) {
			edited.current = false;
			setPreset(id);
			setNotice(
				found.camera === "3d" && live && !live.supports3d
					? "This effect is made for the 3D camera, which needs WebGL or WebGPU: shown in 2D."
					: undefined,
			);
			setState((s) => {
				return fromPreset(found, s.camera, s.background, s.grid);
			});
		}
	};

	const chooseSprite = async (e: ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		e.target.value = "";
		if (!file) {
			return;
		}
		try {
			const image = await loadFile(file);
			const name =
				file.name.replace(/\.[^.]*$/, "").replace(/[^\w-]+/g, "-") ||
				"particle";
			const sprite: Sprite = {
				name,
				image,
				framewidth: undefined,
				frameheight: undefined,
				frames: undefined,
				randomFrame: false,
			};
			edited.current = true;
			setState((s) => {
				return { ...s, texture: "sprite", sprite };
			});
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		}
	};

	const setSprite = (patch: Partial<Sprite>) => {
		edited.current = true;
		setState((s) => {
			return s.sprite ? { ...s, sprite: { ...s.sprite, ...patch } } : s;
		});
	};

	const importJSON = async (e: ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		e.target.value = "";
		if (!file) {
			return;
		}
		try {
			const { state: next, missing } = fromJSON(
				await file.text(),
				state,
				BUILT_IN,
			);
			setState(next);
			setPreset("");
			setCustom("From a file");
			setNotice(
				missing
					? `The effect uses the image "${missing}": choose it again with "Sprite from a file".`
					: undefined,
			);
		} catch (err) {
			setError(
				`Could not read ${file.name}: ${err instanceof Error ? err.message : String(err)}`,
			);
		}
	};

	const text = useMemo(() => {
		return output === "code" ? toCode(state, language) : toJSON(state);
	}, [state, output, language]);

	const copy = () => {
		void navigator.clipboard?.writeText(text).then(() => {
			setCopied(true);
			setTimeout(() => {
				setCopied(false);
			}, 1500);
		});
	};

	const is3d = state.camera === "3d" && (live?.supports3d ?? true);
	const texture =
		state.texture === "sprite" ? undefined : builtIn(state.texture);

	return (
		<>
			<div className="pe-toolbar">
				<button
					type="button"
					className="pe-button"
					onClick={() => {
						setPaused(!paused);
					}}
				>
					{paused ? "▶ Play" : "❚❚ Pause"}
				</button>
				<button
					type="button"
					className="pe-button"
					onClick={() => {
						live?.restart();
					}}
				>
					↻ Restart
				</button>
				<Segmented<Background>
					value={state.background}
					options={[
						["dark", "Dark"],
						["light", "Light"],
						["checker", "Checker"],
					]}
					onChange={(background) => {
						setState((s) => {
							return { ...s, background };
						});
					}}
				/>
				<button
					type="button"
					className={`pe-button${state.grid ? " on" : ""}`}
					aria-pressed={state.grid}
					onClick={() => {
						setState((s) => {
							return { ...s, grid: !s.grid };
						});
					}}
				>
					# Grid
				</button>
				{is3d && (
					<button
						type="button"
						className="pe-button"
						onClick={() => {
							live?.resetView();
						}}
					>
						Reset view
					</button>
				)}
				<span className="pe-hint">
					{is3d
						? "drag to orbit · scroll or pinch to zoom"
						: "drag the dot to aim · drag the emitter to move it"}
				</span>
			</div>

			{error && (
				<div className="pe-error" role="alert">
					{error}
				</div>
			)}
			{!error && notice && (
				<button
					type="button"
					className="pe-error pe-notice"
					title="Dismiss"
					onClick={() => {
						setNotice(undefined);
					}}
				>
					{notice} ✕
				</button>
			)}

			<div className="pe-tabs">
				{(
					[
						["effect", "Effect"],
						["properties", "Properties"],
						["code", "Code"],
					] as [Tab, string][]
				).map(([id, label]) => {
					return (
						<button
							type="button"
							key={id}
							className={tab === id ? "on" : ""}
							onClick={() => {
								setTab(id);
							}}
						>
							{label}
						</button>
					);
				})}
			</div>

			<aside className={`pe-panel pe-left${tab === "effect" ? " shown" : ""}`}>
				<div className="pe-section">
					<h3>Effect</h3>
					<select
						aria-label="Effect"
						value={preset}
						onChange={(e) => {
							choosePreset(e.target.value);
						}}
					>
						{preset === "" && (
							<option value="" disabled>
								{custom}
							</option>
						)}
						{PRESETS.map((p) => {
							return (
								<option key={p.id} value={p.id}>
									{p.label}
									{p.camera === "3d" ? " (3D)" : ""}
								</option>
							);
						})}
					</select>
					<button
						type="button"
						className="pe-button pe-random"
						onClick={() => {
							setPreset("");
							setCustom("Random");
							setNotice(undefined);
							setState((s) => {
								return randomState(s, BUILT_IN);
							});
						}}
					>
						🎲 Random
					</button>
					<div style={{ marginTop: 8 }}>
						<Segmented
							value={state.mode}
							options={[
								["stream", "Stream"],
								["burst", "Burst"],
							]}
							onChange={(mode) => {
								edited.current = true;
								setState((s) => {
									return { ...s, mode };
								});
							}}
						/>
					</div>
					<p className="pe-note">
						{state.mode === "stream"
							? "Emits all the time: smoke, fire, rain."
							: "Throws every particle at once, then plays again: explosions, hits."}
					</p>
				</div>

				<div className="pe-section">
					<h3>Texture</h3>
					<select
						aria-label="Texture"
						value={state.texture}
						onChange={(e) => {
							if (e.target.value === "file") {
								spriteInput.current?.click();
							} else {
								const value = e.target.value;
								edited.current = true;
								setState((s) => {
									return { ...s, texture: value };
								});
							}
						}}
					>
						{BUILT_IN.map((id) => {
							return (
								<option key={id} value={id}>
									{builtIn(id).label}
								</option>
							);
						})}
						{state.sprite && (
							<option value="sprite">{state.sprite.name}</option>
						)}
						<option value="file">Sprite from a file…</option>
					</select>
					<input
						ref={spriteInput}
						type="file"
						accept="image/*"
						hidden
						onChange={(e) => {
							void chooseSprite(e);
						}}
					/>
					{texture?.image && (
						<div className="pe-sprite">
							<img src={toDataURL(texture.image)} alt={texture.label} />
							<button
								type="button"
								className="pe-button"
								onClick={() => {
									download(texture);
								}}
							>
								Save as PNG
							</button>
						</div>
					)}
					{state.texture === "sprite" && state.sprite && (
						<SpriteSettings sprite={state.sprite} onChange={setSprite} />
					)}
					<p className="pe-note">
						A file you choose stays on this device: it is read here, never
						uploaded.
					</p>
				</div>

				<div className="pe-section">
					<h3>Camera</h3>
					<Segmented<CameraKind>
						value={is3d ? "3d" : "2d"}
						options={[
							["2d", "2D"],
							["3d", "3D"],
						]}
						disabled={(c) => {
							return c === "3d" && live !== undefined && !live.supports3d;
						}}
						onChange={(camera) => {
							const found = PRESETS.find((p) => {
								return p.id === preset;
							});
							setState((s) => {
								// an untouched preset is reloaded for the new camera,
								// with or without its 3D spread
								return found && !edited.current
									? fromPreset(found, camera, s.background, s.grid)
									: { ...s, camera };
							});
						}}
					/>
					<p className="pe-note">
						{live && !live.supports3d
							? "3D needs WebGL or WebGPU; this page runs on Canvas."
							: is3d
								? "Perspective, orbiting the emitter. Particles are flat and face the screen, so the orbit stops short of seeing them edge-on."
								: "Orthographic: the effect as a 2D game shows it."}
					</p>
				</div>

				<div className="pe-section">
					<h3>Emitter motion</h3>
					<Segmented<Motion>
						value={state.motion}
						options={[
							["still", "Still"],
							["sway", "Sway"],
							["circle", "Circle"],
						]}
						onChange={(motion) => {
							edited.current = true;
							setState((s) => {
								return { ...s, motion };
							});
						}}
					/>
					<p className="pe-note">
						Move the emitter to see the reference space at work.
					</p>
				</div>

				<div className="pe-section">
					<h3>Renderer</h3>
					<select
						aria-label="Renderer"
						value={currentRenderer()}
						onChange={(e) => {
							chooseRenderer(e.target.value);
						}}
					>
						{RENDERERS.map(([id, label]) => {
							return (
								<option key={id} value={id}>
									{label}
								</option>
							);
						})}
					</select>
					<p className="pe-note">
						Running on {rendererLabel(live?.rendererName)}. Changing it reloads
						the page.
					</p>
				</div>

				<p className="pe-note">
					The first nine effects come from the original melonJS particle editor,
					in the archived{" "}
					<a
						href="https://github.com/melonjs/examples/tree/master/particles"
						target="_blank"
						rel="noopener noreferrer"
					>
						examples repository
					</a>
					.
				</p>
			</aside>

			<aside
				className={`pe-panel pe-right${tab === "properties" ? " shown" : ""}`}
			>
				{GROUPS.map((group) => {
					return (
						<details className="pe-group" key={group.title} open>
							<summary>{group.title}</summary>
							{group.fields.map((field) => {
								return (
									<FieldRow
										key={field.key}
										field={field}
										value={state.effect[field.key]}
										off={
											(field.only3d === true && !is3d) ||
											(field.key === "textureSize" &&
												state.texture !== "square") ||
											(state.mode === "burst" &&
												["maxParticles", "frequency", "duration"].includes(
													field.key,
												))
										}
										onChange={(value) => {
											setEffect(field.key, value);
										}}
									/>
								);
							})}
						</details>
					);
				})}
				<p className="pe-note">
					A dot marks a setting changed from its default; ↺ puts it back. A
					dimmed one has no effect with the current choices.
				</p>
			</aside>

			<section
				className={`pe-panel pe-bottom${tab === "code" ? " shown" : ""}`}
			>
				<div className="pe-bottom-bar">
					<Segmented
						value={output}
						options={[
							["code", "Code"],
							["json", "JSON"],
						]}
						onChange={setOutput}
					/>
					{output === "code" && (
						<Segmented<Language>
							value={language}
							options={[
								["ts", "TypeScript"],
								["js", "JavaScript"],
							]}
							onChange={setLanguage}
						/>
					)}
					<span className="pe-spacer" />
					<button type="button" className="pe-button" onClick={copy}>
						{copied ? "Copied" : "Copy"}
					</button>
					{output === "json" && (
						<>
							<button
								type="button"
								className="pe-button"
								onClick={() => {
									saveText(
										text,
										`${preset || "particles"}.json`,
										"application/json",
									);
								}}
							>
								Save
							</button>
							<button
								type="button"
								className="pe-button"
								onClick={() => {
									jsonInput.current?.click();
								}}
							>
								Open…
							</button>
							<input
								ref={jsonInput}
								type="file"
								accept="application/json,.json"
								hidden
								onChange={(e) => {
									void importJSON(e);
								}}
							/>
						</>
					)}
				</div>
				<pre className="pe-code">{text}</pre>
			</section>

			<PreviewHost />
		</>
	);
};

const SpriteSettings = ({
	sprite,
	onChange,
}: {
	sprite: Sprite;
	onChange: (patch: Partial<Sprite>) => void;
}) => {
	const [frames, setFrames] = useState(sprite.frames?.join(", ") ?? "");
	const size = (value: string) => {
		const n = Number.parseInt(value, 10);
		return Number.isInteger(n) && n > 0 ? n : undefined;
	};
	return (
		<>
			<div className="pe-sprite">
				<img src={sprite.image.src} alt={sprite.name} />
				<span className="pe-note">
					{sprite.image.naturalWidth} × {sprite.image.naturalHeight} px
				</span>
			</div>
			<div className="pe-row">
				<label htmlFor="pe-framewidth">Frame width</label>
				<input
					id="pe-framewidth"
					type="number"
					min={1}
					max={sprite.image.naturalWidth}
					placeholder="whole"
					value={sprite.framewidth ?? ""}
					onChange={(e) => {
						onChange({ framewidth: size(e.target.value) });
					}}
				/>
			</div>
			<div className="pe-row">
				<label htmlFor="pe-frameheight">Frame height</label>
				<input
					id="pe-frameheight"
					type="number"
					min={1}
					max={sprite.image.naturalHeight}
					placeholder="whole"
					value={sprite.frameheight ?? ""}
					onChange={(e) => {
						onChange({ frameheight: size(e.target.value) });
					}}
				/>
			</div>
			<div className="pe-row">
				<label htmlFor="pe-frames">Frames</label>
				<input
					id="pe-frames"
					type="text"
					placeholder="all, e.g. 0, 1, 2"
					value={frames}
					style={{ width: 120 }}
					onChange={(e) => {
						setFrames(e.target.value);
						const list = e.target.value
							.split(/[\s,]+/)
							.filter(Boolean)
							.map(Number);
						onChange({
							frames:
								list.length > 0 && list.every(Number.isInteger)
									? list
									: undefined,
						});
					}}
				/>
			</div>
			<div className="pe-row">
				<label htmlFor="pe-random">Random frame</label>
				<input
					id="pe-random"
					type="checkbox"
					checked={sprite.randomFrame}
					onChange={(e) => {
						onChange({ randomFrame: e.target.checked });
					}}
				/>
			</div>
			<p className="pe-note">
				For a sprite sheet: the size of one frame. Each particle plays the
				frames over its life, or keeps one at random.
			</p>
		</>
	);
};

const urls = new WeakMap<HTMLCanvasElement | HTMLImageElement, string>();
const toDataURL = (image: HTMLCanvasElement | HTMLImageElement) => {
	if (image instanceof HTMLImageElement) {
		return image.src;
	}
	let url = urls.get(image);
	if (!url) {
		url = image.toDataURL();
		urls.set(image, url);
	}
	return url;
};

export const ExampleParticleEditor = Editor;
