export default function ContactPage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col px-6 py-12 md:px-8 md:py-20">
      <div className="rounded-2xl border border-surface/60 bg-surface/30 p-8 text-center shadow-neon-sm transition-all duration-300 hover:shadow-neon-md md:p-12">
        <h1 className="mb-6 text-4xl font-bold tracking-tight text-accent md:text-5xl">Contact</h1>
        
        <div className="mx-auto max-w-2xl space-y-6">
          <p className="text-lg text-text/80">
            Foodly Map is an early-stage project focused on building a better way to discover and share food experiences.
          </p>
          
          <p className="text-base text-text/70">
            For questions or feedback, contact me here:
          </p>
          
          <a
            href="https://djm-tech.dev/contact/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-lg border-2 border-accent/60 bg-surface/80 px-8 py-3 text-base font-semibold text-accent shadow-glow transition-all duration-300 hover:-translate-y-0.5 hover:border-accent hover:bg-accent/10 hover:shadow-glow-lg"
          >
            Get in Touch
          </a>
        </div>
      </div>
    </div>
  );
}
