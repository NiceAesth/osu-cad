import {Injectable, Logger} from "@nestjs/common";
import {BeatmapService} from "../beatmap/beatmap.service";
import {EditorRoom} from "./editor.room";
import {BeatmapData, BeatmapId} from "@osucad/common";

@Injectable()
export class EditorRoomManager {

  private readonly rooms = new Map<BeatmapId, EditorRoom | Promise<EditorRoom>>();

  private readonly logger = new Logger(EditorRoomManager.name);

  constructor(
    private readonly beatmapService: BeatmapService,
  ) {

    setInterval(async () => {
      const rooms = await Promise.all([...this.rooms.values()]);
      const totalUsers = rooms.reduce((acc, room) => acc + room.userCount, 0);
      this.printStats();

      for (const room of this.rooms.values()) {
        if (room instanceof Promise) {
          continue;
        }


        const entity = room.entity;
        if (entity && room.hasUnsavedChanges) {
          const beatmap = room.beatmap;

          const data: BeatmapData = {
            version: 1,
            general: beatmap.general,
            audioFilename: beatmap.audioFilename,
            backgroundPath: beatmap.backgroundPath,
            colors: beatmap.colors.map(color => "#" + color.toString(16).padStart(6, "0")),
            difficulty: beatmap.difficulty,
            bookmarks: beatmap.bookmarks,
            controlPoints: beatmap.controlPoints.serialize(),
            hitObjects: beatmap.hitObjects.serialize(),
            hitSounds: beatmap.hitSounds,
          };

          await this.beatmapService.save(entity, data);
        }
      }
      [...this.rooms.keys()].forEach(key => {
        const room = this.rooms.get(key);
        if (room instanceof Promise) return;
        if (room.userCount === 0) {
          this.rooms.delete(key);
          this.logger.log(`closed room ${key}`);
        }
      });
    }, 15_000);
  }

  private async createRoom(beatmapId: BeatmapId): Promise<EditorRoom | null> {
    const beatmap = await this.beatmapService.findBeatmapByUuid(beatmapId);
    if (!beatmap) return null;
    this.logger.log(`creating room ${beatmapId} for ${beatmap.mapset.artist} - ${beatmap.mapset.title}`);
    return new EditorRoom(beatmap);
  }

  async getRoom(beatmapId: BeatmapId): Promise<EditorRoom | undefined> {
    let room = this.rooms.get(beatmapId);

    if (!room) return undefined;

    return room instanceof Promise ? await room : room;
  }

  async getRoomOrCreateRoom(beatmapId: BeatmapId): Promise<EditorRoom | null> {
    let room = this.rooms.get(beatmapId);

    if (!room) {
      room = this.createRoom(beatmapId).then(room => {
        if (room)
          this.rooms.set(beatmapId, room);
        else
          this.rooms.delete(beatmapId);
        return room;
      });
      this.rooms.set(beatmapId, room);
      return room;
    }

    return room instanceof Promise ? await room : room;
  }

  printStats() {
    const rooms = [...this.rooms.values()].filter(room => !(room instanceof Promise)) as EditorRoom[];
    const totalUsers = rooms.reduce((acc, room) => acc + room.userCount, 0);
    this.logger.log(`${rooms.length} active rooms with ${totalUsers} users`);
    rooms.sort((a, b) => b.userCount - a.userCount);
    for (const room of rooms) {
      const metadata = room.beatmap.metadata;
      this.logger.log(`  [${room.beatmap.id}] ${metadata.artist} - ${metadata.title} - ${room.userCount} users`);
      for (const user of room.users) {
        this.logger.log(`  |   ${user.user.username} { sessionId: ${user.sessionId} }`);
      }
    }
  }

}