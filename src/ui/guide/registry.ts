// The guides that are written, by id; all eight chapters of `chapters.ts`. A page names its guide with `ctx.setGuide(id)`.
import { AI_ACTIONS_GUIDE } from "../../features/ai-actions/ai-guides";
import { CONNECTIONS_GUIDE } from "../../features/context/context-guides";
import { IDEAS_GUIDE } from "../../features/ideas/ideas-guides";
import { JOURNAL_GUIDE } from "../../features/journal/journal-guides";
import { PLACES_GUIDE } from "../../features/location/location-guides";
import { PROJECT_GUIDE, PROJECTS_GUIDE } from "../../features/projects/projects-guides";
import type { Guide } from "./guide";
import { HOME_GUIDE } from "./home-guide";

export const GUIDES: ReadonlyMap<string, Guide> = new Map([HOME_GUIDE, IDEAS_GUIDE, PROJECTS_GUIDE, PROJECT_GUIDE, JOURNAL_GUIDE, CONNECTIONS_GUIDE, AI_ACTIONS_GUIDE, PLACES_GUIDE].map((guide) => [guide.id, guide]));
