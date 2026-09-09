export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export class DatabaseNotConfiguredError extends AppError {
  constructor() {
    super(503, 'DATABASE_NOT_CONFIGURED', 'Cơ sở dữ liệu chưa được cấu hình')
  }
}
