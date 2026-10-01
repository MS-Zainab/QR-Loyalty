export const logClientError = (context, error) => {
  const details = {};

  if (Number.isInteger(error?.response?.status)) {
    details.status = error.response.status;
  }

  if (typeof error?.code === 'string') {
    details.code = error.code;
  }

  if (typeof error?.name === 'string') {
    details.name = error.name;
  }

  console.error(context, details);
};
