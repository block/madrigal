import type {
  ComplianceResult,
  ComplianceViolation,
  ReportOptions,
} from './index.js';

/**
 * Format a compliance result into the requested output format.
 */
export function formatReport(
  result: ComplianceResult,
  options: ReportOptions,
): string {
  switch (options.format) {
    case 'markdown':
      return formatMarkdown(result, options);
    case 'json':
      return formatJson(result);
    case 'sarif':
      return formatSarif(result);
  }
}

// --- Markdown ---

function formatMarkdown(
  result: ComplianceResult,
  options: ReportOptions,
): string {
  const lines: string[] = [];

  const counts = [
    result.violations.length > 0
      ? `${result.violations.length} violation(s)`
      : null,
    result.warnings.length > 0 ? `${result.warnings.length} warning(s)` : null,
  ]
    .filter(Boolean)
    .join(', ');

  lines.push(`## Compliance Check: ${counts || 'no issues found'}`);
  lines.push('');

  if (result.violations.length > 0) {
    lines.push('### Violations (MUST fix)');
    lines.push('');
    for (const v of result.violations) {
      lines.push(formatViolationMd(v, options));
    }
    lines.push('');
  }

  if (result.warnings.length > 0) {
    lines.push('### Warnings (SHOULD fix)');
    lines.push('');
    for (const v of result.warnings) {
      lines.push(formatViolationMd(v, options));
    }
    lines.push('');
  }

  if (options.includeContext && result.info.length > 0) {
    lines.push('### Info');
    lines.push('');
    for (const v of result.info) {
      lines.push(formatViolationMd(v, options));
    }
    lines.push('');
  }

  if (result.passed) {
    lines.push('**Result: PASSED** — no must-level violations found.');
  } else {
    lines.push(
      `**Result: FAILED** — ${result.violations.length} must-level violation(s) found.`,
    );
  }

  return lines.join('\n');
}

function formatViolationMd(
  v: ComplianceViolation,
  options: ReportOptions,
): string {
  const score = v.matchResult.confidence.toFixed(2);
  let line = `- **${v.knowledgeUnit.title}** [${v.knowledgeUnit.enforcement.toUpperCase()}] — relevance: ${score}`;

  if (options.includeSuggestions) {
    // Include a brief excerpt from the rule body as guidance
    const excerpt = v.knowledgeUnit.body.slice(0, 200).split('\n')[0];
    line += `\n  > ${excerpt}`;
  }

  return line;
}

// --- JSON ---

function formatJson(result: ComplianceResult): string {
  return JSON.stringify(
    {
      passed: result.passed,
      violations: result.violations.map(violationToJson),
      warnings: result.warnings.map(violationToJson),
      info: result.info.map(violationToJson),
    },
    null,
    2,
  );
}

function violationToJson(v: ComplianceViolation) {
  return {
    unitId: v.knowledgeUnit.id,
    title: v.knowledgeUnit.title,
    enforcement: v.knowledgeUnit.enforcement,
    confidence: v.matchResult.confidence,
    message: v.message,
    tags: v.knowledgeUnit.tags,
  };
}

// --- SARIF 2.1.0 ---

function formatSarif(result: ComplianceResult): string {
  const allViolations = [
    ...result.violations,
    ...result.warnings,
    ...result.info,
  ];

  // Collect unique rules
  const ruleMap = new Map<string, ComplianceViolation>();
  for (const v of allViolations) {
    if (!ruleMap.has(v.knowledgeUnit.id)) {
      ruleMap.set(v.knowledgeUnit.id, v);
    }
  }

  const rules = Array.from(ruleMap.values()).map((v) => ({
    id: v.knowledgeUnit.id,
    shortDescription: { text: v.knowledgeUnit.title },
    fullDescription: { text: v.knowledgeUnit.body.slice(0, 500) },
    defaultConfiguration: {
      level: enforcementToSarifLevel(v.knowledgeUnit.enforcement),
    },
    properties: {
      tags: v.knowledgeUnit.tags,
      enforcement: v.knowledgeUnit.enforcement,
    },
  }));

  const results = allViolations.map((v) => ({
    ruleId: v.knowledgeUnit.id,
    level: enforcementToSarifLevel(v.knowledgeUnit.enforcement),
    message: { text: v.message },
    properties: {
      confidence: v.matchResult.confidence,
    },
  }));

  const sarif = {
    $schema:
      'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/main/sarif-2.1/schema/sarif-schema-2.1.0.json',
    version: '2.1.0' as const,
    runs: [
      {
        tool: {
          driver: {
            name: 'madrigal',
            informationUri: 'https://github.com/block/madrigal',
            rules,
          },
        },
        results,
      },
    ],
  };

  return JSON.stringify(sarif, null, 2);
}

function enforcementToSarifLevel(
  enforcement: string,
): 'error' | 'warning' | 'note' {
  switch (enforcement) {
    case 'must':
      return 'error';
    case 'should':
      return 'warning';
    default:
      return 'note';
  }
}
