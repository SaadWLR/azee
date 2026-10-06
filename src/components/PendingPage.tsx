import type { ReactNode } from "react";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { usePageMeta } from "../hooks/usePageMeta";

/**
 * The shared shell for a route whose SHAPE is real and whose DATA is
 * honestly absent.
 *
 * Extracted from MutualFundsPage, which was the first page built this
 * way and still renders through it byte-for-byte. The pattern it
 * encodes: say what the page will carry, say plainly that no verified
 * source is connected yet, and show NO figure of any kind until one
 * is. A placeholder that invents a plausible row is worse than no
 * page at all, because a reader cannot tell the difference.
 *
 * `columns` renders the real table head with an empty body. That is
 * deliberately a <table>, not a picture of one: the column set is the
 * part of the design that is already decided, and showing it with an
 * explicit empty state is honest about what is missing. No row is ever
 * generated here — there is no code path in this file that can emit a
 * number.
 *
 * NOTHING INTERACTIVE. No filters, tabs or buttons that would do
 * nothing when clicked. Where a page will eventually have controls,
 * the copy describes them instead.
 */

export interface IntendedField {
  name: string;
  note: string;
}

export interface PendingPageProps {
  /** Small label above the title, e.g. "Markets". */
  eyebrow: string;
  title: string;
  /** Browser/SEO title and description. */
  metaTitle: string;
  metaDescription: string;
  /** The sentence under the title. */
  lead: ReactNode;
  /** The body of the "Content pending" panel. */
  pending: ReactNode;
  /** What the page is intended to carry. Intent, not data. */
  intended: IntendedField[];
  intendedHeading?: string;
  /** Column headers of the table this page will show, if it has one. */
  columns?: string[];
  /** Caption above the empty table. */
  columnsHeading?: string;
  /** Anything page-specific, rendered inside the panel after the list. */
  children?: ReactNode;
  /** Tailwind max-width for the column; wider when a table is shown. */
  maxWidth?: string;
}

export function PendingPage({
  eyebrow,
  title,
  metaTitle,
  metaDescription,
  lead,
  pending,
  intended,
  intendedHeading = "What this page will show:",
  columns,
  columnsHeading = "Columns this page will carry:",
  children,
  maxWidth = "max-w-3xl",
}: PendingPageProps) {
  usePageMeta(metaTitle, metaDescription);

  return (
    <main className="min-h-screen text-white">
      <Navbar />

      <section className="section-tint-a relative px-4 pb-20 pt-[calc(var(--nav-height)+2.5rem)] sm:px-6 lg:px-12">
        <div className={`mx-auto ${maxWidth}`}>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-300/90">
            {eyebrow}
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-[rgb(var(--azee-chalk))] sm:text-4xl">
            {title}
          </h1>
          {/* Brand-signature stripe — same motif as the other pages. */}
          <div className="mt-4 h-[3px] w-16 rounded-full bg-gradient-to-r from-[rgb(var(--azee-orange))] to-[rgb(var(--azee-orange)/0)]" />
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-gray-400 sm:text-base">
            {lead}
          </p>

          <div className="liquid-glass glass-sheen mt-8 rounded-3xl px-6 py-8 sm:px-9 sm:py-10">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-300/80">
              Content pending
            </p>
            {pending}

            <p className="mt-7 text-sm font-semibold text-gray-300">
              {intendedHeading}
            </p>
            <dl className="mt-4 divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10">
              {intended.map((item) => (
                <div
                  key={item.name}
                  className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:gap-6"
                >
                  <dt className="text-sm font-semibold text-gray-300 sm:w-52 sm:shrink-0">
                    {item.name}
                  </dt>
                  <dd className="text-sm text-gray-400">{item.note}</dd>
                </div>
              ))}
            </dl>

            {columns ? (
              <>
                <p className="mt-7 text-sm font-semibold text-gray-300">
                  {columnsHeading}
                </p>
                <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10">
                  <table className="w-full min-w-[40rem] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-white/10">
                        {columns.map((column, i) => (
                          <th
                            key={column}
                            scope="col"
                            className={`px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-white/45 ${
                              i === 0 ? "text-left" : "text-right"
                            }`}
                          >
                            {column}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {/*
                       * The empty state, and the only row this table can
                       * ever render until a real source is wired in.
                       */}
                      <tr>
                        <td
                          colSpan={columns.length}
                          className="px-5 py-8 text-center text-sm text-gray-400"
                        >
                          Not connected yet — no rows to show.
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}

            {children}
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
