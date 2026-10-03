/** Shown the moment a page is opened from the spine, while its entries are read: a blank ruled page with the header's shape. */
export default function Loading() {
  return (
    <div role="status" aria-label="Opening the page" className="flex flex-1 flex-col">
      <div className="rule-double px-4 pt-5 pb-3 md:px-8 md:pt-7">
        <div className="h-[30px] w-[min(320px,70%)] animate-pulse bg-page-sunk md:h-[34px]" />
      </div>
      <div className="ruled-fill flex-1 animate-pulse" />
    </div>
  );
}
