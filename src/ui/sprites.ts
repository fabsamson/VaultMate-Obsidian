import actionDrop from "../../assets/sprites/action_drop.png";
import actionOpenNote from "../../assets/sprites/action_open_note.png";
import actionPromote from "../../assets/sprites/action_promote.png";
import heroDay from "../../assets/sprites/hero_day.png";
import heroEvening from "../../assets/sprites/hero_evening.png";
import heroMorning from "../../assets/sprites/hero_morning.png";
import heroNight from "../../assets/sprites/hero_night.png";
import inkSpread1 from "../../assets/sprites/ink_spread_1.png";
import inkSpread2 from "../../assets/sprites/ink_spread_2.png";
import inkSpread3 from "../../assets/sprites/ink_spread_3.png";
import layerDayClouds from "../../assets/sprites/layer_day_clouds.png";
import layerDaySun1 from "../../assets/sprites/layer_day_sun_1.png";
import layerDaySun2 from "../../assets/sprites/layer_day_sun_2.png";
import layerDaySun3 from "../../assets/sprites/layer_day_sun_3.png";
import layerEveningClouds from "../../assets/sprites/layer_evening_clouds.png";
import layerEveningLanterns1 from "../../assets/sprites/layer_evening_lanterns_1.png";
import layerEveningLanterns2 from "../../assets/sprites/layer_evening_lanterns_2.png";
import layerEveningLanterns3 from "../../assets/sprites/layer_evening_lanterns_3.png";
import layerMorningClouds from "../../assets/sprites/layer_morning_clouds.png";
import layerMorningSun1 from "../../assets/sprites/layer_morning_sun_1.png";
import layerMorningSun2 from "../../assets/sprites/layer_morning_sun_2.png";
import layerMorningSun3 from "../../assets/sprites/layer_morning_sun_3.png";
import layerNightClouds from "../../assets/sprites/layer_night_clouds.png";
import layerNightLanterns1 from "../../assets/sprites/layer_night_lanterns_1.png";
import layerNightLanterns2 from "../../assets/sprites/layer_night_lanterns_2.png";
import layerNightLanterns3 from "../../assets/sprites/layer_night_lanterns_3.png";
import layerNightStars1 from "../../assets/sprites/layer_night_stars_1.png";
import layerNightStars2 from "../../assets/sprites/layer_night_stars_2.png";
import layerNightStars3 from "../../assets/sprites/layer_night_stars_3.png";
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
import stampDone from "../../assets/sprites/stamp_done.png";
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
	stampDone: { src: stampDone, pixels: 20 },
	stampHit: { src: stampHit, pixels: 20 },
	stampMiss: { src: stampMiss, pixels: 20 },
	stampReview: { src: stampReview, pixels: 20 },
} satisfies Record<string, Sprite>;

/**
 * The banner sprites (160 x 56 source pixels, so not square and not a `Sprite`), their animation frames
 * and the stamp ink (28 x 28). Frames are listed in number order: frame 1 first.
 */
export const SCENES = {
	hero: { morning: heroMorning, day: heroDay, evening: heroEvening, night: heroNight },
	sun: {
		morning: [layerMorningSun1, layerMorningSun2, layerMorningSun3],
		day: [layerDaySun1, layerDaySun2, layerDaySun3],
	},
	lanterns: {
		evening: [layerEveningLanterns1, layerEveningLanterns2, layerEveningLanterns3],
		night: [layerNightLanterns1, layerNightLanterns2, layerNightLanterns3],
	},
	stars: { night: [layerNightStars1, layerNightStars2, layerNightStars3] },
	clouds: { morning: layerMorningClouds, day: layerDayClouds, evening: layerEveningClouds, night: layerNightClouds },
	ink: [inkSpread1, inkSpread2, inkSpread3],
} as const;
