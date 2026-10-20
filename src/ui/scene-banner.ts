// The scene at the top of the hub: the banner for the time of day, with its animated layers when animations
// are on. The banner alone is complete (reduced motion and the app's widgets draw only that). Layers swap
// frames on one 7 fps timer; the clouds are a CSS strip that moves one source pixel every 250 ms. Everything
// pauses while the banner is not visible (hidden view, hidden window).
import { LOOP_TICKS, SCENE_LAYERS, TICK_MS, frameAt, sceneForHour, sceneSize, type LayerKind, type SceneName } from "./motion";
import { SCENES } from "./sprites";

const SCENE_LABELS: Record<SceneName, string> = { morning: "Morning", day: "Daytime", evening: "Evening", night: "Night" };

/** The frames of a layer in a scene, or none when the scene has no such layer. */
function framesOf(kind: LayerKind, scene: SceneName): readonly string[] {
	const byScene: Partial<Record<SceneName, readonly string[]>> = SCENES[kind];
	return byScene[scene] ?? [];
}

export interface SceneBannerOptions {
	/** Whether layers move; false draws the still banner only. */
	animate: boolean;
	/** Called once when the hour moves the banner to another scene, so the owner can draw it again. */
	onSceneChange: () => void;
}

export class SceneBanner {
	private readonly scene: SceneName = sceneForHour(new Date().getHours());
	private readonly banner: HTMLElement;
	private readonly layers: Array<{ kind: LayerKind; frames: HTMLElement[] }> = [];
	private readonly observers: Array<{ disconnect(): void }> = [];
	private readonly doc: Document;
	private timer: number | null = null;
	private tick = 0;
	private onScreen = true;
	private destroyed = false;
	private readonly onVisibility = (): void => this.sync();

	public constructor(parent: HTMLElement, private readonly options: SceneBannerOptions) {
		const { scene } = this;
		this.doc = parent.doc;
		this.banner = parent.createDiv({ cls: "vaultmate-banner", attr: { role: "img", "aria-label": `${SCENE_LABELS[scene]} scene` } });
		this.banner.createEl("img", { cls: "vaultmate-banner-layer", attr: { src: SCENES.hero[scene], alt: "" } });
		if (options.animate) this.addLayers(scene);
		this.fit(parent);
		if (!options.animate) return;
		this.doc.addEventListener("visibilitychange", this.onVisibility);
		const intersection = new IntersectionObserver((entries) => {
			this.onScreen = entries.some((entry) => entry.isIntersecting);
			this.sync();
		});
		intersection.observe(this.banner);
		this.observers.push(intersection);
		this.sync();
	}

	private addLayers(scene: SceneName): void {
		for (const kind of SCENE_LAYERS[scene]) {
			const frames = framesOf(kind, scene).map((src) => this.banner.createEl("img", { cls: "vaultmate-banner-layer vaultmate-banner-frame", attr: { src, alt: "" } }));
			this.layers.push({ kind, frames });
			this.show(kind, frames, 0);
		}
		const clouds = this.banner.createDiv({ cls: "vaultmate-banner-clouds" });
		clouds.setCssProps({ "--vaultmate-clouds": `url("${SCENES.clouds[scene]}")` });
	}

	/** Keeps the banner at a whole-number pixel scale of the width its parent offers, and again when that changes. */
	private fit(parent: HTMLElement): void {
		const apply = (): void => {
			const size = sceneSize(parent.clientWidth, parent.win.devicePixelRatio || 1);
			this.banner.setCssProps({ "--vaultmate-banner-width": `${size.width}px`, "--vaultmate-banner-height": `${size.height}px` });
		};
		apply();
		const resize = new ResizeObserver(apply);
		resize.observe(parent);
		this.observers.push(resize);
	}

	private show(kind: LayerKind, frames: HTMLElement[], tick: number): void {
		const current = frameAt(kind, tick) - 1;
		frames.forEach((frame, index) => frame.toggleClass("is-on", index === current));
	}

	/** Runs the timer and the clouds only while the banner and the window are visible. */
	private sync(): void {
		const visible = !this.destroyed && this.onScreen && this.doc.visibilityState === "visible";
		this.banner.toggleClass("is-paused", !visible);
		if (visible && this.timer === null) this.timer = this.banner.win.setInterval(() => this.step(), TICK_MS);
		else if (!visible && this.timer !== null) this.stopTimer();
	}

	private step(): void {
		if (sceneForHour(new Date().getHours()) !== this.scene) {
			this.destroy();
			this.options.onSceneChange();
			return;
		}
		this.tick = (this.tick + 1) % LOOP_TICKS;
		for (const { kind, frames } of this.layers) this.show(kind, frames, this.tick);
	}

	private stopTimer(): void {
		if (this.timer !== null) this.banner.win.clearInterval(this.timer);
		this.timer = null;
	}

	public destroy(): void {
		this.destroyed = true;
		this.stopTimer();
		this.doc.removeEventListener("visibilitychange", this.onVisibility);
		this.observers.forEach((observer) => observer.disconnect());
		this.observers.length = 0;
	}
}
