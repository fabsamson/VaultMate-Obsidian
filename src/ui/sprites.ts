import mascotSleep from "../../assets/sprites/mascot_sleep.png";
import mascotTea from "../../assets/sprites/mascot_tea.png";
import moduleDecision from "../../assets/sprites/module_decision.png";
import moduleQuestions from "../../assets/sprites/module_questions.png";
import modulePrediction from "../../assets/sprites/module_prediction.png";
import patternSeigaiha from "../../assets/sprites/pattern_seigaiha.png";
import stampHit from "../../assets/sprites/stamp_hit.png";
import stampMiss from "../../assets/sprites/stamp_miss.png";
import stampReview from "../../assets/sprites/stamp_review.png";

import type { Sprite } from "./pixel";

// Sprites are drawn and built in obsidian_widget/tools/sprites; `npm run sync-sprites` copies them here.
export const SPRITES = {
	mascotSleep: { src: mascotSleep, pixels: 48 },
	mascotTea: { src: mascotTea, pixels: 48 },
	moduleDecision: { src: moduleDecision, pixels: 24 },
	moduleQuestions: { src: moduleQuestions, pixels: 24 },
	modulePrediction: { src: modulePrediction, pixels: 24 },
	patternSeigaiha: { src: patternSeigaiha, pixels: 16 },
	stampHit: { src: stampHit, pixels: 20 },
	stampMiss: { src: stampMiss, pixels: 20 },
	stampReview: { src: stampReview, pixels: 20 },
} satisfies Record<string, Sprite>;
