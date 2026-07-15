import type { FieldMapping } from "../data/demoTemplate";

type MappingPreviewProps = {
  mappings: FieldMapping[];
};

export function MappingPreview({ mappings }: MappingPreviewProps) {
  return (
    <section className="panel">
      <h2>Mapping Preview</h2>
      <ul className="mapping-list">
        {mappings.map((mapping) => (
          <li key={mapping.simpleField}>
            <span>{mapping.simpleField}</span>
            <span aria-hidden="true">→</span>
            <strong>{mapping.originalField}</strong>
          </li>
        ))}
      </ul>
    </section>
  );
}
