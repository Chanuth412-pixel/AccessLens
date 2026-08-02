import { query } from "../db.js";

export type WebsiteRequestRow = {
  id: string;
  url: string;
  base_domain: string;
  site_name: string;
  user_note: string | null;
  status: "pending" | "in_review" | "fulfilled" | "rejected";
  request_count: number;
  created_at: string;
  updated_at: string;
  template_id?: string | null;
  template_status?: "draft" | "pending_review" | "approved" | "archived" | null;
};

function extractBaseDomain(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    return parsed.hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return rawUrl.toLowerCase().trim();
  }
}

function deriveSiteName(rawUrl: string, providedTitle?: string): string {
  if (providedTitle && providedTitle.trim() && providedTitle !== "AccessLens") {
    return providedTitle.trim().slice(0, 100);
  }
  const domain = extractBaseDomain(rawUrl);
  return domain.charAt(0).toUpperCase() + domain.slice(1);
}

export async function submitWebsiteRequest(
  url: string,
  providedSiteName?: string,
  userNote?: string
): Promise<WebsiteRequestRow> {
  const baseDomain = extractBaseDomain(url);
  const siteName = deriveSiteName(url, providedSiteName);
  const cleanNote = userNote?.trim() || null;

  try {
    const existing = await query<WebsiteRequestRow>(
      `select * from website_requests where base_domain = $1 limit 1`,
      [baseDomain]
    );

    if (existing.rows.length > 0) {
      const row = existing.rows[0];
      const updateResult = await query<WebsiteRequestRow>(
        `
          update website_requests
          set
            request_count = request_count + 1,
            user_note = coalesce($1, user_note),
            updated_at = now()
          where id = $2
          returning *
        `,
        [cleanNote, row.id]
      );
      return updateResult.rows[0];
    }

    const insertResult = await query<WebsiteRequestRow>(
      `
        insert into website_requests (url, base_domain, site_name, user_note)
        values ($1, $2, $3, $4)
        returning *
      `,
      [url, baseDomain, siteName, cleanNote]
    );

    return insertResult.rows[0];
  } catch (error) {
    if (error instanceof Error && error.message.includes("website_requests")) {
      throw new Error("website_requests table does not exist in Supabase database. Please run schema.sql in Supabase SQL Editor.");
    }
    throw error;
  }
}


export async function checkWebsiteRequestStatus(url: string): Promise<WebsiteRequestRow | null> {
  try {
    const baseDomain = extractBaseDomain(url);
    const result = await query<WebsiteRequestRow>(
      `select * from website_requests where base_domain = $1 limit 1`,
      [baseDomain]
    );
    return result.rows[0] ?? null;
  } catch {
    return null;
  }
}

export async function listWebsiteRequests(): Promise<WebsiteRequestRow[]> {
  try {
    const result = await query<WebsiteRequestRow>(
      `
        select
          website_requests.*,
          matching_template.id as template_id,
          matching_template.status as template_status
        from website_requests
        left join lateral (
          select templates.id, templates.status
          from templates
          join sites on sites.id = templates.site_id
          where lower(regexp_replace(sites.base_domain, '^www\\.', '', 'i'))
            = lower(regexp_replace(website_requests.base_domain, '^www\\.', '', 'i'))
          order by
            (templates.status = 'pending_review') desc,
            (templates.status = 'approved') desc,
            templates.updated_at desc
          limit 1
        ) matching_template on true
        order by website_requests.request_count desc, website_requests.updated_at desc
      `
    );
    return result.rows;
  } catch {
    return [];
  }
}

export async function getWebsiteRequest(id: string): Promise<WebsiteRequestRow | null> {
  const result = await query<WebsiteRequestRow>(
    "select * from website_requests where id = $1",
    [id]
  );
  return result.rows[0] ?? null;
}

export async function fulfillWebsiteRequestForDomain(baseDomain: string) {
  const normalizedDomain = baseDomain.replace(/^www\./i, "");
  await query(
    `
      update website_requests
      set status = 'fulfilled', updated_at = now()
      where lower(regexp_replace(base_domain, '^www\\.', '', 'i')) = lower($1)
    `,
    [normalizedDomain]
  );
}

export async function countPendingWebsiteRequests(): Promise<number> {
  try {
    const result = await query<{ count: string }>(
      `select count(*) from website_requests where status = 'pending'`
    );
    return parseInt(result.rows[0]?.count ?? "0", 10);
  } catch {
    return 0;
  }
}


export async function updateWebsiteRequestStatus(
  id: string,
  status: string
): Promise<WebsiteRequestRow | null> {
  const validStatuses = ["pending", "in_review", "fulfilled", "rejected"];
  if (!validStatuses.includes(status)) {
    throw new Error(`Invalid status: ${status}`);
  }

  const result = await query<WebsiteRequestRow>(
    `
      update website_requests
      set status = $1, updated_at = now()
      where id = $2
      returning *
    `,
    [status, id]
  );

  return result.rows[0] ?? null;
}

export async function deleteWebsiteRequest(id: string): Promise<boolean> {
  const result = await query(`delete from website_requests where id = $1`, [id]);
  return (result.rowCount ?? 0) > 0;
}
