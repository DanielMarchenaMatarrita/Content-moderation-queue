import { IsEnum, IsInt, Matches, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { SimulationScenario } from '../../../../../generated/prisma/client.js';

export class CreatePaymentOrderDto {
  @ApiProperty({ minimum: 1, example: 1500 })
  @IsInt()
  @Min(1)
  amount: number;

  @ApiProperty({ pattern: '^[A-Z]{3}$', example: 'USD' })
  @Matches(/^[A-Z]{3}$/)
  currency: string;

  @ApiProperty({ enum: SimulationScenario })
  @IsEnum(SimulationScenario)
  simulationScenario: (typeof SimulationScenario)[keyof typeof SimulationScenario];
}
