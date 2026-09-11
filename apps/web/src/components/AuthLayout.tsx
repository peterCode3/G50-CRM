import Image from "next/image";
import { CalendarIcon, FlagIcon, PinIcon } from "./icons";

const FEATURES = [
  { icon: CalendarIcon, text: "Book classes & appointments in seconds" },
  { icon: PinIcon, text: "Every G50.Golf location, one account" },
  { icon: FlagIcon, text: "Track your bookings, credits & membership" },
];

export function AuthLayout({
  children,
  tagline = "Book smarter. Play better.",
  subtext = "Classes, appointments and coaching at every G50.Golf location — booked in minutes.",
}: {
  children: React.ReactNode;
  tagline?: string;
  subtext?: string;
}) {
  return (
    <main className="flex flex-1">
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-br from-teal-900 via-teal-800 to-teal-900 p-12 text-white lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, white 1px, transparent 1px), radial-gradient(circle at 80% 60%, white 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-0 h-96 w-96 -translate-y-1/2 translate-x-1/3 rounded-full bg-gold-500/10 blur-3xl"
        />

        <Image src="/logo.png" alt="G50.Golf" width={818} height={616} className="relative h-14 w-auto" />

        <div className="relative">
          <h2 className="animate-fade-in-up font-display text-4xl font-semibold">{tagline}</h2>
          <p className="animate-fade-in-up mt-3 max-w-sm text-teal-100" style={{ animationDelay: "80ms" }}>
            {subtext}
          </p>

          <ul className="mt-8 flex flex-col gap-3">
            {FEATURES.map(({ icon: Icon, text }, i) => (
              <li
                key={text}
                style={{ animationDelay: `${140 + i * 70}ms` }}
                className="animate-fade-in-up flex items-center gap-3 text-sm text-teal-50"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-gold-300">
                  <Icon className="h-4 w-4" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-teal-200/60">© {new Date().getFullYear()} G50.Golf</p>
      </div>

      <div className="flex flex-1 items-center justify-center bg-teal-50/40 px-6 py-16">
        {children}
      </div>
    </main>
  );
}
