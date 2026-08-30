import { useEffect, useMemo, useRef, useState } from "react";
import { PROJECT, SHARE_CONFIG } from "./config";
import { createShareLinks } from "./share";
import type { RfcNode } from "./types";

type CopyStatus = "idle" | "copied" | "failed";

interface CopyFeedback {
  canonicalUrl: string;
  status: CopyStatus;
}

function copyWithSelection(value: string): boolean {
  const focusedElement = document.activeElement;
  const input = document.createElement("textarea");
  input.value = value;
  input.setAttribute("readonly", "");
  input.tabIndex = -1;
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  try {
    input.select();
    return document.execCommand("copy");
  } finally {
    input.remove();
    if (focusedElement instanceof HTMLElement) focusedElement.focus();
  }
}

async function copyText(value: string): Promise<boolean> {
  if (!navigator.clipboard?.writeText) return copyWithSelection(value);

  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return copyWithSelection(value);
  }
}

export default function ShareLinks({ node }: { node: RfcNode }) {
  const links = useMemo(() => createShareLinks(node, PROJECT.url), [node]);
  const [copyFeedback, setCopyFeedback] = useState<CopyFeedback>({
    canonicalUrl: links.canonicalUrl,
    status: "idle",
  });
  const feedbackTimer = useRef(0);

  useEffect(() => () => window.clearTimeout(feedbackTimer.current), []);

  const copyLink = async () => {
    try {
      if (!(await copyText(links.canonicalUrl))) throw new Error("Copy unavailable");
      setCopyFeedback({ canonicalUrl: links.canonicalUrl, status: "copied" });
    } catch {
      setCopyFeedback({ canonicalUrl: links.canonicalUrl, status: "failed" });
    }
    window.clearTimeout(feedbackTimer.current);
    feedbackTimer.current = window.setTimeout(
      () => setCopyFeedback({ canonicalUrl: links.canonicalUrl, status: "idle" }),
      SHARE_CONFIG.feedbackDurationMs,
    );
  };

  const copyStatus =
    copyFeedback.canonicalUrl === links.canonicalUrl ? copyFeedback.status : "idle";
  const statusMessage =
    copyStatus === "copied" ? "Link copied" : copyStatus === "failed" ? "Copy failed" : "";
  const linkAttributes = { target: "_blank", rel: "nofollow noopener noreferrer" } as const;

  return (
    <div className="share-row">
      <span
        className={`share-label${copyStatus === "idle" ? "" : " share-feedback"}`}
        role="status"
        aria-live="polite"
      >
        {statusMessage || "Share"}
      </span>
      <div className="share-actions">
        <a
          className="share-button"
          href={links.x}
          {...linkAttributes}
          aria-label={`Share RFC ${node.number} on X`}
        >
          <span className="share-icon share-x" aria-hidden="true" />
        </a>
        <a
          className="share-button"
          href={links.bluesky}
          {...linkAttributes}
          aria-label={`Share RFC ${node.number} on Bluesky`}
        >
          <span className="share-icon share-bluesky" aria-hidden="true" />
        </a>
        <a
          className="share-button"
          href={links.linkedin}
          {...linkAttributes}
          aria-label={`Share RFC ${node.number} on LinkedIn`}
        >
          <span className="share-icon share-linkedin" aria-hidden="true" />
        </a>
        <button
          className="share-button"
          type="button"
          onClick={() => void copyLink()}
          aria-label={`Copy link to RFC ${node.number}`}
        >
          <span className="share-icon share-copy" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
