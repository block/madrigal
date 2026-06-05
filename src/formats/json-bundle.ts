import type { KnowledgeUnit } from '../schema/index.js';
import type { Format, FormatOptions } from './registry.js';

/**
 * JSON bundle output structure.
 */
export interface JsonBundle {
  /** Metadata about the bundle */
  meta: {
    version: string;
    generatedAt: string;
    brand?: string;
    domain?: string;
    system?: string;
    unitCount: number;
  };
  /** Knowledge units in the bundle */
  units: KnowledgeUnit[];
}

/**
 * JSON Bundle format.
 * Compiles knowledge units into a searchable JSON bundle.
 */
export const jsonBundleFormat: Format = {
  name: 'json-bundle',
  description: 'Compiles knowledge units into a searchable JSON bundle',
  extension: '.json',

  compile(units: KnowledgeUnit[], options: FormatOptions): string {
    const bundle: JsonBundle = {
      meta: {
        version: '1.0.0',
        generatedAt: new Date().toISOString(),
        brand: options.brand,
        domain: options.domain,
        system: options.system,
        unitCount: units.length,
      },
      units: units.map((unit) => ({
        // Ensure consistent field ordering in output
        id: unit.id,
        title: unit.title,
        body: unit.body,
        kind: unit.kind,
        tags: unit.tags,
        sourcePath: unit.sourcePath,
        frontmatter: unit.frontmatter,
        attributes: unit.attributes,
        relationships: unit.relationships,
        provenance: unit.provenance,
        domain: unit.domain,
        system: unit.system,
        brand: unit.brand,
        enforcement: unit.enforcement,
      })),
    };

    return JSON.stringify(bundle, null, 2);
  },
};
