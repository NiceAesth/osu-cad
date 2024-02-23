import { UserInfo } from './userInfo';
import { SerializedHitObject } from './hitobject';
import {
  SerializedBeatmapDifficulty,
  SerializedBeatmapGeneral,
} from '../protocol';
import { SerializedHitSounds } from '../osu';
import { SerializedTimingPoint, SerializedVelocityPoint } from './timingPoint';

export interface MapsetInfo {
  id: string;
  title: string;
  artist: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  beatmaps: BeatmapInfo[];
  creator: UserInfo;
  backgroundPath: string | null;
}

export interface BeatmapInfo {
  id: string;
  name: string;
  starRating: number;
}

export interface BeatmapData {
  version: number;
  hitObjects: SerializedHitObject[];
  controlPoints: {
    timing: SerializedTimingPoint[];
    velocity: SerializedVelocityPoint[];
  };
  colors: string[];
  bookmarks: SerializedEditorBookmark[];
  backgroundPath: string | null;
  difficulty: SerializedBeatmapDifficulty;
  audioFilename: string;
  general: SerializedBeatmapGeneral;
  hitSounds: SerializedHitSounds;
}

export interface SerializedEditorBookmark {
  time: number;
  name: string | null;
}
