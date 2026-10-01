import { useEffect, type ReactNode } from "react";
import { Link } from "react-router-dom";

type Section = { title: string; content: ReactNode };

export const LegalPage = ({ title, intro, sections }: {
  title: string;
  intro: string;
  sections: Section[];
}) => {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${title} | RGBoo`;
    window.scrollTo(0, 0);
    return () => { document.title = previousTitle; };
  }, [title]);

  return (
    <div className="legal-page">
      <header className="legal-header">
        <Link to="/" aria-label="RGBoo home">RGBoo <span> / Live color requests</span></Link>
      </header>
      <main id="main-content" className="legal-content">
        <p className="legal-eyebrow">RGBoo Stream Aggregator</p>
        <h1>{title}</h1>
        <p className="legal-date">Last updated: September 27, 2026</p>
        <p className="legal-intro">{intro}</p>
        {sections.map(({ title: heading, content }, index) => (
          <section key={heading} aria-labelledby={`section-${index}`}>
            <h2 id={`section-${index}`}>{heading}</h2>
            {content}
          </section>
        ))}
      </main>
      <footer className="legal-footer">
        <nav aria-label="Site information">
          <Link to="/">Back to RGBoo</Link>
          <Link to="/privacy">Privacy policy</Link>
          <Link to="/terms">Terms of service</Link>
        </nav>
      </footer>
    </div>
  );
};
