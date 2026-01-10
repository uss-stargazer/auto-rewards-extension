import * as z from "zod";

// IMPORTANT: undefined is used for the default option, so please use null for option types instead

let browserEnv: typeof chrome;
if (typeof chrome !== "undefined") {
  browserEnv = chrome;
  // @ts-ignore
} else if (typeof browser !== "undefined") {
  // @ts-ignore
  browserEnv = browser;
}

type Callback<Value> = (newValue: Value) => void;
type SetFunction<Value> = (newValue: Value | undefined) => Promise<void>;
type GetFunction<Value> = () => Promise<Value>;
type Subscriber<Value> = (callback: Callback<Value>) => () => void; // Returns function to remove subscriber

export interface Option<Z extends z.ZodType> {
  schema: Z;
  set: SetFunction<z.infer<Z>>;
  get: GetFunction<z.infer<Z>>;
  onUpdate: Subscriber<z.infer<Z>>;
}

const makeListener =
  <Z extends z.ZodType>(
    callback: Callback<z.infer<Z>>,
    schema: Z,
    name: string,
    defaultValueString: string
  ): ((changes: { [key: string]: chrome.storage.StorageChange }) => void) =>
  (changes) => {
    const change = changes[name];
    if (change !== undefined) {
      const valueString = (change.newValue ?? defaultValueString) as string;
      callback(schema.parse(JSON.parse(valueString)));
    }
  };

export const createOption = <Z extends z.ZodType>(
  name: string,
  schema: Z,
  defaultValue: z.infer<Z>
): Option<Z> => {
  type Data = z.infer<Z>;
  const defaultValueString = JSON.stringify(defaultValue);

  const setOption = async (newValue: Data | undefined): Promise<void> => {
    const valueString =
      newValue === undefined ? defaultValueString : JSON.stringify(newValue);
    return await browserEnv.storage.sync.set({ [name]: valueString });
  };

  const getOption = async (): Promise<Data> => {
    const valueString = (
      await browserEnv.storage.sync.get({
        [name]: defaultValueString,
      })
    )[name] as string;
    return schema.parse(JSON.parse(valueString));
  };

  const subscribe: Subscriber<Data> = (callback) => {
    const listener = makeListener(callback, schema, name, defaultValueString);
    browserEnv.storage.sync.onChanged.addListener(listener);
    return () => browserEnv.storage.sync.onChanged.removeListener(listener);
  };

  return { schema, get: getOption, set: setOption, onUpdate: subscribe };
};
