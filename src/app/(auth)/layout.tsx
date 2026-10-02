import Image from "next/image";

/** The book's cover: yellow polymer stock, the title, and the munia plate. The form is the inside page. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-cover text-cover-ink">
      <div className="mx-auto grid min-h-dvh max-w-[1280px] grid-cols-1 content-start gap-8 px-4 py-6 md:grid-cols-[minmax(0,1fr)_440px] md:content-stretch md:gap-12 md:px-10 md:py-10">
        <div className="flex flex-col">
          <p className="font-stamp text-[clamp(56px,10vw,128px)] font-bold uppercase leading-[0.86] tracking-[-0.01em]">
            Bird-
            <br />
            Watcher
          </p>
          <div className="mt-5 flex items-center gap-x-4 border-y border-cover-ink/60 py-2 md:mt-6">
            <span className="stamp text-[12px]">Field book</span>
            <span className="h-3 w-px bg-cover-ink/40" aria-hidden />
            <span className="stamp text-[12px] text-cover-pencil">Personal · Team · Research</span>
          </div>
          <figure className="mt-6 min-h-0 md:flex-1">
            <Image
              src="/brand/munia-plate.jpg"
              alt="A munia with a chestnut head and scaled yellow breast, perched on a branch."
              width={600}
              height={900}
              priority
              className="h-40 w-full border border-cover-ink object-cover object-[50%_14%] md:h-full md:max-h-[52vh] md:w-auto md:object-center"
            />
          </figure>
        </div>
        <div className="flex items-start md:items-end">{children}</div>
      </div>
    </div>
  );
}
