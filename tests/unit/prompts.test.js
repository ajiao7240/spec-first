'use strict';

const { PassThrough } = require('node:stream');

const {
  PromptCancelled,
  confirm,
  requireTty,
  select,
  textInput,
} = require('../../src/cli/prompts');

function createPromptStreams() {
  const input = new PassThrough();
  const output = new PassThrough();
  const chunks = [];
  input.isTTY = true;
  output.isTTY = true;
  input.setRawMode = jest.fn();
  output.on('data', (chunk) => {
    chunks.push(Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk));
  });
  return {
    input,
    output,
    readOutput: () => chunks.join(''),
  };
}

describe('prompt primitives', () => {
  test('requireTty rejects non-TTY stdin', () => {
    const input = new PassThrough();
    const output = new PassThrough();
    output.isTTY = true;

    expect(requireTty({ input, output })).toEqual({
      ok: false,
      reason: 'no-stdin-tty',
    });
  });

  test('select supports arrow navigation and enter', async () => {
    const { input, output, readOutput } = createPromptStreams();
    const result = select('Platform?', ['A', 'B', 'C'], { input, output });

    input.write('\x1b[B');
    input.write('\x1b[B');
    input.write('\r');

    await expect(result).resolves.toBe('C');
    expect(input.setRawMode).toHaveBeenCalledWith(true);
    expect(input.setRawMode).toHaveBeenCalledWith(false);
    expect(readOutput()).not.toContain('\x1b[2J\x1b[H');
    expect(readOutput()).toContain('\x1b[4A\r\x1b[J');
  });

  test('select clamps an invalid default index', async () => {
    const { input, output } = createPromptStreams();
    const result = select('Platform?', ['A', 'B'], { input, output, defaultIndex: 99 });

    input.write('\r');

    await expect(result).resolves.toBe('A');
  });

  test('textInput accepts default value on enter and typed value otherwise', async () => {
    const first = createPromptStreams();
    const defaultResult = textInput('Name?', { input: first.input, output: first.output, default: 'kuang' });
    first.input.write('\r');
    await expect(defaultResult).resolves.toBe('kuang');

    const second = createPromptStreams();
    const typedResult = textInput('Name?', { input: second.input, output: second.output, default: 'kuang' });
    second.input.write('leo\n');
    await expect(typedResult).resolves.toBe('leo');
  });

  test('confirm handles default, yes, and no values', async () => {
    const first = createPromptStreams();
    const defaultResult = confirm('Apply?', { input: first.input, output: first.output, default: true });
    first.input.write('\r');
    await expect(defaultResult).resolves.toBe(true);

    const second = createPromptStreams();
    const noResult = confirm('Apply?', { input: second.input, output: second.output, default: true });
    second.input.write('n');
    await expect(noResult).resolves.toBe(false);

    const third = createPromptStreams();
    const yesResult = confirm('Apply?', { input: third.input, output: third.output, default: false });
    third.input.write('y');
    await expect(yesResult).resolves.toBe(true);
  });

  test('Ctrl+C cancels and restores raw mode', async () => {
    const { input, output } = createPromptStreams();
    const result = select('Platform?', ['A', 'B'], { input, output });

    input.write('\x03');

    await expect(result).rejects.toBeInstanceOf(PromptCancelled);
    expect(input.setRawMode).toHaveBeenLastCalledWith(false);
  });

  test('stdin EOF cancels and restores raw mode', async () => {
    const { input, output } = createPromptStreams();
    const result = textInput('Name?', { input, output, default: 'kuang' });

    input.end();

    await expect(result).rejects.toBeInstanceOf(PromptCancelled);
    expect(input.setRawMode).toHaveBeenLastCalledWith(false);
  });

  test('SIGTERM cleanup restores raw mode', async () => {
    const { input, output } = createPromptStreams();
    const result = confirm('Apply?', { input, output });

    process.emit('SIGTERM');

    await expect(result).rejects.toBeInstanceOf(PromptCancelled);
    expect(input.setRawMode).toHaveBeenLastCalledWith(false);
  });

  test('SIGHUP cleanup restores raw mode', async () => {
    const { input, output } = createPromptStreams();
    const result = confirm('Apply?', { input, output });

    process.emit('SIGHUP');

    await expect(result).rejects.toBeInstanceOf(PromptCancelled);
    expect(input.setRawMode).toHaveBeenLastCalledWith(false);
  });

  test('successful prompt pauses stdin after resuming it', async () => {
    const { input, output } = createPromptStreams();
    const resumeSpy = jest.spyOn(input, 'resume');
    const pauseSpy = jest.spyOn(input, 'pause');
    const result = confirm('Apply?', { input, output });

    input.write('\r');

    await expect(result).resolves.toBe(true);
    expect(resumeSpy).toHaveBeenCalled();
    expect(pauseSpy).toHaveBeenCalled();
  });
});
