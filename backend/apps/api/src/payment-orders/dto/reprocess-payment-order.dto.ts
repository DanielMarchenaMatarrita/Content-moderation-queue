import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { SimulationScenario } from '../../../../../generated/prisma/client.js';

export class ReprocessPaymentOrderDto {
  @ApiProperty({ enum: SimulationScenario, example: SimulationScenario.SUCCESS })
  @IsEnum(SimulationScenario)
  scenario: (typeof SimulationScenario)[keyof typeof SimulationScenario];
}
