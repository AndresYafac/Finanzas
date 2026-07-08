import React from 'react';

export function useFormState(initialValues = {}, validate) {
  const [values, setValues] = React.useState(initialValues);
  const [errors, setErrors] = React.useState({});

  const setField = React.useCallback((field, value) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }, []);

  const reset = React.useCallback((nextValues = initialValues) => {
    setValues(nextValues);
    setErrors({});
  }, [initialValues]);

  const validateForm = React.useCallback(() => {
    const nextErrors = validate ? validate(values) || {} : {};
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }, [validate, values]);

  return { values, setValues, setField, errors, setErrors, reset, validateForm };
}

