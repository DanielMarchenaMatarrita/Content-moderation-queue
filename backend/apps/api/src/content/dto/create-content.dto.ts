import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateContentDto {
  @ApiProperty({
    format: 'uuid',
    description:
      'Existing user ID. A future authentication layer will derive this from the authenticated principal.',
  })
  @IsUUID()
  userId: string;

  @ApiProperty({ maxLength: 10_000, example: 'A normal text submission.' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(10_000)
  body: string;
}
