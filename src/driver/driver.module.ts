import { Module } from '@nestjs/common';
import { DriverController } from './driver.controller';
import { DriverService } from './driver.service';
import { DatabaseModule } from '../database';
import { AuthModule } from '../auth';
import { BookingModule } from '../booking';

@Module({
  imports: [DatabaseModule, AuthModule, BookingModule],
  controllers: [DriverController],
  providers: [DriverService],
  exports: [DriverService],
})
export class DriverModule {}
