import { BrandEntrance } from "../components/BrandEntrance";
import { useMediaNavigation } from "../state/useMediaNavigation";
import { NativeDetails } from "../components/native/NativeDetails";
import { usePlaybackStore } from "../state/usePlaybackStore";
import { NativePlayer } from "../components/native/NativePlayer";
import { lazy, Suspense, useLayoutEffect } from "react";
import { MotionConfig, motion, useReducedMotion } from "motion/react";
import { useAppStore } from "../state/useAppStore";
import { Layout } from "../components/Layout";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { LoadState } from "../components/LoadState";
const pages = {
  home: lazy(() => import("../pages/Home")),
  live: lazy(() => import("../pages/Live")),
  movies: lazy(() => import("../pages/Movies")),
  series: lazy(() => import("../pages/Series")),
  favorites: lazy(() => import("../pages/Favorites")),
  watchlist: lazy(() => import("../pages/Watchlist")),
  history: lazy(() => import("../pages/History")),
  sources: lazy(() => import("../pages/Sources")),
  settings: lazy(() => import("../pages/Settings")),
};
export function App() {
  const reducedMotion = useReducedMotion();
  const page = useAppStore((s) => s.page);
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    const playback = usePlaybackStore.getState();
    if (page !== "live" && playback.session?.mode === "docked")
      playback.close();
  }, [page]);
  const Page = pages[page];
  const session = usePlaybackStore((s) => s.session);
  const close = usePlaybackStore((s) => s.close);
  const selected = useMediaNavigation((s) => s.selected);
  const closeDetails = useMediaNavigation((s) => s.close);
  const docked = session?.mode === "docked";
  const returnFromPlayer = () => {
    if (session?.item.kind === "live")
      usePlaybackStore.getState().setMode("docked");
    else close();
  };
  return (
    <MotionConfig reducedMotion="user">
      <ErrorBoundary>
        <BrandEntrance />
        <div inert={session !== null && !docked}>
          <Layout>
            <Suspense fallback={<LoadState status="loading" />}>
              <motion.div
                key={page}
                className="page-transition"
                initial={{ opacity: reducedMotion ? 1 : 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: reducedMotion ? 0 : 0.18 }}
              >
                {selected ? (
                  <NativeDetails item={selected} onClose={closeDetails} />
                ) : (
                  <Page />
                )}
              </motion.div>
            </Suspense>
          </Layout>
        </div>
        {session && (
          <NativePlayer session={session} onClose={returnFromPlayer} />
        )}
      </ErrorBoundary>
    </MotionConfig>
  );
}
