import { BeatmapColors } from './BeatmapColors';
import { BeatmapDifficultyInfo } from './BeatmapDifficultyInfo';
import { BeatmapMetadata } from './BeatmapMetadata';
import { BeatmapSettings } from './BeatmapSettings';
import { HitObjectList } from './hitObjects/HitObjectList';
import { ControlPointInfo } from './timing/ControlPointInfo';

export class Beatmap {
  readonly settings = new BeatmapSettings();
  readonly metadata = new BeatmapMetadata();
  readonly difficulty = new BeatmapDifficultyInfo();
  readonly colors = new BeatmapColors();
  readonly controlPoints = new ControlPointInfo();
  readonly hitObjects = new HitObjectList(this);
}
