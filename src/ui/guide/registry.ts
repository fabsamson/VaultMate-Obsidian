// The guides that are written, by id; the other chapters of `chapters.ts` are coming. A page names its guide with `ctx.setGuide(id)`.
import { CONNECTIONS_GUIDE } from "../../features/context/context-guides";
import { IDEAS_GUIDE } from "../../features/ideas/ideas-guides";
import { PROJECT_GUIDE, PROJECTS_GUIDE } from "../../features/projects/projects-guides";
import type { Guide } from "./guide";

export const GUIDES: ReadonlyMap<string, Guide> = new Map([IDEAS_GUIDE, CONNECTIONS_GUIDE, PROJECTS_GUIDE, PROJECT_GUIDE].map((guide) => [guide.id, guide]));
