import { Reveal } from "./Reveal";

interface SectionHeadingProps {
  eyebrow: string;
  title: string;
  description?: string;
}

export function SectionHeading({
  eyebrow,
  title,
  description,
}: SectionHeadingProps) {
  return (
    <Reveal>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-300">
        {eyebrow}
      </p>
      <h2 className="mt-3 max-w-2xl text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
        {title}
      </h2>
      {description && (
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-gray-300 sm:text-lg">
          {description}
        </p>
      )}
    </Reveal>
  );
}
