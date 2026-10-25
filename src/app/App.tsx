import { usePlaybackStore } from "../state/usePlaybackStore";
import { NativePlayer } from "../components/native/NativePlayer";
import { lazy, Suspense } from "react";
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
  history: lazy(() => import("../pages/History")),
  sources: lazy(() => import("../pages/Sources")),
  settings: lazy(() => import("../pages/Settings")),
};
export function App() {
  const reducedMotion = useReducedMotion();
  const page = useAppStore((s) => s.page);
  const Page = pages[page];
  const session = usePlaybackStore((s) => s.session);
  const close = usePlaybackStore((s) => s.close);
  return (
    <MotionConfig reducedMotion="user">
      <ErrorBoundary>
        <div inert={session !== null}>
        <Layout>
          <Suspense fallback={<LoadState status="loading" />}>
            <motion.div
              key={page}
              className="page-transition"
              initial={{ opacity: reducedMotion ? 1 : 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: reducedMotion ? 0 : 0.18 }}
            >
              <Page />
            </motion.div>
          </Suspense>
        </Layout>
        </div>
        {session && <NativePlayer session={session} onClose={close} />}
      </ErrorBoundary>
    </MotionConfig>
  );
}
