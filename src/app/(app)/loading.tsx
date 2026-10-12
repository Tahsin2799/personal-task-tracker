/** Shown the moment a page is opened from the spine, while its entries are read: the header's shape and a few rows. */
export default function Loading() {
  return (
    <div role="status" aria-label="Opening the page" className="flex flex-1 flex-col">
      <div className="rule-head px-4 pt-5 pb-3 md:px-8 md:pt-7">
        <div className="h-[30px] w-[min(320px,70%)] animate-pulse bg-rule md:h-[34px]" />
      </div>
      <div className="animate-pulse">
        {/* The ledger's caption row, so the page doesn't jump when the real one arrives. */}
        <div className="rule-head flex h-[33px] items-center gap-4 px-4 md:px-8">
          <div className="h-2 w-10 bg-rule" />
          <div className="h-2 w-16 bg-rule" />
        </div>
        {[72, 58, 64, 46, 68, 52].map((width, i) => (
          <div key={i} className="flex h-10 items-center gap-4 border-b border-rule px-4 md:px-8">
            <div className="h-3 w-12 bg-rule" />
            <div className="h-3 bg-rule" style={{ width: `${width}%` }} />
          </div>
        ))}
      </div>
    </div>
  );
}
