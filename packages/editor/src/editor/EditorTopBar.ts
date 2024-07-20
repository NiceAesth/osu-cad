import { Anchor, Axes, Container, dependencyLoader } from 'osucad-framework';
import { BackdropBlurFilter } from 'pixi-filters';
import { Corner, EditorCornerPiece } from './EditorCornerPiece';
import { Timeline } from './timeline/Timeline';
import { TimelineZoomButtons } from './timeline/TimelineZoomButtons';
import { EditorMenubar } from './EditorMenubar';
import { BeatSnapDivisorSelector } from './BeatSnapDivisorSelector';
import { EditorScreenSelect } from './EditorScreenSelect';

export class EditorTopBar extends Container {
  constructor() {
    super();
    this.relativeSizeAxes = Axes.X;
    this.height = 84;
  }

  @dependencyLoader()
  init() {
    const filter = new BackdropBlurFilter({
      strength: 15,
      quality: 3,
      antialias: 'inherit',
      resolution: devicePixelRatio,
    });
    filter.padding = 30;

    const timeline = new Timeline();

    this.addAll(
      new Container({
        relativeSizeAxes: Axes.X,
        padding: { horizontal: 170 },
        child: timeline,
        height: 66,
      }),
      new Container({
        relativeSizeAxes: Axes.Both,
        filters: [filter],
        children: [
          new EditorCornerPiece({
            corner: Corner.TopLeft,
            width: 220,
            relativeSizeAxes: Axes.Y,
            children: [
              new Container({
                relativeSizeAxes: Axes.Y,
                anchor: Anchor.TopRight,
                origin: Anchor.TopRight,
                autoSizeAxes: Axes.X,
                padding: { horizontal: 6, vertical: 4 },
                child: new TimelineZoomButtons(timeline, {
                  relativeSizeAxes: Axes.Y,
                  width: 30,
                }),
              }),
              new Container({
                relativeSizeAxes: Axes.X,
                autoSizeAxes: Axes.Y,
                child: new EditorMenubar(),
              }),
            ],
          }),
          new EditorCornerPiece({
            corner: Corner.TopRight,
            width: 220,
            relativeSizeAxes: Axes.Y,
            anchor: Anchor.TopRight,
            origin: Anchor.TopRight,
            child: new Container({
              relativeSizeAxes: Axes.Both,
              padding: { horizontal: 8 },
              children: [
                new EditorScreenSelect().apply({
                  autoSizeAxes: Axes.X,
                  anchor: Anchor.TopCenter,
                  origin: Anchor.TopCenter,
                  height: 32,
                }),
                new Container({
                  relativeSizeAxes: Axes.X,
                  y: 35,
                  height: 35,
                  padding: { left: 25, right: 10 },
                  child: new BeatSnapDivisorSelector(),
                }),
              ],
            }),
          }),
        ],
      }),
    );
  }
}
