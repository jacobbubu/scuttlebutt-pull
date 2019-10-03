import * as clc from 'cli-color'
import { formatWithOptions } from 'util'
import supportsColor = require('supports-color')
import { LoggerService } from '../interfaces'

const format = (f: string, ...argv: any[]) => {
  return formatWithOptions({ colors: supportsColor.stdout }, f, ...argv)
}

type LogLevel = 'ERROR' | 'WARN' | 'INFO' | 'DEBUG'

const toColoredContext = (context: string) => {
  const MaxLength = 12
  let output = context
  if (output.length > MaxLength) {
    output = output.slice(0, MaxLength - 1) + '…'
  }
  output = output.padEnd(MaxLength, ' ')
  return supportsColor.stdout ? clc.green.underline(output) : output
}

const toColoredLogLevel = (level: LogLevel) => {
  let output = '[' + level.padStart(5, ' ') + ']'
  if (!supportsColor.stdout) return output

  switch (level) {
    case 'ERROR':
      output = clc.red(output)
      break
    case 'WARN':
      output = clc.yellow(output)
      break
    case 'INFO':
      output = clc.green(output)
      break
    case 'DEBUG':
      output = clc.cyan(output)
      break
  }
  return output
}

export class Logger implements LoggerService {
  private static lastTimestamp?: number
  private _context = ''

  constructor(context?: any, private readonly isTimestampEnabled = false) {
    if (context) {
      this._context = format(context)
    }
  }

  error(...argv: any[]) {
    this.printMessage('ERROR', this._context, this.isTimestampEnabled, ...argv)
  }

  warn(...argv: any[]) {
    this.printMessage('WARN', this._context, this.isTimestampEnabled, ...argv)
  }

  info(...argv: any[]) {
    this.printMessage('INFO', this._context, this.isTimestampEnabled, ...argv)
  }

  debug(...argv: any[]) {
    this.printMessage('DEBUG', this._context, this.isTimestampEnabled, ...argv)
  }

  createSubLogger(context?: any, isTimestampEnabled = false) {
    let newContext = ''
    if (context) {
      if (this._context) {
        newContext = this._context + '/' + format(context)
      } else {
        newContext = format(context)
      }
    }
    return new Logger(newContext, isTimestampEnabled || this.isTimestampEnabled)
  }

  private printMessage(
    level: LogLevel,
    context: string = '',
    isTimeDiffEnabled: boolean = true,
    ...argv: any
  ) {
    process.stdout.write(toColoredLogLevel(level) + ' ')

    const localeStringOptions = {
      year: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      day: '2-digit',
      month: '2-digit'
    }
    const timestamp = new Date(Date.now()).toLocaleString(undefined, localeStringOptions)
    process.stdout.write(`${timestamp} `)

    context && process.stdout.write(toColoredContext(`[${context}]`) + ' ')
    process.stdout.write(format.apply(this, argv))

    this.printTimestamp(isTimeDiffEnabled)
    process.stdout.write(`\n`)
  }

  private printTimestamp(isTimeDiffEnabled?: boolean) {
    const includeTimestamp = Logger.lastTimestamp && isTimeDiffEnabled
    if (includeTimestamp) {
      process.stdout.write(toColoredContext(` +${Date.now() - Logger.lastTimestamp!}ms`))
    }
    Logger.lastTimestamp = Date.now()
  }
}

function noop() {
  /**/
}

class NoopLogger implements LoggerService {
  error(...argv: any[]) {
    noop()
  }

  warn(...argv: any[]) {
    noop()
  }

  info(...argv: any[]) {
    noop()
  }

  debug(...argv: any[]) {
    noop()
  }

  createSubLogger(context?: any, isTimestampEnabled = false) {
    return DefaultNoopLogger
  }
}

export const DefaultNoopLogger = new NoopLogger()
