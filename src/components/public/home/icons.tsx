/**
 * Line icons lifted verbatim from the v2 landing design (256×256 grid, stroked,
 * no fill). Kept here so every section draws from one set instead of repeating
 * path data inline.
 */

type IconProps = {
  size?: number;
  strokeWidth?: number;
  className?: string;
  style?: React.CSSProperties;
};

function Icon({
  size = 16,
  strokeWidth = 18,
  style,
  className,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 256 256"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ width: size, height: size, ...style }}
      className={className}
    >
      {children}
    </svg>
  );
}

export const TrophyIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M56 48h144v56a72 72 0 0 1-144 0Z" />
    <path d="M56 64H32a24 24 0 0 0 24 24M200 64h24a24 24 0 0 1-24 24M96 216h64M128 176v40" />
  </Icon>
);

export const TrophySimpleIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M56 48h144v56a72 72 0 0 1-144 0Z" />
    <path d="M96 216h64M128 176v40" />
  </Icon>
);

export const UsersIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="104" cy="96" r="44" />
    <path d="M28 200c14-30 42-48 76-48s62 18 76 48" />
    <path d="M176 60a44 44 0 0 1 0 72" />
  </Icon>
);

export const BallIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="128" cy="128" r="96" />
    <path d="M128 32a96 96 0 0 0 0 192M32 128h192" />
  </Icon>
);

export const FlameIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M128 24c26 34 24 52 12 66-14 16-30 26-30 50a46 46 0 0 0 92 0c0-42-42-74-74-116Z" />
    <path d="M92 132c-16 16-26 30-26 50a62 62 0 0 0 30 53" />
  </Icon>
);

export const BootIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M40 92h58l30 30h58a30 30 0 0 1 30 30v22H40Z" />
    <path d="M40 174v18h176v-18M98 92V62M74 122l-12-22" />
  </Icon>
);

/** A pass: the passer, the ball's arc, and where it lands. */
export const AssistIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="58" cy="186" r="26" />
    <path d="M84 166c56-24 90-62 106-108" />
    <path d="M154 40h38v38" />
  </Icon>
);

export const ArrowRightIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M40 128h176M144 56l72 72-72 72" />
  </Icon>
);

export const SearchIcon = ({ size = 16, ...p }: IconProps) => (
  <svg
    viewBox="0 0 256 256"
    fill="none"
    stroke="currentColor"
    strokeWidth={20}
    strokeLinecap="round"
    aria-hidden="true"
    style={{ width: size, height: size, ...p.style }}
  >
    <circle cx="116" cy="116" r="76" />
    <path d="M170 170l46 46" />
  </svg>
);

export const DownloadIcon = (p: IconProps) => (
  <Icon strokeWidth={20} {...p}>
    <path d="M128 32v120M84 108l44 44 44-44M40 200h176" />
  </Icon>
);

export const CloseIcon = ({ size = 13, ...p }: IconProps) => (
  <svg
    viewBox="0 0 256 256"
    fill="none"
    stroke="currentColor"
    strokeWidth={22}
    strokeLinecap="round"
    aria-hidden="true"
    style={{ width: size, height: size, ...p.style }}
  >
    <path d="M64 64l128 128M192 64L64 192" />
  </svg>
);

export const ChartIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M32 216h192" />
    <path d="M64 216v-52M112 216v-100M160 216v-68M208 216v-124" />
  </Icon>
);

export const AppChartIcon = (p: IconProps) => (
  <Icon strokeWidth={20} {...p}>
    <path d="M32 216h192M72 216V132M128 216V72M184 216v-56" />
  </Icon>
);

export const RatioIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M208 48L48 208" />
    <circle cx="76" cy="76" r="28" />
    <circle cx="180" cy="180" r="28" />
  </Icon>
);

export const ShieldCheckIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M40 60l88-28 88 28v72c0 56-48 84-88 96-40-12-88-40-88-96Z" />
    <path d="M96 128l24 24 44-48" />
  </Icon>
);

export const BellIcon = (p: IconProps) => (
  <Icon strokeWidth={20} {...p}>
    <path d="M56 104a72 72 0 0 1 144 0c0 60 24 72 24 72H32s24-12 24-72" />
    <path d="M104 208a26 26 0 0 0 48 0" />
  </Icon>
);

export const BracketIcon = (p: IconProps) => (
  <Icon strokeWidth={20} {...p}>
    <path d="M40 56h56v48h-56ZM40 152h56v48h-56ZM160 104h56v48h-56ZM96 80h32v48h32M96 176h32v-48" />
  </Icon>
);

export const ProfileIcon = (p: IconProps) => (
  <Icon strokeWidth={20} {...p}>
    <circle cx="128" cy="100" r="40" />
    <path d="M56 200c14-30 40-48 72-48s58 18 72 48" />
  </Icon>
);

export const HomeIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M40 216V116l88-76 88 76v100Z" />
    <path d="M104 216v-56h48v56" />
  </Icon>
);

export const WhatsAppIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M45 211l12-40a88 88 0 1 1 34 34Z" />
    <path d="M96 116a12 12 0 0 0 12 12l12 12a56 56 0 0 0 24 24l12 12a12 12 0 0 0 12-12" />
  </Icon>
);

export const YouTubeIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="24" y="60" width="208" height="136" rx="22" />
    <path d="M110 100l52 28-52 28Z" />
  </Icon>
);

export const InstagramIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="36" y="36" width="184" height="184" rx="46" />
    <circle cx="128" cy="128" r="40" />
    <circle cx="180" cy="76" r="8" fill="currentColor" />
  </Icon>
);

export const CalendarIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="32" y="56" width="192" height="168" rx="16" />
    <path d="M32 104h192M88 32v40M168 32v40" />
  </Icon>
);
