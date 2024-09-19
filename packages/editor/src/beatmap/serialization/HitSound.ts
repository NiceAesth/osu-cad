import type { Additions } from '../hitSounds/Additions';
import type { SampleSet } from '../hitSounds/SampleSet';
import { HitSound } from '../hitSounds/HitSound';

export interface SerializedHitSound {
  sampleSet: SampleSet;
  additionSampleSet: SampleSet;
  additions: Additions;
}

export function serializeHitSound(hitSound: HitSound): SerializedHitSound {
  return {
    sampleSet: hitSound.sampleSet,
    additionSampleSet: hitSound.additionSampleSet,
    additions: hitSound.additions,
  };
}

export function deserializeHitSound(hitSound: SerializedHitSound): HitSound {
  return new HitSound(
    hitSound.sampleSet,
    hitSound.additionSampleSet,
    hitSound.additions,
  );
}
