import { Action } from 'osucad-framework';
import type { ControlPointGroupChangeEvent } from './ControlPointGroup';
import { ControlPointGroup } from './ControlPointGroup';
import { ControlPointList } from './ControlPointList';
import { TickGenerator } from './TickGenerator';
import { TimingPoint } from './TimingPoint';
import { DifficultyPoint } from './DifficultyPoint';
import { EffectPoint } from './EffectPoint';
import type { ControlPoint } from './ControlPoint';
import { SamplePoint } from './SamplePoint';

export class ControlPointInfo {
  groups = new ControlPointList<ControlPointGroup>();

  timingPoints = new ControlPointList<TimingPoint>();

  difficultyPoints = new ControlPointList<DifficultyPoint>();

  effectPoints = new ControlPointList<EffectPoint>();

  samplePoints = new ControlPointList<SamplePoint>();

  groupAdded = new Action<ControlPointGroup>();

  groupRemoved = new Action<ControlPointGroup>();

  constructor() {
    this.groups.added.addListener(this.#onGroupAdded.bind(this));
    this.groups.removed.addListener(this.#onGroupRemoved.bind(this));
  }

  add(controlPoint: ControlPointGroup): boolean {
    if (this.groups.find(it => it.id === controlPoint.id))
      return false;

    this.groups.add(controlPoint);
    return true;
  }

  controlPointGroupAtTime(time: number, create: true): ControlPointGroup;

  controlPointGroupAtTime(time: number, create?: false): ControlPointGroup | undefined;

  controlPointGroupAtTime(time: number, create: boolean = false): ControlPointGroup | undefined {
    const controlPoint = new ControlPointGroup();
    controlPoint.time = time;

    const index = this.groups.binarySearch(controlPoint);

    if (index >= 0) {
      return this.groups.get(index)!;
    }

    if (create) {
      this.add(controlPoint);

      return controlPoint;
    }

    return undefined;
  }

  snap(time: number, divisor: number) {
    const timingPoint = this.timingPointAt(time);

    if (!timingPoint)
      return time;

    const beatSnapLength = timingPoint.beatLength / divisor;
    const beats = (Math.max(time, 0) - timingPoint.time) / beatSnapLength;

    const closestBeat = beats < 0 ? -Math.round(-beats) : Math.round(beats);
    const snappedTime = Math.floor(
      timingPoint.time + closestBeat * beatSnapLength,
    );

    if (snappedTime >= 0)
      return snappedTime;

    return snappedTime + beatSnapLength;
  }

  timingPointAt(time: number) {
    return this.timingPoints.controlPointAt(time) ?? TimingPoint.default;
  }

  difficultyPointAt(time: number) {
    const difficultyPoint = this.difficultyPoints.controlPointAt(time);
    if (!difficultyPoint || difficultyPoint.time > time)
      return DifficultyPoint.default;

    return difficultyPoint;
  }

  effectPointAt(time: number) {
    return this.effectPoints.controlPointAt(time) ?? EffectPoint.default;
  }

  samplePointAt(time: number) {
    return this.samplePoints.controlPointAt(time) ?? SamplePoint.default;
  }

  readonly tickGenerator = new TickGenerator(this.timingPoints);

  #onGroupAdded(group: ControlPointGroup) {
    this.groupAdded.emit(group);

    group.added.addListener(e => this.#onAddedToGroup(e));
    group.removed.addListener(e => this.#onRemovedFromGroup(e));

    for (const child of group.children) {
      this.#onAddedToGroup({ group, controlPoint: child });
    }
  }

  #onGroupRemoved(group: ControlPointGroup) {
    this.groupRemoved.emit(group);

    for (const child of group.children) {
      this.#onRemovedFromGroup({ group, controlPoint: child });
    }
  }

  #onAddedToGroup = (event: ControlPointGroupChangeEvent) => {
    const controlPoint = event.controlPoint;

    this.listFor(controlPoint)?.add(controlPoint);
  };

  #onRemovedFromGroup = (event: ControlPointGroupChangeEvent) => {
    const controlPoint = event.controlPoint;

    this.listFor(controlPoint)?.remove(controlPoint);
  };

  addToGroup(group: ControlPointGroup, controlPoint: ControlPoint, skipIfRedundant: boolean): boolean {
    if (skipIfRedundant) {
      const existing = this.listFor(controlPoint)?.controlPointAt(group.time);

      if (existing && controlPoint.isRedundant(existing))
        return false;
    }

    return group.add(controlPoint);
  }

  protected listFor<T extends ControlPoint>(controlPoint: T): ControlPointList<T> | undefined {
    switch (controlPoint.constructor) {
      case TimingPoint:
        return this.timingPoints as any;
      case DifficultyPoint:
        return this.difficultyPoints as any;
      case EffectPoint:
        return this.effectPoints as any;
      case SamplePoint:
        return this.samplePoints as any;
    }
  }
}