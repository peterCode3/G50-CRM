import Image from "next/image";
import Link from "next/link";

export function Header() {
  return (
    <header className="w-full border-b border-teal-50 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
        <Link href="/" className="flex items-center">
          <Image
            src="/logo.png"
            alt="G50.Golf"
            width={818}
            height={616}
            priority
            className="h-12 w-auto"
          />
        </Link>
        <nav className="flex items-center gap-5 text-sm font-medium text-teal-700">
          <Link href="/bookings" className="hover:text-teal-900">
            My Bookings
          </Link>
          <Link href="/account" className="hover:text-teal-900">
            Account
          </Link>
        </nav>
      </div>
    </header>
  );
}
