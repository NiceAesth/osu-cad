import { Anchor, Axes, Container, dependencyLoader } from 'osucad-framework';
import { BackdropBlurFilter } from 'pixi-filters';
import { Corner, EditorCornerPiece } from './EditorCornerPiece';
import { Timeline } from './timeline/Timeline';

export class EditorTopBar extends Container {
  constructor() {
    super();
    this.relativeSizeAxes = Axes.X;
    this.height = 84;
  }

  @dependencyLoader()
  init() {
    const filter = new BackdropBlurFilter({
      strength: 20,
      quality: 3,
      antialias: 'on',
    });
    filter.padding = 30;

    this.addAll(
      new Container({
        relativeSizeAxes: Axes.X,
        padding: { horizontal: 170 },
        child: new Timeline(),
        height: 66,
      }),
      new Container({
        relativeSizeAxes: Axes.Both,
        filters: [filter],
        children: [
          new EditorCornerPiece({
            corner: Corner.TopLeft,
            width: 200,
            relativeSizeAxes: Axes.Y,
          }),
          new EditorCornerPiece({
            corner: Corner.TopRight,
            width: 200,
            relativeSizeAxes: Axes.Y,
            anchor: Anchor.TopRight,
            origin: Anchor.TopRight,
          }),
        ],
      }),
    );
  }
}