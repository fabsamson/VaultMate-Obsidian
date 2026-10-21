// Every page guide, by id. A page names its guide with `ctx.setGuide(id)`.
import type { Guide } from "./guide";

export const GUIDES: ReadonlyMap<string, Guide> = new Map<string, Guide>([]);
