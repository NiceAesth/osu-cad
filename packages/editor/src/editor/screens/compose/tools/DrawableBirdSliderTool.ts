import type {
  SerializedSlider,
} from '@osucad/common';
import {
  Additions,
  DeleteHitObjectCommand,
  PathPoint,
  PathType,
  Slider,
  UpdateHitObjectCommand,
} from '@osucad/common';
import type {
  Bindable,
  DragStartEvent,
  KeyDownEvent,
  MouseDownEvent,
  MouseMoveEvent,
  ScrollEvent,
} from 'osucad-framework';
import { Key, MouseButton, Vec2, clamp, dependencyLoader } from 'osucad-framework';

import { Editor } from '../../../Editor';
import { DrawableHitObjectPlacementTool } from './DrawableHitObjectPlacementTool';
import { SliderPathVisualizer } from './SliderPathVisualizer';
import { SliderUtils } from './SliderUtils';
import { DistanceSnapProvider } from './DistanceSnapProvider';

export class DrawableBirdSliderTool extends DrawableHitObjectPlacementTool<Slider> {
  constructor() {
    super();
  }

  protected sliderPathVisualizer = new SliderPathVisualizer();

  protected sliderUtils!: SliderUtils;

  @dependencyLoader()
  load() {
    const distanceSnapProvider = new DistanceSnapProvider();

    this.sliderUtils = new SliderUtils(
      this.commandManager,
      distanceSnapProvider,
    );

    this.addAll(this.sliderPathVisualizer, distanceSnapProvider);

    this.sliderPathVisualizer.onHandleMouseDown = this.#onHandleMouseDown;
    this.sliderPathVisualizer.onHandleDragStarted = this.#onHandleDragStarted;
    this.sliderPathVisualizer.onHandleDragged = this.#onHandleDragged;
    this.sliderPathVisualizer.onHandleDragEnded = this.#onHandleDragEnded;
  }

  createObject(): Slider {
    const slider = new Slider();

    slider.position = this.getSnappedPosition(this.mousePosition);
    slider.startTime = this.snappedTime;
    slider.isNewCombo = this.newCombo.value;

    slider.path.controlPoints = [
      new PathPoint(Vec2.zero(), PathType.Bezier),
      new PathPoint(Vec2.zero()),
    ];

    let additions = Additions.None;
    if (this.sampleWhistle.value)
      additions |= Additions.Whistle;
    if (this.sampleFinish.value)
      additions |= Additions.Finish;
    if (this.sampleClap.value)
      additions |= Additions.Clap;

    slider.hitSound.additions = additions;
    slider.hitSounds.forEach(it => (it.additions = additions));

    return slider;
  }

  protected onPlacementStart(hitObject: Slider) {
    super.onPlacementStart(hitObject);

    this.isPlacingEnd = true;
    this.sliderPathVisualizer.slider = hitObject;

    this.startPosition = hitObject.position;
    this.endPosition = hitObject.position;
    this.curveAnchor = new Vec2(0.7, 0.6);
    this.tailSize = 0.6;
  }

  isPlacingEnd = false;

  onMouseDown(e: MouseDownEvent): boolean {
    if (e.button === MouseButton.Left) {
      if (!this.isPlacing) {
        this.beginPlacing();
        return true;
      }
      else if (this.isPlacingEnd) {
        this.isPlacingEnd = false;
        return true;
      }

      const hovered = this.hoveredHitObjects(e.mousePosition);

      const toSelect = this.findClosestToCurrentTime(hovered)!;

      if (toSelect) {
        this.selection.select([toSelect]);
      }

      this.finishPlacing();
    }
    else if (e.button === MouseButton.Right) {
      if (!this.isPlacing) {
        this.newCombo.value = !this.newCombo.value;
      }
      else if (this.isPlacingEnd) {
        this.isPlacingEnd = false;
      }
      else {
        const hovered = this.hoveredHitObjects(e.mousePosition);

        const toDelete = this.findClosestToCurrentTime(hovered)!;

        if (toDelete) {
          this.submit(new DeleteHitObjectCommand(toDelete), true);
        }

        this.finishPlacing();
      }
    }

    return false;
  }

  startPosition = new Vec2();
  endPosition = new Vec2();

  tailSize = 1;

  curveAnchor = new Vec2(0.5, 0.5);

  onMouseMove(e: MouseMoveEvent): boolean {
    if (!this.isPlacing)
      return false;

    if (this.isPlacingEnd) {
      this.endPosition = e.mousePosition;

      this.updatePath();
    }

    return true;
  }

  updatePath() {
    const endPosition = this.endPosition.sub(this.startPosition);

    const length = endPosition.length();

    const tailOffset = endPosition.rotate(Math.PI / 2).scale(this.tailSize);
    const tailPosition = endPosition.scale(0.5).add(tailOffset);

    const startCurveAnchor = this.curveAnchor
      .scale(length * 0.5)
      .mul({ x: 1, y: this.tailSize })
      .rotate(endPosition.angle());

    const endCurveAnchor = endPosition.add(
      this.curveAnchor
        .scale(length * 0.5)
        .mul({ x: -1, y: this.tailSize })
        .rotate(endPosition.angle()),
    );

    const points: PathPoint[] = [
      new PathPoint(Vec2.zero(), PathType.Bezier),
      new PathPoint(startCurveAnchor),
      new PathPoint(tailPosition, PathType.Bezier),
      new PathPoint(endCurveAnchor),
      new PathPoint(endPosition),
    ];

    this.hitObject.velocityOverride = null;

    this.sliderUtils.setPath(this.hitObject, points, false);

    let velocity = (this.hitObject.velocity / this.hitObject.baseVelocity);

    if (this.hitObject.path.expectedDistance > 0) {
      velocity *= this.hitObject.path.totalLength / this.hitObject.path.expectedDistance;
    }

    this.submit(
      new UpdateHitObjectCommand(this.hitObject, {
        position: this.startPosition,
        velocity,
        expectedDistance: this.hitObject.path.totalLength,
      } as Partial<SerializedSlider>),
      false,
    );
  }

  applySampleType(addition: Additions, bindable: Bindable<boolean>): void {
  }

  onScroll(e: ScrollEvent): boolean {
    if (this.isPlacing && this.isPlacingEnd) {
      const multiplier = e.scrollDelta.y > 0 ? 1.1 : 1 / 1.1;

      this.tailSize = clamp(this.tailSize * multiplier, 0.1, 2);

      this.updatePath();

      return true;
    }

    return false;
  }

  onKeyDown(e: KeyDownEvent): boolean {
    switch (e.key) {
      case Key.KeyF:
        if (this.isPlacingEnd) {
          this.tailSize *= -1;
          this.updatePath();
          return true;
        }
    }

    return false;
  }

  #onHandleMouseDown = () => !this.isPlacingEnd;

  #onHandleDragStarted = (_: number, e: DragStartEvent) => {
    return e.button === MouseButton.Left;
  };

  #onHandleDragged = (index: number, e: DragStartEvent) => {
    const position = this.toLocalSpace(e.screenSpaceMousePosition);
    const relativePosition = position.sub(this.hitObject.stackedPosition);

    if (index === 0) {
      this.startPosition = this.clampToPlayfieldBounds(position);
    }

    if (index === 1 || index === 3) {
      const endPosition = this.endPosition.sub(this.startPosition);
      const angle = endPosition.angle();
      const length = endPosition.length();

      const anchorPos = relativePosition.rotate(-angle).divF(length * 0.5);

      if (index === 3) {
        anchorPos.x = 2 - anchorPos.x;
      }

      anchorPos.y /= this.tailSize;

      this.curveAnchor = anchorPos;
    }

    if (index === 2) {
      const span = this.endPosition.sub(this.startPosition);

      const center = span.scale(0.5);

      const distance = relativePosition.sub(center).length();

      const isNegative = relativePosition.sub(center).cross(span) > 0;

      this.tailSize = distance / this.endPosition.sub(this.startPosition).length() * (isNegative ? -1 : 1);
    }

    if (index === 4) {
      this.endPosition = position;
    }

    this.updatePath();

    return true;
  };

  #onHandleDragEnded = () => {
    this.commit();
  };

  finishPlacing() {
    this.commit();
    this.findClosestParentOfType(Editor)?.requestSelectTool?.emit();
  }

  applyNewCombo(newCombo: boolean) {
    super.applyNewCombo(newCombo);

    if (this.isPlacing) {
      this.submit(new UpdateHitObjectCommand(this.hitObject, { newCombo }), false);
    }
  }
}
