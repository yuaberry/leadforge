import Link from "next/link";

import { cn } from "@/lib/utils";

export function Logo({
  className,
  withText = true,
}: {
  className?: string;
  withText?: boolean;
}) {
  return (
    <Link href="/" className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="flex size-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 via-violet-500 to-cyan-400 shadow-lg shadow-blue-500/25">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-5 text-white"
          aria-hidden="true"
        >
          <path d="M12 2c2 3.5 2.5 5.5 2.5 7.5a2.5 2.5 0 0 1-5 0c0-2 .5-4 2.5-7.5Z" />
          <path d="M12 12v7" />
          <path d="M8.5 16.5 7 19h10l-1.5-2.5" />
        </svg>
      </span>
      {withText && (
        <span className="text-lg font-bold tracking-tight">
          LEAD<span className="text-gradient">FORGE</span>
        </span>
      )}
    </Link>
  );
}
