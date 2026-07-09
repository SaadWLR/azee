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
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-300/90">
        {eyebrow}
      </p>
      <h2 className="mt-3 max-w-2xl text-3xl font-bold leading-[1.1] tracking-tight text-white sm:text-4xl lg:text-5xl">
        {title}
      </h2>
      {description && (
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-gray-400 sm:text-lg">
          {description}
        </p>
      )}
    </Reveal>
  );
}
