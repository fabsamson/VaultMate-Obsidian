import actionDrop from "../../assets/sprites/action_drop.png";
import actionOpenNote from "../../assets/sprites/action_open_note.png";
import actionPromote from "../../assets/sprites/action_promote.png";
import mascotSleep from "../../assets/sprites/mascot_sleep.png";
import mascotTea from "../../assets/sprites/mascot_tea.png";
import moduleContext from "../../assets/sprites/module_context.png";
import moduleDecision from "../../assets/sprites/module_decision.png";
import moduleIdea from "../../assets/sprites/module_idea.png";
import moduleLocation from "../../assets/sprites/module_location.png";
import moduleProjects from "../../assets/sprites/module_projects.png";
import moduleQuestions from "../../assets/sprites/module_questions.png";
import modulePrediction from "../../assets/sprites/module_prediction.png";
import patternSeigaiha from "../../assets/sprites/pattern_seigaiha.png";
import sealTrackBacklog from "../../assets/sprites/seal_track_backlog.png";
import sealTrackDone from "../../assets/sprites/seal_track_done.png";
import sealTrackDropped from "../../assets/sprites/seal_track_dropped.png";
import sealTrackExplore from "../../assets/sprites/seal_track_explore.png";
import sealTrackProgress from "../../assets/sprites/seal_track_progress.png";
import stampHit from "../../assets/sprites/stamp_hit.png";
import stampMiss from "../../assets/sprites/stamp_miss.png";
import stampReview from "../../assets/sprites/stamp_review.png";

import type { Sprite } from "./pixel";

// Sprites are drawn and built in obsidian_widget/tools/sprites; `npm run sync-sprites` copies them here.
export const SPRITES = {
	actionDrop: { src: actionDrop, pixels: 16 },
	actionOpenNote: { src: actionOpenNote, pixels: 16 },
	actionPromote: { src: actionPromote, pixels: 16 },
	mascotSleep: { src: mascotSleep, pixels: 48 },
	mascotTea: { src: mascotTea, pixels: 48 },
	moduleContext: { src: moduleContext, pixels: 24 },
	moduleDecision: { src: moduleDecision, pixels: 24 },
	moduleIdea: { src: moduleIdea, pixels: 24 },
	moduleLocation: { src: moduleLocation, pixels: 24 },
	moduleProjects: { src: moduleProjects, pixels: 24 },
	moduleQuestions: { src: moduleQuestions, pixels: 24 },
	modulePrediction: { src: modulePrediction, pixels: 24 },
	patternSeigaiha: { src: patternSeigaiha, pixels: 16 },
	sealTrackBacklog: { src: sealTrackBacklog, pixels: 48 },
	sealTrackDone: { src: sealTrackDone, pixels: 48 },
	sealTrackDropped: { src: sealTrackDropped, pixels: 48 },
	sealTrackExplore: { src: sealTrackExplore, pixels: 48 },
	sealTrackProgress: { src: sealTrackProgress, pixels: 48 },
	stampHit: { src: stampHit, pixels: 20 },
	stampMiss: { src: stampMiss, pixels: 20 },
	stampReview: { src: stampReview, pixels: 20 },
} satisfies Record<string, Sprite>;
