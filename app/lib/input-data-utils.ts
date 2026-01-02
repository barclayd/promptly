interface InputDataState {
  inputData: unknown;
  inputDataRootName: string | null;
}

interface RemoveFieldsResult {
  inputData: unknown;
  inputDataRootName: string | null;
}

export const reconstructFullData = (
  inputData: unknown,
  rootName: string | null,
): Record<string, unknown> => {
  if (rootName) {
    return { [rootName]: inputData };
  }
  return (inputData ?? {}) as Record<string, unknown>;
};

export const removeFieldsFromInputData = (
  state: InputDataState,
  fieldsToRemove: string[],
): RemoveFieldsResult => {
  const { inputData, inputDataRootName } = state;
  const fullData = reconstructFullData(inputData, inputDataRootName);

  const filteredEntries = Object.entries(fullData).filter(
    ([key]) => !fieldsToRemove.includes(key),
  );

  const newData = Object.fromEntries(filteredEntries);

  if (!inputDataRootName) {
    return { inputData: newData, inputDataRootName: null };
  }

  const rootValue = newData[inputDataRootName];
  if (rootValue !== undefined) {
    return { inputData: rootValue, inputDataRootName };
  }

  return { inputData: {}, inputDataRootName: null };
};
