import { useEffect, useMemo, useState } from "react";
import {
  approveDeveloperTemplate,
  createRecordingSession,
  fetchDeveloperStats,
  fetchDeveloperTemplate,
  fetchPendingDeveloperTemplates,
  fetchWebsiteRequests,
  fetchRecordingSessions,
  rejectDeveloperTemplate,
  saveDeveloperTemplate,
  validateDeveloperTemplate
} from "./api/developerApi";
import type {
  DeveloperFieldMapping,
  DeveloperStats,
  DeveloperTemplateDetail,
  DeveloperTemplateSummary,
  DeveloperValidationResult,
  RecordingSessionDetail,
  TemplateStatus,
  WebsiteRequest
} from "./types/developer";

type View = "dashboard" | "pending" | "requests" | "recordings" | "review" | "fieldMappings" | "runnerInstructions";

export type FormValues = {
  fullName: string;
  nicNumber: string;
  mobileNumber: string;
  vehicleNumber: string;
  province: string;
};

export type FormErrors = Partial<Record<keyof FormValues, string>>;

const emptyStats: DeveloperStats = {
  pendingTemplates: 0,
  approvedTemplates: 0,
  archivedTemplates: 0,
  templateErrors: 0,
  pendingWebsiteRequests: 0
};


function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function StatusBadge({ status }: { status: TemplateStatus | string }) {
  return <span className={`status-badge status-${status}`}>{status.replace("_", " ")}</span>;
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <article className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <section className="empty-state">
      <h2>{title}</h2>
      <p>{message}</p>
    </section>
  );
}

function PendingTemplatesTable({
  templates,
  onReview
}: {
  templates: DeveloperTemplateSummary[];
  onReview: (templateId: string) => void;
}) {
  if (templates.length === 0) {
    return (
      <EmptyState
        title="No pending templates"
        message="AI-generated templates waiting for review will appear here."
      />
    );
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Template</th>
            <th>Website</th>
            <th>Base domain</th>
            <th>Version</th>
            <th>Status</th>
            <th>Created</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {templates.map((template) => (
            <tr key={template.id}>
              <td>
                <strong>{template.template_name}</strong>
                <span className="muted-text">{template.template_key}</span>
              </td>
              <td>{template.site.site_name}</td>
              <td>{template.site.base_domain}</td>
              <td>{template.version}</td>
              <td><StatusBadge status={template.status} /></td>
              <td>{formatDate(template.created_at)}</td>
              <td>
                <button className="ghost-button" type="button" onClick={() => onReview(template.id)}>
                  Review
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WebsiteRequestsTable({
  requests,
  onCreateTemplate,
  onReviewTemplate
}: {
  requests: WebsiteRequest[];
  onCreateTemplate: (request: WebsiteRequest) => void;
  onReviewTemplate: (templateId: string) => void;
}) {
  if (requests.length === 0) {
    return (
      <EmptyState
        title="No website requests"
        message="Website requests submitted by users via the Chrome extension will appear here."
      />
    );
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Website Name</th>
            <th>Domain / URL</th>
            <th>Requests</th>
            <th>User Note</th>
            <th>Date</th>
            <th>Status</th>
            <th>Template</th>
          </tr>
        </thead>
        <tbody>
          {requests.map((req) => (
            <tr key={req.id}>
              <td>
                <strong>{req.site_name}</strong>
              </td>
              <td>
                <a href={req.url} target="_blank" rel="noreferrer" className="table-link">
                  {req.base_domain}
                </a>
              </td>
              <td>
                <span className="request-count-badge">
                  {req.request_count} {req.request_count === 1 ? "request" : "requests"}
                </span>
              </td>
              <td>{req.user_note || <span className="muted">None</span>}</td>
              <td>{formatDate(req.created_at)}</td>
              <td>
                <StatusBadge status={req.status} />
              </td>
              <td>
                {req.template_id && req.template_status === "pending_review" ? (
                  <button
                    type="button"
                    className="secondary-button request-template-button"
                    onClick={() => onReviewTemplate(req.template_id as string)}
                  >
                    Review Template
                  </button>
                ) : req.template_status === "approved" ? (
                  <button type="button" className="secondary-button request-template-button" disabled>
                    Template Approved
                  </button>
                ) : (
                  <button
                    type="button"
                    className="primary-button request-template-button"
                    onClick={() => onCreateTemplate(req)}
                  >
                    Create Template
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CategoryDialog({
  request,
  category,
  error,
  busy,
  onCategoryChange,
  onCancel,
  onContinue
}: {
  request: WebsiteRequest;
  category: string;
  error: string;
  busy: boolean;
  onCategoryChange: (category: string) => void;
  onCancel: () => void;
  onContinue: () => void;
}) {
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          onCancel();
        }
      }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onCancel();
        }
      }}
    >
      <section
        className="category-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="category-dialog-title"
        aria-describedby="category-dialog-description"
      >
        <div className="category-dialog-header">
          <div>
            <p className="eyebrow">New recording</p>
            <h2 id="category-dialog-title">Choose a workflow category</h2>
          </div>
          <button className="modal-close-button" type="button" aria-label="Close" onClick={onCancel} disabled={busy}>
            ×
          </button>
        </div>

        <p id="category-dialog-description" className="category-dialog-description">
          Name the process you want to record on <strong>{request.site_name}</strong>. For example,
          use “Registration” for a registration flow.
        </p>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            onContinue();
          }}
        >
          <label className="category-field" htmlFor="workflow-category">
            <span>Category</span>
            <input
              id="workflow-category"
              type="text"
              value={category}
              onChange={(event) => onCategoryChange(event.target.value)}
              placeholder="e.g. Registration"
              autoComplete="off"
              autoFocus
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "category-error" : "category-help"}
            />
          </label>
          {error ? (
            <p id="category-error" className="field-error" role="alert">{error}</p>
          ) : (
            <p id="category-help" className="field-help">
              After continuing, the website opens in a new tab so you can record this flow.
            </p>
          )}

          <div className="category-dialog-actions">
            <button className="secondary-button" type="button" onClick={onCancel} disabled={busy}>Cancel</button>
            <button className="primary-button" type="submit" disabled={busy}>
              {busy ? "Preparing recording..." : "Continue to website"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function RecordingWorkspace({
  request,
  recordings,
  loading,
  onBack,
  onRefresh,
  onAddCategory
}: {
  request: WebsiteRequest;
  recordings: RecordingSessionDetail[];
  loading: boolean;
  onBack: () => void;
  onRefresh: () => void;
  onAddCategory: () => void;
}) {
  const [selectedRecordingId, setSelectedRecordingId] = useState<string | null>(null);
  const selectedRecording = recordings.find((recording) => recording.id === selectedRecordingId) ?? null;

  useEffect(() => {
    if (selectedRecordingId && !recordings.some((recording) => recording.id === selectedRecordingId)) {
      setSelectedRecordingId(null);
    }
  }, [recordings, selectedRecordingId]);

  return (
    <>
      <section className="page-heading recording-page-heading">
        <div>
          <p className="eyebrow">Template categories</p>
          <h1>{request.site_name}</h1>
          <p>{request.base_domain} - Review saved categories and their recorded instructions.</p>
        </div>
        <div className="heading-actions">
          <button className="secondary-button" type="button" onClick={onBack}>Back to Requests</button>
          <button className="secondary-button" type="button" onClick={onRefresh} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
          <button className="primary-button" type="button" onClick={onAddCategory}>Add Category</button>
        </div>
      </section>

      {recordings.length === 0 && !loading ? (
        <EmptyState
          title="No categories recorded yet"
          message="Add a category, record its website flow, and save an instruction for each step."
        />
      ) : selectedRecording ? (
        <section className="recording-detail" aria-label={`${selectedRecording.category} instructions`}>
          <div className="recording-detail-toolbar">
            <button className="secondary-button" type="button" onClick={() => setSelectedRecordingId(null)}>
              Back to Categories
            </button>
          </div>

          <article className="recording-category-card recording-detail-card">
            <header className="recording-category-header">
              <div>
                <p className="eyebrow">Category</p>
                <h2>{selectedRecording.category}</h2>
                <p>{selectedRecording.steps.length} recorded {selectedRecording.steps.length === 1 ? "step" : "steps"} - Started {formatDate(selectedRecording.started_at)}</p>
              </div>
              <StatusBadge status={selectedRecording.status} />
            </header>

            {selectedRecording.steps.length === 0 ? (
              <p className="recording-empty-steps">
                {selectedRecording.status === "recording"
                  ? "Recording is in progress. Refresh after finishing it in the extension."
                  : "No instructions were saved for this category."}
              </p>
            ) : (
              <ol className="recording-instruction-list">
                {selectedRecording.steps.map((step) => (
                  <li key={step.id}>
                    <span className="recording-step-number">{step.step_order}</span>
                    <div>
                      <div className="recording-step-heading">
                        <strong>{step.element_label}</strong>
                        <span>{step.action_type}</span>
                      </div>
                      <p>{step.instruction_text}</p>
                      <small>{step.page_title || step.page_url}</small>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </article>
        </section>
      ) : (
        <section className="recording-category-list" aria-label="Recorded template categories">
          {recordings.map((recording) => (
            <button
              className="recording-category-card recording-category-button"
              key={recording.id}
              type="button"
              onClick={() => setSelectedRecordingId(recording.id)}
            >
              <span className="recording-category-main">
                <span className="eyebrow">Category</span>
                <strong>{recording.category}</strong>
                <span>{recording.steps.length} recorded {recording.steps.length === 1 ? "step" : "steps"} - Started {formatDate(recording.started_at)}</span>
              </span>
              <span className="recording-category-meta">
                <StatusBadge status={recording.status} />
                <span className="recording-view-text">View instructions</span>
              </span>
            </button>
          ))}
        </section>
      )}
    </>
  );
}

function Dashboard({
  stats,
  templates,
  onReview,
  onOpenPending,
  onOpenRequests
}: {
  stats: DeveloperStats;
  templates: DeveloperTemplateSummary[];
  onReview: (templateId: string) => void;
  onOpenPending: () => void;
  onOpenRequests: () => void;
}) {
  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">AccessLens</p>
          <h1>Developer Console</h1>
          <p>Review AI-generated templates and requested websites from users.</p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button className="secondary-button" type="button" onClick={onOpenRequests}>
            View Website Requests ({stats.pendingWebsiteRequests ?? 0})
          </button>
          <button className="primary-button" type="button" onClick={onOpenPending}>
            View Pending Templates
          </button>
        </div>
      </section>

      <section className="stats-grid">
        <StatCard label="Pending templates" value={stats.pendingTemplates} />
        <StatCard label="Website requests" value={stats.pendingWebsiteRequests ?? 0} />
        <StatCard label="Approved templates" value={stats.approvedTemplates} />
        <StatCard label="Archived templates" value={stats.archivedTemplates} />
        <StatCard label="Template errors" value={stats.templateErrors} />
      </section>

      <section className="panel">
        <div className="panel-heading">
          <h2>Pending review queue</h2>
          <span>{templates.length} shown</span>
        </div>
        <PendingTemplatesTable templates={templates.slice(0, 8)} onReview={onReview} />
      </section>
    </>
  );
}


function FieldMappingsEditor({
  fields,
  onChange
}: {
  fields: DeveloperFieldMapping[];
  onChange: (fields: DeveloperFieldMapping[]) => void;
}) {
  function updateField(index: number, updates: Partial<DeveloperFieldMapping>) {
    onChange(fields.map((field, fieldIndex) =>
      fieldIndex === index ? { ...field, ...updates } : field
    ));
  }

  return (
    <div className="table-wrap">
      <table className="editable-table">
        <thead>
          <tr>
            <th>Field key</th>
            <th>Label</th>
            <th>Input type</th>
            <th>Selector</th>
            <th>XPath</th>
            <th>Required</th>
            <th>Validation</th>
            <th>Order</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((field, index) => (
            <tr key={field.id}>
              <td><code>{field.field_key}</code></td>
              <td>
                <input
                  value={field.label}
                  onChange={(event) => updateField(index, { label: event.target.value })}
                />
              </td>
              <td>
                <select
                  value={field.input_type}
                  onChange={(event) => updateField(index, { input_type: event.target.value })}
                >
                  <option value="text">text</option>
                  <option value="email">email</option>
                  <option value="tel">tel</option>
                  <option value="number">number</option>
                  <option value="date">date</option>
                  <option value="select">select</option>
                  <option value="textarea">textarea</option>
                </select>
              </td>
              <td>
                <input
                  value={field.selector}
                  onChange={(event) => updateField(index, { selector: event.target.value })}
                />
              </td>
              <td>
                <input
                  value={field.xpath ?? ""}
                  onChange={(event) => updateField(index, { xpath: event.target.value || null })}
                />
              </td>
              <td className="center-cell">
                <input
                  type="checkbox"
                  checked={field.required}
                  onChange={(event) => updateField(index, { required: event.target.checked })}
                />
              </td>
              <td>
                <input
                  value={field.validation_rule ?? ""}
                  onChange={(event) => updateField(index, { validation_rule: event.target.value || null })}
                />
              </td>
              <td>
                <input
                  type="number"
                  value={field.sort_order}
                  onChange={(event) => updateField(index, { sort_order: Number(event.target.value) })}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RunnerInstructionsTable({ template }: { template: DeveloperTemplateDetail }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Step</th>
            <th>Type</th>
            <th>Field key</th>
            <th>Selector</th>
            <th>Value source</th>
            <th>Wait ms</th>
          </tr>
        </thead>
        <tbody>
          {template.runner_instructions.map((instruction) => (
            <tr key={instruction.id}>
              <td>{instruction.step_order}</td>
              <td>{instruction.instruction_type}</td>
              <td>{instruction.field_key ?? "none"}</td>
              <td><code>{instruction.selector ?? "none"}</code></td>
              <td>{instruction.value_source ?? "none"}</td>
              <td>{instruction.wait_ms ?? "none"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ValidationPanel({ result }: { result: DeveloperValidationResult | null }) {
  if (!result) {
    return null;
  }

  return (
    <section className={result.valid ? "notice success-notice" : "notice error-notice"}>
      <strong>{result.valid ? "Validation passed" : "Validation needs attention"}</strong>
      {result.errors.map((error) => <p key={error}>{error}</p>)}
      {result.warnings.map((warning) => <p key={warning}>{warning}</p>)}
    </section>
  );
}

function TemplateReviewPage({
  template,
  message,
  validation,
  onTemplateNameChange,
  onUrlPatternsChange,
  onBack,
  onOpenFieldMappings,
  onOpenRunnerInstructions,
  onSave,
  onApprove,
  onReject,
  onValidate
}: {
  template: DeveloperTemplateDetail;
  message: string;
  validation: DeveloperValidationResult | null;
  onTemplateNameChange: (value: string) => void;
  onUrlPatternsChange: (value: string) => void;
  onBack: () => void;
  onOpenFieldMappings: () => void;
  onOpenRunnerInstructions: () => void;
  onSave: () => void;
  onApprove: () => void;
  onReject: () => void;
  onValidate: () => void;
}) {
  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">Template review</p>
          <h1>{template.template_name}</h1>
          <p>{template.site.site_name} · {template.site.base_domain}</p>
        </div>
        <button className="secondary-button" type="button" onClick={onBack}>
          Back to Pending Templates
        </button>
      </section>

      {message && <section className="notice">{message}</section>}
      <ValidationPanel result={validation} />

      <section className="detail-grid">
        <article className="panel">
          <h2>Site information</h2>
          <dl className="meta-list">
            <div><dt>Site name</dt><dd>{template.site.site_name}</dd></div>
            <div><dt>Site key</dt><dd><code>{template.site.site_key}</code></dd></div>
            <div><dt>Base domain</dt><dd>{template.site.base_domain}</dd></div>
            <div><dt>Category</dt><dd>{template.site.category}</dd></div>
            <div><dt>Status</dt><dd>{template.site.status}</dd></div>
          </dl>
        </article>

        <article className="panel">
          <h2>Template information</h2>
          <label>
            Template name
            <input value={template.template_name} onChange={(event) => onTemplateNameChange(event.target.value)} />
          </label>
          <label>
            URL patterns
            <textarea
              value={template.url_patterns.join("\n")}
              onChange={(event) => onUrlPatternsChange(event.target.value)}
            />
          </label>
          <dl className="meta-list">
            <div><dt>Template key</dt><dd><code>{template.template_key}</code></dd></div>
            <div><dt>Version</dt><dd>{template.version}</dd></div>
            <div><dt>Status</dt><dd><StatusBadge status={template.status} /></dd></div>
            <div><dt>Created</dt><dd>{formatDate(template.created_at)}</dd></div>
            <div><dt>Updated</dt><dd>{formatDate(template.updated_at)}</dd></div>
          </dl>
        </article>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <h2>Review tools</h2>
          <span>Open detailed technical tables only when you need them.</span>
        </div>
        <div className="tool-grid">
          <article className="tool-card">
            <div>
              <h3>Field mappings</h3>
              <p>Edit labels, selectors, required flags, validation rules, and order.</p>
            </div>
            <button className="secondary-button" type="button" onClick={onOpenFieldMappings}>
              Field Mappings
            </button>
          </article>
          <article className="tool-card">
            <div>
              <h3>Runner instructions</h3>
              <p>Review the generated fill/select/review steps before approval.</p>
            </div>
            <button className="secondary-button" type="button" onClick={onOpenRunnerInstructions}>
              Runner Instructions
            </button>
          </article>
        </div>
      </section>

      <section className="panel">
        <h2>Template JSON preview</h2>
        <pre className="json-viewer">{JSON.stringify(template.template_json, null, 2)}</pre>
      </section>

      <section className="action-bar">
        <button className="secondary-button" type="button" onClick={onValidate}>Validate</button>
        <button className="secondary-button" type="button" onClick={onSave}>Save Changes</button>
        <button className="primary-button" type="button" onClick={onApprove}>Approve Template</button>
        <button className="danger-button" type="button" onClick={onReject}>Reject Template</button>
      </section>
    </>
  );
}

function FieldMappingsPage({
  template,
  fields,
  message,
  onChange,
  onBack,
  onSave
}: {
  template: DeveloperTemplateDetail;
  fields: DeveloperFieldMapping[];
  message: string;
  onChange: (fields: DeveloperFieldMapping[]) => void;
  onBack: () => void;
  onSave: () => void;
}) {
  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">Template review</p>
          <h1>Field Mappings</h1>
          <p>{template.template_name} - {template.site.site_name}</p>
        </div>
        <button className="secondary-button" type="button" onClick={onBack}>
          Back to Template Review
        </button>
      </section>

      {message && <section className="notice">{message}</section>}

      <section className="panel">
        <div className="panel-heading">
          <h2>Editable mappings</h2>
          <span>Edit only if the AI-generated selectors or labels are wrong.</span>
        </div>
        <FieldMappingsEditor fields={fields} onChange={onChange} />
      </section>

      <section className="action-bar">
        <button className="secondary-button" type="button" onClick={onBack}>Back</button>
        <button className="primary-button" type="button" onClick={onSave}>Save Changes</button>
      </section>
    </>
  );
}

function RunnerInstructionsPage({
  template,
  onBack
}: {
  template: DeveloperTemplateDetail;
  onBack: () => void;
}) {
  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">Template review</p>
          <h1>Runner Instructions</h1>
          <p>{template.template_name} - {template.site.site_name}</p>
        </div>
        <button className="secondary-button" type="button" onClick={onBack}>
          Back to Template Review
        </button>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <h2>Generated steps</h2>
          <span>Read-only for now. These steps come from the pending template.</span>
        </div>
        <RunnerInstructionsTable template={template} />
      </section>
    </>
  );
}

function App() {
  const [view, setView] = useState<View>("dashboard");
  const [stats, setStats] = useState<DeveloperStats>(emptyStats);
  const [pendingTemplates, setPendingTemplates] = useState<DeveloperTemplateSummary[]>([]);
  const [websiteRequests, setWebsiteRequests] = useState<WebsiteRequest[]>([]);
  const [selectedRecordingRequest, setSelectedRecordingRequest] = useState<WebsiteRequest | null>(null);
  const [recordingSessions, setRecordingSessions] = useState<RecordingSessionDetail[]>([]);
  const [recordingsLoading, setRecordingsLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<DeveloperTemplateDetail | null>(null);
  const [fieldMappings, setFieldMappings] = useState<DeveloperFieldMapping[]>([]);
  const [templateName, setTemplateName] = useState("");
  const [urlPatternsText, setUrlPatternsText] = useState("");
  const [validation, setValidation] = useState<DeveloperValidationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [recordingRequest, setRecordingRequest] = useState<WebsiteRequest | null>(null);
  const [recordingCategory, setRecordingCategory] = useState("");
  const [categoryError, setCategoryError] = useState("");
  const [creatingRecording, setCreatingRecording] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function refreshDashboard() {
    const [nextStats, nextTemplates, nextRequests] = await Promise.all([
      fetchDeveloperStats(),
      fetchPendingDeveloperTemplates(),
      fetchWebsiteRequests().catch(() => [])
    ]);
    setStats(nextStats);
    setPendingTemplates(nextTemplates);
    setWebsiteRequests(nextRequests);
  }

  useEffect(() => {
    refreshDashboard()
      .catch((caughtError) => setError(caughtError instanceof Error ? caughtError.message : "Failed to load console."))
      .finally(() => setLoading(false));
  }, []);

  async function refreshRecordingSessions(websiteRequestId: string) {
    setRecordingsLoading(true);
    setError("");
    try {
      setRecordingSessions(await fetchRecordingSessions(websiteRequestId));
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Failed to load recording categories.");
    } finally {
      setRecordingsLoading(false);
    }
  }

  function handleCreateTemplate(request: WebsiteRequest) {
    setSelectedRecordingRequest(request);
    setRecordingSessions([]);
    setMessage("");
    setView("recordings");
    void refreshRecordingSessions(request.id);
  }

  function openCategoryDialog() {
    if (!selectedRecordingRequest) {
      return;
    }
    setRecordingRequest(selectedRecordingRequest);
    setRecordingCategory("");
    setCategoryError("");
    setError("");
  }

  async function startRecordingSetup() {
    if (!recordingRequest) {
      return;
    }

    const category = recordingCategory.trim();
    if (!category) {
      setCategoryError("Enter a category before continuing.");
      return;
    }

    const targetWindow = window.open("about:blank", "_blank");
    if (!targetWindow) {
      setCategoryError("Allow pop-ups for AccessLens, then try again.");
      return;
    }

    targetWindow.opener = null;
    targetWindow.document.title = "Preparing AccessLens recording...";
    setCreatingRecording(true);

    try {
      const session = await createRecordingSession(recordingRequest.id, category);
      const recordingSetup = {
        sessionId: session.id,
        requestId: recordingRequest.id,
        category: session.category,
        siteName: session.site_name,
        url: session.site_url,
        startedAt: session.started_at,
        status: session.status
      };

      try {
        window.localStorage.setItem("accesslens_recording_setup", JSON.stringify(recordingSetup));
      } catch (caughtError) {
        console.warn("Could not save the recording setup to local storage.", caughtError);
      }

      const browserApi = globalThis as typeof globalThis & {
        chrome?: { storage?: { local?: { set: (items: Record<string, unknown>) => void } } };
      };
      browserApi.chrome?.storage?.local?.set({
        accesslens_recording_setup: recordingSetup,
        al_isRecording: true,
        al_isPlaying: false,
        al_steps: [],
        al_playbackIndex: 0
      });

      const targetUrl = new URL(session.site_url);
      targetUrl.searchParams.set("_accesslens_recording", session.id);
      targetWindow.location.replace(targetUrl.toString());
      setMessage(`Recording the "${category}" flow. Add an instruction for every captured step.`);
      setRecordingRequest(null);
      setRecordingCategory("");
      setCategoryError("");
      void refreshDashboard();
      void refreshRecordingSessions(session.website_request_id ?? recordingRequest.id);
    } catch (caughtError) {
      targetWindow.close();
      setCategoryError(caughtError instanceof Error ? caughtError.message : "Could not start recording.");
    } finally {
      setCreatingRecording(false);
    }
  }

  async function openTemplate(templateId: string) {
    setLoading(true);
    setError("");
    setMessage("");
    setValidation(null);

    try {
      const template = await fetchDeveloperTemplate(templateId);
      setSelectedTemplate(template);
      setFieldMappings(template.field_mappings);
      setTemplateName(template.template_name);
      setUrlPatternsText(template.url_patterns.join("\n"));
      setView("review");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Failed to load template.");
    } finally {
      setLoading(false);
    }
  }

  async function saveCurrentTemplate() {
    if (!selectedTemplate) {
      return null;
    }

    setLoading(true);
    setMessage("");
    setError("");

    try {
      const updatedTemplate = await saveDeveloperTemplate(selectedTemplate.id, {
        template_name: templateName,
        url_patterns: urlPatternsText.split("\n").map((value) => value.trim()).filter(Boolean),
        field_mappings: fieldMappings
      });
      setSelectedTemplate(updatedTemplate);
      setFieldMappings(updatedTemplate.field_mappings);
      setMessage("Changes saved.");
      return updatedTemplate;
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Failed to save changes.");
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function validateCurrentTemplate() {
    if (!selectedTemplate) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      setValidation(await validateDeveloperTemplate(selectedTemplate.id));
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Validation failed.");
    } finally {
      setLoading(false);
    }
  }

  async function approveCurrentTemplate() {
    if (!selectedTemplate) {
      return;
    }

    const savedTemplate = await saveCurrentTemplate();
    if (!savedTemplate) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const validationResult = await validateDeveloperTemplate(savedTemplate.id);
      setValidation(validationResult);
      if (!validationResult.valid) {
        setError("Template validation failed. Fix the field mappings before approval.");
        return;
      }

      if (!window.confirm("Validation passed. Approve this template for normal extension use?")) {
        return;
      }

      const approved = await approveDeveloperTemplate(savedTemplate.id);
      setSelectedTemplate(approved);
      setMessage("Template approved. The extension can now fetch it as an approved template.");
      await refreshDashboard();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Failed to approve template.");
    } finally {
      setLoading(false);
    }
  }

  async function rejectCurrentTemplate() {
    if (!selectedTemplate) {
      return;
    }

    const reason = window.prompt("Why should this template be rejected?");
    if (reason === null) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const rejected = await rejectDeveloperTemplate(selectedTemplate.id, reason);
      setSelectedTemplate(rejected);
      setMessage("Template rejected and archived.");
      await refreshDashboard();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Failed to reject template.");
    } finally {
      setLoading(false);
    }
  }

  const currentReviewTemplate = useMemo(() => {
    if (!selectedTemplate) {
      return null;
    }

    return {
      ...selectedTemplate,
      template_name: templateName,
      url_patterns: urlPatternsText.split("\n").map((value) => value.trim()).filter(Boolean)
    };
  }, [selectedTemplate, templateName, urlPatternsText]);

  return (
    <main className="developer-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <span className="logo-mark">AL</span>
          <div>
            <strong>AccessLens</strong>
            <span>Developer Console</span>
          </div>
        </div>
        <nav>
          <button className={view === "dashboard" ? "nav-active" : ""} type="button" onClick={() => setView("dashboard")}>
            Dashboard
          </button>

          <button className={view === "pending" ? "nav-active" : ""} type="button" onClick={() => setView("pending")}>
            Pending Templates ({stats.pendingTemplates ?? 0})
          </button>

          <button className={view === "requests" || view === "recordings" ? "nav-active" : ""} type="button" onClick={() => setView("requests")}>
            Website Requests ({stats.pendingWebsiteRequests ?? 0})
          </button>
        </nav>
      </aside>

      <section className="developer-content">
        {loading && <div className="loading-bar">Loading...</div>}
        {error && <section className="notice error-notice">{error}</section>}

        {view === "dashboard" && (
          <Dashboard
            stats={stats}
            templates={pendingTemplates}
            onReview={openTemplate}
            onOpenPending={() => setView("pending")}
            onOpenRequests={() => setView("requests")}
          />
        )}

        {view === "pending" && (
          <>
            <section className="page-heading">
              <div>
                <p className="eyebrow">Review queue</p>
                <h1>Pending Templates</h1>
                <p>Open an AI-generated draft, edit mappings if needed, then approve or reject it.</p>
              </div>
            </section>
            <section className="panel">
              <PendingTemplatesTable templates={pendingTemplates} onReview={openTemplate} />
            </section>
          </>
        )}

        {view === "requests" && (
          <>
            <section className="page-heading">
              <div>
                <p className="eyebrow">User requests</p>
                <h1>Website Support Requests</h1>
                <p>Sites requested by users from the AccessLens Chrome Extension overlay.</p>
              </div>
            </section>
            {message && <section className="notice success-notice">{message}</section>}
            <section className="panel">
              <WebsiteRequestsTable
                requests={websiteRequests}
                onCreateTemplate={handleCreateTemplate}
                onReviewTemplate={openTemplate}
              />
            </section>
          </>
        )}

        {view === "review" && currentReviewTemplate && (
          <TemplateReviewPage
            template={currentReviewTemplate}
            message={message}
            validation={validation}
            onTemplateNameChange={setTemplateName}
            onUrlPatternsChange={setUrlPatternsText}
            onBack={() => setView("pending")}
            onOpenFieldMappings={() => setView("fieldMappings")}
            onOpenRunnerInstructions={() => setView("runnerInstructions")}
            onSave={saveCurrentTemplate}
            onApprove={approveCurrentTemplate}
            onReject={rejectCurrentTemplate}
            onValidate={validateCurrentTemplate}
          />
        )}

        {view === "fieldMappings" && currentReviewTemplate && (
          <FieldMappingsPage
            template={currentReviewTemplate}
            fields={fieldMappings}
            message={message}
            onChange={setFieldMappings}
            onBack={() => setView("review")}
            onSave={saveCurrentTemplate}
          />
        )}

        {view === "runnerInstructions" && currentReviewTemplate && (
          <RunnerInstructionsPage
            template={currentReviewTemplate}
            onBack={() => setView("review")}
          />
        )}

        {view === "recordings" && selectedRecordingRequest && (
          <RecordingWorkspace
            request={selectedRecordingRequest}
            recordings={recordingSessions}
            loading={recordingsLoading}
            onBack={() => setView("requests")}
            onRefresh={() => void refreshRecordingSessions(selectedRecordingRequest.id)}
            onAddCategory={openCategoryDialog}
          />
        )}

        {recordingRequest && (
          <CategoryDialog
            request={recordingRequest}
            category={recordingCategory}
            error={categoryError}
            busy={creatingRecording}
            onCategoryChange={(category) => {
              setRecordingCategory(category);
              if (categoryError) {
                setCategoryError("");
              }
            }}
            onCancel={() => {
              setRecordingRequest(null);
              setRecordingCategory("");
              setCategoryError("");
            }}
            onContinue={startRecordingSetup}
          />
        )}
      </section>
    </main>
  );
}

export default App;

