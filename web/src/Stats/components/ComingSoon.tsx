import { Link } from "react-router-dom";
import LogoIcon from "../../assets/pumpkin.svg?react";

/**
 * Stands in for the whole dashboard when there is no data, or when the
 * fetch failed: a zeroed dashboard reads as broken, where this is
 * deliberate. See useStats for why a failure shows this rather than a
 * banner.
 */
export const ComingSoon = () => (
  <section className="stats-card stats-soon" aria-labelledby="soon-heading">
    <LogoIcon
      viewBox="0 0 441 409"
      className="stats-soon-pumpkin"
      aria-hidden="true"
    />
    <p className="stats-eyebrow stats-eyebrow--accent">Coming soon</p>
    <h2 id="soon-heading" className="stats-soon-heading mt-2">
      Nothing stirs here yet
    </h2>
    <p className="stats-soon-body mt-4">
      The spirits are still gathering. Check back soon.
    </p>
    <Link to="/" className="admin-secondary-button stats-soon-link mt-8">
      Go pick a colour
    </Link>
  </section>
);
