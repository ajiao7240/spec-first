#!/usr/bin/env node

const pkg = require('../package.json');

// 版本号固定宽度，右边对齐到边框
const ver = `spec-first v${pkg.version}`;
const LINE = '─'.repeat(60);

process.stdout.write(`
┌${LINE}┐
│  ${ver.padEnd(58)}│
│  安装完成                                                  │
└${LINE}┘

  如果安装过程中看到 tree-sitter peer dependency 警告，
  属于预期行为，不影响 CRG 解析功能，可以直接忽略。

快速开始：

  1. 诊断当前环境
     spec-first doctor

  2. 在目标项目初始化（二选一）
     spec-first init --claude
     spec-first init --codex

  3. 完全退出并重启 Claude Code 或 Codex

  4. 使用工作流入口
     /spec:bootstrap          通用上下文生成
     /spec:graph-bootstrap    CRG 图谱驱动（需先运行 crg build）
     /spec:brainstorm         需求分析
     /spec:plan               方案规划

查看所有命令：spec-first --help
查看版本详情：spec-first -v

`);
