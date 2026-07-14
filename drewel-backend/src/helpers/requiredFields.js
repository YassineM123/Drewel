export const checkRequiredFields = (fields, body) => {
  console.log(body);
  const missingFields = fields.filter(field => !body[field]);
  return {
    isValid: missingFields.length === 0,
    missingFields,
  };
};