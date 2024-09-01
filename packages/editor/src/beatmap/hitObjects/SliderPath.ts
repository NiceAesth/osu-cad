import { Action, CachedValue, List, Vec2 } from 'osucad-framework';
import { CalculatedPath } from './CalculatedPath';
import { PathRange } from './PathRange';
import type { PathPoint } from './PathPoint';
import { PathType } from './PathType';
import { PathApproximator } from './PathApproximator';

export class SliderPath {
  readonly invalidated = new Action();

  #expectedDistance = 0;

  get expectedDistance() {
    return this.#expectedDistance;
  }

  set expectedDistance(value: number) {
    if (value === this.#expectedDistance)
      return;

    this.#expectedDistance = value;
    this.#invalidateRange();
  }

  #controlPoints: readonly PathPoint[] = [];

  get controlPoints(): ReadonlyArray<PathPoint> {
    return this.#controlPoints;
  }

  set controlPoints(value: readonly PathPoint[]) {
    this.#controlPoints = value;
    this.invalidate();
  }

  invalidate() {
    if (this.#calculatedPath.isValid || this.#calculatedRange.isValid) {
      this.#calculatedPath.invalidate();
      this.#calculatedRange.invalidate();
    }
    this.invalidated.emit();
  }

  #invalidateRange() {
    if (this.#calculatedRange.isValid) {
      this.#calculatedRange.invalidate();

      this.invalidated.emit();
    }
  }

  #calculatedPath = new CachedValue<CalculatedPath>();

  #calculatedRange = new CachedValue<PathRange>();

  get calculatedPath() {
    this.#ensureValid();
    return this.#calculatedPath.value;
  }

  get calculatedRange() {
    this.#ensureValid();
    return this.#calculatedRange.value;
  }

  #ensureValid() {
    if (!this.#calculatedPath.isValid) {
      this.#calculatedPath.value = this.#calculatePath();
    }
    if (!this.#calculatedRange.isValid) {
      this.#calculatedRange.value = new PathRange(this.#calculatedPath.value, 0, this.expectedDistance);
    }
  }

  #calculatePath(): CalculatedPath {
    if (this.controlPoints.length <= 1) {
      return new CalculatedPath();
    }

    const points = new List<Vec2>(100);
    const cumulativeDistance = new List<number>(100);

    points.push(new Vec2());
    cumulativeDistance.push(0);

    for (const segment of this.pathSegments) {
      const segmentPoints = segment.points.map(p => p.position.clone());
      let calculatedSegment: Vec2[];

      switch (segment.type) {
        case PathType.Catmull:
          calculatedSegment = PathApproximator.approximateCatmull(segmentPoints);
          break;
        case PathType.Linear:
          calculatedSegment = segmentPoints;
          break;
        // @ts-expect-error we want to fall back to bezier if the segment does not have 3 points
        case PathType.PerfectCurve:
          if (segmentPoints.length === 3) {
            calculatedSegment = PathApproximator.approximateCircularArc(segmentPoints);
            break;
          }
        // eslint-disable-next-line no-fallthrough -- see above
        default:
          calculatedSegment = PathApproximator.approximateBezier(segmentPoints);
          break;
      }

      for (const p of calculatedSegment) {
        const last = points.last!;
        const distance = last.distance(p);

        if (distance === 0)
          continue;

        points.push(p);
        cumulativeDistance.push(cumulativeDistance.last! + distance);
      }
    }

    return new CalculatedPath([...points], [...cumulativeDistance]);
  }

  get pathSegments(): PathSegment[] {
    const segments: PathSegment[] = [];

    let segmentStart = 0;
    let segmentType = this.controlPoints[0].type!;

    for (let i = 1; i < this.controlPoints.length; i++) {
      const controlPoint = this.controlPoints[i];

      if (controlPoint.type !== null || i === this.controlPoints.length - 1) {
        segments.push({
          type: segmentType,
          points: this.controlPoints.slice(segmentStart, i + 1),
        });

        segmentStart = i;
        segmentType = controlPoint.type!;
      }
    }

    return segments;
  }

  get calculatedDistance() {
    return this.calculatedPath.cumulativeDistance[this.calculatedPath.length - 1] ?? 0;
  }

  getPositionAt(progress: number) {
    return this.calculatedPath.getPositionAtDistance(progress * this.expectedDistance);
  }

  getPositionAtDistance(distance: number) {
    return this.calculatedPath.getPositionAtDistance(distance);
  }

  getRange(start: number, end: number) {
    return new PathRange(this.calculatedPath, start, end);
  }

  get endPosition() {
    return this.calculatedRange.endPosition;
  }
}

interface PathSegment {
  type: PathType;
  points: PathPoint[];
}