import { GooeyFilter } from "@/components/ui/gooey-filter";
import NavHeader from "@/components/ui/nav-header";
import { PixelTrail } from "@/components/ui/pixel-trail";
import { LoginPage } from "@/components/ui/sign-in-page";
import { useScreenSize } from "@/hooks/use-screen-size";
import { BrowserRouter } from "react-router-dom";

function GooeyDemo() {
  const screenSize = useScreenSize();

  return (
    <div className="relative flex h-screen min-h-screen w-screen flex-col items-center justify-center overflow-hidden bg-black text-center text-pretty">
      <NavHeader />

      <img
        src="https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=3200&q=90"
        alt="pixel-style arcade scene"
        className="absolute inset-0 h-full w-full object-cover object-center opacity-75"
      />

      <GooeyFilter id="gooey-filter-pixel-trail" strength={5} />

      <div className="absolute inset-0 z-0" style={{ filter: "url(#gooey-filter-pixel-trail)" }}>
        <PixelTrail
          pixelSize={screenSize.lessThan("md") ? 24 : 32}
          fadeDuration={0}
          delay={500}
          pixelClassName="bg-white"
        />
      </div>

      <p className="z-10 w-[92%] text-5xl font-bold text-white md:w-1/2 md:text-7xl">
        Smart Eye Ragging Detection system
        <span className="font-overusedGrotesk"></span>
      </p>
    </div>
  );
}

export { GooeyDemo };

export default function Demo() {
  return (
    <BrowserRouter>
      <LoginPage />
    </BrowserRouter>
  );
}
