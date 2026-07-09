import { Fragment, useEffect, useState } from "react";

interface AnimatedHeadingProps {
  /** Each entry renders as its own line with an identical line break. */
  lines: string[];
  /** Delay in ms before the first character animates. */
  baseDelay?: number;
  /** Delay in ms between successive characters. */
  charStagger?: number;
  className?: string;
}

export function AnimatedHeading({
  lines,
  baseDelay = 0,
  charStagger = 30,
  className = "",
}: AnimatedHeadingProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  let charIndex = 0;

  return (
    <h1 className={className}>
      {lines.map((line, lineIndex) => (
        <span key={lineIndex} className="block">
          {line.split(" ").map((word, wordIndex, words) => {
            const chars = word.split("").map((char, i) => {
              const delay = baseDelay + charIndex * charStagger;
              charIndex += 1;
              return (
                <span
                  key={i}
                  className={`inline-block transition-all duration-700 ease-out ${
                    mounted
                      ? "translate-y-0 opacity-100"
                      : "translate-y-8 opacity-0"
                  }`}
                  style={{ transitionDelay: `${delay}ms` }}
                >
                  {char}
                </span>
              );
            });
            // The space between words keeps its slot in the stagger
            // sequence so per-character delays stay unchanged.
            if (wordIndex < words.length - 1) charIndex += 1;
            return (
              <Fragment key={wordIndex}>
                {/* whitespace-nowrap keeps line breaks at word boundaries
                    while every character still animates independently. */}
                <span className="inline-block whitespace-nowrap">{chars}</span>
                {wordIndex < words.length - 1 && " "}
              </Fragment>
            );
          })}
        </span>
      ))}
    </h1>
  );
}
