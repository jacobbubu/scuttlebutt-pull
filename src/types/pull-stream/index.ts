declare module 'pull-stream2' {
  type EndOrError = Error | boolean | null
  type SourceCallback = <T>(endOrError: EndOrError, data: T) => any
  export { EndOrError, SourceCallback }
}
