export type FieldMapping = {
  simpleField: string;
  originalField: string;
};

export const demoTemplate = {
  fieldMappings: [
    {
      simpleField: "Full Name",
      originalField: "Original website name field"
    },
    {
      simpleField: "NIC Number",
      originalField: "Original website identity field"
    },
    {
      simpleField: "Mobile Number",
      originalField: "Original website contact number field"
    },
    {
      simpleField: "Vehicle Number",
      originalField: "Original website vehicle registration field"
    },
    {
      simpleField: "Province",
      originalField: "Original website province dropdown"
    }
  ] satisfies FieldMapping[]
};
