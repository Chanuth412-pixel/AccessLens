import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import type {
  DomElementSnapshot,
  GenerateTemplateRequest
} from "../schemas/domSnapshotSchema.js";

const maxHtmlBytes = 2 * 1024 * 1024;
const maxRedirects = 5;
const requestTimeoutMs = 15_000;

export class WebsiteSnapshotError extends Error {
  constructor(message: string, public readonly status = 422) {
    super(message);
    this.name = "WebsiteSnapshotError";
  }
}

function isPrivateIp(address: string) {
  const normalized = address.toLowerCase().replace(/^::ffff:/, "");

  if (isIP(normalized) === 4) {
    const [a, b] = normalized.split(".").map(Number);
    return a === 0
      || a === 10
      || a === 127
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168)
      || a >= 224;
  }

  return normalized === "::"
    || normalized === "::1"
    || normalized.startsWith("fc")
    || normalized.startsWith("fd")
    || normalized.startsWith("fe8")
    || normalized.startsWith("fe9")
    || normalized.startsWith("fea")
    || normalized.startsWith("feb")
    || normalized.startsWith("ff");
}

async function assertPublicWebsiteUrl(url: URL) {
  if (!(["http:", "https:"] as string[]).includes(url.protocol)) {
    throw new WebsiteSnapshotError("Only public HTTP and HTTPS website URLs can be scanned.", 400);
  }

  if (url.username || url.password || url.hostname === "localhost") {
    throw new WebsiteSnapshotError("Local or credentialed website URLs cannot be scanned.", 400);
  }

  let addresses: Array<{ address: string; family: number }>;
  try {
    addresses = await lookup(url.hostname, { all: true, verbatim: true });
  } catch {
    throw new WebsiteSnapshotError("The requested website domain could not be resolved.");
  }

  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateIp(address))) {
    throw new WebsiteSnapshotError("The requested URL does not resolve to a public website.", 400);
  }
}

async function readLimitedHtml(response: Response) {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
    throw new WebsiteSnapshotError("The requested URL did not return an HTML page.");
  }

  const declaredSize = Number(response.headers.get("content-length") ?? 0);
  if (declaredSize > maxHtmlBytes) {
    throw new WebsiteSnapshotError("The requested page is too large to scan safely.");
  }

  if (!response.body) {
    return response.text();
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maxHtmlBytes) {
      await reader.cancel();
      throw new WebsiteSnapshotError("The requested page is too large to scan safely.");
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

async function fetchPublicHtml(initialUrl: URL) {
  let currentUrl = initialUrl;

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    await assertPublicWebsiteUrl(currentUrl);

    let response: Response;
    try {
      response = await fetch(currentUrl, {
        redirect: "manual",
        signal: AbortSignal.timeout(requestTimeoutMs),
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "User-Agent": "AccessLensTemplateBot/1.0"
        }
      });
    } catch {
      throw new WebsiteSnapshotError("AccessLens could not load the requested website.");
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        throw new WebsiteSnapshotError("The requested website returned an invalid redirect.");
      }
      currentUrl = new URL(location, currentUrl);
      continue;
    }

    if (!response.ok) {
      throw new WebsiteSnapshotError(`The requested website returned HTTP ${response.status}.`);
    }

    return { html: await readLimitedHtml(response), finalUrl: currentUrl };
  }

  throw new WebsiteSnapshotError("The requested website redirected too many times.");
}

function cleanText(value?: string | null, maxLength = 200) {
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function escapeAttribute(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function elementPath($: cheerio.CheerioAPI, element: AnyNode) {
  const parts: string[] = [];
  let current = $(element);

  while (current.length && current[0]?.type === "tag" && parts.length < 6) {
    const tag = current[0].name.toLowerCase();
    const id = current.attr("id");
    if (id) {
      parts.unshift(`[id="${escapeAttribute(id)}"]`);
      break;
    }

    const siblings = current.parent().children(tag);
    const index = siblings.index(current);
    parts.unshift(siblings.length > 1 ? `${tag}:nth-of-type(${index + 1})` : tag);
    current = current.parent();
  }

  return parts.join(" > ");
}

function selectorCandidates($: cheerio.CheerioAPI, element: AnyNode) {
  const control = $(element);
  const tag = element.type === "tag" ? element.name.toLowerCase() : "input";
  const id = control.attr("id");
  const name = control.attr("name");
  const candidates: string[] = [];

  if (id) {
    candidates.push(`[id="${escapeAttribute(id)}"]`);
  }

  if (name) {
    const byName = `${tag}[name="${escapeAttribute(name)}"]`;
    const form = control.closest("form");
    const formId = form.attr("id");
    const formName = form.attr("name");
    if (formId) candidates.push(`[id="${escapeAttribute(formId)}"] ${byName}`);
    if (formName) candidates.push(`form[name="${escapeAttribute(formName)}"] ${byName}`);
    if ($(byName).length === 1) candidates.push(byName);
  }

  candidates.push(elementPath($, element));
  return unique(candidates).slice(0, 8);
}

function getLabel($: cheerio.CheerioAPI, element: AnyNode) {
  const control = $(element);
  const id = control.attr("id");
  const explicitLabel = id
    ? $(`label[for="${escapeAttribute(id)}"]`).first().text()
    : "";
  const wrappedLabel = control.closest("label").first().text();
  const name = control.attr("name")?.replace(/[_-]+/g, " ");

  return cleanText(
    explicitLabel
      || wrappedLabel
      || control.attr("aria-label")
      || control.attr("placeholder")
      || name
      || `${element.type === "tag" ? element.name : "form"} field`
  );
}

function getFormContext($: cheerio.CheerioAPI, element: AnyNode) {
  const form = $(element).closest("form");
  return cleanText(
    form.attr("aria-label")
      || form.find("legend").first().text()
      || form.find("h1,h2,h3").first().text()
      || form.attr("name")
      || form.attr("id")
      || "Page form"
  );
}

function extractElements($: cheerio.CheerioAPI): DomElementSnapshot[] {
  const snapshots: DomElementSnapshot[] = [];
  const excludedInputTypes = new Set([
    "button", "checkbox", "color", "file", "hidden", "image", "password", "radio", "range", "reset", "submit"
  ]);

  $("input, select, textarea").each((_index, element) => {
    const control = $(element);
    const tag = element.name.toLowerCase() as DomElementSnapshot["tag"];
    const inputType = tag === "input" ? (control.attr("type") ?? "text").toLowerCase() : tag;
    if (excludedInputTypes.has(inputType)
      || control.is("[disabled], [readonly]")
      || control.attr("aria-hidden") === "true") {
      return;
    }

    const candidates = selectorCandidates($, element);
    if (!candidates[0]) return;

    snapshots.push({
      tag,
      selector: candidates[0],
      selectorCandidates: candidates,
      label: getLabel($, element),
      id: cleanText(control.attr("id")) || undefined,
      name: cleanText(control.attr("name")) || undefined,
      placeholder: cleanText(control.attr("placeholder")) || undefined,
      ariaLabel: cleanText(control.attr("aria-label")) || undefined,
      inputType: inputType.slice(0, 40),
      required: control.is("[required]") || control.attr("aria-required") === "true",
      options: tag === "select"
        ? control.find("option").map((_optionIndex, option) => cleanText($(option).text())).get().filter(Boolean).slice(0, 100)
        : [],
      formContext: getFormContext($, element)
    });
  });

  return snapshots.slice(0, 100);
}

export async function createWebsiteDomSnapshot(rawUrl: string): Promise<GenerateTemplateRequest> {
  let requestedUrl: URL;
  try {
    requestedUrl = new URL(rawUrl);
  } catch {
    throw new WebsiteSnapshotError("The website request contains an invalid URL.", 400);
  }

  const { html, finalUrl } = await fetchPublicHtml(requestedUrl);
  const $ = cheerio.load(html);
  const elements = extractElements($);

  if (elements.length === 0) {
    throw new WebsiteSnapshotError(
      "No supported form fields were found in the page HTML. The site may require sign-in or render its form only with JavaScript."
    );
  }

  return {
    url: finalUrl.href,
    title: cleanText($("title").first().text(), 300) || finalUrl.hostname,
    heading: cleanText($("h1").first().text(), 300) || undefined,
    language: cleanText($("html").attr("lang"), 30) || "en",
    elements
  };
}
