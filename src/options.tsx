import React, { ReactElement, useState } from "react";
import { createRoot } from "react-dom/client";
import * as z from "zod";
import useOptions, { optionSchemas, OptionsProvider } from "./hooks/useOptions";
import setTheme from "./modules/setTheme";
import ReactSwitch from "react-switch";
import { MdKeyboardArrowDown } from "react-icons/md";
import { FaGithub } from "react-icons/fa";

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
      <div
        className="bar dropdown-header"
        onClick={() => setDetailsIsOpen(!detailsIsOpen)}
      >
        <div className="bar">
          <MdKeyboardArrowDown
            className={`medium-icon ${
              detailsIsOpen ? "dropdown-arrow-down" : "dropdown-arrow-right"
            }`}
          />
          <label htmlFor={field}>
            <h3>{info.label}</h3>
          </label>
        </div>
        <div
          onClick={
            (e) => e.stopPropagation() // Hacky hack so it doesn't trigger bar toggle
          }
        >
          {primaryInput}
        </div>
        {error && <p className="form__error">{error.message}</p>}
      </div>

      <div className={`dropdown-content ${detailsIsOpen ? "" : "hidden"}`}>
        <div className="bar">
          <p>{info.description}</p>
          <a className="btn" onClick={setDefault}>
            Reset
          </a>
        </div>
      </div>
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
    <form className="list medium-gap">
      <div className="list no-gap">
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
      <div className="bar">
        <div />
        <a
          className="btn"
          onClick={() =>
            Object.keys(data).forEach((field) =>
              resetField(field as keyof typeof data)
            )
          }
        >
          Reset all
        </a>
      </div>
    </form>
  );
}

function Options() {
  const { options, setOption } = useOptions();

  setTheme(options.darkMode);

  const optionInfos = {
    darkMode: {
      label: "Dark Mode",
      description: "Use dark theme for UI.",
    },
  };

  return (
    <>
      <Form
        data={options}
        schemas={optionSchemas}
        setField={setOption}
        resetField={(field) => setOption(field, undefined)}
        fieldInfos={optionInfos}
      />

      <hr />
      <div className="bar">
        <p>
          AutoRewards is an extension to automate gathering rewards for a
          handful of platforms.
        </p>
        <a
          onClick={() =>
            chrome.tabs.create({
              active: true,
              url: "https://github.com/uss-stargazer/auto-rewards-extension",
            })
          }
        >
          <FaGithub className="large-icon" />
        </a>
      </div>
    </>
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
