import { type ReactNode, useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  CheckCircle,
  FileText,
  Loader2,
  RefreshCw,
  ScanLine,
  Send,
  Server,
  Shield,
  XCircle,
} from "lucide-react";

type Verdict = "legitimate" | "suspicious" | "fraudulent";
type RowStatus = "ok" | "warn" | "bad";

interface ChromeTab {
  id?: number;
  url?: string;
}

interface ChromeScriptResult<T> {
  result?: T;
}

interface ChromeExtensionApi {
  runtime?: {
    id?: string;
    lastError?: {
      message?: string;
    };
  };
  tabs?: {
    query: (queryInfo: { active: boolean; currentWindow: boolean }) => Promise<ChromeTab[]>;
  };
  scripting?: {
    executeScript: <T>(injection: {
      target: { tabId: number };
      func: () => T;
    }) => Promise<ChromeScriptResult<T>[]>;
  };
}

declare const chrome: ChromeExtensionApi | undefined;

interface RuleFinding {
  category: string;
  reason: string;
  score: number;
}

interface RuleAnalysis {
  rule_score: number;
  reasons: string[];
  triggered_rules: string[];
  findings: RuleFinding[];
}

interface DomainAnalysis {
  emails_found: string[];
  urls_found: string[];
  domain_risk: string;
  risk_flags: string[];
}

interface PredictReport {
  prediction: string;
  summary: string;
  risk_score: number;
  confidence: string;
  fraud_probability: number;
  reasons: string[];
  recommendation: string;
  rule_analysis: RuleAnalysis;
  domain_analysis: DomainAnalysis;
}

interface PageExtraction {
  text: string;
  title: string;
  url: string;
  isLikelyJobPage: boolean;
  matchCount: number;
}

interface ScanResult {
  verdict: Verdict;
  score: number;
  verdictLabel: string;
  summary: string;
  recommendation: string;
  reasons: string[];
  source?: PageExtraction;
  rows: { icon: ReactNode; label: string; value: string; status: RowStatus }[];
}

function getChromeApi() {
  if (typeof chrome === "undefined") {
    return null;
  }

  if (!chrome?.runtime?.id || !chrome.tabs || !chrome.scripting) {
    return null;
  }

  return chrome;
}

const IS_EXTENSION = Boolean(getChromeApi());
const DEFAULT_API_BASE_URL = IS_EXTENSION ? "http://127.0.0.1:8000" : "/api";
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, "") || DEFAULT_API_BASE_URL;

const VERDICT_STYLE = {
  legitimate: {
    badge: "bg-green-50 text-green-700 border border-green-200",
    bar: "bg-green-500",
    icon: CheckCircle,
    iconColor: "text-green-500",
  },
  suspicious: {
    badge: "bg-amber-50 text-amber-700 border border-amber-200",
    bar: "bg-amber-400",
    icon: AlertTriangle,
    iconColor: "text-amber-500",
  },
  fraudulent: {
    badge: "bg-red-50 text-red-700 border border-red-200",
    bar: "bg-red-500",
    icon: XCircle,
    iconColor: "text-red-500",
  },
};

const STATUS_ICONS = {
  ok: <CheckCircle className="w-4 h-4 text-green-500" />,
  warn: <AlertTriangle className="w-4 h-4 text-amber-400" />,
  bad: <XCircle className="w-4 h-4 text-red-500" />,
};

function extractPageContent(): PageExtraction {
  const selectors = [
    "article",
    "[role='main']",
    "main",
    "[class*='job-description' i]",
    "[class*='jobdescription' i]",
    "[class*='job-details' i]",
    "[class*='job_post' i]",
    "[class*='job-post' i]",
    "[class*='vacancy' i]",
    "[class*='posting' i]",
    "[id*='job-description' i]",
    "[id*='jobdetails' i]",
    "[id*='job-details' i]",
    ".description",
    ".details",
    ".content",
  ];

  const normalize = (value: string) =>
    value
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

  const candidates: string[] = [];

  for (const selector of selectors) {
    for (const element of Array.from(document.querySelectorAll<HTMLElement>(selector))) {
      const text = normalize(element.innerText || "");

      if (text.length > 120) {
        candidates.push(text);
      }
    }
  }

  const bestCandidate =
    candidates.sort((a, b) => b.length - a.length)[0] || normalize(document.body?.innerText || "");

  const headings = Array.from(document.querySelectorAll<HTMLElement>("h1, h2"))
    .map((element) => normalize(element.innerText || ""))
    .filter(Boolean)
    .slice(0, 8)
    .join("\n");

  const metaDescription =
    document.querySelector<HTMLMetaElement>("meta[name='description']")?.content || "";

  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"))
    .map((anchor) => anchor.href)
    .filter(Boolean)
    .slice(0, 40)
    .join("\n");

  const text = normalize(
    [document.title, metaDescription, headings, bestCandidate, links].filter(Boolean).join("\n\n"),
  );

  const lower = text.toLowerCase();
  const keywords = [
    "job",
    "vacancy",
    "role",
    "position",
    "responsibilities",
    "requirements",
    "qualifications",
    "apply",
    "salary",
    "employment",
    "full time",
    "part time",
    "internship",
    "recruiter",
    "candidate",
    "experience",
  ];

  const matchCount = keywords.reduce(
    (count, keyword) => count + (lower.includes(keyword) ? 1 : 0),
    0,
  );
  const urlLooksLikeJob = /job|career|vacanc|recruit|apply|position/i.test(window.location.href);

  return {
    text,
    title: document.title || "Current page",
    url: window.location.href,
    isLikelyJobPage: matchCount >= 3 || urlLooksLikeJob,
    matchCount,
  };
}

function limitJobText(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();

  if (normalized.length <= 19_000) {
    return normalized;
  }

  return `${normalized.slice(0, 15_000)}\n\n[Content shortened]\n\n${normalized.slice(-3_500)}`;
}

async function extractCurrentTab() {
  const chromeApi = getChromeApi();

  if (!chromeApi?.tabs || !chromeApi.scripting) {
    throw new Error("Open VeriJob as a Chrome extension to scan the current page.");
  }

  const [tab] = await chromeApi.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id) {
    throw new Error("Could not access the active tab.");
  }

  if (tab.url && /^(chrome|edge|about):\/\//i.test(tab.url)) {
    throw new Error("Chrome does not allow extensions to scan this page.");
  }

  const [injection] = await chromeApi.scripting.executeScript<PageExtraction>({
    target: { tabId: tab.id },
    func: extractPageContent,
  });

  const lastError = chromeApi.runtime?.lastError?.message;

  if (lastError) {
    throw new Error(lastError);
  }

  if (!injection?.result?.text) {
    throw new Error("No readable job text was found on this page.");
  }

  return {
    ...injection.result,
    text: limitJobText(injection.result.text),
  };
}

function getVerdict(prediction: string): Verdict {
  const normalized = prediction.toLowerCase();

  if (normalized === "fraudulent") {
    return "fraudulent";
  }

  if (normalized === "suspicious") {
    return "suspicious";
  }

  return "legitimate";
}

function getVerdictLabel(verdict: Verdict) {
  if (verdict === "fraudulent") {
    return "Likely Scam";
  }

  if (verdict === "suspicious") {
    return "Suspicious";
  }

  return "Likely Legit";
}

function getStatusForVerdict(verdict: Verdict): RowStatus {
  if (verdict === "fraudulent") {
    return "bad";
  }

  if (verdict === "suspicious") {
    return "warn";
  }

  return "ok";
}

function getStatusForDomain(domainRisk: string): RowStatus {
  const normalized = domainRisk.toLowerCase();

  if (normalized.includes("suspicious")) {
    return "bad";
  }

  if (normalized.includes("caution")) {
    return "warn";
  }

  return "ok";
}

function formatPercent(value: number) {
  return `${Number.isInteger(value) ? value : value.toFixed(2)}%`;
}

function getUrlHost(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function mapReportToResult(report: PredictReport, source?: PageExtraction): ScanResult {
  const verdict = getVerdict(report.prediction);
  const verdictStatus = getStatusForVerdict(verdict);
  const ruleCount = report.rule_analysis.triggered_rules.length;
  const domainFlagCount = report.domain_analysis.risk_flags.length;
  const totalFlagCount = ruleCount + domainFlagCount;

  return {
    verdict,
    score: Math.round(report.risk_score),
    verdictLabel: getVerdictLabel(verdict),
    summary: report.summary,
    recommendation: report.recommendation,
    reasons: report.reasons,
    source,
    rows: [
      {
        icon: <Building2 className="w-4 h-4" />,
        label: "Prediction",
        value: report.prediction,
        status: verdictStatus,
      },
      {
        icon: <FileText className="w-4 h-4" />,
        label: "Fraud probability",
        value: formatPercent(report.fraud_probability),
        status: verdictStatus,
      },
      {
        icon: <Server className="w-4 h-4" />,
        label: "Domain risk",
        value: report.domain_analysis.domain_risk,
        status: getStatusForDomain(report.domain_analysis.domain_risk),
      },
      {
        icon: <AlertTriangle className="w-4 h-4" />,
        label: "Rule flags",
        value: totalFlagCount === 0 ? "None detected" : `${totalFlagCount} detected`,
        status: totalFlagCount === 0 ? "ok" : verdictStatus,
      },
    ],
  };
}

async function getErrorMessage(response: Response) {
  try {
    const body = await response.json();
    const detail = body?.detail;

    if (typeof detail === "string") {
      return detail;
    }

    if (Array.isArray(detail)) {
      const messages = detail
        .map((item) => item?.msg)
        .filter(Boolean)
        .map((message) => String(message).replace(/^Value error,\s*/i, ""));

      if (messages.length > 0) {
        return messages.join(" ");
      }
    }
  } catch {
    // Fall through to the generic HTTP message below.
  }

  return `Request failed with status ${response.status}`;
}

async function requestPrediction(jobText: string) {
  const response = await fetch(`${API_BASE_URL}/predict`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      job_text: jobText,
    }),
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  return (await response.json()) as PredictReport;
}

export default function App() {
  const [jobText, setJobText] = useState("");
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const trimmedText = useMemo(() => jobText.trim(), [jobText]);
  const canScanManualText = trimmedText.length >= 20 && !scanning;

  const scanText = async (text: string, source?: PageExtraction) => {
    const preparedText = limitJobText(text);

    if (preparedText.length < 20) {
      throw new Error("Job text is too short to analyze");
    }

    const report = await requestPrediction(preparedText);
    setResult(mapReportToResult(report, source));
  };

  const handleScanPage = async () => {
    setScanning(true);
    setResult(null);
    setError(null);

    try {
      const source = await extractCurrentTab();

      if (!source.isLikelyJobPage) {
        throw new Error("This does not appear to be a job listing page.");
      }

      await scanText(source.text, source);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not scan the current page. Make sure the VeriJob API is running.",
      );
    } finally {
      setScanning(false);
    }
  };

  const handleManualScan = async () => {
    setScanning(true);
    setResult(null);
    setError(null);

    try {
      await scanText(trimmedText);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not reach the VeriJob API. Start the backend on http://127.0.0.1:8000 and try again.",
      );
    } finally {
      setScanning(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setError(null);
  };

  const cfg = result ? VERDICT_STYLE[result.verdict] : null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f0f2f5] px-4 py-5 font-['Inter',system-ui,sans-serif]">
      <div className="w-full max-w-[430px] bg-white rounded-2xl shadow-xl overflow-hidden border border-black/[0.06]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" strokeWidth={2.5} />
            </div>
            <span className="text-[15px] font-semibold text-gray-900">VeriJob</span>
          </div>
          <button
            type="button"
            onClick={() => window.open(`${API_BASE_URL}/`, "_blank", "noopener,noreferrer")}
            className="h-8 w-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-colors cursor-pointer"
            aria-label="Open API status"
            title="Open API status"
          >
            <Server className="w-[18px] h-[18px]" />
          </button>
        </div>

        <div className="px-5 py-5">
          {!result && !scanning && (
            <div className="flex flex-col py-3 gap-4">
              <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center">
                <Shield className="w-8 h-8 text-blue-600" strokeWidth={1.5} />
              </div>

              {IS_EXTENSION ? (
                <button
                  onClick={handleScanPage}
                  className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-[14px] font-semibold text-white transition-colors hover:bg-blue-700 active:bg-blue-800"
                >
                  <ScanLine className="w-4 h-4" />
                  Scan Current Page
                </button>
              ) : (
                <>
                  <div>
                    <label htmlFor="jobText" className="text-[13px] font-semibold text-gray-900">
                      Job listing text
                    </label>
                    <textarea
                      id="jobText"
                      value={jobText}
                      onChange={(event) => {
                        setJobText(event.target.value);
                        setError(null);
                      }}
                      className="mt-2 h-40 w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-[13px] leading-5 text-gray-800 outline-none transition-colors placeholder:text-gray-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
                      placeholder="Paste the job advert, recruiter message, or vacancy description."
                    />
                    <div className="mt-2 flex items-center justify-between text-[12px] text-gray-400">
                      <span>{trimmedText.length.toLocaleString()} characters</span>
                      <span>Minimum 20</span>
                    </div>
                  </div>

                  <button
                    onClick={handleManualScan}
                    disabled={!canScanManualText}
                    className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-[14px] font-semibold text-white transition-colors hover:bg-blue-700 active:bg-blue-800 disabled:cursor-not-allowed disabled:bg-gray-300"
                  >
                    <Send className="w-4 h-4" />
                    Scan Text
                  </button>
                </>
              )}

              {error && (
                <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-[13px] leading-5 text-red-700">
                  {error}
                </div>
              )}
            </div>
          )}

          {scanning && (
            <div className="flex flex-col items-center py-8 gap-3">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              <p className="text-[13px] text-gray-400">Analyzing job listing...</p>
            </div>
          )}

          {result && cfg && (
            <div>
              {result.source && (
                <div className="mb-4 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                  <p className="truncate text-[12px] font-semibold text-gray-700">
                    {result.source.title}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-gray-400">
                    {getUrlHost(result.source.url)}
                  </p>
                </div>
              )}

              <div className="mb-4">
                <p className="text-[11px] font-medium text-gray-400 uppercase mb-2">
                  Risk Score
                </p>
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-gray-900">{result.score}</span>
                    <span className="text-base text-gray-400 font-medium">/100</span>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-semibold ${cfg.badge}`}>
                    <cfg.icon className={`w-3.5 h-3.5 ${cfg.iconColor}`} />
                    {result.verdictLabel}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${cfg.bar}`}
                    style={{ width: `${result.score}%` }}
                  />
                </div>
              </div>

              <div className="h-px bg-gray-100 mb-4" />

              <div className="flex flex-col gap-0">
                {result.rows.map((row, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0"
                  >
                    <div className="flex items-center gap-2.5 text-gray-400">
                      {row.icon}
                      <span className="text-[13px] text-gray-600">{row.label}</span>
                    </div>
                    <div className="flex max-w-[190px] items-center justify-end gap-1.5 text-right">
                      <span className={`text-[13px] font-medium ${
                        row.status === "ok" ? "text-green-600" : row.status === "warn" ? "text-amber-600" : "text-red-600"
                      }`}>
                        {row.value}
                      </span>
                      {STATUS_ICONS[row.status]}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-xl bg-gray-50 px-3 py-3">
                <p className="text-[13px] leading-5 text-gray-700">{result.summary}</p>
                <p className="mt-2 text-[12px] leading-5 text-gray-500">{result.recommendation}</p>
              </div>

              {result.reasons.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-[11px] font-medium uppercase text-gray-400">Detected Reasons</p>
                  <ul className="flex flex-col gap-2">
                    {result.reasons.slice(0, 4).map((reason) => (
                      <li key={reason} className="flex gap-2 text-[12px] leading-5 text-gray-600">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                        <span>{reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <button
                onClick={handleReset}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 py-2.5 text-[13px] font-medium text-gray-500 transition-colors hover:bg-gray-50"
              >
                <RefreshCw className="w-4 h-4" />
                Scan Another
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
