"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

// nspell has no bundled types. A minimal declaration keeps us honest without
// pulling in a community typings package.
type Nspell = {
  correct: (word: string) => boolean;
  suggest: (word: string) => string[];
};

type Dict = { aff: string; dic: string };

// Module-level cache so the dictionary is fetched and compiled at most once
// per tab, even if the component mounts/unmounts (e.g. navigation back and
// forth). The nspell object is several MB resident; reusing it matters.
let dictPromise: Promise<Nspell> | null = null;

function loadSpell(): Promise<Nspell> {
  if (dictPromise) return dictPromise;
  dictPromise = (async () => {
    const [{ default: nspell }, res] = await Promise.all([
      import("nspell") as Promise<{ default: (d: Dict) => Nspell }>,
      fetch("/api/dict/v1"),
    ]);
    if (!res.ok) throw new Error(`dict fetch failed: ${res.status}`);
    const dict = (await res.json()) as Dict;
    return nspell(dict);
  })();
  return dictPromise;
}

// Word tokenizer: letters plus internal apostrophes (so "don't" / "it's" are
// one word). Everything else is passed through as literal text.
const WORD_RE = /[A-Za-z]+(?:'[A-Za-z]+)*/g;

type WordHit = { word: string; start: number; end: number };

function wordAt(text: string, pos: number): WordHit | null {
  // Expand around `pos` to capture the surrounding word. If `pos` is at a
  // boundary (space, punctuation) between two words, prefer the word to the
  // left — that's what users expect when they click just past a typo.
  const isLetter = (ch: string | undefined) =>
    !!ch && /[A-Za-z']/.test(ch);
  let start = pos;
  let end = pos;
  if (!isLetter(text[pos]) && isLetter(text[pos - 1])) {
    start = pos - 1;
    end = pos - 1;
  }
  while (start > 0 && isLetter(text[start - 1])) start--;
  while (end < text.length && isLetter(text[end])) end++;
  // Trim leading/trailing apostrophes that aren't between letters.
  while (start < end && text[start] === "'") start++;
  while (end > start && text[end - 1] === "'") end--;
  if (end <= start) return null;
  return { word: text.slice(start, end), start, end };
}

type Props = {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  className?: string;
};

export default function SpellcheckTextarea({
  value,
  onChange,
  placeholder,
  className,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const [spell, setSpell] = useState<Nspell | null>(null);
  const [popup, setPopup] = useState<{
    hit: WordHit;
    suggestions: string[];
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadSpell()
      .then((s) => {
        if (!cancelled) setSpell(s);
      })
      .catch((err) => {
        // Non-fatal: the textarea still works, just without suggestions.
        console.error("spellchecker failed to load", err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Compute the backdrop children (misspelled words wrapped in <span>). We
  // deliberately rebuild on every render — it's O(text length) and a 300-word
  // essay is trivial.
  const backdropChildren = useMemo(() => {
    if (!spell) return value;
    const parts: Array<string | React.ReactElement> = [];
    let last = 0;
    WORD_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = WORD_RE.exec(value)) !== null) {
      if (m.index > last) parts.push(value.slice(last, m.index));
      const w = m[0];
      if (!spell.correct(w)) {
        parts.push(
          <span key={`${m.index}-${w}`} className="spell-miss">
            {w}
          </span>,
        );
      } else {
        parts.push(w);
      }
      last = m.index + w.length;
    }
    if (last < value.length) parts.push(value.slice(last));
    // Trailing newline guarantees the backdrop matches the textarea's
    // implicit last line (browsers add a line for a trailing \n).
    parts.push("\n");
    return parts;
  }, [value, spell]);

  // Keep the backdrop's scroll pinned to the textarea's so the underlines
  // stay aligned even when the content overflows.
  const syncScroll = useCallback(() => {
    const ta = textareaRef.current;
    const bd = backdropRef.current;
    if (!ta || !bd) return;
    bd.scrollTop = ta.scrollTop;
    bd.scrollLeft = ta.scrollLeft;
  }, []);

  useLayoutEffect(() => {
    syncScroll();
  }, [value, syncScroll]);

  // Click handling: find the word at the caret position, show suggestions if
  // it's misspelled. We run on mouseup rather than click so `selectionStart`
  // reflects the new caret position (on some browsers click fires before the
  // selection updates).
  function onMouseUp(e: React.MouseEvent<HTMLTextAreaElement>) {
    if (!spell) return;
    const ta = e.currentTarget;
    // Ignore text-selection drags — only handle plain single-position clicks.
    if (ta.selectionStart !== ta.selectionEnd) {
      setPopup(null);
      return;
    }
    const hit = wordAt(value, ta.selectionStart);
    if (!hit || spell.correct(hit.word)) {
      setPopup(null);
      return;
    }
    const suggestions = spell.suggest(hit.word).slice(0, 6);
    // Position the popup relative to the wrapper so it follows the textarea
    // if the page scrolls. clientX/Y are viewport coords; subtract the
    // wrapper's bounding rect to go wrapper-relative.
    const wrapRect = wrapperRef.current?.getBoundingClientRect();
    const x = wrapRect ? e.clientX - wrapRect.left : e.clientX;
    const y = wrapRect ? e.clientY - wrapRect.top + 18 : e.clientY + 18;
    setPopup({ hit, suggestions, x, y });
  }

  function replaceWith(replacement: string) {
    if (!popup) return;
    const next =
      value.slice(0, popup.hit.start) +
      replacement +
      value.slice(popup.hit.end);
    onChange(next);
    setPopup(null);
    // Restore focus + place caret just past the replacement.
    requestAnimationFrame(() => {
      const ta = textareaRef.current;
      if (!ta) return;
      const caret = popup.hit.start + replacement.length;
      ta.focus();
      ta.setSelectionRange(caret, caret);
    });
  }

  // Dismiss the popup on any outside click or on Escape.
  useEffect(() => {
    if (!popup) return;
    function onDown(e: MouseEvent) {
      const target = e.target as Node | null;
      if (!target) return;
      // Click inside the popup handled by the button's onClick; anything else
      // dismisses.
      if (
        wrapperRef.current?.contains(target) &&
        (target as HTMLElement).closest?.("[data-spell-popup]")
      ) {
        return;
      }
      setPopup(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setPopup(null);
    }
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [popup]);

  return (
    <div ref={wrapperRef} className={`spell-wrap ${className ?? ""}`}>
      <div ref={backdropRef} aria-hidden className="spell-backdrop">
        {backdropChildren}
      </div>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          if (popup) setPopup(null);
        }}
        onScroll={syncScroll}
        onMouseUp={onMouseUp}
        onKeyDown={() => {
          if (popup) setPopup(null);
        }}
        placeholder={placeholder}
        // We render our own underlines; disable the browser's to avoid doubles.
        spellCheck={false}
        lang="en"
        className="spell-textarea"
      />
      {popup && (
        <div
          data-spell-popup
          className="spell-popup"
          style={{ left: popup.x, top: popup.y }}
        >
          <div className="spell-popup-header">{popup.hit.word}</div>
          {popup.suggestions.length === 0 ? (
            <div className="spell-popup-empty">No suggestions</div>
          ) : (
            popup.suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => replaceWith(s)}
                className="spell-popup-item"
              >
                {s}
              </button>
            ))
          )}
        </div>
      )}
      <style jsx>{`
        .spell-wrap {
          position: relative;
          width: 100%;
          height: 100%;
        }
        /* Backdrop and textarea share EVERY layout-affecting property so the
           underlines in the backdrop sit exactly under the textarea's text. */
        .spell-backdrop,
        .spell-textarea {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          border: 1px solid rgb(212 212 212);
          border-radius: 0.375rem;
          padding: 0.75rem;
          font-family: inherit;
          font-size: 0.875rem;
          line-height: 1.5rem;
          letter-spacing: normal;
          white-space: pre-wrap;
          word-wrap: break-word;
          overflow-wrap: break-word;
          box-sizing: border-box;
        }
        .spell-backdrop {
          overflow: hidden;
          pointer-events: none;
          color: transparent;
          background: white;
          user-select: none;
        }
        .spell-textarea {
          resize: none;
          background: transparent;
          color: rgb(23 23 23);
          overflow: auto;
        }
        .spell-textarea:focus {
          outline: 2px solid transparent;
          outline-offset: 2px;
          border-color: rgb(0 0 0 / 0.4);
        }
        .spell-popup {
          position: absolute;
          z-index: 50;
          min-width: 140px;
          max-width: 240px;
          background: white;
          border: 1px solid rgb(212 212 212);
          border-radius: 0.375rem;
          box-shadow: 0 4px 12px rgb(0 0 0 / 0.08);
          padding: 0.25rem 0;
          font-size: 0.8125rem;
        }
        .spell-popup-header {
          padding: 0.25rem 0.75rem;
          font-size: 0.6875rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: rgb(115 115 115);
          border-bottom: 1px solid rgb(229 229 229);
          margin-bottom: 0.25rem;
        }
        .spell-popup-empty {
          padding: 0.375rem 0.75rem;
          color: rgb(115 115 115);
        }
        .spell-popup-item {
          display: block;
          width: 100%;
          text-align: left;
          padding: 0.375rem 0.75rem;
          background: transparent;
          border: none;
          cursor: pointer;
          font: inherit;
          color: inherit;
        }
        .spell-popup-item:hover,
        .spell-popup-item:focus {
          background: rgb(245 245 245);
          outline: none;
        }
      `}</style>
      <style jsx global>{`
        .spell-miss {
          text-decoration: underline wavy rgb(220 38 38);
          text-decoration-skip-ink: none;
          text-underline-offset: 2px;
        }
      `}</style>
    </div>
  );
}
