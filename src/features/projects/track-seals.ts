// The seal sprite of each track status: what the plugin shows where the notes write a status emoji.
import type { Sprite } from "../../ui/pixel";
import { SPRITES } from "../../ui/sprites";
import type { TrackStatus } from "./project-note";

export const TRACK_SEALS: Record<TrackStatus, Sprite> = {
	explore: SPRITES.sealTrackExplore,
	backlog: SPRITES.sealTrackBacklog,
	progress: SPRITES.sealTrackProgress,
	done: SPRITES.sealTrackDone,
	dropped: SPRITES.sealTrackDropped,
};
