type CursorIndicatorProps = {
  userName: string;
  color: string;
  x: number;
  y: number;
  lineHeight: number;
};

export const CursorIndicator = ({
  userName,
  color,
  x,
  y,
  lineHeight,
}: CursorIndicatorProps) => {
  return (
    <div
      className="absolute pointer-events-none z-50"
      style={{
        left: `${x}px`,
        top: `${y}px`,
      }}
    >
      {/* Name label */}
      <div
        className="absolute -top-5 left-0 px-1.5 py-0.5 rounded text-[10px] font-medium text-white whitespace-nowrap shadow-sm"
        style={{ backgroundColor: color }}
      >
        {userName}
      </div>
      {/* Cursor line */}
      <div
        className="w-0.5 rounded-full shadow-[0_0_4px_rgba(0,0,0,0.1)]"
        style={{
          backgroundColor: color,
          height: `${lineHeight}px`,
          animation: 'cursor-blink 1s step-end infinite',
        }}
      />
    </div>
  );
};
