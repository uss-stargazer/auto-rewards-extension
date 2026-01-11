import React, { createContext, PropsWithChildren, useContext } from "react";

export interface FormContextType<D extends { [key: string]: any }> {
  fields: D;
  setField: <F extends keyof D>(field: F, newValue: D[F]) => void;
  setDefaultFields: () => void;
}

export default function createForm<D extends { [key: string]: any }>(): {
  FormProvider: React.FC<PropsWithChildren<FormContextType<D>>>;
  useForm: () => FormContextType<D>;
  FormContext: React.Context<FormContextType<D> | null>;
} {
  const FormContext = createContext<null | FormContextType<D>>(null);

  function FormProvider({
    fields,
    setField,
    setDefaultFields,
    children,
  }: PropsWithChildren<FormContextType<D>>) {
    return (
      <FormContext.Provider value={{ fields, setField, setDefaultFields }}>
        {children}
      </FormContext.Provider>
    );
  }

  function useForm(): FormContextType<D> {
    const formContext = useContext(FormContext);
    if (!formContext)
      throw new Error("useForm must be called in child of FormProvider");
    return formContext;
  }

  return {
    FormProvider,
    useForm,
    FormContext,
  };
}
