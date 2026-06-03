// NexusIcons — SVG icons matching the Fluent v9 design handoff

interface IconProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

const Svg = ({ children, size = 16, style, className }: { children: React.ReactNode } & IconProps) => (
  <svg
    width={size} height={size} viewBox="0 0 20 20" fill="none"
    xmlns="http://www.w3.org/2000/svg" style={style} className={className}
    stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true"
  >{children}</svg>
);

export const IconAdd = (p: IconProps) => (
  <Svg {...p}><path d="M10 4.5v11M4.5 10h11" /></Svg>
);
export const IconHistory = (p: IconProps) => (
  <Svg {...p}><circle cx="10" cy="10" r="6.2" /><path d="M10 6.6V10l2.4 1.5" /></Svg>
);
export const IconChevron = (p: IconProps) => (
  <Svg {...p}><path d="M5.5 8l4.5 4.5L14.5 8" /></Svg>
);
export const IconChevronRight = (p: IconProps) => (
  <Svg {...p}><path d="M8 5.5L12.5 10 8 14.5" /></Svg>
);
export const IconMore = (p: IconProps) => (
  <Svg {...p} style={{ ...p.style }}>
    <circle cx="5" cy="10" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="10" cy="10" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="15" cy="10" r="1.4" fill="currentColor" stroke="none" />
  </Svg>
);
export const IconSparkle = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10 3.2l1.3 3.4a2 2 0 0 0 1.1 1.1l3.4 1.3-3.4 1.3a2 2 0 0 0-1.1 1.1L10 14.8l-1.3-3.4a2 2 0 0 0-1.1-1.1L4.2 9l3.4-1.3a2 2 0 0 0 1.1-1.1L10 3.2z" />
    <path d="M15.5 3v2.4M14.3 4.2h2.4" />
  </Svg>
);
export const IconBrain = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 4.2A2.3 2.3 0 0 0 5.7 6.5 2.2 2.2 0 0 0 4.5 8.6a2.2 2.2 0 0 0 .6 1.5 2.3 2.3 0 0 0 .4 2.7A2.2 2.2 0 0 0 8 15.6V4.2z" />
    <path d="M12 4.2a2.3 2.3 0 0 1 2.3 2.3 2.2 2.2 0 0 1 1.2 2.1 2.2 2.2 0 0 1-.6 1.5 2.3 2.3 0 0 1-.4 2.7A2.2 2.2 0 0 1 12 15.6V4.2z" />
    <path d="M8 4.2a2 2 0 0 1 4 0" />
  </Svg>
);
export const IconTool = (p: IconProps) => (
  <Svg {...p}><path d="M12.6 6.4a2.8 2.8 0 0 1-3.7 3.3l-3.6 3.6a1.3 1.3 0 0 1-1.9-1.9l3.6-3.6a2.8 2.8 0 0 1 3.3-3.7L8.7 5.7l1.2 1.2 1.3-.1.1-1.3-1.2-1.2 2.1-.2z" /></Svg>
);
export const IconGlobe = (p: IconProps) => (
  <Svg {...p}><circle cx="10" cy="10" r="6.3" /><path d="M3.7 10h12.6M10 3.7c2 2 2 10.6 0 12.6M10 3.7c-2 2-2 10.6 0 12.6" /></Svg>
);
export const IconAgent = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4.5" y="6.5" width="11" height="8.5" rx="2" />
    <circle cx="8" cy="10.6" r="0.9" fill="currentColor" stroke="none" />
    <circle cx="12" cy="10.6" r="0.9" fill="currentColor" stroke="none" />
    <path d="M10 3.5v3M10 3.5a1 1 0 1 0 0-.01" />
    <path d="M4.5 10.5H3M17 10.5h-1.5" />
  </Svg>
);
export const IconSearch = (p: IconProps) => (
  <Svg {...p}><circle cx="8.7" cy="8.7" r="4.2" /><path d="M11.8 11.8l3.4 3.4" /></Svg>
);
export const IconSend = (p: IconProps) => (
  <Svg {...p}><path d="M4 10l12.5-5.5L13 17l-3.2-4.5L4 10z" /><path d="M9.8 12.5L16.5 4.5" /></Svg>
);
export const IconStop = (p: IconProps) => (
  <Svg {...p}><rect x="6" y="6" width="8" height="8" rx="1.4" fill="currentColor" stroke="none" /></Svg>
);
export const IconAttach = (p: IconProps) => (
  <Svg {...p}><path d="M14.5 9l-5 5a3 3 0 0 1-4.3-4.2l5.4-5.4a2 2 0 0 1 2.9 2.8L8 12.4a1 1 0 0 1-1.4-1.4l4.6-4.6" /></Svg>
);
export const IconDoc = (p: IconProps) => (
  <Svg {...p}><path d="M5.5 3.5h5l4 4v9a.5.5 0 0 1-.5.5h-8.5a.5.5 0 0 1-.5-.5v-12a.5.5 0 0 1 .5-.5z" /><path d="M10.5 3.7V7.5h3.8" /></Svg>
);
export const IconAt = (p: IconProps) => (
  <Svg {...p}><circle cx="10" cy="10" r="2.6" /><path d="M12.6 10v1a1.8 1.8 0 0 0 3.4.7A6.4 6.4 0 1 0 13 15.4" /></Svg>
);
export const IconCheck = (p: IconProps) => (
  <Svg {...p}><path d="M4.5 10.5l3.5 3.5 7.5-8" /></Svg>
);
export const IconCopy = (p: IconProps) => (
  <Svg {...p}>
    <rect x="7" y="7" width="8.5" height="8.5" rx="1.4" />
    <path d="M12.6 7V5.2a.8.8 0 0 0-.8-.8H5.3a.8.8 0 0 0-.8.8v6.5a.8.8 0 0 0 .8.8H7" />
  </Svg>
);
export const IconThumbUp = (p: IconProps) => (
  <Svg {...p}><path d="M6.5 9v6.5M6.5 9l2.2-4.8a1.3 1.3 0 0 1 2.4.9L10.5 8h3.2a1.3 1.3 0 0 1 1.3 1.6l-1 4.4a1.3 1.3 0 0 1-1.3 1H6.5" /></Svg>
);
export const IconThumbDown = (p: IconProps) => (
  <Svg {...p}><path d="M6.5 11V4.5M6.5 11l2.2 4.8a1.3 1.3 0 0 0 2.4-.9L10.5 12h3.2a1.3 1.3 0 0 0 1.3-1.6l-1-4.4a1.3 1.3 0 0 0-1.3-1H6.5" /></Svg>
);
export const IconRetry = (p: IconProps) => (
  <Svg {...p}><path d="M14.5 6.5A5.5 5.5 0 1 0 15.5 11" /><path d="M14.8 3.8v3h-3" /></Svg>
);
export const IconClose = (p: IconProps) => (
  <Svg {...p}><path d="M5 5l10 10M15 5L5 15" /></Svg>
);
export const IconSettings = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="10" cy="10" r="2.2" />
    <path d="M10 4.5v1.2M10 14.3v1.2M4.5 10h1.2M14.3 10h1.2M6.3 6.3l.85.85M12.8 12.8l.85.85M13.65 6.3l-.85.85M7.15 12.8l-.85.85" />
  </Svg>
);
export const IconInfo = (p: IconProps) => (
  <Svg {...p}><circle cx="10" cy="10" r="6.3" /><path d="M10 9v5" /><circle cx="10" cy="7" r="0.5" fill="currentColor" stroke="none" /></Svg>
);
export const IconBranch = (p: IconProps) => (
  <Svg {...p}><path d="M5 3a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm6 6a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM5 7.5v-1A1.5 1.5 0 0 0 6.5 5H9a3 3 0 0 1 3 3v.5" /></Svg>
);
export const IconArrowUp = (p: IconProps) => (
  <Svg {...p}><path d="M10 15.5V4.5M4.5 10l5.5-5.5 5.5 5.5" /></Svg>
);
