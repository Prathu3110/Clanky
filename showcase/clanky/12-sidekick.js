// The sidekick: the Clanky ghost (ghost.js) with the agent layer on top. The palette is the design tokens' neutrals
// (ink, ink-3, oat-soft, oat) and tangerine, for what the agent layer and particles draw on the pixel grid.
Clanky.register(Clanky.ditherKit({
  id: 'sidekick', label: 'Clanky', pixel: 1.3, glow: 0, speed: 80,
  pal: [[42, 36, 32], [74, 64, 56], [201, 189, 173], [243, 235, 221], [242, 166, 90]],
  plugin: (kit) => Clanky.agentPlugin?.(kit) ?? null,
}));
