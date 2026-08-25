import test from 'node:test';
import assert from 'node:assert/strict';
import { createCommandCollection } from '../src/commands/index.js';

test('command registry exposes one consolidated osu command', () => {
  const commands = createCommandCollection();
  const osu = commands.get('osu').data.toJSON();

  assert.equal(commands.size, 20);
  assert.equal(commands.has('osu-profile'), false);
  assert.deepEqual(
    osu.options.map(option => option.name),
    [
      'link',
      'profile',
      'recent',
      'growth',
      'ranking',
      'server-ranking',
      'graph',
      'analysis',
      'dashboard',
      'heatmap',
      'topplays',
      'league',
      'dm',
      'recruit',
      'goal'
    ]
  );
});

test('legacy osu command names can be temporarily restored', () => {
  const previous = process.env.ENABLE_LEGACY_OSU_COMMANDS;
  process.env.ENABLE_LEGACY_OSU_COMMANDS = 'true';

  try {
    const commands = createCommandCollection();
    assert.equal(commands.size, 35);
    assert.equal(commands.has('osu-profile'), true);
    assert.equal(commands.has('osu-goal'), true);
  } finally {
    if (previous === undefined) {
      delete process.env.ENABLE_LEGACY_OSU_COMMANDS;
    } else {
      process.env.ENABLE_LEGACY_OSU_COMMANDS = previous;
    }
  }
});
