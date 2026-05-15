import { Team } from '../../sim/types';

// Team logo: a colored rounded-square tile with a white geometric mark inside.
// Marks are abstract, themed loosely to the team name (bull silhouette for
// Velocity Bulls, sunburst for Solaris, mountain peak for Atlas, etc).
//
// Render strategy: pick the SVG mark by team.shortName, fall back to a neutral
// chevron for unknown teams. Tile size is configurable; default 48px.
export function TeamLogo({ team, size = 48 }: { team: Team; size?: number }) {
  // Inner mark sits in the central 60% of the tile; tile rounded corners ~14% radius
  const r = Math.round(size * 0.14);
  return (
    <span
      className="team-logo"
      style={{
        width: size,
        height: size,
        background: team.color,
        borderRadius: r,
      }}
    >
      <svg
        viewBox="0 0 32 32"
        width={Math.round(size * 0.62)}
        height={Math.round(size * 0.62)}
        fill="none"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-label={`${team.name} logo`}
      >
        {pickMark(team.shortName)}
      </svg>
    </span>
  );
}

// Map shortName to its mark. Each mark is hand-drawn to keep them distinct
// but unified in line weight and overall geometric style.
function pickMark(shortName: string): React.ReactNode {
  switch (shortName) {
    case 'ROS': return <Mark_ROS />;  // Prancing arrow — Scuderia Rosso
    case 'PAP': return <Mark_PAP />;  // Chevron stack — Papaya Racing
    case 'VBR': return <Mark_VBR />;  // Charging horns — Velocity Bulls
    case 'SIL': return <Mark_SIL />;  // Triple-arrow — Silver Arrows
    case 'AVD': return <Mark_AVD />;  // Wing crest — Aston Verde
    case 'ALB': return <Mark_ALB />;  // Mountain swoop — Alpina Bleu
    case 'ATL': return <Mark_ATL />;  // Mountain peaks — Atlas Motors
    case 'NOR': return <Mark_NOR />;  // North star — Nordic GP
    case 'SOL': return <Mark_SOL />;  // Sunburst — Solaris F1
    case 'IBE': return <Mark_IBE />;  // Sword (Iberian) — Iberica Racing
    case 'PHX': return <Mark_PHX />;  // Phoenix wings rising — Phoenix Works
    case 'VAN': return <Mark_VAN />;  // Forward arrow / vanguard — Vanguard F1
    default:    return <Mark_Default />;
  }
}

// ---- Individual marks ----
// All paths designed within a 32×32 viewBox, white stroke or fill on color.

function Mark_ROS() {
  // Prancing-style stylized R + arrow — Italian sport car energy
  return (
    <>
      <path d="M 8 24 L 8 8 L 16 8 Q 22 8 22 13 Q 22 18 16 18 L 8 18" fill="none" />
      <path d="M 14 18 L 22 26" fill="none" />
    </>
  );
}

function Mark_PAP() {
  // Three offset chevrons stacked — speed lines
  return (
    <>
      <path d="M 6 12 L 14 6 L 22 12" fill="none" />
      <path d="M 6 18 L 14 12 L 22 18" fill="none" />
      <path d="M 6 24 L 14 18 L 22 24" fill="none" />
    </>
  );
}

function Mark_VBR() {
  // Bull horns / V-shape — Velocity Bulls
  return (
    <>
      <path d="M 4 8 Q 8 4 14 10 L 16 12 L 18 10 Q 24 4 28 8" fill="none" strokeWidth="3" />
      <circle cx="16" cy="20" r="2.5" fill="white" stroke="none" />
    </>
  );
}

function Mark_SIL() {
  // Three forward arrows — Silver Arrows (Mercedes lineage nod)
  return (
    <>
      <path d="M 4 10 L 12 16 L 4 22" fill="none" />
      <path d="M 12 10 L 20 16 L 12 22" fill="none" />
      <path d="M 20 10 L 28 16 L 20 22" fill="none" />
    </>
  );
}

function Mark_AVD() {
  // Wing crest — Aston Verde
  return (
    <>
      <path d="M 4 16 Q 10 8 16 12 Q 22 8 28 16" fill="none" strokeWidth="2.5" />
      <path d="M 4 20 Q 10 12 16 16 Q 22 12 28 20" fill="none" strokeWidth="2.5" />
    </>
  );
}

function Mark_ALB() {
  // Alpine mountain swoop — Alpina Bleu
  return (
    <>
      <path d="M 4 24 L 12 12 L 18 20 L 24 8 L 28 24 Z" fill="white" stroke="none" />
    </>
  );
}

function Mark_ATL() {
  // Double mountain peaks — Atlas Motors
  return (
    <>
      <path d="M 4 26 L 11 12 L 16 20 L 21 10 L 28 26 Z" fill="white" stroke="none" />
      <circle cx="21" cy="8" r="1.5" fill="white" stroke="none" />
    </>
  );
}

function Mark_NOR() {
  // North star — Nordic GP
  return (
    <>
      <path d="M 16 4 L 18 14 L 28 16 L 18 18 L 16 28 L 14 18 L 4 16 L 14 14 Z" fill="white" stroke="none" />
    </>
  );
}

function Mark_SOL() {
  // Sunburst — Solaris F1
  return (
    <>
      <circle cx="16" cy="16" r="5" fill="white" stroke="none" />
      <path d="M 16 4 L 16 8 M 16 24 L 16 28 M 4 16 L 8 16 M 24 16 L 28 16 M 7.5 7.5 L 10 10 M 22 22 L 24.5 24.5 M 24.5 7.5 L 22 10 M 10 22 L 7.5 24.5" strokeWidth="2.5" />
    </>
  );
}

function Mark_IBE() {
  // Vertical sword — Iberica Racing
  return (
    <>
      <path d="M 16 4 L 16 24" strokeWidth="3" />
      <path d="M 10 22 L 22 22" strokeWidth="2.5" />
      <path d="M 12 22 L 16 28 L 20 22" fill="white" stroke="none" />
      <circle cx="16" cy="6" r="2" fill="white" stroke="none" />
    </>
  );
}

function Mark_PHX() {
  // Phoenix wings rising — Phoenix Works
  return (
    <>
      <path d="M 16 26 L 16 12" />
      <path d="M 16 12 Q 8 12 6 6" fill="none" />
      <path d="M 16 12 Q 24 12 26 6" fill="none" />
      <path d="M 16 16 Q 10 16 8 12" fill="none" />
      <path d="M 16 16 Q 22 16 24 12" fill="none" />
    </>
  );
}

function Mark_VAN() {
  // Forward-pointing arrow / blade — Vanguard F1
  return (
    <>
      <path d="M 6 8 L 26 16 L 6 24 L 12 16 Z" fill="white" stroke="none" />
    </>
  );
}

function Mark_Default() {
  // Generic fallback — neutral chevron
  return <path d="M 8 8 L 16 16 L 8 24" fill="none" />;
}
