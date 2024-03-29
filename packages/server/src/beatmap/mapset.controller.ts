import {
  Controller,
  ForbiddenException,
  Get,
  Param,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { BeatmapImportService } from './beatmap-import.service';
import 'multer';
import { AuthGuard } from '../auth/auth.guard';
import { Request, Response } from 'express';
import { BeatmapService } from './beatmap.service';
import { BeatmapExportService } from './beatmap-export.service';
import { AssetsService } from '../assets/assets.service';
import { MapsetTransformer } from './mapset.transformer';
import { BeatmapTransformer } from './beatmap.transformer';
import { MapsetService } from './mapset.service';

@Controller('api/mapsets')
export class MapsetController {
  constructor(
    private readonly beatmapImportService: BeatmapImportService,
    private readonly beatmapService: BeatmapService,
    private readonly beatmapExportService: BeatmapExportService,
    private readonly assetsService: AssetsService,
    private readonly beatmapTransformer: BeatmapTransformer,
    private readonly mapsetTransformer: MapsetTransformer,
    private readonly mapsetService: MapsetService,
  ) {}

  @Get('/own')
  @UseGuards(AuthGuard)
  async getOwnMapsets(@Req() request: Request) {
    const mapsets = await this.mapsetService.findByCreatorId(
      request.session.user!.id,
    );

    return Promise.all(
      mapsets.map((mapset) => this.mapsetTransformer.transform(mapset)),
    );
  }

  @Get(':id/export')
  @UseGuards(AuthGuard)
  async export(
    @Req() request: Request,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const mapset = await this.mapsetService.findById(id);
    if (!mapset) return res.sendStatus(404);

    const archive = await this.beatmapExportService.convertMapset(mapset);
    res.header('Content-Type', 'application/zip');
    res.header(
      'Content-Disposition',
      `attachment; filename="${mapset.title}.osz"`,
    );
    archive.generateNodeStream().pipe(res);
  }

  @Get(':id/files/*')
  @UseGuards(AuthGuard)
  async getFile(
    @Req() request: Request,
    @Param('id') id: string,
    @Res() response: Response,
  ) {
    if (!(await this.mapsetService.exists(id)))
      throw new Error('Mapset not found');

    const path = decodeURIComponent(
      request.path.split('/files/').slice(1).join('/'),
    );

    if (path.match(/\.\.\//g) !== null) {
      return response.sendStatus(400);
    }

    if (path.length === 0) return response.sendStatus(400);

    const mapset = await this.mapsetService.findById(id);

    if (!mapset) return response.sendStatus(404);

    const url = await this.assetsService.getAssetUrl(mapset, path);

    if (!url) {
      return response.sendStatus(404);
    }

    return response.redirect(url);
  }

  @Get(':id')
  @UseGuards(AuthGuard)
  async findById(@Req() request: Request, @Param('id') id: string) {
    const mapset = await this.mapsetService.findById(id);
    if (!mapset) throw new Error('Mapset not found');

    if (mapset.creator.id !== request.session.user!.id) {
      throw new ForbiddenException();
    }

    return this.mapsetTransformer.transform(mapset);
  }
}
