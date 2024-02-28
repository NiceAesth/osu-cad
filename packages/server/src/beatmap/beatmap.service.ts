import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MapsetEntity } from './mapset.entity';
import { Repository } from 'typeorm';
import { BeatmapEntity } from './beatmap.entity';
import { existsSync, readFileSync } from 'fs';
import * as path from 'path';
import { ParticipantEntity } from './participant.entity';
import { BeatmapAccess, BeatmapData } from '@osucad/common';
import { UserEntity } from '../users/user.entity';
import { EditorSessionEntity } from '../editor/editor-session.entity';
import { BeatmapSnapshotService } from './beatmap-snapshot.service';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { BeatmapThumbnailJob } from './beatmap-thumbnail.processor';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class BeatmapService implements OnModuleInit {
  constructor(
    @InjectRepository(MapsetEntity)
    private readonly mapsetRepository: Repository<MapsetEntity>,
    @InjectRepository(BeatmapEntity)
    private readonly beatmapRepository: Repository<BeatmapEntity>,
    @InjectRepository(ParticipantEntity)
    private readonly participantRepository: Repository<ParticipantEntity>,
    @InjectRepository(EditorSessionEntity)
    private readonly sessionRepository: Repository<EditorSessionEntity>,
    private readonly snapshotService: BeatmapSnapshotService,
    @InjectQueue('beatmap-thumbnail')
    private readonly thumbnailQueue: Queue<BeatmapThumbnailJob>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private readonly logger = new Logger(BeatmapService.name);

  async onModuleInit(): Promise<void> {
    await this.queueThumbnailJobs();
  }

  private async queueThumbnailJobs() {
    const beatmaps = await this.beatmapRepository.find({
      select: ['id'],
      where: {
        needsThumbnail: true,
      },
    });
    this.logger.log(
      `Queuing ${beatmaps.length} beatmaps for thumbnail generation`,
    );
    for (const beatmap of beatmaps) {
      await this.queueThumbnailJob(beatmap);
    }
  }

  async createMapset(mapset: MapsetEntity) {
    mapset = await this.mapsetRepository.save(mapset);
    for (const beatmap of mapset.beatmaps) {
      beatmap.mapset = mapset;
      await this.beatmapRepository.save(beatmap);
    }

    return mapset;
  }

  async saveMapset(mapset: MapsetEntity) {
    await this.mapsetRepository.save(mapset);
  }

  async findMapsetById(id: string) {
    return await this.mapsetRepository.findOne({
      where: { id },
      relations: [
        'creator',
        'beatmaps',
        'beatmaps.thumbnailSmall',
        'beatmaps.thumbnailLarge',
      ],
    });
  }

  async findBeatmapById(id: number) {
    return await this.beatmapRepository.findOne({
      where: { id },
      relations: ['mapset', 'thumbnailLarge', 'thumbnailSmall'],
    });
  }

  async findBeatmapByUuid(uuid: string) {
    return await this.beatmapRepository.findOne({
      where: { uuid },
      relations: [
        'mapset',
        'mapset.creator',
        'thumbnailLarge',
        'thumbnailSmall',
      ],
    });
  }

  async findBeatmapByShareKey(shareId: string) {
    return await this.beatmapRepository.findOne({
      where: { shareId },
      relations: ['mapset'],
    });
  }

  async mapsetExists(id: string) {
    return await this.mapsetRepository.exist({
      where: {
        id,
      },
    });
  }

  getFileContents(id: string, filePath: string): Buffer | null {
    filePath = path.join('files/mapsets', id, filePath);
    if (!existsSync(filePath)) return null;

    const relative = path.relative('files/mapsets', filePath);
    if (relative.startsWith('..') || path.isAbsolute(filePath)) return null;

    return readFileSync(filePath);
  }

  findMapsetsByCreator(id: number) {
    return this.mapsetRepository.find({
      where: {
        creator: { id },
      },
      relations: [
        'creator',
        'beatmaps',
        'beatmaps.thumbnailLarge',
        'beatmaps.thumbnailSmall',
      ],
      order: {
        updatedAt: 'DESC',
      },
    });
  }

  async save(beatmap: BeatmapEntity, data: BeatmapData) {
    await this.snapshotService.createSnapshot(beatmap, data);
  }

  findLastEditedBeatmaps(user: UserEntity) {
    return this.sessionRepository
      .createQueryBuilder('session')
      .innerJoinAndSelect('session.beatmap', 'beatmap')
      .innerJoinAndSelect('beatmap.mapset', 'mapset')
      .innerJoinAndSelect('mapset.creator', 'creator')
      .where({ user })
      .distinctOn(['beatmap.id'])
      .orderBy('session.endDate', 'DESC')
      .limit(10)
      .getMany();
  }

  async setAccess(beatmap: BeatmapEntity, access: BeatmapAccess) {
    await this.beatmapRepository.update(beatmap.id, {
      access,
    });
    beatmap.access = access;
    await this.eventEmitter.emitAsync('beatmapPermissionChange', beatmap);
  }

  async queueThumbnailJob(beatmap: BeatmapEntity) {
    return this.thumbnailQueue.add(
      { beatmapId: beatmap.id },
      {
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    );
  }
}
