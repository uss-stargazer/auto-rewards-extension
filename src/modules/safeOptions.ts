import * as z from "zod";

let browserEnv: typeof chrome;
if (typeof chrome !== "undefined") {
  browserEnv = chrome;
  // @ts-ignore
} else if (typeof browser !== "undefined") {
  // @ts-ignore
  browserEnv = browser;
}

type Callback<Value> = (newValue: Value) => void;
type Subscriber<Value> = (callback: Callback<Value>) => () => void; // Returns function to remove subscriber

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
  schema: Z,
  name: string,
  defaultValue: z.infer<Z>
): [
  (newValue: z.infer<Z> | "default") => Promise<void>,
  () => Promise<z.infer<Z>>,
  Subscriber<z.infer<Z>>
] => {
  type Data = z.infer<Z>;
  const defaultValueString = JSON.stringify(defaultValue);

  const setOption = async (newValue: Data | "default"): Promise<void> => {
    const valueString =
      newValue === "default" ? defaultValueString : JSON.stringify(newValue);
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

  return [setOption, getOption, subscribe];
};
