import type { IResourcesProvider } from '../io/IResourcesProvider';
import type { ISkin } from '../skinning/ISkin';
import { Bindable } from 'osucad-framework';

export abstract class SkinStore {
  readonly skins = new Bindable<SkinProvider[]>([]);
}

export abstract class SkinProvider {
  protected constructor(public name: string) {
  }

  abstract loadSkin(resources: IResourcesProvider): Promise<ISkin>;
}
