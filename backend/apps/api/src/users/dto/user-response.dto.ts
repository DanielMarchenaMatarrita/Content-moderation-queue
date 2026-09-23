import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../../../../generated/prisma/client.js';

export class UserResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  displayName: string;

  @ApiProperty({ enum: UserRole })
  role: (typeof UserRole)[keyof typeof UserRole];

  @ApiProperty({ format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt: Date;
}

export class UserListResponseDto {
  @ApiProperty({ type: () => UserResponseDto, isArray: true })
  items: UserResponseDto[];

  @ApiProperty({ minimum: 1 })
  page: number;

  @ApiProperty({ minimum: 1, maximum: 100 })
  limit: number;

  @ApiProperty({ minimum: 0 })
  total: number;
}
