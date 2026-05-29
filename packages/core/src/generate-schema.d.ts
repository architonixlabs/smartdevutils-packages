declare module 'generate-schema' {
  interface SchemaOptions {
    [key: string]: any;
  }

  export const json: (data: any, options?: SchemaOptions) => any;
  export const mongoose: (data: any, options?: SchemaOptions) => any;

  export default {
    json: (data: any, options?: SchemaOptions) => any,
  };
}
