import { Additions, PathPoint, PathType, Slider, UpdateHitObjectCommand } from '@osucad/common';
import type { Bindable, MouseDownEvent, MouseUpEvent } from 'osucad-framework';
import { MouseButton, Vec2, dependencyLoader } from 'osucad-framework';
import { DrawableHitObjectPlacementTool } from './DrawableHitObjectPlacementTool';
import { SliderPathVisualizer } from './SliderPathVisualizer';
import { SliderUtils } from './SliderUtils';
import { DistanceSnapProvider } from './DistanceSnapProvider';
import { SliderPathBuilder } from './SliderPathBuilder';

export class DrawableSliderTool extends DrawableHitObjectPlacementTool<Slider> {
  constructor() {
    super();
  }

  protected sliderPathVisualizer = new SliderPathVisualizer();

  protected path = new SliderPathBuilder();

  protected segmentStart = 0;

  protected isPlacingPoint = false;

  protected sliderUtils!: SliderUtils;

  get #segmentLength() {
    if (!this.isPlacing)
      return 0;

    return this.hitObject!.path.controlPoints.length - this.segmentStart;
  }

  @dependencyLoader()
  load() {
    const distanceSnapProvider = new DistanceSnapProvider();

    this.sliderUtils = new SliderUtils(
      this.commandManager,
      distanceSnapProvider,
    );

    this.addAllInternal(distanceSnapProvider, this.sliderPathVisualizer);
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

    this.path.setPath([...slider.path.controlPoints]);

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

  applyNewCombo(newCombo: boolean): void {
    super.applyNewCombo(newCombo);

    if (this.isPlacing) {
      this.submit(new UpdateHitObjectCommand(this.hitObject, { newCombo }), false);
    }
  }

  applySampleType(_addition: Additions, _bindable: Bindable<boolean>): void {
    // no-op
  }

  onMouseDown(e: MouseDownEvent): boolean {
    if (e.button === MouseButton.Left) {
      if (!this.isPlacing) {
        this.beginPlacing();
        return true;
      }

      this.#beginPlacingPoint();
      return true;
    }
    else if (e.button === MouseButton.Right) {
      if (!this.isPlacing)
        this.newCombo.value = !this.newCombo.value;
      else
        this.finishPlacing();

      return true;
    }

    return false;
  }

  onMouseMove(): boolean {
    if (this.isPlacing) {
      const position = this.mousePosition.sub(this.hitObject.stackedPosition);

      if (position.distance(this.path.get(-2)) < 5) {
        if (
          this.#segmentLength === 4
          && this.path.get(this.segmentStart).type === PathType.Bezier
        ) {
          this.path.setType(this.segmentStart, PathType.PerfectCurve);
        }
        else if (
          this.#segmentLength === 5
          && this.path.get(this.segmentStart).type === PathType.PerfectCurve
        ) {
          this.path.setType(this.segmentStart, PathType.Bezier);
        }

        this.sliderUtils.setPath(
          this.hitObject,
          this.path.controlPoints.slice(0, Math.max(this.path.length - 1, 2)),
          false,
        );
      }
      else {
        this.path.set(-1, new PathPoint(position));

        if (
          this.#segmentLength === 3
          && this.path.get(this.segmentStart).type === PathType.Bezier
        ) {
          this.path.setType(this.segmentStart, PathType.PerfectCurve);
        }
        else if (
          this.#segmentLength === 4
          && this.path.get(this.segmentStart).type === PathType.PerfectCurve
        ) {
          this.path.setType(this.segmentStart, PathType.Bezier);
        }

        this.sliderUtils.setPath(this.hitObject, this.path.controlPoints, false);
      }

      return true;
    }

    return false;
  }

  onMouseUp(e: MouseUpEvent): boolean {
    if (e.button === MouseButton.Left) {
      if (this.isPlacing && this.isPlacingPoint) {
        this.#endPlacingPoint();
        return true;
      }
    }

    return false;
  }

  beginPlacing() {
    super.beginPlacing();
  }

  #beginPlacingPoint(): void {
    const slider = this.hitObject;
    const path = this.path;
    const position = this.mousePosition.sub(slider.stackedPosition);

    if (path.length > 2) {
      const pointBefore = path.get(-2);
      if (position.distance(pointBefore) < 5) {
        const newType = this.sliderUtils.getNextControlPointType(
          path.get(-2).type,
          path.length - 2,
        );

        this.path.setType(-2, newType);

        for (let i = path.length - 1; i >= 1; i--) {
          if (path.get(i).type !== null) {
            this.segmentStart = i;
            break;
          }
        }

        this.sliderUtils.setPath(
          this.hitObject,
          path.controlPoints.slice(0, Math.max(path.length - 1, 2)),
          false,
        );

        return;
      }
    }

    this.isPlacingPoint = true;
  }

  #endPlacingPoint() {
    const position = this.mousePosition.sub(this.hitObject.stackedPosition);

    this.path.setPath([
      ...this.hitObject.path.controlPoints,
      new PathPoint(position),
    ]);

    this.isPlacingPoint = false;
  }

  protected onPlacementStart(hitObject: Slider) {
    this.sliderPathVisualizer.slider = hitObject;
  }
}
