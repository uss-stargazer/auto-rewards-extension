import React, { ReactElement, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import * as z from "zod";
import useOptions, {
  OptionData,
  optionDataSchema,
  OptionName,
  optionSchemas,
  OptionsProvider,
} from "./hooks/useOptions";
import setTheme from "./modules/setTheme";
import ReactSwitch from "react-switch";
import { devLog, simpleDeepCompare } from "./modules/utils";

type InputInfo = {
  label: string;
  placeholder?: string;
  description: string;
};

function FormInput<S extends z.ZodType>({
  field,
  schema,
  value,
  setValue,
  setDefault,
  info,
}: {
  field: string;
  schema: S;
  value: z.infer<S>;
  setValue: (newValue: z.infer<S>) => void;
  setDefault: () => void;
  info: InputInfo;
}) {
  const [error, setError] = useState<z.ZodError<z.infer<S>> | null>(null);
  const [detailsIsOpen, setDetailsIsOpen] = useState<boolean>(false);

  const onInput = (input: unknown) => {
    const parsed = schema.safeParse(input);
    if (parsed.success) {
      setError(null);
      setValue(parsed.data);
    } else {
      setError(parsed.error);
    }
  };

  const primaryInput: ReactElement =
    schema instanceof z.ZodString ? (
      <input
        type="text"
        value={value as z.infer<typeof schema>}
        placeholder={info.placeholder}
        className={`form__input ${error && "border-red-500"} `}
        onChange={(event) => onInput(event.target.value)}
      />
    ) : schema instanceof z.ZodBoolean ? (
      <ReactSwitch
        checked={value as z.infer<typeof schema>}
        onChange={onInput}
      />
    ) : (
      (() => {
        throw new Error(
          `Input type for schema is not defined (schema: ${schema})`
        );
      })()
    );

  return (
    <div>
      <div className="option-bar">
        <div onClick={() => setDetailsIsOpen(!detailsIsOpen)}>
          Dropdown icon
        </div>
        <div>
          <label htmlFor={field} className="form__label">
            {info.label}
          </label>
          {primaryInput}
        </div>
        {error && <p className="form__error">{error.message}</p>}
      </div>
      {detailsIsOpen && (
        <div className="option-details" onClick={() => setDetailsIsOpen(false)}>
          <p>{info.description}</p>
          <a className="btn" onClick={setDefault}>
            Reset to default
          </a>
        </div>
      )}
    </div>
  );
}

function Form<D extends { [key: string]: any }>({
  data,
  schemas,
  setField,
  resetField,
  fieldInfos,
}: {
  data: D;
  schemas: { [K in keyof D]: z.ZodType<D[K]> };
  setField: <F extends keyof D>(
    field: F,
    newValue: z.infer<(typeof schemas)[F]>
  ) => void;
  resetField: <F extends keyof D>(field: F) => void;
  fieldInfos: { [K in keyof D]: InputInfo };
}) {
  return (
    <form>
      <div className="grid grid-cols-3 gap-4">
        {Object.entries(data).map(([key, value]) => {
          const field = key as keyof typeof data;
          return (
            <FormInput
              key={key}
              field={field.toString()}
              schema={schemas[field]}
              value={data[field]}
              setValue={(newValue) => setField(field, newValue)}
              setDefault={() => resetField(field)}
              info={fieldInfos[field]}
            />
          );
        })}
      </div>
      <a
        onClick={() =>
          Object.keys(data).forEach((field) =>
            resetField(field as keyof typeof data)
          )
        }
      >
        Reset defaults
      </a>
    </form>
  );
}

function Options() {
  const { options, setOption } = useOptions();
  devLog("Options", "options:", options);

  setTheme(options.darkMode);

  const optionInfos = {
    darkMode: {
      label: "Dark Mode",
      description: "Use dark theme for UI",
    },
  };

  return (
    <div>
      <h1>Options</h1>
      <div>
        <Form
          data={options}
          schemas={optionSchemas}
          setField={setOption}
          resetField={(field) => setOption(field, undefined)}
          fieldInfos={optionInfos}
        />
      </div>
      <div>
        <p>
          AutoRewards is an extension to automate gathering rewards for a
          handful of platforms.
        </p>
        <p>
          Contribute at https://github.com/uss-stargazer/auto-rewards-extension
        </p>
      </div>
    </div>
  );
}

const root = createRoot(document.getElementById("root")!);

root.render(
  <React.StrictMode>
    <OptionsProvider>
      <Options />
    </OptionsProvider>
  </React.StrictMode>
);
