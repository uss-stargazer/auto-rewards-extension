import React, { ReactElement, useEffect } from "react";
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
import {
  Controller,
  FieldErrors,
  FormProvider,
  SubmitHandler,
  useForm,
  useFormContext,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ErrorMessage } from "@hookform/error-message";
import ReactSwitch from "react-switch";
import { devLog, simpleDeepCompare } from "./modules/utils";

const optionDetails: {
  [K in OptionName]: {
    label: string;
    placeholder?: string;
    description: string;
  };
} = { darkMode: { label: "Dark Mode", description: "Use dark theme for UI" } };

function InputErrorMessage({
  errors,
  name,
}: {
  name: OptionName;
  errors: FieldErrors<OptionData>;
}) {
  return (
    <ErrorMessage
      errors={errors}
      name={name}
      render={({ message }) => <p className="form__error">{message}</p>}
    />
  );
}

function Input({
  optionName,
  errors,
}: {
  optionName: OptionName;
  errors: FieldErrors<OptionData>;
}) {
  const { register, control } = useFormContext();

  const schema = optionSchemas[optionName];
  const details = optionDetails[optionName];

  let primaryInput: ReactElement;
  if (schema instanceof z.ZodString) {
    primaryInput = (
      <input
        type="text"
        {...register(optionName)}
        ref={null}
        placeholder={details.placeholder}
        className={`form__input ${
          Object.prototype.hasOwnProperty.call(errors, optionName) &&
          "border-red-500"
        } `}
      />
    );
  } else if (schema instanceof z.ZodBoolean) {
    primaryInput = (
      <Controller
        {...register(optionName)}
        control={control}
        render={({ field }) => {
          devLog("switchRender", optionName, "setting switch to", field.value);
          return (
            <ReactSwitch onChange={field.onChange} checked={field.value} />
          );
        }}
      />
    );
  } else {
    throw new Error(`Input type for schema is not defined (schema: ${schema})`);
  }

  return (
    <div>
      <div>
        <label htmlFor={optionName} className="form__label">
          {details.label}
        </label>
        {primaryInput}
      </div>
      <InputErrorMessage name={optionName} errors={errors} />
    </div>
  );
}

function OptionsForm() {
  const { options, setOption } = useOptions();

  const methods = useForm<OptionData>({
    // mode: "onChange",
    defaultValues: options,
    resolver: zodResolver(optionDataSchema),
  });
  const {
    formState: { errors },
    watch,
  } = methods;

  const watchedFormOptions = watch();

  useEffect(() => {
    Object.entries(watchedFormOptions).forEach(([name, value]) => {
      const optionName = name as keyof typeof watchedFormOptions;
      if (!simpleDeepCompare(value, options[optionName]))
        setOption(optionName, value);
    });
  }, [watchedFormOptions]);

  return (
    <FormProvider {...methods}>
      <form>
        <div className="grid grid-cols-3 gap-4">
          {Object.keys(options).map((optionName) => (
            <Input
              key={optionName}
              optionName={optionName as keyof typeof options}
              errors={errors}
            />
          ))}
        </div>
      </form>
    </FormProvider>
  );
}

function Options() {
  const { options, setOption } = useOptions();
  devLog("Options", "options:", options);

  setTheme(options.darkMode);

  const resetOptions = () =>
    Object.keys(options).forEach((name) =>
      setOption(name as keyof typeof options, undefined)
    );

  return (
    <div>
      <h1>Options</h1>
      <div>
        <OptionsForm />
      </div>
      <a onClick={resetOptions}>Reset to defaults</a>
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
