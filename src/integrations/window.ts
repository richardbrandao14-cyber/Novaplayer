import { isTauri } from "@tauri-apps/api/core";
export const nativeWindowAvailable = isTauri();
export async function controlWindow(
  action: "minimize" | "maximize" | "close",
): Promise<void> {
  if (!nativeWindowAvailable)
    throw new Error("Controles disponíveis somente no aplicativo Windows.");
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  const window = getCurrentWindow();
  if (action === "minimize") await window.minimize();
  else if (action === "maximize") await window.toggleMaximize();
  else await window.close();
}
