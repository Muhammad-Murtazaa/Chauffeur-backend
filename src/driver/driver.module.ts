import { Module } from '@nestjs/common';
import { DriverController } from './driver.controller';
import { DriverService } from './driver.service';
import { DatabaseModule } from '../database';
import { AuthModule } from '../auth';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [DriverController],
  providers: [DriverService],
  exports: [DriverService],
})
export class DriverModule {}
