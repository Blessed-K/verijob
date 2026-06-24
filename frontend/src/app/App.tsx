/// <reference types="vite/client" />

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
const DEFAULT_API_BASE_URL = IS_EXTENSION ? "https://verijob-api.onrender.com" : "/api";
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
    return "High Fraud Risk";
  }

  if (verdict === "suspicious") {
    return "Needs Verification";
  }

  return "Verified Safe";
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
  const shellHeightClass = IS_EXTENSION ? "" : "min-h-[420px]";

  return (
    <div className={IS_EXTENSION
      ? "bg-[#f8fafc] p-2.5 font-['Inter',system-ui,sans-serif]"
      : "min-h-screen bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.15),_transparent_35%),linear-gradient(180deg,#eef4ff_0%,#f8fafc_48%,#eef2f7_100%)] px-4 py-4 font-['Inter',system-ui,sans-serif]"
    }>
      <div
        className={IS_EXTENSION
          ? "w-full flex flex-col overflow-hidden rounded-[20px] border border-slate-200/80 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.03)] max-h-card"
          : `mx-auto flex w-full max-w-[380px] flex-col overflow-hidden rounded-[24px] border border-white/70 bg-white/95 shadow-[0_20px_50px_rgba(15,23,42,0.08)] backdrop-blur transition-all duration-300 ${shellHeightClass} max-h-card`
        }
      >
        <div className="border-b border-slate-100/80 px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 shadow-[0_8px_20px_rgba(37,99,235,0.25)]">
              <Shield className="h-5 w-5 text-white" strokeWidth={2.2} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[16px] font-bold tracking-tight text-slate-950">VeriJob</span>
                <span className="rounded-full border border-blue-100 bg-blue-50/50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-blue-600">
                  Scam Detector
                </span>
              </div>
              <p className="mt-1 text-[12px] leading-4.5 text-slate-500">
                Analyze job posts and flag recruitment scams before you apply.
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {!result && !scanning && (
            <div className="flex flex-col gap-4">
              <div className="rounded-2xl border border-slate-100 bg-gradient-to-br from-slate-50 to-blue-50/40 p-4">
                <p className="text-[12px] font-semibold text-slate-900 mb-3">Analysis Indicators:</p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="flex flex-col items-center justify-center rounded-xl bg-white p-2 shadow-[0_2px_8px_rgba(0,0,0,0.02)] ring-1 ring-slate-100">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600 mb-1">
                      <ScanLine className="h-4 w-4" />
                    </div>
                    <span className="text-[10px] font-medium text-slate-600">Risk Score</span>
                  </div>
                  <div className="flex flex-col items-center justify-center rounded-xl bg-white p-2 shadow-[0_2px_8px_rgba(0,0,0,0.02)] ring-1 ring-slate-100">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600 mb-1">
                      <AlertTriangle className="h-4 w-4" />
                    </div>
                    <span className="text-[10px] font-medium text-slate-600">Rule Flags</span>
                  </div>
                  <div className="flex flex-col items-center justify-center rounded-xl bg-white p-2 shadow-[0_2px_8px_rgba(0,0,0,0.02)] ring-1 ring-slate-100">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-green-50 text-green-600 mb-1">
                      <Building2 className="h-4 w-4" />
                    </div>
                    <span className="text-[10px] font-medium text-slate-600">Domain Risk</span>
                  </div>
                </div>
              </div>

              {IS_EXTENSION ? (
                <button
                  onClick={handleScanPage}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-3.5 text-[13px] font-semibold text-white shadow-[0_10px_24px_rgba(37,99,235,0.2)] transition-all duration-200 hover:from-blue-700 hover:to-indigo-700 active:scale-[0.98]"
                >
                  <ScanLine className="h-4 w-4" />
                  Scan Current Page
                </button>
              ) : (
                <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                  <label htmlFor="jobText" className="text-[12px] font-semibold text-slate-900">
                    Job listing text
                  </label>
                  <textarea
                    id="jobText"
                    value={jobText}
                    onChange={(event) => {
                      setJobText(event.target.value);
                      setError(null);
                    }}
                    className="mt-2 h-32 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-[13px] leading-5 text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
                    placeholder="Paste the job details or recruiter message to scan."
                  />
                  <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                    <span>{trimmedText.length.toLocaleString()} characters</span>
                    <span>Min 20 characters</span>
                  </div>

                  <button
                    onClick={handleManualScan}
                    disabled={!canScanManualText}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-3 text-[13px] font-semibold text-white shadow-[0_10px_24px_rgba(37,99,235,0.2)] transition-all duration-200 hover:from-blue-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400 disabled:shadow-none"
                  >
                    <Send className="h-4 w-4" />
                    Scan Text
                  </button>
                </div>
              )}

              {error && (
                <div className="rounded-xl border border-red-100 bg-red-50/70 px-3 py-2 text-[12px] leading-5 text-red-700">
                  {error}
                </div>
              )}
            </div>
          )}

          {scanning && (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <Loader2 className="h-7 w-7 animate-spin text-blue-600" />
              <div>
                <p className="text-[13px] font-semibold text-slate-900">Analyzing job listing</p>
                <p className="mt-1 text-[11px] text-slate-500">This usually takes a few seconds.</p>
              </div>
            </div>
          )}

          {result && cfg && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-100 bg-slate-50/50 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                      Result source
                    </p>
                    {result.source ? (
                      <>
                        <p className="mt-1 truncate text-[13px] font-bold text-slate-800">
                          {result.source.title}
                        </p>
                        <p className="mt-0.5 truncate text-[11px] text-slate-400">{getUrlHost(result.source.url)}</p>
                      </>
                    ) : (
                      <p className="mt-1 text-[13px] font-bold text-slate-800">Manual text scan</p>
                    )}
                  </div>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${cfg.badge}`}
                  >
                    <cfg.icon className={`h-3.5 w-3.5 ${cfg.iconColor}`} />
                    {result.verdictLabel}
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                      Scam Risk Score
                    </p>
                    <div className="mt-1 flex items-baseline gap-1">
                      <span className="text-3xl font-extrabold tracking-tight text-slate-950">
                        {result.score}%
                      </span>
                    </div>
                  </div>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${cfg.bar}`}
                    style={{ width: `${result.score}%` }}
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                <div className="grid gap-2">
                  {result.rows.map((row, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-xl bg-slate-50/50 px-3 py-2"
                    >
                      <div className="flex items-center gap-2 text-slate-400">
                        <span className="text-slate-500">{row.icon}</span>
                        <span className="text-[12px] font-medium text-slate-600">{row.label}</span>
                      </div>
                      <div className="flex max-w-[190px] items-center justify-end gap-1.5 text-right">
                        <span
                          className={`text-[12px] font-semibold ${
                            row.status === "ok" ? "text-green-600" : row.status === "warn" ? "text-amber-600" : "text-red-600"
                          }`}
                        >
                          {row.value}
                        </span>
                        {STATUS_ICONS[row.status]}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3.5">
                <p className="text-[12px] font-medium leading-5 text-slate-700">{result.summary}</p>
                <p className="mt-1.5 text-[11px] leading-4 text-slate-500 border-t border-slate-200/55 pt-2">{result.recommendation}</p>
              </div>

              {result.reasons.length > 0 && (
                <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Risk Factors Detected
                  </p>
                  <ul className="flex flex-col gap-2">
                    {result.reasons.slice(0, 4).map((reason) => (
                      <li key={reason} className="flex gap-2 rounded-xl bg-amber-50/30 p-2 border border-amber-100/30 text-[11px] leading-4 text-slate-600">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                        <span>{reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <button
                onClick={handleReset}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-2.5 text-[12px] font-bold text-slate-600 transition-colors hover:bg-slate-50"
              >
                <RefreshCw className="h-4 w-4" />
                Scan Another Page
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
