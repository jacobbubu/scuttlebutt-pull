export interface LoggerService {
  error(...argv: any[]): void
  warn(...argv: any[]): void
  info(...argv: any[]): void
  debug(...argv: any[]): void
  createSubLogger(context?: any, isTimestampEnabled?: boolean): LoggerService
}
