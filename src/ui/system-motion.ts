import { animationsEnabled } from "./motion";

/** Whether to animate now: the Animations setting is on and the system does not ask for reduced motion. */
export function animationsOn(setting: boolean): boolean {
	return animationsEnabled(setting, activeWindow.matchMedia("(prefers-reduced-motion: reduce)").matches);
}
