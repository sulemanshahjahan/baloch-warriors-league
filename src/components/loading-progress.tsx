"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

// Global variable to track loading state across component re-renders
let isNavigating = false;

export function LoadingProgress() {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    let progressInterval: NodeJS.Timeout | null = null;
    let completeTimeout: NodeJS.Timeout | null = null;
    let startTimeout: NodeJS.Timeout | null = null;

    const startLoading = () => {
      if (isNavigating) return;
      isNavigating = true;
      
      // Small delay before showing to avoid flash on fast loads
      startTimeout = setTimeout(() => {
        if (!isNavigating) return;
        setVisible(true);
        setProgress(0);
        
        // Animate progress
        progressInterval = setInterval(() => {
          setProgress((prev) => {
            if (prev >= 85) {
              if (progressInterval) clearInterval(progressInterval);
              return 85;
            }
            // Fast start, slow down near end
            const increment = prev < 20 ? 25 : prev < 50 ? 12 : prev < 70 ? 6 : 2;
            return prev + increment;
          });
        }, 80);
      }, 50);
    };

    const stopLoading = () => {
      isNavigating = false;
      
      if (startTimeout) clearTimeout(startTimeout);
      if (progressInterval) clearInterval(progressInterval);
      
      setProgress(100);
      completeTimeout = setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 250);
    };

    // Handle all link clicks
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest("a");
      
      if (link) {
        const href = link.getAttribute("href");
        const isExternal = link.target === "_blank" || 
                          href?.startsWith("http") || 
                          href?.startsWith("mailto:");
        const isSamePage = href?.startsWith("#") || !href;
        const isDownload = link.hasAttribute("download");
        
        if (href && !isExternal && !isSamePage && !isDownload) {
          // Check if it's actually a different route
          const currentPath = window.location.pathname + window.location.search;
          const isSameRoute = href === currentPath || 
                             (href.startsWith("/") && 
                              !href.includes("?") && 
                              window.location.pathname === href);
          
          if (!isSameRoute) {
            startLoading();
          }
        }
      }
    };

    // Handle popstate (back/forward buttons)
    const handlePopState = () => {
      startLoading();
    };

    // Stop loading when route changes complete
    stopLoading();

    document.addEventListener("click", handleClick);
    window.addEventListener("popstate", handlePopState);
    
    return () => {
      document.removeEventListener("click", handleClick);
      window.removeEventListener("popstate", handlePopState);
      if (startTimeout) clearTimeout(startTimeout);
      if (progressInterval) clearInterval(progressInterval);
      if (completeTimeout) clearTimeout(completeTimeout);
    };
  }, [pathname, searchParams]);

  if (!visible && progress === 0) return null;

  return (
    <div 
      className={cn(
        "fixed top-0 left-0 right-0 z-[100] h-1 bg-primary/10 transition-opacity duration-200",
        visible ? "opacity-100" : "opacity-0"
      )}
    >
      <div
        className={cn(
          "h-full bg-primary transition-all duration-100 ease-out",
          progress >= 100 && "opacity-0"
        )}
        style={{
          width: `${progress}%`,
          boxShadow: "0 0 8px hsl(var(--primary)), 0 0 4px hsl(var(--primary))",
        }}
      />
    </div>
  );
}
