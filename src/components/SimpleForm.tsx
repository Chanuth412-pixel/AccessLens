import type { FormErrors, FormValues } from "../App";

type SimpleFormProps = {
  values: FormValues;
  errors: FormErrors;
  onChange: (field: keyof FormValues, value: string) => void;
  onReview: () => void;
};

const provinceOptions = [
  "Western",
  "Central",
  "Southern",
  "Northern",
  "Eastern",
  "North Western",
  "North Central",
  "Uva",
  "Sabaragamuwa"
];

export function SimpleForm({ values, errors, onChange, onReview }: SimpleFormProps) {
  return (
    <section className="panel">
      <h2>Simple Details Form</h2>
      <div className="form-grid">
        <label>
          Full Name
          <input
            value={values.fullName}
            onChange={(event) => onChange("fullName", event.target.value)}
            placeholder="Enter full name"
          />
          {errors.fullName && <span className="error">{errors.fullName}</span>}
        </label>

        <label>
          NIC Number
          <input
            value={values.nicNumber}
            onChange={(event) => onChange("nicNumber", event.target.value)}
            placeholder="Enter NIC number"
          />
          {errors.nicNumber && <span className="error">{errors.nicNumber}</span>}
        </label>

        <label>
          Mobile Number
          <input
            value={values.mobileNumber}
            onChange={(event) => onChange("mobileNumber", event.target.value)}
            placeholder="077 123 4567"
          />
          {errors.mobileNumber && <span className="error">{errors.mobileNumber}</span>}
        </label>

        <label>
          Vehicle Number
          <input
            value={values.vehicleNumber}
            onChange={(event) => onChange("vehicleNumber", event.target.value)}
            placeholder="ABC-1234"
          />
          {errors.vehicleNumber && <span className="error">{errors.vehicleNumber}</span>}
        </label>

        <label>
          Province
          <select
            value={values.province}
            onChange={(event) => onChange("province", event.target.value)}
          >
            <option value="">Select province</option>
            {provinceOptions.map((province) => (
              <option key={province} value={province}>
                {province}
              </option>
            ))}
          </select>
          {errors.province && <span className="error">{errors.province}</span>}
        </label>
      </div>

      <button className="primary-button" type="button" onClick={onReview}>
        Review Details
      </button>
    </section>
  );
}
