export const logClientError = (code: string, error?: unknown) => {
  if (import.meta.env.DEV) {
    console.error(code, error);
    return;
  }

  console.error(code);
};
