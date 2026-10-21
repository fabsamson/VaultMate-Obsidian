// The guides that are written, by id; the other chapters of `chapters.ts` are coming. A page names its guide with `ctx.setGuide(id)`.
import { PROJECT_GUIDE, PROJECTS_GUIDE } from "../../features/projects/projects-guides";
import type { Guide } from "./guide";

export const GUIDES: ReadonlyMap<string, Guide> = new Map([PROJECTS_GUIDE, PROJECT_GUIDE].map((guide) => [guide.id, guide]));
