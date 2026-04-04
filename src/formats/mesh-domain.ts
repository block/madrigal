import type { KnowledgeUnit } from '../schema/index.js';
import type { Format, FormatOptions } from './registry.js';

/**
 * AI App Info mesh domain structure.
 */
export interface MeshDomain {
  name: string;
  description: string;
  version: string;
  generatedAt: string;
  knowledge: MeshKnowledgeEntry[];
}

/**
 * Knowledge entry in mesh domain format.
 */
export interface MeshKnowledgeEntry {
  id: string;
  title: string;
  content: string;
  domain: string;
  enforcement: string;
  tags: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Mesh Domain format.
 * Compiles knowledge units into ai-app-info mesh domain format.
 */
export const meshDomainFormat: Format = {
  name: 'mesh-domain',
  description: 'Compiles knowledge units into ai-app-info mesh domain format',
  extension: '.json',

  compile(units: KnowledgeUnit[], options: FormatOptions): string {
    const domainName = options.domain || 'design-knowledge';

    const meshDomain: MeshDomain = {
      name: domainName,
      description: `Design knowledge domain: ${domainName}`,
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      knowledge: units.map((unit) => ({
        id: unit.id,
        title: unit.title,
        content: unit.body,
        domain: unit.domain,
        enforcement: unit.enforcement,
        tags: unit.tags,
        metadata: {
          kind: unit.kind,
          attributes: unit.attributes,
          brand: unit.brand,
          system: unit.system,
          sourcePath: unit.sourcePath,
          provenance: unit.provenance,
        },
      })),
    };

    return JSON.stringify(meshDomain, null, 2);
  },
};
