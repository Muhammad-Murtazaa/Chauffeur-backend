import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { QuoteService } from './quote.service';
import { CreateQuoteDto } from '../dto';
import { JwtOptionalGuard } from '../../auth/guards/jwt-optional.guard';

@ApiTags('Quotes & Pricing')
@Controller('quotes')
export class QuoteController {
  constructor(private readonly quoteService: QuoteService) {}

  @Post()
  @UseGuards(JwtOptionalGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Request instant ride quote and available vehicle options' })
  @ApiResponse({ status: 201, description: 'Quote generated with 15-minute expiration' })
  async createQuote(@Body() dto: CreateQuoteDto, @Req() req: any) {
    const customerId = req?.user?.id || null;
    return this.quoteService.createQuote(dto, customerId);
  }

  @Get('vehicle-types')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get available vehicle categories and base rates' })
  async getVehicleTypes() {
    return this.quoteService.getVehicleTypes();
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get quote details and remaining validity time' })
  @ApiResponse({ status: 200, description: 'Quote details returned' })
  async getQuote(@Param('id', ParseIntPipe) id: number) {
    return this.quoteService.getQuote(id);
  }
}
