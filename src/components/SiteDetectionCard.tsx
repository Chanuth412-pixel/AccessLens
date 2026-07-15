import type { SupportedSite } from "../data/supportedSites";

type SiteDetectionCardProps = {
  site: SupportedSite;
};

export function SiteDetectionCard({ site }: SiteDetectionCardProps) {
  return (
    <section className="panel">
      <h2>Detected Website</h2>
      <div className="detected-site">
        <p>
          <span>Website detected:</span>
          <strong>{site.name}</strong>
        </p>
        <p>
          <span>Status:</span>
          <strong>{site.status}</strong>
        </p>
      </div>
    </section>
  );
}
