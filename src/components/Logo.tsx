import Image from "next/image";
import { cn } from "@/components/ui";

/**
 * Tanzania Immigration emblem, used as the application mark.
 * The PNG is square (1080×1080) with a transparent background.
 */
export default function Logo({
  size = 36,
  className,
  priority = false,
}: {
  size?: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/logo/immigrationEmblem.png"
      alt="Tanzania Immigration"
      width={size}
      height={size}
      priority={priority}
      className={cn("object-contain", className)}
    />
  );
}

export function LogoLockup({
  size = 36,
  subtitle,
  tone = "dark",
}: {
  size?: number;
  subtitle?: string;
  tone?: "dark" | "light";
}) {
  return (
    <span className="flex items-center gap-3">
      <Logo size={size} priority />
      <span className="flex flex-col leading-tight">
        <span
          className={cn(
            "text-[0.95rem] font-bold tracking-tight",
            tone === "light" ? "text-white" : "text-slate-900",
          )}
        >
          Service Provision
        </span>
        {subtitle ? (
          <span
            className={cn(
              "text-[0.7rem] font-medium",
              tone === "light" ? "text-white/70" : "text-slate-500",
            )}
          >
            {subtitle}
          </span>
        ) : null}
      </span>
    </span>
  );
}
