import { useEffect, useMemo, useState } from "react";
import {
  approveDeveloperTemplate,
  deleteWebsiteRequest,
  fetchDeveloperStats,
  fetchDeveloperTemplate,
  fetchPendingDeveloperTemplates,
  fetchWebsiteRequests,
  rejectDeveloperTemplate,
  saveDeveloperTemplate,
  updateWebsiteRequestStatus,
  validateDeveloperTemplate
} from "./api/developerApi";
import type {
  DeveloperFieldMapping,
  DeveloperStats,
  DeveloperTemplateDetail,
  DeveloperTemplateSummary,
  DeveloperValidationResult,
  TemplateStatus,
  WebsiteRequest,
  WebsiteRequestStatus
} from "./types/developer";

type View = "dashboard" | "pending" | "requests" | "review" | "fieldMappings" | "runnerInstructions";

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
  onStatusChange,
  onDelete
}: {
  requests: WebsiteRequest[];
  onStatusChange: (id: string, status: WebsiteRequestStatus) => void;
  onDelete: (id: string) => void;
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
            <th>Action</th>
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
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <select
                    value={req.status}
                    onChange={(e) => onStatusChange(req.id, e.target.value as WebsiteRequestStatus)}
                    style={{ padding: "4px 8px", borderRadius: "6px", fontSize: "13px", borderColor: "#cbd5e1" }}
                  >
                    <option value="pending">Pending</option>
                    <option value="in_review">In Review</option>
                    <option value="fulfilled">Fulfilled</option>
                    <option value="rejected">Rejected</option>
                  </select>
                  <button
                    type="button"
                    className="secondary-button"
                    style={{ padding: "4px 8px", fontSize: "12px", color: "#dc2626" }}
                    onClick={() => onDelete(req.id)}
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
  const [selectedTemplate, setSelectedTemplate] = useState<DeveloperTemplateDetail | null>(null);
  const [fieldMappings, setFieldMappings] = useState<DeveloperFieldMapping[]>([]);
  const [templateName, setTemplateName] = useState("");
  const [urlPatternsText, setUrlPatternsText] = useState("");
  const [validation, setValidation] = useState<DeveloperValidationResult | null>(null);
  const [loading, setLoading] = useState(true);
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

  async function handleStatusChange(id: string, status: WebsiteRequestStatus) {
    try {
      await updateWebsiteRequestStatus(id, status);
      await refreshDashboard();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Failed to update request status.");
    }
  }

  async function handleDeleteRequest(id: string) {
    if (!window.confirm("Are you sure you want to delete this website request?")) {
      return;
    }
    try {
      await deleteWebsiteRequest(id);
      await refreshDashboard();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Failed to delete website request.");
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
      return;
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
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Failed to save changes.");
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
    if (!selectedTemplate || !window.confirm("Approve this template for normal extension use?")) {
      return;
    }

    await saveCurrentTemplate();
    setLoading(true);
    setError("");

    try {
      const approved = await approveDeveloperTemplate(selectedTemplate.id);
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

          <button className={view === "requests" ? "nav-active" : ""} type="button" onClick={() => setView("requests")}>
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
            <section className="panel">
              <WebsiteRequestsTable
                requests={websiteRequests}
                onStatusChange={handleStatusChange}
                onDelete={handleDeleteRequest}
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
      </section>
    </main>
  );
}

export default App;

