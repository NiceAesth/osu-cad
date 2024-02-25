import { Module } from '@nestjs/common';
import { BeatmapModule } from './beatmap/beatmap.module';
import { UserModule } from './users/user.module';
import { AuthModule } from './auth/auth.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EditorModule } from './editor/editor.module';
import { OsuModule } from './osu/osu.module';
import * as path from 'path';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { PreferencesModule } from './preferences/preferences.module';
import { MongooseModule } from '@nestjs/mongoose';
import { dbdatasource } from './datasource';
import { AppController } from './app.controller';
import { AssetsModule } from './assets/assets.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: path.resolve(__dirname, '../../../.env'),
    }),
    TypeOrmModule.forRoot(dbdatasource),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const host = config.get('MONGODB_HOST', 'mongodb');
        const port = config.get('MONGODB_PORT', 27017);
        return {
          uri: `mongodb://${host}:${port}/osucad`,
        };
      },
    }),
    ServeStaticModule.forRoot({
      rootPath: path.resolve(__dirname, '../../client/dist'),
    }),
    BeatmapModule,
    UserModule,
    AuthModule,
    EditorModule,
    OsuModule,
    PreferencesModule,
    AssetsModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
