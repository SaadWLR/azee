const BADGES = [
  "PSX TREC Holder No. 108",
  "SECP Regulated",
  "CDC Participant",
  "Real-Time Market Access",
];

export function TrustBadges() {
  return (
    <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
      {BADGES.map((badge) => (
        <li
          key={badge}
          className="flex items-center gap-1.5 text-xs font-medium text-gray-300"
        >
          <span className="text-white/70">✓</span>
          {badge}
        </li>
      ))}
    </ul>
  );
}
