import { pool, query } from "../db.js";
import type { SaveRecordingStepInput } from "../schemas/recordingSchema.js";
import { getWebsiteRequest } from "./requestService.js";

export type RecordingSessionRow = {
  id: string;
  website_request_id: string | null;
  site_url: string;
  base_domain: string;
  site_name: string;
  category: string;
  status: "recording" | "completed" | "cancelled";
  started_at: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type RecordingStepRow = {
  id: string;
  recording_session_id: string;
  step_order: number;
  page_url: string;
  page_title: string;
  action_type: "click" | "input" | "select" | "change";
  selector: string;
  xpath: string | null;
  element_label: string;
  instruction_title: string;
  instruction_text: string;
  element_metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type PublicRecordingGuideSummary = {
  id: string;
  category: string;
  site_name: string;
  step_count: number;
  updated_at: string;
};

export type PublicRecordingGuide = PublicRecordingGuideSummary & {
  site_url: string;
  base_domain: string;
  steps: RecordingStepRow[];
};

function normalizeDomain(rawUrl: string) {
  return new URL(rawUrl).hostname.replace(/^www\./i, "").toLowerCase();
}

export async function listCompletedRecordingGuides(rawUrl: string) {
  const baseDomain = normalizeDomain(rawUrl);
  const result = await query<PublicRecordingGuideSummary>(
    `
      select distinct on (lower(trim(rs.category)))
        rs.id,
        rs.category,
        rs.site_name,
        count(rst.id)::int as step_count,
        rs.updated_at
      from recording_sessions rs
      join recording_steps rst on rst.recording_session_id = rs.id
      where rs.base_domain = $1
        and rs.status = 'completed'
      group by rs.id
      order by lower(trim(rs.category)), rs.completed_at desc nulls last, rs.updated_at desc
    `,
    [baseDomain]
  );

  return result.rows.sort((left, right) => left.category.localeCompare(right.category));
}

export async function getCompletedRecordingGuide(sessionId: string) {
  const sessionResult = await query<Omit<PublicRecordingGuide, "steps" | "step_count"> & { step_count: number }>(
    `
      select
        rs.id,
        rs.category,
        rs.site_name,
        rs.site_url,
        rs.base_domain,
        count(rst.id)::int as step_count,
        rs.updated_at
      from recording_sessions rs
      join recording_steps rst on rst.recording_session_id = rs.id
      where rs.id = $1
        and rs.status = 'completed'
      group by rs.id
    `,
    [sessionId]
  );

  const session = sessionResult.rows[0];
  if (!session) {
    return null;
  }

  const stepsResult = await query<RecordingStepRow>(
    `
      select *
      from recording_steps
      where recording_session_id = $1
      order by step_order
    `,
    [sessionId]
  );

  return { ...session, steps: stepsResult.rows };
}

export async function createRecordingSession(websiteRequestId: string, category: string) {
  const websiteRequest = await getWebsiteRequest(websiteRequestId);
  if (!websiteRequest) {
    return null;
  }

  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(
      `
        update recording_sessions
        set status = 'cancelled', updated_at = now()
        where website_request_id = $1 and status = 'recording'
      `,
      [websiteRequestId]
    );
    const result = await client.query<RecordingSessionRow>(
      `
        insert into recording_sessions (
          website_request_id,
          site_url,
          base_domain,
          site_name,
          category
        )
        values ($1, $2, $3, $4, $5)
        returning *
      `,
      [
        websiteRequest.id,
        websiteRequest.url,
        normalizeDomain(websiteRequest.url),
        websiteRequest.site_name,
        category.trim()
      ]
    );
    await client.query(
      "update website_requests set status = 'in_review', updated_at = now() where id = $1",
      [websiteRequestId]
    );
    await client.query("commit");
    return result.rows[0];
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function getRecordingSession(sessionId: string) {
  const [sessionResult, stepsResult] = await Promise.all([
    query<RecordingSessionRow>("select * from recording_sessions where id = $1", [sessionId]),
    query<RecordingStepRow>(
      "select * from recording_steps where recording_session_id = $1 order by step_order",
      [sessionId]
    )
  ]);

  const session = sessionResult.rows[0];
  return session ? { ...session, steps: stepsResult.rows } : null;
}

export async function listRecordingSessionsForRequest(websiteRequestId: string) {
  const sessionsResult = await query<RecordingSessionRow>(
    `
      select *
      from recording_sessions
      where website_request_id = $1
        and status <> 'cancelled'
      order by created_at desc
    `,
    [websiteRequestId]
  );

  if (sessionsResult.rows.length === 0) {
    return [];
  }

  const sessionIds = sessionsResult.rows.map((session) => session.id);
  const stepsResult = await query<RecordingStepRow>(
    `
      select *
      from recording_steps
      where recording_session_id = any($1::uuid[])
      order by recording_session_id, step_order
    `,
    [sessionIds]
  );
  const stepsBySession = new Map<string, RecordingStepRow[]>();
  for (const step of stepsResult.rows) {
    const sessionSteps = stepsBySession.get(step.recording_session_id) ?? [];
    sessionSteps.push(step);
    stepsBySession.set(step.recording_session_id, sessionSteps);
  }

  return sessionsResult.rows.map((session) => ({
    ...session,
    steps: stepsBySession.get(session.id) ?? []
  }));
}

export async function saveRecordingStep(
  sessionId: string,
  stepOrder: number,
  input: SaveRecordingStepInput
) {
  const result = await query<RecordingStepRow>(
    `
      insert into recording_steps (
        recording_session_id,
        step_order,
        page_url,
        page_title,
        action_type,
        selector,
        xpath,
        element_label,
        instruction_title,
        instruction_text,
        element_metadata
      )
      select
        id, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb
      from recording_sessions
      where id = $1 and status = 'recording'
      on conflict (recording_session_id, step_order)
      do update set
        page_url = excluded.page_url,
        page_title = excluded.page_title,
        action_type = excluded.action_type,
        selector = excluded.selector,
        xpath = excluded.xpath,
        element_label = excluded.element_label,
        instruction_title = excluded.instruction_title,
        instruction_text = excluded.instruction_text,
        element_metadata = excluded.element_metadata,
        updated_at = now()
      returning *
    `,
    [
      sessionId,
      stepOrder,
      input.pageUrl,
      input.pageTitle,
      input.actionType,
      input.selector,
      input.xpath ?? null,
      input.elementLabel,
      input.instructionTitle,
      input.instructionText,
      JSON.stringify(input.elementMetadata)
    ]
  );

  return result.rows[0] ?? null;
}

export async function deleteRecordingStep(sessionId: string, stepOrder: number) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await client.query(
      `
        delete from recording_steps
        where recording_session_id = $1
          and step_order = $2
          and exists (
            select 1 from recording_sessions
            where id = $1 and status = 'recording'
          )
      `,
      [sessionId, stepOrder]
    );

    if ((result.rowCount ?? 0) > 0) {
      // Move later steps outside the normal range first to avoid temporary
      // unique-key conflicts while closing the deleted step-order gap.
      await client.query(
        `
          update recording_steps
          set step_order = step_order + 100000
          where recording_session_id = $1 and step_order > $2
        `,
        [sessionId, stepOrder]
      );
      await client.query(
        `
          update recording_steps
          set step_order = step_order - 100001, updated_at = now()
          where recording_session_id = $1 and step_order > 100000 + $2
        `,
        [sessionId, stepOrder]
      );
    }

    await client.query("commit");
    return (result.rowCount ?? 0) > 0;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function clearRecordingSteps(sessionId: string) {
  await query(
    `
      delete from recording_steps
      where recording_session_id = $1
        and exists (
          select 1 from recording_sessions
          where id = $1 and status = 'recording'
        )
    `,
    [sessionId]
  );
}

export async function updateRecordingSessionStatus(
  sessionId: string,
  status: "completed" | "cancelled"
) {
  const result = await query<RecordingSessionRow>(
    `
      update recording_sessions
      set
        status = $2,
        completed_at = case when $2 = 'completed' then now() else completed_at end,
        updated_at = now()
      where id = $1
        and status = 'recording'
        and ($2 <> 'completed' or exists (
          select 1 from recording_steps where recording_session_id = $1
        ))
      returning *
    `,
    [sessionId, status]
  );
  return result.rows[0] ?? null;
}
