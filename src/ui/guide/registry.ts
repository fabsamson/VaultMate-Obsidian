// The guides that are written, by id; the other chapters of `chapters.ts` are coming. A page names its guide with `ctx.setGuide(id)`.
import { JOURNAL_GUIDE } from "../../features/journal/journal-guides";
import { PROJECT_GUIDE, PROJECTS_GUIDE } from "../../features/projects/projects-guides";
import type { Guide } from "./guide";
import { HOME_GUIDE } from "./home-guide";

export const GUIDES: ReadonlyMap<string, Guide> = new Map([HOME_GUIDE, PROJECTS_GUIDE, PROJECT_GUIDE, JOURNAL_GUIDE].map((guide) => [guide.id, guide]));
