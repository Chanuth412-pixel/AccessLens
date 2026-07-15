import { useState } from "react";
import { Header } from "./components/Header";
import { MappingPreview } from "./components/MappingPreview";
import { ReviewPanel } from "./components/ReviewPanel";
import { SimpleForm } from "./components/SimpleForm";
import { SiteDetectionCard } from "./components/SiteDetectionCard";
import { demoTemplate } from "./data/demoTemplate";
import { supportedSites } from "./data/supportedSites";

export type FormValues = {
  fullName: string;
  nicNumber: string;
  mobileNumber: string;
  vehicleNumber: string;
  province: string;
};

export type FormErrors = Partial<Record<keyof FormValues, string>>;

const emptyForm: FormValues = {
  fullName: "",
  nicNumber: "",
  mobileNumber: "",
  vehicleNumber: "",
  province: ""
};

function validateForm(values: FormValues): FormErrors {
  const errors: FormErrors = {};
  const phonePattern = /^[0-9+\-\s()]{7,15}$/;
  const mobileDigits = values.mobileNumber.replace(/\D/g, "");

  if (!values.fullName.trim()) {
    errors.fullName = "Full name is required.";
  }

  if (!values.nicNumber.trim()) {
    errors.nicNumber = "NIC number is required.";
  }

  if (!values.mobileNumber.trim()) {
    errors.mobileNumber = "Mobile number is required.";
  } else if (!phonePattern.test(values.mobileNumber.trim()) || mobileDigits.length < 7) {
    errors.mobileNumber = "Enter a valid phone number.";
  }

  if (!values.vehicleNumber.trim()) {
    errors.vehicleNumber = "Vehicle number is required.";
  }

  if (!values.province.trim()) {
    errors.province = "Province is required.";
  }

  return errors;
}

function App() {
  const [formValues, setFormValues] = useState<FormValues>(emptyForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [reviewValues, setReviewValues] = useState<FormValues | null>(null);
  const [prototypeMessage, setPrototypeMessage] = useState("");

  const detectedSite = supportedSites[0];

  function updateField(field: keyof FormValues, value: string) {
    setFormValues((currentValues) => ({
      ...currentValues,
      [field]: value
    }));
  }

  function handleReview() {
    const nextErrors = validateForm(formValues);
    setErrors(nextErrors);
    setPrototypeMessage("");

    if (Object.keys(nextErrors).length === 0) {
      setReviewValues(formValues);
    } else {
      setReviewValues(null);
    }
  }

  function handleFillOriginalForm() {
    setPrototypeMessage(
      "Prototype only: In the next stage, this will fill the matching fields on the original website. The user will still manually submit the form."
    );
  }

  return (
    <main className="app-shell">
      <Header />

      <section className="intro-section">
        <h1>AccessLens</h1>
        <p>
          AccessLens helps users use complex public-service websites through a
          simpler interface.
        </p>
      </section>

      <SiteDetectionCard site={detectedSite} />

      <SimpleForm
        values={formValues}
        errors={errors}
        onChange={updateField}
        onReview={handleReview}
      />

      <ReviewPanel values={reviewValues} />

      <MappingPreview mappings={demoTemplate.fieldMappings} />

      <section className="panel">
        <button className="primary-button" type="button" onClick={handleFillOriginalForm}>
          Fill Original Form
        </button>
        {prototypeMessage && <p className="prototype-message">{prototypeMessage}</p>}
      </section>

      <p className="privacy-note">
        This prototype does not store personal data. Final submission must always
        be confirmed by the user.
      </p>
    </main>
  );
}

export default App;
