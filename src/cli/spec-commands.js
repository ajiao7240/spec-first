const COMMANDS = [
  {
    name: 'brainstorm',
    filename: 'brainstorm.md',
    description: 'Run the Spec-First brainstorm workflow',
    argumentHint: '[feature idea or problem]',
  },
  {
    name: 'plan',
    filename: 'plan.md',
    description: 'Run the Spec-First planning workflow',
    argumentHint: '[requirements doc path or topic]',
  },
  {
    name: 'work',
    filename: 'work.md',
    description: 'Run the Spec-First execution workflow',
    argumentHint: '[plan file path]',
  },
  {
    name: 'review',
    filename: 'review.md',
    description: 'Run the Spec-First review workflow',
    argumentHint: '[branch, PR, or change summary]',
  },
  {
    name: 'compound',
    filename: 'compound.md',
    description: 'Run the Spec-First knowledge capture workflow',
    argumentHint: '[brief problem context]',
  },
];

function commandNames() {
  return COMMANDS.map((command) => command.name);
}

module.exports = {
  COMMANDS,
  commandNames,
};
