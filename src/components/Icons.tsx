import type { SVGProps } from "react";

function base(props: SVGProps<SVGSVGElement>) {
  return {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...props,
  };
}

export function IconLandmark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M3 21h18M4 18h16M6 18v-7M10 18v-7M14 18v-7M18 18v-7M3 8l9-5 9 5H3z" />
    </svg>
  );
}

export function IconExternalLink(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M15 3h6v6M21 3l-9 9M18 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" />
    </svg>
  );
}

export function IconBadgeCheck(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M12 3l2.1 1.6 2.6-.3 1 2.4 2.4 1-.3 2.6L21.4 12l-1.6 2.1.3 2.6-2.4 1-1 2.4-2.6-.3L12 21.4l-2.1-1.6-2.6.3-1-2.4-2.4-1 .3-2.6L2.6 12l1.6-2.1-.3-2.6 2.4-1 1-2.4 2.6.3L12 3z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

export function IconShieldCheck(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M12 3l7 3v5c0 4.4-2.8 8.4-7 10-4.2-1.6-7-5.6-7-10V6l7-3z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

export function IconVault(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <ellipse cx="12" cy="6" rx="7" ry="3" />
      <path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6" />
      <path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" />
    </svg>
  );
}

export function IconTrendBars(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M4 20V13M9 20V9M14 20v-6M19 20V5" />
      <path d="M15 5h4v4" />
    </svg>
  );
}

export function IconResearch(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8l-5-5z" />
      <path d="M14 3v5h5M8 13h5M8 17h8M8 9h3" />
    </svg>
  );
}

export function IconCandles(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M6 4v3M6 13v3M4 7h4v6H4zM12 8v2M12 18v2M10 10h4v8h-4zM18 3v3M18 13v4M16 6h4v7h-4z" />
    </svg>
  );
}

export function IconIngots(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M7.5 13h5l1.5 5H6l1.5-5zM12.5 13h5l1.5 5h-8l1.5-5zM10 6h5l1.5 5h-8L10 6z" />
    </svg>
  );
}

export function IconRocket(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M12 15c-1.5-1-2.5-2.5-3-4.5C9.7 6 12 3.5 15.5 3c.5 3.5-.5 6.5-4 8.5" />
      <path d="M9 10.5c-1.8.2-3.2 1.2-4 3l3 .5M13.5 12c-.2 1.8-1.2 3.2-3 4l-.5-3" />
      <path d="M6 18c-.5 1-1 2-1 3 1 0 2-.5 3-1" />
      <circle cx="13" cy="7" r="1" />
    </svg>
  );
}

export function IconPie(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M12 3a9 9 0 1 0 9 9h-9V3z" />
      <path d="M15 3.5A9 9 0 0 1 20.5 9H15V3.5z" />
    </svg>
  );
}

export function IconCompass(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M15.5 8.5l-2 5-5 2 2-5 5-2z" />
    </svg>
  );
}

export function IconApple(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M17.05 12.54c-.03-2.34 1.91-3.46 2-3.52-1.09-1.59-2.78-1.81-3.38-1.83-1.44-.15-2.81.85-3.54.85-.73 0-1.86-.83-3.06-.81-1.57.02-3.02.92-3.83 2.33-1.63 2.83-.42 7.03 1.17 9.33.78 1.12 1.71 2.39 2.93 2.34 1.18-.05 1.62-.76 3.05-.76s1.83.76 3.07.74c1.27-.02 2.07-1.15 2.85-2.28.9-1.31 1.26-2.58 1.28-2.64-.03-.01-2.46-.94-2.54-3.75zM14.72 5.65c.65-.79 1.09-1.88.97-2.97-.94.04-2.07.62-2.74 1.41-.6.7-1.13 1.82-.99 2.89 1.05.08 2.11-.53 2.76-1.33z" />
    </svg>
  );
}

export function IconGooglePlay(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M4 3.5v17c0 .35.38.57.68.4l.1-.06L14 12 4.78 3.16A.46.46 0 0 0 4 3.5zM15.2 10.8L6.5 2.5l10.9 6.27-2.2 2.03zM15.2 13.2l2.2 2.03L6.5 21.5l8.7-8.3zM18.6 9.6l-2.3 2.4 2.3 2.4 2.65-1.53c.6-.35.6-1.39 0-1.74L18.6 9.6z" />
    </svg>
  );
}

export function IconFacebook(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M13.5 21v-7h2.4l.4-3h-2.8V9.1c0-.9.3-1.5 1.6-1.5h1.3V4.9c-.6-.1-1.4-.2-2.3-.2-2.3 0-3.8 1.4-3.8 3.9V11H8v3h2.3v7h3.2z" />
    </svg>
  );
}

export function IconInstagram(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="0.5" fill="currentColor" />
    </svg>
  );
}

export function IconLinkedIn(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M6.5 8.8H3.6V21h2.9V8.8zM5 7.4a1.7 1.7 0 1 0 0-3.4 1.7 1.7 0 0 0 0 3.4zM20.4 14.3c0-3.3-1.8-4.9-4.1-4.9-1.9 0-2.7 1-3.2 1.8V8.8H10.2V21h2.9v-6.5c0-1.7.8-2.7 2.2-2.7 1.3 0 2.1.9 2.1 2.7V21h3v-6.7z" />
    </svg>
  );
}

export function IconYouTube(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.3 5 12 5 12 5s-6.3 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12c0 1.6.13 3.2.4 4.8a2.5 2.5 0 0 0 1.8 1.8c1.5.4 7.8.4 7.8.4s6.3 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8c.27-1.6.4-3.2.4-4.8s-.13-3.2-.4-4.8zM10 15.5v-7l6 3.5-6 3.5z" />
    </svg>
  );
}
