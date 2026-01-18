import React, {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
} from "react";
import * as z from "zod";
import { createOption, Option } from "../modules/utils/safeOptions";
import { getDarkModePreference } from "../modules/definitions";
import {
  createStatesObject,
  parseStatesObject,
  UseStateReturn,
} from "../modules/utils";

// Option definitions -----------------------------------------------------------------------------

// IMPORTANT: undefined is used for the default option, so please use null for option types instead

export const optionSchemas = { darkMode: z.boolean() } as const;
export const optionDataSchema = z.object(optionSchemas);

export type OptionSchemas = typeof optionSchemas;
export type OptionName = keyof OptionSchemas;
export type OptionData = z.infer<typeof optionDataSchema>;
export type OptionsDefinitions = {
  [K in OptionName]: Option<OptionSchemas[K]>;
};

const DEFAULT_OPTION_VALUES: OptionData = {
  darkMode: await (async (): Promise<boolean> =>
    window && window.matchMedia
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
      : await getDarkModePreference(
          undefined,
          (
            await chrome.tabs.query({})
          )[0].id!
        ))(),
};

// This function is kinda a mess for type safety but it returns an
// object of `Option` types (from safeOptions util)
const populateOptionDefinitions = <T extends { [key: string]: z.ZodType }>(
  schemas: T
): {
  [K in keyof T]: Option<T[K]>;
} => {
  const options = {} as any;
  for (const optionName in schemas) {
    const schema = schemas[optionName];
    options[optionName] = createOption(
      optionName,
      schema,
      DEFAULT_OPTION_VALUES[optionName as OptionName] as z.infer<typeof schema>
    );
  }
  return options;
};
const optionDefinitions: OptionsDefinitions =
  populateOptionDefinitions(optionSchemas);

// Context and hook -------------------------------------------------------------------------------

type SetOptionFunction = <K extends OptionName>(
  option: K,
  newValue: z.infer<OptionSchemas[K]> | undefined
) => Promise<void>;
type OptionsContextType = { options: OptionData; setOption: SetOptionFunction };
const OptionsDataContext = createContext<OptionsContextType | null>(null);

export function OptionsProvider({ children }: PropsWithChildren) {
  const optionStates = createStatesObject(DEFAULT_OPTION_VALUES);

  useEffect(() => {
    const removeListenerFunctions: (() => void)[] = [];

    const addOptionListeners = <
      D extends { [key: string]: Option<any> },
      S extends { [K in keyof D]: UseStateReturn<any> }
    >(
      optionDefinitions: D,
      optionStates: S
    ) => {
      for (const optionName in optionDefinitions) {
        const removeListener = optionDefinitions[optionName].onUpdate(
          (newValue) => optionStates[optionName][1](newValue)
        );
        removeListenerFunctions.push(removeListener);
      }
    };

    addOptionListeners(optionDefinitions, optionStates);

    // Set initial values for state
    Object.entries(optionStates).forEach(([option, [, setOption]]) => {
      const optionName = option as keyof typeof optionStates;
      optionDefinitions[optionName]
        .get()
        .then((initialValue) => setOption(initialValue));
    });

    return () => removeListenerFunctions.forEach((f) => f());
  }, []);

  const setOption: SetOptionFunction = (option, newValue) =>
    optionDefinitions[option].set(newValue);
  return (
    <OptionsDataContext.Provider
      value={{ options: parseStatesObject(optionStates), setOption }}
    >
      {children}
    </OptionsDataContext.Provider>
  );
}

export default function useOptions(): OptionsContextType {
  const optionsContext = useContext(OptionsDataContext);
  if (!optionsContext)
    throw Error("Must call useOptions as child of OptionsProvider");
  return optionsContext;
}
