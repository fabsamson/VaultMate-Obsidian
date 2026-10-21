// The guides that are written, by id; the other chapters of `chapters.ts` are coming. A page names its guide with `ctx.setGuide(id)`.
import { AI_ACTIONS_GUIDE } from "../../features/ai-actions/ai-guides";
import { PLACES_GUIDE } from "../../features/location/location-guides";
import { PROJECT_GUIDE, PROJECTS_GUIDE } from "../../features/projects/projects-guides";
import type { Guide } from "./guide";

export const GUIDES: ReadonlyMap<string, Guide> = new Map([PLACES_GUIDE, PROJECTS_GUIDE, AI_ACTIONS_GUIDE, PROJECT_GUIDE].map((guide) => [guide.id, guide]));
