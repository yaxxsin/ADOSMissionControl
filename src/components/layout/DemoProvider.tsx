"use client";

import { useEffect } from "react";

export function DemoProvider() {
  useEffect(() => {
    let mounted = true;
    let engine: { start: (ms: number) => void; stop: () => void } | undefined;
    import("@/mock/engine").then((mod) => {
      if (!mounted) return;
      engine = mod.mockEngine;
      engine.start(200);
    });
    return () => {
      mounted = false;
      engine?.stop();
    };
  }, []);

  return null;
}
