"use client";

import Link from "next/link";
import { useEffect } from "react";

/** When a page can't be read: still the field book (spine, ruled header), with a way back. */
export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col">
      <header className="rule-head px-4 pt-5 pb-3 md:px-8 md:pt-7">
        <h1 className="font-stamp text-[30px] font-semibold uppercase leading-none tracking-[0.02em] md:text-[34px]">Page not read</h1>
      </header>
      <div className="px-4 py-6 md:px-8">
        <p role="alert" className="max-w-[60ch] text-[15px] text-attention">
          This page couldn&apos;t be read just now. Nothing you wrote was lost; the connection or the server dropped for a
          moment.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button type="button" onClick={() => retry()} className="btn btn-primary">
            Try again
          </button>
          <Link href="/" className="btn">
            My Work
          </Link>
        </div>
        {error.digest && (
          <p className="mt-5 text-[12px] text-pencil">
            Reference <span className="font-mono">{error.digest}</span>
          </p>
        )}
      </div>
    </div>
  );
}
