// Decisions about motion, without the DOM: whether to animate, which scene to show, which frame of a
// layer is on screen and how large the banner is. Pure, so Vitest tests it. The timings follow
// obsidian_widget/tools/sprites/README.md ("Animated scenes and moments"), shared with the Android app.

/** Animations run only when the setting is on and the system does not ask for reduced motion. */
export function animationsEnabled(setting: boolean, prefersReducedMotion: boolean): boolean {
	return setting && !prefersReducedMotion;
}

export type SceneName = "morning" | "day" | "evening" | "night";

/** The scene for an hour (0-23): morning 05:00-10:59, day 11:00-16:59, evening 17:00-20:59, night 21:00-04:59. */
export function sceneForHour(hour: number): SceneName {
	if (hour >= 5 && hour < 11) return "morning";
	if (hour >= 11 && hour < 17) return "day";
	if (hour >= 17 && hour < 21) return "evening";
	return "night";
}

/** The kinds of animated layer, each with its own frame order (1-based frame numbers), played in a loop. */
export const FRAME_ORDERS = {
	sun: [1, 2, 3, 2],
	lanterns: [1, 3, 2, 1, 2, 3],
	stars: [1, 1, 2, 2, 3, 3],
} as const;

export type LayerKind = keyof typeof FRAME_ORDERS;

function gcd(a: number, b: number): number {
	return b === 0 ? a : gcd(b, a % b);
}

/** Ticks after which every frame order starts over together, so a tick counter can wrap instead of growing. */
export const LOOP_TICKS = Object.values(FRAME_ORDERS).reduce((total, order) => (total * order.length) / gcd(total, order.length), 1);

/** The animated layers of a scene, bottom to top; the clouds (a moving strip) are drawn after them. */
export const SCENE_LAYERS: Record<SceneName, readonly LayerKind[]> = {
	morning: ["sun"],
	day: ["sun"],
	evening: ["lanterns"],
	night: ["stars", "lanterns"],
};

/** Time between two frames: 7 frames per second. */
export const TICK_MS = 143;

/** The frame number (1 to 3) a layer shows at a tick. */
export function frameAt(kind: LayerKind, tick: number): number {
	const order = FRAME_ORDERS[kind];
	return order[tick % order.length] ?? 1;
}

export const SCENE_WIDTH = 160;
export const SCENE_HEIGHT = 56;
/** Tallest banner, in CSS pixels: the scene stays a strip above the tiles even on a wide panel. */
const MAX_BANNER_HEIGHT = 128;

/**
 * CSS size of the banner: the largest whole-number scale (device pixels per source pixel) that fits the
 * available width and `MAX_BANNER_HEIGHT`, never below 1. Sprite pixels then cover whole device pixels
 * at any density, so the art stays crisp.
 */
export function sceneSize(availableWidth: number, devicePixelRatio: number): { width: number; height: number } {
	const byWidth = Math.floor((availableWidth * devicePixelRatio) / SCENE_WIDTH);
	const byHeight = Math.floor((MAX_BANNER_HEIGHT * devicePixelRatio) / SCENE_HEIGHT);
	const scale = Math.max(1, Math.min(byWidth, byHeight));
	return { width: (SCENE_WIDTH * scale) / devicePixelRatio, height: (SCENE_HEIGHT * scale) / devicePixelRatio };
}

/** Size of the stamp moment's 28 px canvas: the largest whole device-pixel scale within 112 CSS pixels. */
export function stampScale(devicePixelRatio: number): number {
	return Math.max(1, Math.floor((112 * devicePixelRatio) / 28)) / devicePixelRatio;
}
