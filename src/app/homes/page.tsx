import type { Metadata } from "next";
import { getAllHomes, type Brand } from "@/lib/homes";
import { HomesBrowser } from "@/components/homes-browser";

export const metadata: Metadata = {
  title: "Homes for Sale",
  description:
    "Browse new Clayton, Cavco, and Champion manufactured homes available with land across Horry County, SC — from the low $200s.",
};

const BRANDS: ("All" | Brand)[] = ["All", "Clayton", "Cavco", "Champion"];

export default async function HomesPage({
  searchParams,
}: {
  searchParams: Promise<{ brand?: string }>;
}) {
  const { brand } = await searchParams;
  const initialBrand =
    BRANDS.find((b) => b.toLowerCase() === brand?.toLowerCase()) ?? "All";
  const all = getAllHomes();

  return (
    <>
      <section className="border-b border-stone-line bg-stone-surface">
        <div className="container-x py-14">
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">
            {all.length} homes available
          </p>
          <h1 className="mt-2 font-display text-4xl font-semibold text-stone-ink sm:text-5xl">
            Find your home
          </h1>
          <p className="mt-3 max-w-2xl text-stone-muted">
            Each price is a <strong className="font-semibold text-stone-ink">starting</strong> point for
            the complete package — the home on a ¼-acre lot, delivered, set, and connected
            to utilities. Call for your exact all-in number on any model.
          </p>
        </div>
      </section>

      <section className="container-x py-10">
        <HomesBrowser homes={all} initialBrand={initialBrand} />
      </section>
    </>
  );
}
