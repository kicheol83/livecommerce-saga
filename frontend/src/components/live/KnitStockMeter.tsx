type KnitStockMeterProps = {
  stock: number;
  capacity: number;
};

const COLUMNS = 24;
const ROWS = 2;
const PITCH = 12;
const ROW_HEIGHT = 10;
const LOW_STOCK_RATIO = 0.2;

export function KnitStockMeter({ stock, capacity }: KnitStockMeterProps) {
  const ratio = capacity > 0 ? Math.min(1, stock / capacity) : 0;
  const totalStitches = COLUMNS * ROWS;
  const filled = stock > 0 ? Math.max(1, Math.ceil(ratio * totalStitches)) : 0;
  const low = stock > 0 && ratio <= LOW_STOCK_RATIO;
  const tone = low ? "text-mustard" : "text-cranberry";

  const stitches = [];
  for (let column = 0; column < COLUMNS; column += 1) {
    for (let row = 0; row < ROWS; row += 1) {
      const order = column * ROWS + row;
      const isFilled = order < filled;
      const x = column * PITCH;
      const y = 7 + row * ROW_HEIGHT;
      const left = x + 3.4;
      const right = x + 8.6;
      stitches.push(
        <g
          key={order}
          className={`transition-colors duration-700 ${isFilled ? tone : "text-ash"}`}
          fill={isFilled ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth={isFilled ? 0 : 0.8}
          strokeOpacity={0.55}
        >
          <ellipse cx={left} cy={y} rx={2.1} ry={5} transform={`rotate(-30 ${left} ${y})`} />
          <ellipse cx={right} cy={y} rx={2.1} ry={5} transform={`rotate(30 ${right} ${y})`} />
        </g>
      );
    }
  }

  return (
    <svg viewBox={`0 0 ${COLUMNS * PITCH} ${ROWS * ROW_HEIGHT + 4}`} className="mt-2 h-auto w-full" aria-hidden="true">
      {stitches}
    </svg>
  );
}
