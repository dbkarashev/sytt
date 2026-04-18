import Header from "@/components/Header";
import GlobeView from "@/components/GlobeView";

export default function Home() {
  return (
    <main className="relative h-dvh w-dvw overflow-hidden">
      <Header />
      <GlobeView />
    </main>
  );
}
