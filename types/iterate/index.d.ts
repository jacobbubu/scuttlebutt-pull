declare module 'iterate' {
  namespace Iterate {
    type Iterator = (value: any, key: string, obj: Object) => void
    export const each: (obj: Object, iterator: Iterator) => void
  }
  export = Iterate
}
