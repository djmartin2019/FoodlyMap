import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import demoLocations from "../data/demoLocations.json";

interface DemoLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  category?: string;
}

export default function DashboardPage() {
  // Refs prevent re-initialization on re-renders
  // Map and markers are imperative objects, not React state
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  // Single reusable popup instance - created once, reused for all markers
  const popupRef = useRef<mapboxgl.Popup | null>(null);

  useEffect(() => {
    // Guard: map already initialized
    if (mapRef.current) return;
    if (!mapContainerRef.current) return;

    const token = import.meta.env.VITE_MAPBOX_TOKEN;
    if (!token) return;

    mapboxgl.accessToken = token;

    // Create map exactly once - lifecycle managed by refs, not React state
    mapRef.current = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [-95.3698, 29.7604],
      zoom: 11,
      interactive: true, // Enable pan and zoom
      attributionControl: false,
    });

    // Add markers after map loads
    mapRef.current.once("load", () => {
      if (!mapRef.current) return;

      // Create single reusable popup instance
      popupRef.current = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: true,
        className: "demo-popup",
      });

      const locations = demoLocations as DemoLocation[];

      locations.forEach((location) => {
        // Create custom marker element with neon green styling
        const el = document.createElement("div");
        el.className = "demo-marker";
        el.setAttribute("role", "button");
        el.setAttribute("aria-label", `Location: ${location.name}`);
        el.setAttribute("tabindex", "0");
        el.style.width = "12px";
        el.style.height = "12px";
        el.style.borderRadius = "50%";
        el.style.backgroundColor = "#39FF88";
        el.style.border = "2px solid rgba(57, 255, 136, 0.6)";
        el.style.boxShadow = "0 0 8px rgba(57, 255, 136, 0.5)";
        el.style.cursor = "pointer"; // Indicate clickability
        // Explicitly ensure pointer events are enabled (not blocked)
        el.style.pointerEvents = "auto";
        el.style.position = "relative";
        el.style.zIndex = "1000";

        // Create marker
        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([location.longitude, location.latitude])
          .addTo(mapRef.current!);

        // Get the actual marker element (more reliable than using el directly)
        const markerElement = marker.getElement();

        // Handle marker interaction (click and keyboard)
        const handleInteraction = (e: MouseEvent | KeyboardEvent) => {
          if (e instanceof KeyboardEvent && e.key !== "Enter" && e.key !== " ") {
            return;
          }
          e.preventDefault();
          e.stopPropagation(); // Prevent map click events

          if (!mapRef.current || !popupRef.current) return;

          // Remove popup from map if already showing
          popupRef.current.remove();

          // Update popup content and position, then add to map
          // Use safe DOM construction to prevent XSS
          const popupNode = document.createElement("div");
          popupNode.className = "text-sm font-semibold text-text";
          popupNode.textContent = location.name; // Safe: textContent escapes HTML
          
          popupRef.current
            .setLngLat([location.longitude, location.latitude])
            .setDOMContent(popupNode)
            .addTo(mapRef.current);

          // Smoothly fly to the location with zoom
          mapRef.current.flyTo({
            center: [location.longitude, location.latitude],
            zoom: 14,
            duration: 1000,
            essential: true,
          });
        };

        // Add click handler: show popup and fly to location
        markerElement.addEventListener("click", handleInteraction);
        // Add keyboard handler for accessibility
        markerElement.addEventListener("keydown", handleInteraction);

        markersRef.current.push(marker);
      });
    });

    // Cleanup: remove map, markers, and popup
    return () => {
      // Remove popup
      popupRef.current?.remove();
      popupRef.current = null;
      // Remove all markers
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      // Remove map
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col px-6 py-12 md:px-8">
      {/* Hero Section */}
      <section className="relative mb-24 text-center">
        {/* Subtle background glow behind hero */}
        <div className="absolute inset-x-0 top-1/2 -z-10 h-96 -translate-y-1/2 bg-gradient-to-b from-accent/5 via-transparent to-transparent blur-3xl" />
        
        <h1 className="mb-4 animate-fade-in text-5xl font-bold tracking-tight text-accent drop-shadow-glow md:text-6xl">
          Foodly Map
        </h1>
        <p className="mb-6 animate-fade-in-delay text-2xl font-medium text-text/90 md:text-3xl">
          A personal, social-first food map.
        </p>
        <p className="mx-auto mb-10 max-w-2xl animate-fade-in-delay-2 text-lg text-text/70">
          Yelp, but fun. Build your own food collection, discover through trusted friends, and
          explore places that actually matter to you.
        </p>
        <button
          onClick={() => {
            document.getElementById("map-demo")?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
          aria-label="Scroll to interactive map demo"
          className="group relative animate-fade-in-delay-2 rounded-lg border-2 border-accent/60 bg-surface/80 px-8 py-3 text-base font-semibold text-accent shadow-glow transition-all duration-300 hover:-translate-y-0.5 hover:border-accent hover:bg-accent/10 hover:shadow-glow-lg"
        >
          <span className="relative z-10">Explore the Map</span>
          <span className="absolute inset-0 rounded-lg bg-accent/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        </button>
      </section>

      {/* Map Demo Section */}
      <section id="map-demo" className="mb-20 scroll-mt-20">
        <div className="group relative rounded-2xl border border-surface/80 bg-surface/50 p-8 shadow-neon-card transition-all duration-300 hover:-translate-y-1 hover:border-accent/30 hover:bg-surface/60 hover:shadow-neon-card-hover md:p-12">
          <div className="mb-4 flex items-center gap-2">
            <h2 className="text-2xl font-semibold text-text">See It In Action</h2>
            <span className="rounded-full bg-accent/20 px-2 py-0.5 text-xs font-medium text-accent">
              Interactive
            </span>
          </div>
          <p className="mb-6 text-base text-text/70">
            A preview of your personal food map. Pin places you've been, organize them into lists,
            and discover new spots through friends.
          </p>
          <div className="relative h-64 w-full overflow-hidden rounded-lg border-2 border-accent/20 bg-bg/40 shadow-inner transition-all duration-300 group-hover:border-accent/40 group-hover:shadow-neon-md md:h-80">
            <div 
              ref={mapContainerRef} 
              className="h-full w-full" 
              role="application"
              aria-label="Interactive food map showing demo locations"
            />
            {!import.meta.env.VITE_MAPBOX_TOKEN && (
              <div className="absolute inset-0 flex items-center justify-center bg-bg/80" role="status" aria-live="polite">
                <p className="text-sm text-text/60">
                  Add VITE_MAPBOX_TOKEN to your .env file to see the map
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="mb-20">
        <div className="rounded-2xl border border-surface/60 bg-surface/30 p-8 shadow-neon-sm transition-all duration-300 hover:shadow-neon-md md:p-12">
          <h2 className="mb-6 text-3xl font-semibold text-text">The Problem</h2>
          <p className="mb-8 text-lg text-text/80">
            Current food discovery apps are broken. Here's why:
          </p>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="group rounded-xl border border-surface/60 bg-bg/40 p-6 shadow-neon-sm transition-all duration-300 hover:-translate-y-1 hover:border-accent/30 hover:bg-bg/60 hover:shadow-neon-md">
              <h3 className="mb-2 text-lg font-semibold text-text">Overwhelming Choices</h3>
              <p className="text-sm text-text/70">
                Thousands of restaurants, hundreds of reviews, endless scrolling. Decision fatigue
                sets in before you even pick a place.
              </p>
            </div>
            <div className="group rounded-xl border border-surface/60 bg-bg/40 p-6 shadow-neon-sm transition-all duration-300 hover:-translate-y-1 hover:border-accent/30 hover:bg-bg/60 hover:shadow-neon-md">
              <h3 className="mb-2 text-lg font-semibold text-text">Low-Trust Reviews</h3>
              <p className="text-sm text-text/70">
                Anonymous ratings from strangers you don't know. Fake reviews, incentivized
                content, and review manipulation make it hard to trust what you read.
              </p>
            </div>
            <div className="group rounded-xl border border-surface/60 bg-bg/40 p-6 shadow-neon-sm transition-all duration-300 hover:-translate-y-1 hover:border-accent/30 hover:bg-bg/60 hover:shadow-neon-md">
              <h3 className="mb-2 text-lg font-semibold text-text">Analysis Paralysis</h3>
              <p className="text-sm text-text/70">
                Spending more time reading reviews than actually eating. The search for the "perfect"
                spot becomes a chore, not a joy.
              </p>
            </div>
            <div className="group rounded-xl border border-surface/60 bg-bg/40 p-6 shadow-neon-sm transition-all duration-300 hover:-translate-y-1 hover:border-accent/30 hover:bg-bg/60 hover:shadow-neon-md">
              <h3 className="mb-2 text-lg font-semibold text-text">Algorithm-Driven Noise</h3>
              <p className="text-sm text-text/70">
                Platforms push what's popular or profitable, not what's right for you. Your
                preferences get lost in the machine.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Solution Section */}
      <section className="mb-20">
        <div className="rounded-2xl border border-surface/60 bg-surface/30 p-8 shadow-neon-sm transition-all duration-300 hover:shadow-neon-md md:p-12">
          <h2 className="mb-6 text-3xl font-semibold text-text">The Foodly Map Approach</h2>
          <p className="mb-8 text-lg text-text/80">
            We flip the model. Instead of starting with the global database, you start with your
            own map.
          </p>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="group flex items-start gap-4 rounded-xl p-4 transition-all duration-300 hover:-translate-y-0.5 hover:bg-surface/40">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-accent/50 bg-accent/15 text-accent shadow-glow transition-all duration-300 group-hover:border-accent group-hover:bg-accent/20 group-hover:shadow-glow-lg">
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                  />
                </svg>
              </div>
              <div>
                <h3 className="mb-2 text-lg font-semibold text-text">Build Your Own Food Map</h3>
                <p className="text-sm text-text/70">
                  Pin places you've actually been to and enjoyed. Your map grows organically as you
                  explore.
                </p>
              </div>
            </div>
            <div className="group flex items-start gap-4 rounded-xl p-4 transition-all duration-300 hover:-translate-y-0.5 hover:bg-surface/40">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-accent/50 bg-accent/15 text-accent shadow-glow transition-all duration-300 group-hover:border-accent group-hover:bg-accent/20 group-hover:shadow-glow-lg">
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="mb-2 text-lg font-semibold text-text">Save Places You Actually Like</h3>
                <p className="text-sm text-text/70">
                  No need to rate everything. Just save spots that matter to you. Quality over
                  quantity.
                </p>
              </div>
            </div>
            <div className="group flex items-start gap-4 rounded-xl p-4 transition-all duration-300 hover:-translate-y-0.5 hover:bg-surface/40">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-accent/50 bg-accent/15 text-accent shadow-glow transition-all duration-300 group-hover:border-accent group-hover:bg-accent/20 group-hover:shadow-glow-lg">
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="mb-2 text-lg font-semibold text-text">Discover Through Trusted Friends</h3>
                <p className="text-sm text-text/70">
                  See what your friends are eating. Mutual connections mean recommendations you can
                  actually trust.
                </p>
              </div>
            </div>
            <div className="group flex items-start gap-4 rounded-xl p-4 transition-all duration-300 hover:-translate-y-0.5 hover:bg-surface/40">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-accent/50 bg-accent/15 text-accent shadow-glow transition-all duration-300 group-hover:border-accent group-hover:bg-accent/20 group-hover:shadow-glow-lg">
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
              </div>
              <div>
                <h3 className="mb-2 text-lg font-semibold text-text">Collect and Organize</h3>
                <p className="text-sm text-text/70">
                  Create custom lists, tag places, and build your food collection like a curated
                  library. No more endless searching.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="mb-20">
        <div className="rounded-2xl border border-surface/60 bg-surface/30 p-8 shadow-neon-sm transition-all duration-300 hover:shadow-neon-md md:p-12">
          <h2 className="mb-6 text-3xl font-semibold text-text">How It Works</h2>
          <p className="mb-10 text-lg text-text/80">
            Simple, personal, and social. Here's the flow:
          </p>
          <div className="space-y-8">
            <div className="group flex gap-6 rounded-xl p-4 transition-all duration-300 hover:-translate-y-0.5 hover:bg-surface/40">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-accent/60 bg-accent/15 text-xl font-bold text-accent shadow-glow transition-all duration-300 group-hover:border-accent group-hover:bg-accent/20 group-hover:shadow-glow-lg">
                1
              </div>
              <div className="flex-1">
                <h3 className="mb-2 text-xl font-semibold text-text">Pin Places You've Been To</h3>
                <p className="text-base text-text/70">
                  Drop a pin on the map for any place you've visited and enjoyed. Add a name, maybe
                  a note, and you're done. No ratings required.
                </p>
              </div>
            </div>
            <div className="group flex gap-6 rounded-xl p-4 transition-all duration-300 hover:-translate-y-0.5 hover:bg-surface/40">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-accent/60 bg-accent/15 text-xl font-bold text-accent shadow-glow transition-all duration-300 group-hover:border-accent group-hover:bg-accent/20 group-hover:shadow-glow-lg">
                2
              </div>
              <div className="flex-1">
                <h3 className="mb-2 text-xl font-semibold text-text">Organize Into Lists</h3>
                <p className="text-base text-text/70">
                  Create custom lists like "Date Night Spots," "Quick Lunch," or "Hidden Gems."
                  Organize your map however makes sense to you.
                </p>
              </div>
            </div>
            <div className="group flex gap-6 rounded-xl p-4 transition-all duration-300 hover:-translate-y-0.5 hover:bg-surface/40">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-accent/60 bg-accent/15 text-xl font-bold text-accent shadow-glow transition-all duration-300 group-hover:border-accent group-hover:bg-accent/20 group-hover:shadow-glow-lg">
                3
              </div>
              <div className="flex-1">
                <h3 className="mb-2 text-xl font-semibold text-text">Add Friends and See Their Recommendations</h3>
                <p className="text-base text-text/70">
                  Connect with friends and see their food maps. When you have mutual friends, you
                  can discover places they've verified. Social trust, not star ratings.
                </p>
              </div>
            </div>
            <div className="group flex gap-6 rounded-xl p-4 transition-all duration-300 hover:-translate-y-0.5 hover:bg-surface/40">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-accent/60 bg-accent/15 text-xl font-bold text-accent shadow-glow transition-all duration-300 group-hover:border-accent group-hover:bg-accent/20 group-hover:shadow-glow-lg">
                4
              </div>
              <div className="flex-1">
                <h3 className="mb-2 text-xl font-semibold text-text">Discover Verified Spots Through Social Trust</h3>
                <p className="text-base text-text/70">
                  When multiple friends have been to the same place, it's verified. Save it to your
                  map and explore with confidence.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Differentiation Section */}
      <section className="mb-12">
        <div className="rounded-2xl border border-surface/60 bg-surface/30 p-4 shadow-neon-sm transition-all duration-300 hover:shadow-neon-md sm:p-6 md:p-12">
          <h2 className="mb-4 text-2xl font-semibold text-text sm:mb-6 sm:text-3xl">What Makes Us Different</h2>
          <p className="mb-6 text-base text-text/80 sm:mb-10 sm:text-lg">
            Foodly Map vs. traditional food discovery apps:
          </p>
          
          {/* Mobile: Stacked card layout - no horizontal scrolling */}
          <div className="space-y-4 sm:hidden">
            <div className="rounded-xl border border-surface/60 bg-bg/40 p-5 shadow-neon-sm">
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-text/50">Focus</div>
              <div className="text-lg font-semibold text-accent">Personal-first</div>
              <div className="mt-2 text-sm text-text/60">vs. Global-first</div>
            </div>
            
            <div className="rounded-xl border border-surface/60 bg-bg/40 p-5 shadow-neon-sm">
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-text/50">Recommendations</div>
              <div className="text-lg font-semibold text-accent">Friends over strangers</div>
              <div className="mt-2 text-sm text-text/60">vs. Strangers over friends</div>
            </div>
            
            <div className="rounded-xl border border-surface/60 bg-bg/40 p-5 shadow-neon-sm">
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-text/50">Content Model</div>
              <div className="text-lg font-semibold text-accent">Collection over reviews</div>
              <div className="mt-2 text-sm text-text/60">vs. Reviews over collection</div>
            </div>
            
            <div className="rounded-xl border border-surface/60 bg-bg/40 p-5 shadow-neon-sm">
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-text/50">Discovery</div>
              <div className="text-lg font-semibold text-accent">Signal over noise</div>
              <div className="mt-2 text-sm text-text/60">vs. Algorithm-driven noise</div>
            </div>
            
            <div className="rounded-xl border border-surface/60 bg-bg/40 p-5 shadow-neon-sm">
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-text/50">Trust Model</div>
              <div className="text-lg font-semibold text-accent">Social verification</div>
              <div className="mt-2 text-sm text-text/60">vs. Star ratings</div>
            </div>
          </div>

          {/* Desktop: Table layout for larger screens */}
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-surface">
                  <th className="pb-4 text-left text-sm font-semibold text-text/60"></th>
                  <th className="pb-4 text-left text-sm font-semibold text-accent">Foodly Map</th>
                  <th className="pb-4 text-left text-sm font-semibold text-text/60">
                    Yelp / Google Maps
                  </th>
                </tr>
              </thead>
              <tbody className="text-sm">
                <tr className="border-b border-surface/60">
                  <td className="py-4 pr-8 font-medium text-text">Focus</td>
                  <td className="py-4 text-text/80">Personal-first</td>
                  <td className="py-4 text-text/60">Global-first</td>
                </tr>
                <tr className="border-b border-surface/60">
                  <td className="py-4 pr-8 font-medium text-text">Recommendations</td>
                  <td className="py-4 text-text/80">Friends over strangers</td>
                  <td className="py-4 text-text/60">Strangers over friends</td>
                </tr>
                <tr className="border-b border-surface/60">
                  <td className="py-4 pr-8 font-medium text-text">Content Model</td>
                  <td className="py-4 text-text/80">Collection over reviews</td>
                  <td className="py-4 text-text/60">Reviews over collection</td>
                </tr>
                <tr className="border-b border-surface/60">
                  <td className="py-4 pr-8 font-medium text-text">Discovery</td>
                  <td className="py-4 text-text/80">Signal over noise</td>
                  <td className="py-4 text-text/60">Algorithm-driven noise</td>
                </tr>
                <tr>
                  <td className="py-4 pr-8 font-medium text-text">Trust Model</td>
                  <td className="py-4 text-text/80">Social verification</td>
                  <td className="py-4 text-text/60">Star ratings</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
