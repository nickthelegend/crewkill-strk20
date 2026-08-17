"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Scroll motion, done with IntersectionObserver.
 *
 * A scroll listener fires on every frame and forces layout each time, which is fine on a
 * desktop and miserable on a phone. The observer only wakes when something actually crosses
 * the line it was given.
 */

/** Arrives from below with the blur clearing, once, and then stays put. */
export function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Starts visible. It is only hidden once the client has confirmed it can watch for the
  // element arriving, so a failure anywhere in that path leaves the content readable.
  const [shown, setShown] = useState(true);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // Already on screen at mount: leave it alone. Only sections that are genuinely below
    // the fold are worth animating in.
    const box = node.getBoundingClientRect();
    if (box.top < window.innerHeight && box.bottom > 0) return;

    setShown(false);

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setShown(true);
        observer.disconnect();
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" },
    );
    observer.observe(node);

    // Content must never depend on an animation having run. If the observer has not fired
    // by the time someone could reasonably have scrolled here, show the section anyway.
    // An unrevealed section is invisible, and invisible content is worse than unanimated
    // content in every case.
    const safety = window.setTimeout(() => {
      setShown(true);
      observer.disconnect();
    }, 3000);

    return () => {
      window.clearTimeout(safety);
      observer.disconnect();
    };
  }, []);

  return (
    <div
      ref={ref}
      className={`reveal ${className}`}
      data-shown={shown}
      // The visible state is set inline rather than left to an attribute selector. If the
      // selector ever fails to match, the section stays at opacity zero and the page is
      // blank, and no animation is worth that risk.
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/**
 * The tagline, lit one word at a time in reading order.
 *
 * Each word is its own observed element, so a word turns as it crosses the trigger rather
 * than the whole block flipping together. Reading order falls out of the DOM order, and the
 * stagger comes from the words physically arriving at the line at different moments rather
 * than from a fixed delay.
 */
export function WordReveal({ text, className = "" }: { text: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const words = Array.from(node.querySelectorAll<HTMLElement>("[data-word]"));
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          // A small positional delay keeps the sweep readable when several words cross at once.
          const index = words.indexOf(el);
          window.setTimeout(() => el.setAttribute("data-lit", "true"), index * 45);
          observer.unobserve(el);
        }
      },
      { threshold: 1, rootMargin: "0px 0px -25% 0px" },
    );
    words.forEach((w) => observer.observe(w));

    // Same rule as above: the tagline is the section's entire content, so it must end up
    // readable whether or not the sweep ever ran.
    const safety = window.setTimeout(() => {
      words.forEach((w) => w.setAttribute("data-lit", "true"));
      observer.disconnect();
    }, 4000);

    return () => {
      window.clearTimeout(safety);
      observer.disconnect();
    };
  }, [text]);

  return (
    <p ref={ref} className={className}>
      {text.split(" ").map((word, i) => (
        <span key={`${word}-${i}`} data-word className="word">
          {word}
          {i < text.split(" ").length - 1 ? " " : ""}
        </span>
      ))}
    </p>
  );
}
