import {Injectable} from "@nestjs/common";
import {InjectRepository} from "@nestjs/typeorm";
import {Repository} from "typeorm";
import {Beatmap, BeatmapSet} from "./beatmap.entity";
import {promisify} from "util";
import {readdir, readFile, rename} from "fs";
import {User} from "../user/user.entity";
import * as path from "path";
import {BeatmapDecoder} from 'osu-parsers'
import {Beatmap as ParsedBeatmap, HitType, ISlidableObject, PathType} from 'osu-classes'
import {TimingPointV1} from "./schema/timing.schema";
import {HitObjectV1} from "./schema/hitobject.schema";
import {SliderControlPointKind} from "osucad-gameserver";

@Injectable()
export class BeatmapService {

    constructor(
        @InjectRepository(Beatmap)
        private readonly beatmapRepository: Repository<Beatmap>,
        @InjectRepository(BeatmapSet)
        private readonly beatmapSetRepository: Repository<BeatmapSet>
    ) {
    }

    async importFromDirectory(directory: string, user: User): Promise<BeatmapSet | null> {
        const files = await promisify(readdir)(directory)

        const beatmapContents = await Promise.all(files
            .filter(filename => filename.endsWith('.osu'))
            .map(filename => promisify(readFile)(path.resolve(directory, filename), 'utf-8'))
        )
        const decoder = new BeatmapDecoder()

        const parsedBeatmaps = beatmapContents.map(content => decoder.decodeFromString(content))

        if (parsedBeatmaps.length === 0)
            return null

        const mapSet = new BeatmapSet()

        mapSet.artist = parsedBeatmaps[0].metadata.artist
        mapSet.artistUnicode = parsedBeatmaps[0].metadata.artistUnicode
        mapSet.title = parsedBeatmaps[0].metadata.title
        mapSet.titleUnicode = parsedBeatmaps[0].metadata.titleUnicode

        mapSet.difficulties = parsedBeatmaps.map(it => this.importBeatmap(it))

        mapSet.owner = user

        await this.beatmapSetRepository.save(mapSet)

        await Promise.all(mapSet.difficulties.map(async it => {
            it.mapSet = mapSet
            await this.beatmapRepository.save(it)
            it.mapSet = undefined
        }))


        await promisify(rename)(directory, path.resolve(directory, '..', mapSet.id))

        return mapSet
    }

    importBeatmap(parsed: ParsedBeatmap): Beatmap {
        const beatmap = new Beatmap()
        beatmap.difficultyName = parsed.metadata.version

        const timingPoints: TimingPointV1[] = []

        parsed.controlPoints.timingPoints.forEach(it => {
            timingPoints.push({
                time: it.startTime,
                timing: {
                    bpm: it.bpm,
                    signature: it.timeSignature
                },
            })
        })

        parsed.controlPoints.difficultyPoints.forEach(it => {
            let timingPoint = timingPoints.find(t => t.time === it.startTime)
            if (!timingPoint) {
                timingPoint = {
                    time: it.startTime,
                }
                timingPoints.push(timingPoint)
            }
            timingPoint.sv = it.sliderVelocity
        })

        beatmap.beatmapData = {
            version: 1,
            difficulty: {
                hpDrainRate: parsed.difficulty.drainRate,
                circleSize: parsed.difficulty.circleSize,
                overallDifficulty: parsed.difficulty.overallDifficulty,
                approachRate: parsed.difficulty.approachRate,
                sliderMultiplier: parsed.difficulty.sliderMultiplier,
                sliderTickRate: parsed.difficulty.sliderTickRate
            },
            timingPoints,
            hitObjects: parsed.hitObjects.map(it => {
                if ((it.hitType & HitType.Normal) !== 0) {
                    const hitObject: HitObjectV1 = {
                        startTime: it.startTime,
                        position: {x: it.startPosition.x, y: it.startPosition.y},
                        newCombo: (it.hitType & HitType.NewCombo) !== 0,
                        selectedBy: null,
                        data: {
                            type: 'circle'
                        }
                    }
                    return hitObject
                } else if ((it.hitType & HitType.Slider) !== 0) {
                    const slider = it as unknown as ISlidableObject
                    const hitObject: HitObjectV1 = {
                        startTime: it.startTime,
                        position: {x: it.startPosition.x, y: it.startPosition.y},
                        newCombo: (it.hitType & HitType.NewCombo) !== 0,
                        selectedBy: null,
                        data: {
                            type: 'slider',
                            controlPoints: slider.path.controlPoints.map(c => {
                                let kind: SliderControlPointKind = 'none'
                                switch (c.type) {
                                    case PathType.Bezier:
                                        kind = 'bezier';
                                        break;
                                    case PathType.Catmull:
                                        kind = 'bezier';
                                        break;
                                    case PathType.Linear:
                                        kind = 'linear';
                                        break;
                                    case PathType.PerfectCurve:
                                        kind = 'circle';
                                        break;
                                }
                                return {
                                    kind,
                                    position: {x: c.position.x + it.startPosition.x, y: c.position.y + it.startPosition.y}
                                }
                            }),
                            expectedDistance: slider.path.expectedDistance,
                            repeats: slider.repeats + 1
                        }
                    }
                    return hitObject
                }
            }).filter(it => it) as HitObjectV1[]
        }

        return beatmap
    }

    importBeatmapOld(parsed: any): Beatmap {
        const beatmap = new Beatmap()

        beatmap.difficultyName = parsed.Version

        beatmap.beatmapData = {
            difficulty: {
                hpDrainRate: parseFloat(parsed.HPDrainRate),
                circleSize: parseFloat(parsed.CircleSize),
                overallDifficulty: parseFloat(parsed.OverallDifficulty),
                approachRate: parseFloat(parsed.ApproachRate),
                sliderMultiplier: parseFloat(parsed.SliderMultiplier),
                sliderTickRate: parseFloat(parsed.SliderTickRate)
            },

            hitObjects: parsed.hitObjects.map(it => {
                let controlPoints = undefined;
                if (it.points) {
                    controlPoints = []

                    let shouldSkip = false

                    it.points.forEach(([x, y], i, arr) => {
                        if (shouldSkip) {
                            shouldSkip = false
                            return
                        }
                        const position = {x, y}

                        let kind = i === 0 ? 1 : 0
                        if (arr[i + 1] && arr[i + 1][0] === x && arr[i + 1][1] === y) {
                            shouldSkip = true
                            kind = 1
                        }
                        if (i === 0 && it.curveType === 'pass-through')
                            kind = 3

                        controlPoints.push({
                            position,
                            kind
                        })
                    })

                }

                return {
                    type: it.objectName,
                    time: it.startTime,
                    position: {x: it.position[0], y: it.position[1]},
                    repeatCount: it.repeatCount,
                    expectedDistance: it.pixelLength,
                    curveType: it.curveType,
                    controlPoints: controlPoints,//: it.points?.map(([x, y]) => ({x, y})),
                    newCombo: it.newCombo,
                }
            }),
            timingPoints: parsed.timingPoints.map(it => {
                let t: any = {
                    sv: it.velocity,
                    time: it.offset,
                    volume: it.volume
                }
                if (it.timingChange) {
                    t.timing = {
                        bpm: it.bpm,
                        signature: it.timingSignature,
                    }
                }
                return t
            })
        }

        return beatmap
    }

    findBeatmapById(id: string) {
        return this.beatmapRepository.findOne({
            where: {id},
            relations: {mapSet: true}
        })
    }

    findSetsByOwner(owner: User) {
        return this.beatmapSetRepository.find({
            where: {owner},
            relations: {difficulties: true}
        })
    }

    async updateBeatmap(beatmap: Beatmap) {
        this.beatmapRepository.save(beatmap)
    }
}