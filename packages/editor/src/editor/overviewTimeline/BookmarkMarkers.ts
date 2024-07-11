import { Beatmap } from '@osucad/common';
import {
  Anchor,
  Axes,
  CompositeDrawable,
  Container,
  Invalidation,
  LayoutMember,
  RoundedBox,
  dependencyLoader,
  resolved,
} from 'osucad-framework';
import { EditorClock } from '../EditorClock';
import {
  OverviewTimelineMarker,
  OverviewTimelineMarkerContainer,
} from './OverviewTimelineMarkerContainer';

export class BookmarkMarkers extends OverviewTimelineMarkerContainer {
  constructor() {
    super({
      height: 10,
      verticalPadding: 2,
    });

    this.anchor = Anchor.BottomLeft;
    this.origin = Anchor.BottomLeft;
  }

  @resolved(EditorClock)
  editorClock!: EditorClock;

  @dependencyLoader()
  load() {
    this.beatmap.onBookmarksChanged.addListener(() => this.invalidateMarkers());
  }

  createMarkers(): OverviewTimelineMarker[] {
    const trackLength = this.editorClock.trackLength;

    return this.beatmap.bookmarks.map((bookmark) => {
      const marker = new OverviewTimelineMarker(0x529aff);

      marker.x = bookmark.time / trackLength;

      return marker;
    });
  }
}