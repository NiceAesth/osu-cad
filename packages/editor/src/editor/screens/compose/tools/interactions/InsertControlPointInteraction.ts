import type { Slider } from '@osucad/common';
import { PathPoint } from '@osucad/common';
import type {
  DragEvent,
  DragStartEvent,
  MouseUpEvent,
  Vec2,
} from 'osucad-framework';
import {
  MouseButton,
  dependencyLoader,
  resolved,
} from 'osucad-framework';
import { SliderUtils } from '../SliderUtils';
import { DistanceSnapProvider } from '../DistanceSnapProvider';
import { ComposeToolInteraction } from './ComposeToolInteraction';

export class InsertControlPointInteraction extends ComposeToolInteraction {
  constructor(
    readonly slider: Slider,
    readonly startPosition: Vec2,
    readonly index: number,
  ) {
    super();
  }

  #sliderUtils!: SliderUtils;

  @resolved(DistanceSnapProvider)
  private distanceSnapProvider!: DistanceSnapProvider;

  @dependencyLoader()
  load() {
    this.#sliderUtils = new SliderUtils(
      this.commandManager,
      this.distanceSnapProvider,
    );

    const path = [...this.slider.path.controlPoints];
    path.splice(this.index, 0, new PathPoint(this.startPosition));

    this.#sliderUtils.setPath(this.slider, path, false);
  }

  onDragStart(e: DragStartEvent): boolean {
    return e.button === MouseButton.Left;
  }

  onDrag(e: DragEvent): boolean {
    const position = e.mousePosition.sub(this.slider.stackedPosition);

    const path = [...this.slider.path.controlPoints];
    path[this.index] = path[this.index].withPosition(position);

    this.#sliderUtils.setPath(this.slider, path, false);

    return true;
  }

  onMouseUp(e: MouseUpEvent): boolean {
    if (e.button === MouseButton.Left) {
      this.complete();
      return true;
    }

    return false;
  }
}
