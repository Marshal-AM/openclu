import type { ChildProcess } from "node:child_process";
import * as readline from "node:readline";

let activeCleanup: (() => void) | null = null;

export function stopCaptureQuitListener(): void {
  activeCleanup?.();
  activeCleanup = null;
}

/** Listen on the orchestrator terminal for "q" + Enter and forward to capture stdin. */
export function startCaptureQuitListener(
  child: ChildProcess,
  onQuit?: () => void,
): void {
  stopCaptureQuitListener();

  if (!child.stdin) {
    console.warn("[capture] stdin pipe unavailable — cannot listen for q");
    return;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });

  console.log("\nRecording active — type q and press Enter in this terminal to stop.\n");

  const onLine = (line: string) => {
    if (line.trim().toLowerCase() !== "q") return;
    console.log("[capture] Quit requested — finishing recording...");
    onQuit?.();
    try {
      child.stdin?.write("q\n");
    } catch (e) {
      console.warn("[capture] Could not write quit to capture stdin:", e);
    }
    stopCaptureQuitListener();
  };

  rl.on("line", onLine);

  activeCleanup = () => {
    rl.off("line", onLine);
    rl.close();
  };
}
