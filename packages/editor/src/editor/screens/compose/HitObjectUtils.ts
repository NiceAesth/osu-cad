import type {
  HitObject,
  SerializedSlider,
} from '@osucad/common';
import {
  PathPoint,
  PathType,
  Slider,
  Spinner,
  UpdateHitObjectCommand,
} from '@osucad/common';
import { PathApproximator, Vector2 } from 'osu-classes';
import { Axes, CompositeDrawable, Rectangle, Vec2, dependencyLoader, resolved } from 'osucad-framework';
import { Matrix } from 'pixi.js';
import { CommandManager } from '../../context/CommandManager';
import { DistanceSnapProvider } from './tools/DistanceSnapProvider';

export class HitObjectUtils extends CompositeDrawable {
  constructor() {
    super();
  }

  @resolved(CommandManager)
  commandManager!: CommandManager;

  snapProvider!: DistanceSnapProvider;

  @dependencyLoader()
  load() {
    this.snapProvider = new DistanceSnapProvider();
    this.addInternal(this.snapProvider);
  }

  mirrorHitObjects(
    axis: Axes,
    hitObjects: HitObject[],
    aroundCenter: boolean = false,
    commit: boolean = true,
  ) {
    if (hitObjects.length === 0)
      return;

    const center = aroundCenter
      ? this.getBounds(hitObjects).center
      : new Vec2(512 / 2, 384 / 2);

    switch (axis) {
      case Axes.X:
        this.transformHitObjects(
          new Matrix()
            .translate(-center.x, -center.y)
            .scale(-1, 1)
            .translate(center.x, center.y),
          hitObjects,
          commit,
        );

        break;
      case Axes.Y:
        this.transformHitObjects(
          new Matrix()
            .translate(-center.x, -center.y)
            .scale(1, -1)
            .translate(center.x, center.y),
          hitObjects,
          commit,
        );

        break;
    }
  }

  rotateHitObjects(
    hitObjects: HitObject[],
    center: Vec2,
    angle: number,
    commit: boolean = true,
  ) {
    if (hitObjects.length === 0)
      return;

    this.transformHitObjects(
      new Matrix()
        .translate(-center.x, -center.y)
        .rotate(angle)
        .translate(center.x, center.y),
      hitObjects,
      commit,
    );
  }

  getBounds(hitObjects: HitObject[]) {
    let minX = Number.MAX_VALUE;
    let minY = Number.MAX_VALUE;
    let maxX = Number.MIN_VALUE;
    let maxY = Number.MIN_VALUE;

    for (const hitObject of hitObjects) {
      if (hitObject instanceof Spinner) {
        continue;
      }

      minX = Math.min(minX, hitObject.position.x);
      minY = Math.min(minY, hitObject.position.y);
      maxX = Math.max(maxX, hitObject.position.x);
      maxY = Math.max(maxY, hitObject.position.y);

      if (hitObject instanceof Slider) {
        minX = Math.min(minX, hitObject.endPosition.x);
        minY = Math.min(minY, hitObject.endPosition.y);
        maxX = Math.max(maxX, hitObject.endPosition.x);
        maxY = Math.max(maxY, hitObject.endPosition.y);
      }
    }

    return new Rectangle(minX, minY, maxX - minX, maxY - minY);
  }

  transformHitObjects(
    transform: Matrix,
    hitObjects: HitObject[],
    commit: boolean = true,
  ) {
    for (let i = 0; i < hitObjects.length; i++) {
      this.transformHitObject(
        transform,
        hitObjects[i],
        commit && i === hitObjects.length - 1,
      );
    }
  }

  transformHitObject(
    transform: Matrix,
    hitObject: HitObject,
    commit: boolean = true,
  ) {
    const position = hitObject.position;
    const newPosition = Vec2.from(transform.apply(position));

    if (hitObject instanceof Slider) {
      const pointTransform = transform
        .clone()
        .translate(-transform.tx, -transform.ty);

      const path = hitObject.path.controlPoints.map((p) => {
        return {
          ...Vec2.from(pointTransform.apply(p)),
          type: p.type,
        };
      });

      this.commandManager.submit(
        new UpdateHitObjectCommand(hitObject, {
          position: newPosition,
          path,
        } as Partial<SerializedSlider>),
        commit,
      );

      this.commandManager.submit(
        new UpdateHitObjectCommand(hitObject, {
          expectedDistance: this.snapProvider.findSnappedDistance(
            hitObject,
          ),
        } as Partial<SerializedSlider>),
        commit,
      );
    }

    this.commandManager.submit(
      new UpdateHitObjectCommand(hitObject, {
        position: newPosition,
      }),
      commit,
    );
  }

  reverseSlider(slider: Slider, commit: boolean = true) {
    const controlPoints = [...slider.path.controlPoints];

    const endPosition = slider.path.endPosition;
    controlPoints[controlPoints.length - 1] = controlPoints[controlPoints.length - 1].withPosition(endPosition);

    const reversed: PathPoint[] = [];
    const pathTypes = controlPoints
      .filter(it => it.type !== null)
      .map(it => it.type);

    const lastPoint = controlPoints[controlPoints.length - 1];

    for (let i = 0; i < controlPoints.length; i++) {
      const point = controlPoints[i];
      let pathType: PathType | null = null;
      if (i === controlPoints.length - 1 || (point.type !== null && i !== 0)) {
        pathType = pathTypes.shift()!;

        console.assert(pathType !== null, 'Path type should not be null');
      }

      reversed.unshift(new PathPoint(point.position.sub(lastPoint.position), pathType));
    }

    if (reversed.length === 3 && reversed[0].type === PathType.PerfectCurve) {
      const arcProperties = PathApproximator._circularArcProperties(
        reversed.map(it => new Vector2(it.x, it.y)),
      );

      const { centre, radius, thetaStart, thetaRange, direction }
        = arcProperties;

      const middlePoint = new Vec2(
        centre.x + radius * Math.cos(thetaStart + (thetaRange / 2) * direction),
        centre.y + radius * Math.sin(thetaStart + (thetaRange / 2) * direction),
      );

      reversed[1] = reversed[1].withPosition(middlePoint);
    }

    this.commandManager.submit(
      new UpdateHitObjectCommand(slider, {
        position: slider.position.add(lastPoint),
        path: reversed,
      } as Partial<SerializedSlider>),
      commit,
    );
  }

  reverseObjects(hitObjects: HitObject[], commit: boolean = true) {
    if (hitObjects.length === 0)
      return;

    const startTime = hitObjects.reduce(
      (acc, it) => Math.min(acc, it.startTime),
      Number.MAX_VALUE,
    );

    const endTime = hitObjects.reduce(
      (acc, it) => Math.max(acc, it.endTime),
      Number.MIN_VALUE,
    );

    for (let i = 0; i < hitObjects.length; i++) {
      const hitObject = hitObjects[i];

      const distanceToEnd = endTime - hitObject.endTime;

      if (hitObject instanceof Slider) {
        this.reverseSlider(hitObject, false);
      }

      this.commandManager.submit(
        new UpdateHitObjectCommand(hitObject, {
          startTime: startTime + distanceToEnd,
        }),
        false,
      );
    }

    if (commit) {
      this.commandManager.commit();
    }
  }

  convertToBezier(slider: Slider) {
    const path = structuredClone(slider.path.controlPoints);

    if (path.length <= 2)
      return;

    const newPath: PathPoint[] = [];

    let segmentType = path[0].type;
    let segmentStart = 0;

    for (let i = 1; i < path.length; i++) {
      const point = path[i];

      if (point.type !== null || i === path.length - 1) {
        const segmentEnd = i;
        const segment = path.slice(segmentStart, segmentEnd + 1);

        let newSegment: PathPoint[] = segment;

        if (segmentType === PathType.PerfectCurve) {
          newSegment = this.convertCircularArcToBezier(
            segment.map(it => Vec2.from(it)),
          );
        }

        newPath.push(...(i === path.length - 1 ? newSegment : newSegment.slice(0, -1)));

        segmentStart = i;
        segmentType = point.type;
      }
    }

    this.commandManager.submit(
      new UpdateHitObjectCommand(slider, {
        path: newPath,
      } as Partial<SerializedSlider>),
      true,
    );
  }

  convertCircularArcToBezier(segment: Vec2[]): PathPoint[] {
    if (segment.length !== 3)
      return segment.map((it, index) => new PathPoint(it, index === 0 ? PathType.Bezier : null));
    const cs = PathApproximator._circularArcProperties(segment.map(it => new Vector2(it.x, it.y)));
    if (!cs.isValid)
      return segment.map((it, index) => new PathPoint(it, index === 0 ? PathType.Bezier : null));

    let preset = this.circlePresets[this.circlePresets.length - 1];

    for (const p of this.circlePresets) {
      if (p.maxAngle >= cs.thetaRange) {
        preset = p;
        break;
      }
    }

    const arc = preset.points.map(it => it.clone());
    let arcLength = preset.maxAngle;

    const n = arc.length - 1;
    let tf = cs.thetaRange / arcLength;

    while (Math.abs(tf - 1) > 0.0000001) {
      for (let j = 0; j < n; j++) {
        for (let i = n; i > j; i--) {
          arc[i] = arc[i].scale(tf).add(arc[i - 1].scale(1 - tf));
        }
      }

      arcLength = Math.atan2(arc[arc.length - 1].y, arc[arc.length - 1].x);
      if (arcLength < 0) {
        arcLength += 2 * Math.PI;
      }

      tf = cs.thetaRange / arcLength;
    }

    const rotator = new Matrix()
      .scale(cs.radius, cs.radius * cs.direction)
      .rotate(cs.thetaStart)
      .translate(cs.centre.x, cs.centre.y);

    for (let i = 0; i < arc.length; i++) {
      arc[i] = rotator.apply(arc[i]);
    }

    return arc.map((it, index) => new PathPoint(it, index === 0 ? PathType.Bezier : null));
  }

  readonly circlePresets: CircleBezierPreset[] = [
    {
      maxAngle: 0.4993379862754501,
      points: [
        new Vec2(1, 0),
        new Vec2(1.0, 0.2549893626632736),
        new Vec2(0.8778997558480327, 0.47884446188920726),
      ],
    },
    {
      maxAngle: 1.7579419829169447,
      points: [
        new Vec2(1, 0),
        new Vec2(1.0, 0.6263026),
        new Vec2(0.42931178, 1.0990661),
        new Vec2(-0.18605515, 0.9825393),
      ],
    },
    {
      maxAngle: 3.1385246920140215,
      points: [
        new Vec2(1, 0),
        new Vec2(1.0, 0.87084764),
        new Vec2(0.002304826, 1.5033062),
        new Vec2(-0.9973236, 0.8739115),
        new Vec2(-0.9999953, 0.0030679568),
      ],
    },
    {
      maxAngle: 5.69720464620727,
      points: [
        new Vec2(1, 0),
        new Vec2(1.0, 1.4137783),
        new Vec2(-1.4305235, 2.0779421),
        new Vec2(-2.3410065, -0.94017583),
        new Vec2(0.05132711, -1.7309346),
        new Vec2(0.8331702, -0.5530167),
      ],
    },
    {
      maxAngle: 2 * Math.PI,
      points: [
        new Vec2(1, 0),
        new Vec2(1.0, 1.2447058),
        new Vec2(-0.8526471, 2.118367),
        new Vec2(-2.6211002, 7.854936e-06),
        new Vec2(-0.8526448, -2.118357),
        new Vec2(1.0, -1.2447058),
        new Vec2(1.0, -2.4492937e-16),
      ],
    },
  ];
}

interface CircleBezierPreset {
  maxAngle: number;
  points: Vec2[];
}
