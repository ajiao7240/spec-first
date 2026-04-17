'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ClaudeAdapter = require('../../src/cli/adapters/claude');
const CodexAdapter = require('../../src/cli/adapters/codex');

const REPO_ROOT = path.join(__dirname, '..', '..');
const SKILL_DIR = path.join(REPO_ROOT, 'skills/dspy-ruby');
const SKILL_PATH = path.join(SKILL_DIR, 'SKILL.md');
const REFERENCES_DIR = path.join(SKILL_DIR, 'references');
const ASSETS_DIR = path.join(SKILL_DIR, 'assets');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function exists(filePath) {
  return fs.existsSync(filePath);
}

describe('dspy-ruby contracts', () => {
  test('source skill covers signatures/modules/providers/optimization and local resource links', () => {
    const skill = read(SKILL_PATH);

    expect(skill).toContain('name: dspy-ruby');
    expect(skill).toContain('### 1. Signatures');
    expect(skill).toContain('### 2. Modules');
    expect(skill).toContain('## Provider Adapter Gems');
    expect(skill).toContain('### 5. Optimization');
    expect(skill).toContain('MIPROv2');
    expect(skill).toContain('GEPA');

    expect(skill).toContain('references/core-concepts.md');
    expect(skill).toContain('references/toolsets.md');
    expect(skill).toContain('references/providers.md');
    expect(skill).toContain('references/optimization.md');
    expect(skill).toContain('references/observability.md');
    expect(skill).toContain('assets/signature-template.rb');
    expect(skill).toContain('assets/module-template.rb');
    expect(skill).toContain('assets/config-template.rb');
  });

  test('references and assets exist and preserve core DSPy.rb contracts', () => {
    const coreConceptsPath = path.join(REFERENCES_DIR, 'core-concepts.md');
    const providersPath = path.join(REFERENCES_DIR, 'providers.md');
    const optimizationPath = path.join(REFERENCES_DIR, 'optimization.md');
    const observabilityPath = path.join(REFERENCES_DIR, 'observability.md');
    const toolsetsPath = path.join(REFERENCES_DIR, 'toolsets.md');

    const signatureTemplatePath = path.join(ASSETS_DIR, 'signature-template.rb');
    const moduleTemplatePath = path.join(ASSETS_DIR, 'module-template.rb');
    const configTemplatePath = path.join(ASSETS_DIR, 'config-template.rb');

    expect(exists(coreConceptsPath)).toBe(true);
    expect(exists(providersPath)).toBe(true);
    expect(exists(optimizationPath)).toBe(true);
    expect(exists(observabilityPath)).toBe(true);
    expect(exists(toolsetsPath)).toBe(true);

    expect(exists(signatureTemplatePath)).toBe(true);
    expect(exists(moduleTemplatePath)).toBe(true);
    expect(exists(configTemplatePath)).toBe(true);

    const coreConcepts = read(coreConceptsPath);
    const providers = read(providersPath);
    const optimization = read(optimizationPath);
    const signatureTemplate = read(signatureTemplatePath);
    const moduleTemplate = read(moduleTemplatePath);
    const configTemplate = read(configTemplatePath);

    expect(coreConcepts).toContain('## Signatures');
    expect(coreConcepts).toContain('## Modules');
    expect(providers).toContain('dspy-openai');
    expect(providers).toContain('dspy-ruby_llm');
    expect(optimization).toContain('## MIPROv2');
    expect(optimization).toContain('## GEPA');

    expect(signatureTemplate).toContain('class SentimentAnalysis < DSPy::Signature');
    expect(moduleTemplate).toContain('class BasicClassifier < DSPy::Module');
    expect(configTemplate).toContain("gem 'dspy-ruby_llm'");
  });

  test('runtime transforms keep dspy-ruby identity and resource references', () => {
    const sourceSkill = read(SKILL_PATH);
    const claude = new ClaudeAdapter();
    const codex = new CodexAdapter();
    const claudeRuntime = claude.transformSkillContent(sourceSkill);
    const codexRuntime = codex.transformSkillContent(sourceSkill, { skillName: 'dspy-ruby' });

    expect(claudeRuntime).toContain('name: dspy-ruby');
    expect(codexRuntime).toContain('name: dspy-ruby');
    expect(claudeRuntime).toContain('references/core-concepts.md');
    expect(codexRuntime).toContain('references/core-concepts.md');
    expect(claudeRuntime).toContain('assets/signature-template.rb');
    expect(codexRuntime).toContain('assets/signature-template.rb');
  });
});
