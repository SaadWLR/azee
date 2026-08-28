import { useId, useState, type ReactNode } from "react";

/**
 * A small disclosure list, for FAQs.
 *
 * Built rather than reached for: nothing in this repo had one. It is
 * deliberately plain — a button that owns the open state, wired to its
 * panel with aria-controls/aria-expanded, and a panel that is actually
 * removed from the tree when closed rather than hidden with CSS. A
 * visually-hidden-but-present answer is still read by a screen reader
 * and still found by in-page search, which makes "collapsed" a lie.
 *
 * One item open at a time, because these are alternative questions
 * rather than a checklist, and a reader who opens the fourth is done
 * with the first.
 */

export interface AccordionItem {
  question: string;
  answer: ReactNode;
}

export function Accordion({ items }: { items: AccordionItem[] }) {
  const [open, setOpen] = useState<number | null>(0);
  const uid = useId().replace(/:/g, "");

  return (
    <div className="divide-y divide-white/10 border-y border-white/10">
      {items.map((item, i) => {
        const isOpen = open === i;
        const panelId = `${uid}-panel-${i}`;
        const buttonId = `${uid}-button-${i}`;
        return (
          <div key={item.question}>
            <h3>
              <button
                id={buttonId}
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpen(isOpen ? null : i)}
                className="flex w-full items-center justify-between gap-6 py-5 text-left"
              >
                <span className="text-[15px] font-semibold text-[rgb(var(--azee-chalk))] sm:text-base">
                  {item.question}
                </span>
                {/* A plus that becomes a minus: rotating one stroke of
                    a cross is legible at this size where a chevron's
                    direction is not. */}
                <svg
                  aria-hidden="true"
                  viewBox="0 0 16 16"
                  className="h-4 w-4 shrink-0 text-[rgb(var(--azee-orange))]"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                >
                  <line x1="2" y1="8" x2="14" y2="8" />
                  <line
                    x1="8"
                    y1="2"
                    x2="8"
                    y2="14"
                    className="origin-center transition-transform duration-300"
                    style={{
                      transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
                    }}
                  />
                </svg>
              </button>
            </h3>
            {isOpen ? (
              <div
                id={panelId}
                role="region"
                aria-labelledby={buttonId}
                className="pb-5 pr-10 text-sm leading-relaxed text-white/65"
              >
                {item.answer}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
