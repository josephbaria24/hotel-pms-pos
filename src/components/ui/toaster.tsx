import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Toaster as SileoToaster } from "sileo";

export function Toaster() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const updateTheme = () => {
      setIsDarkMode(document.documentElement.classList.contains("dark"));
    };
    updateTheme();

    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  if (!mounted) return null;

  return createPortal(
    <SileoToaster
      position="top-center"
      options={{
        fill: isDarkMode ? "#FFFFFF" : "#000000",
        styles: {
          title: isDarkMode ? "text-black font-semibold" : "text-white font-semibold",
          description: isDarkMode ? "text-black/80" : "text-white/80",
          badge: isDarkMode ? "text-black/70" : "text-white/70",
          button: isDarkMode ? "text-black border-black/20" : "text-white border-white/20",
        },
      }}
    />,
    document.body,
  );
}
