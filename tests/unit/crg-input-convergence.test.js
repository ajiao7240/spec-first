'use strict';

/**
 * CRG 输入收敛流水线单元测试
 *
 * 执行方式：
 *   npx jest tests/unit/crg-input-convergence.test.js
 *
 * 说明：
 *   - detectPresentLanguages / isSensitiveFile 是纯函数，可直接执行
 *   - collectInputFiles / computePodExcludePaths 依赖 fs/git，以 test.todo() 形式存在
 *     （待 npm install + fixture git init 后补充）
 */

const {
  detectPresentLanguages,
  isSensitiveFile,
  computePodExcludePaths,
  collectInputFiles,
} = require('../../src/crg/input-convergence');

const fs = require('fs');
const os = require('os');
const path = require('path');

const FIXTURE_BASIC = path.join(
  __dirname,
  '../fixtures/graphignore/basic-repo'
);

// ---------------------------------------------------------------------------
// detectPresentLanguages
// ---------------------------------------------------------------------------
describe('detectPresentLanguages', () => {
  test('从扩展名推导语言 - js/ts/py 文件正确识别', () => {
    const result = detectPresentLanguages([
      'src/index.js',
      'src/utils.ts',
      'lib/main.py',
    ]);
    expect(result.has('javascript')).toBe(true);
    expect(result.has('typescript')).toBe(true);
    expect(result.has('python')).toBe(true);
  });

  test('.mm 文件识别为 objc', () => {
    const result = detectPresentLanguages(['ios/View.mm']);
    expect(result.has('objc')).toBe(true);
  });

  test('.m 文件识别为 objc', () => {
    const result = detectPresentLanguages(['ios/Controller.m']);
    expect(result.has('objc')).toBe(true);
  });

  test('.swift 文件识别为 swift', () => {
    const result = detectPresentLanguages(['App.swift']);
    expect(result.has('swift')).toBe(true);
  });

  test('.go 文件识别为 go', () => {
    const result = detectPresentLanguages(['server/main.go']);
    expect(result.has('go')).toBe(true);
  });

  test('.rs 文件识别为 rust', () => {
    const result = detectPresentLanguages(['src/lib.rs']);
    expect(result.has('rust')).toBe(true);
  });

  test('.kt 和 .kts 文件识别为 kotlin', () => {
    const result = detectPresentLanguages(['Main.kt', 'build.gradle.kts']);
    expect(result.has('kotlin')).toBe(true);
  });

  test('.jsx/.tsx 文件识别为 javascript/typescript', () => {
    const result = detectPresentLanguages(['App.jsx', 'Component.tsx']);
    expect(result.has('javascript')).toBe(true);
    expect(result.has('typescript')).toBe(true);
  });

  test('无法识别扩展名的文件不报错', () => {
    expect(() =>
      detectPresentLanguages(['README.md', '.gitignore', 'Makefile'])
    ).not.toThrow();
  });

  test('空数组返回空 Set', () => {
    const result = detectPresentLanguages([]);
    expect(result.size).toBe(0);
  });

  test('返回值是 Set 类型', () => {
    const result = detectPresentLanguages(['index.js']);
    expect(result instanceof Set).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isSensitiveFile
// ---------------------------------------------------------------------------
describe('SENSITIVE_PATTERNS / isSensitiveFile', () => {
  test('识别 .env 为敏感文件', () => {
    expect(isSensitiveFile('.env')).toBe(true);
  });

  test('识别 .env.local 为敏感文件', () => {
    expect(isSensitiveFile('.env.local')).toBe(true);
  });

  test('识别 .env.production 为敏感文件', () => {
    expect(isSensitiveFile('.env.production')).toBe(true);
  });

  test('识别 credentials.json 为敏感文件', () => {
    expect(isSensitiveFile('credentials.json')).toBe(true);
  });

  test('识别 credential.yml 为敏感文件', () => {
    expect(isSensitiveFile('credential.yml')).toBe(true);
  });

  test('识别 secrets.yaml 为敏感文件', () => {
    expect(isSensitiveFile('secrets.yaml')).toBe(true);
  });

  test('识别 secret.json 为敏感文件', () => {
    expect(isSensitiveFile('secret.json')).toBe(true);
  });

  test('识别 .pem 文件为敏感', () => {
    expect(isSensitiveFile('server.pem')).toBe(true);
  });

  test('识别 private_key.json 为敏感文件', () => {
    expect(isSensitiveFile('private_key.json')).toBe(true);
  });

  test('识别 privatekey.pem 为敏感文件', () => {
    expect(isSensitiveFile('privatekey.pem')).toBe(true);
  });

  test('普通 .js 文件不是敏感文件', () => {
    expect(isSensitiveFile('index.js')).toBe(false);
  });

  test('package.json 不是敏感文件', () => {
    expect(isSensitiveFile('package.json')).toBe(false);
  });

  test('.envrc 不命中（不含 . 或行尾）', () => {
    // .envrc 不匹配 /^\.env(\.|$)/i，因为 rc 不是 . 或行尾
    expect(isSensitiveFile('.envrc')).toBe(false);
  });

  test('接受完整路径，取 basename 判断', () => {
    expect(isSensitiveFile('config/.env.local')).toBe(true);
    expect(isSensitiveFile('config/index.js')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// computePodExcludePaths（需要 fs，可直接执行 fixture 测试）
// ---------------------------------------------------------------------------
describe('computePodExcludePaths', () => {
  test('Podfile.lock 不存在 → 降级为 Pods/** 排除', () => {
    const result = computePodExcludePaths('/nonexistent/path', 'Podfile.lock');
    expect(result.excludes).toContain('Pods/**');
    expect(result.includes).toHaveLength(0);
  });

  test.todo('含 EXTERNAL SOURCES :path: 的 Podfile.lock → 本地 Pod 保留，三方 Pod 排除');
  test.todo('无 EXTERNAL SOURCES 的 Podfile.lock → Pods/** 安全排除');
});

// ---------------------------------------------------------------------------
// collectInputFiles（依赖 git + fs，集成测试形式）
// ---------------------------------------------------------------------------
describe('collectInputFiles', () => {
  test('all-files 模式下，basic-repo 中的 node_modules 文件不进入 final_inputs', async () => {
    const { finalInputs } = await collectInputFiles(FIXTURE_BASIC, {
      mode: 'all-files',
    });
    const hasNodeModules = finalInputs.some((f) =>
      f.includes('node_modules/')
    );
    expect(hasNodeModules).toBe(false);
  });

  test('all-files 模式下，.env 文件命中安全硬规则，不进入 final_inputs', async () => {
    const { finalInputs } = await collectInputFiles(FIXTURE_BASIC, {
      mode: 'all-files',
    });
    const hasEnv = finalInputs.some(
      (f) => path.basename(f) === '.env'
    );
    expect(hasEnv).toBe(false);
  });

  test('all-files 模式下，credentials.json 命中安全硬规则，不进入 final_inputs', async () => {
    const { finalInputs } = await collectInputFiles(FIXTURE_BASIC, {
      mode: 'all-files',
    });
    const hasCreds = finalInputs.some(
      (f) => path.basename(f) === 'credentials.json'
    );
    expect(hasCreds).toBe(false);
  });

  test('all-files 模式下，src/index.js 进入 final_inputs', async () => {
    const { finalInputs } = await collectInputFiles(FIXTURE_BASIC, {
      mode: 'all-files',
    });
    expect(finalInputs.some((f) => f === 'src/index.js')).toBe(true);
  });

  test('stats 包含 input_files_total 和 input_files_after_ignore', async () => {
    const { stats } = await collectInputFiles(FIXTURE_BASIC, {
      mode: 'all-files',
    });
    expect(typeof stats.input_files_total).toBe('number');
    expect(typeof stats.input_files_after_ignore).toBe('number');
    expect(stats.input_files_after_ignore).toBeLessThanOrEqual(
      stats.input_files_total
    );
  });

  test('presentLanguages 是 Set 类型', async () => {
    const { presentLanguages } = await collectInputFiles(FIXTURE_BASIC, {
      mode: 'all-files',
    });
    expect(presentLanguages instanceof Set).toBe(true);
  });

  test('basic-repo 含 js 文件，presentLanguages 含 javascript', async () => {
    const { presentLanguages } = await collectInputFiles(FIXTURE_BASIC, {
      mode: 'all-files',
    });
    expect(presentLanguages.has('javascript')).toBe(true);
  });

  test('final_inputs 已排序', async () => {
    const { finalInputs } = await collectInputFiles(FIXTURE_BASIC, {
      mode: 'all-files',
    });
    const sorted = [...finalInputs].sort();
    expect(finalInputs).toEqual(sorted);
  });

  test('all-files 模式下，runtime 副本目录 .claude/.codex/.agents 不进入 final_inputs', async () => {
    const tmpRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'crg-runtime-excludes-'));
    fs.mkdirSync(path.join(tmpRepo, 'src'), { recursive: true });
    fs.mkdirSync(path.join(tmpRepo, '.claude/skills/demo'), { recursive: true });
    fs.mkdirSync(path.join(tmpRepo, '.codex/skills/demo'), { recursive: true });
    fs.mkdirSync(path.join(tmpRepo, '.agents/skills/demo'), { recursive: true });

    fs.writeFileSync(path.join(tmpRepo, 'src/index.js'), 'console.log("ok");\n');
    fs.writeFileSync(path.join(tmpRepo, '.claude/skills/demo/runtime.js'), 'console.log("claude");\n');
    fs.writeFileSync(path.join(tmpRepo, '.codex/skills/demo/runtime.js'), 'console.log("codex");\n');
    fs.writeFileSync(path.join(tmpRepo, '.agents/skills/demo/runtime.js'), 'console.log("agents");\n');

    try {
      const { finalInputs, stats } = await collectInputFiles(tmpRepo, {
        mode: 'all-files',
      });

      expect(finalInputs).toContain('src/index.js');
      expect(finalInputs.some((f) => f.startsWith('.claude/'))).toBe(false);
      expect(finalInputs.some((f) => f.startsWith('.codex/'))).toBe(false);
      expect(finalInputs.some((f) => f.startsWith('.agents/'))).toBe(false);
      expect(stats.ignored_files_by_rule.default_exclude).toBeGreaterThanOrEqual(3);
    } finally {
      fs.rmSync(tmpRepo, { recursive: true, force: true });
    }
  });

  test.todo('tracked-only 模式下两次收敛结果一致（需 git init fixture）');
  test.todo('iOS + 本地 Pod → 自动升级 tracked+untracked，stderr 有 warning');
  test.todo('白名单 !generated/keep.ts → 仅 keep.ts 入图，other.ts 被排除');
});
