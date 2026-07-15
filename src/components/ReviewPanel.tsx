import type { FormValues } from "../App";

type ReviewPanelProps = {
  values: FormValues | null;
};

export function ReviewPanel({ values }: ReviewPanelProps) {
  return (
    <section className="panel">
      <h2>Review Details</h2>
      {!values ? (
        <p className="muted">Complete the form and click Review Details to see a summary.</p>
      ) : (
        <dl className="review-list">
          <div>
            <dt>Full Name</dt>
            <dd>{values.fullName}</dd>
          </div>
          <div>
            <dt>NIC Number</dt>
            <dd>{values.nicNumber}</dd>
          </div>
          <div>
            <dt>Mobile Number</dt>
            <dd>{values.mobileNumber}</dd>
          </div>
          <div>
            <dt>Vehicle Number</dt>
            <dd>{values.vehicleNumber}</dd>
          </div>
          <div>
            <dt>Province</dt>
            <dd>{values.province}</dd>
          </div>
        </dl>
      )}
    </section>
  );
}
