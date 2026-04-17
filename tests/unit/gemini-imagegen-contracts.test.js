'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ClaudeAdapter = require('../../src/cli/adapters/claude');
const CodexAdapter = require('../../src/cli/adapters/codex');

const REPO_ROOT = path.join(__dirname, '..', '..');
const SKILL_DIR = path.join(REPO_ROOT, 'skills/gemini-imagegen');
const SKILL_PATH = path.join(SKILL_DIR, 'SKILL.md');
const SCRIPTS_DIR = path.join(SKILL_DIR, 'scripts');
const REQUIREMENTS_PATH = path.join(SKILL_DIR, 'requirements.txt');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

describe('gemini-imagegen contracts', () => {
  test('source skill preserves generate/edit/compose/multi-turn chat contracts', () => {
    const skill = read(SKILL_PATH);

    expect(skill).toContain('name: gemini-imagegen');
    expect(skill).toContain('GEMINI_API_KEY');
    expect(skill).toContain('model="gemini-3-pro-image-preview"');
    expect(skill).toContain('## Editing Images');
    expect(skill).toContain('## Multi-Turn Refinement');
    expect(skill).toContain('### Multiple Reference Images (Up to 14)');
    expect(skill).toContain('chat = client.chats.create');
    expect(skill).toContain('response_modalities');
  });

  test('requirements and script set exist with expected capability entry points', () => {
    const requirements = read(REQUIREMENTS_PATH);
    const scriptNames = fs.readdirSync(SCRIPTS_DIR)
      .filter((name) => name.endsWith('.py'))
      .sort();

    expect(requirements).toContain('google-genai>=1.0.0');
    expect(requirements).toContain('Pillow>=10.0.0');
    expect(scriptNames).toEqual([
      'compose_images.py',
      'edit_image.py',
      'gemini_images.py',
      'generate_image.py',
      'multi_turn_chat.py',
    ]);

    const generate = read(path.join(SCRIPTS_DIR, 'generate_image.py'));
    const edit = read(path.join(SCRIPTS_DIR, 'edit_image.py'));
    const compose = read(path.join(SCRIPTS_DIR, 'compose_images.py'));
    const chat = read(path.join(SCRIPTS_DIR, 'multi_turn_chat.py'));

    expect(generate).toContain('def generate_image(');
    expect(generate).toContain('client.models.generate_content(');
    expect(edit).toContain('def edit_image(');
    expect(edit).toContain('contents=[instruction, input_image]');
    expect(compose).toContain('def compose_images(');
    expect(compose).toContain('Maximum 14 reference images supported');
    expect(chat).toContain('class ImageChat');
    expect(chat).toContain('self.client.chats.create(');
    expect(chat).toContain('/save [filename]');
  });

  test('runtime transforms preserve gemini-imagegen naming and usage anchors', () => {
    const sourceSkill = read(SKILL_PATH);
    const claude = new ClaudeAdapter();
    const codex = new CodexAdapter();
    const claudeRuntime = claude.transformSkillContent(sourceSkill);
    const codexRuntime = codex.transformSkillContent(sourceSkill, { skillName: 'gemini-imagegen' });

    expect(claudeRuntime).toContain('name: gemini-imagegen');
    expect(codexRuntime).toContain('name: gemini-imagegen');
    expect(claudeRuntime).toContain('## Multi-Turn Refinement');
    expect(codexRuntime).toContain('## Multi-Turn Refinement');
    expect(claudeRuntime).toContain('### Multiple Reference Images (Up to 14)');
    expect(codexRuntime).toContain('### Multiple Reference Images (Up to 14)');
  });
});
