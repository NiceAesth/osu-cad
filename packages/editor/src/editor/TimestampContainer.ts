import { ControlPointManager } from '@osucad/common';
import {
  Anchor,
  Axes,
  Container,
  dependencyLoader,
  resolved,
  SpriteText,
} from 'osucad-framework';
import { Timestamp } from './Timestamp';
import { EditorClock } from './EditorClock';
import { UIFonts } from './UIFonts';
import { ThemeColors } from './ThemeColors';

export class TimestampContainer extends Container {
  constructor() {
    super({
      relativeSizeAxes: Axes.Both,
    });
  }

  timestamp = new Timestamp();

  bpm!: SpriteText;

  @resolved(EditorClock)
  editorClock!: EditorClock;

  @resolved(ControlPointManager)
  controlPoints!: ControlPointManager;

  @resolved(UIFonts)
  fonts!: UIFonts;

  @resolved(ThemeColors)
  colors!: ThemeColors;

  @dependencyLoader()
  load() {
    this.add(this.timestamp);
    this.add(
      (this.bpm = new SpriteText({
        text: '180bpm',
        color: this.colors.primary,
        font: this.fonts.nunitoSans600,
        style: {
          fontSize: 12,
          fill: 'white',
        },
        anchor: Anchor.BottomLeft,
        origin: Anchor.BottomLeft,
      })),
    );
  }

  update(): void {
    super.update();

    const timingPoint = this.controlPoints.timingPointAt(
      this.editorClock.currentTime,
    );
    let bpm = 60_000 / timingPoint.timing.beatLength;
    bpm = Math.round(bpm * 10) / 10;
    this.bpm.text = `${bpm}bpm`;
  }
}
