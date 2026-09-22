import { TECHNIQUE_DIFFICULTY } from '@tsudoku/core';
import { Button } from '@/components/ui/button';
import { DIFFICULTY_BANDS } from '@/lib/difficulty';
import type { Settings } from '@/lib/settings';
import { cn } from '@/lib/utils';

/**
 * Settings: difficulty band, auto-notes, and per-technique auto-solve.
 *
 * Rendered inline rather than in a modal. On a phone a modal costs a
 * full-screen context switch for what is a handful of toggles, and settings
 * you can see next to the board are settings you will actually adjust.
 */

interface SettingsPanelProps {
  readonly settings: Settings;
  readonly onSetBand: (bandId: string) => void;
  readonly onToggleAutoSolve: (technique: string) => void;
  readonly onSetAutoNotes: (enabled: boolean) => void;
  readonly onClose: () => void;
}

/**
 * Techniques offered for auto-solve, easiest first.
 *
 * Only the two singles for now. Auto-solving an elimination technique is a
 * different proposition — it removes candidates rather than placing a digit,
 * so there is no obvious "the app played your move" boundary, and the cascade
 * question in STATUS.md is unsettled. Singles are the ones worth earning
 * first anyway.
 */
const AUTO_SOLVE_TECHNIQUES: readonly string[] = ['NakedSingle', 'HiddenSingle'];

const TECHNIQUE_LABELS: Record<string, string> = {
  NakedSingle: 'Naked singles',
  HiddenSingle: 'Hidden singles',
};

export function SettingsPanel({
  settings,
  onSetBand,
  onToggleAutoSolve,
  onSetAutoNotes,
  onClose,
}: SettingsPanelProps): JSX.Element {
  return (
    <div className="rounded-lg border bg-card p-4 text-sm">
      <div className="flex items-center justify-between">
        <h2 className="font-medium">Settings</h2>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Done
        </Button>
      </div>

      <fieldset className="mt-4">
        <legend className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Difficulty
        </legend>
        <p className="mt-1 text-xs text-muted-foreground">
          New puzzles are picked at random from the band you choose.
        </p>
        <div className="mt-2 flex flex-col gap-1">
          {DIFFICULTY_BANDS.map((band) => {
            const active = band.id === settings.bandId;
            return (
              <button
                key={band.id}
                type="button"
                onClick={() => onSetBand(band.id)}
                aria-pressed={active}
                className={cn(
                  'rounded-md border px-3 py-2 text-left transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  active
                    ? 'border-board-primary bg-board-primary/10'
                    : 'border-transparent hover:bg-muted',
                )}
              >
                <span className="font-medium">{band.label}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{band.blurb}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="mt-4 border-t pt-4">
        <legend className="sr-only">Notes</legend>
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={settings.autoNotes}
            onChange={(e) => onSetAutoNotes(e.target.checked)}
            className="mt-0.5 h-4 w-4"
          />
          <span>
            <span className="font-medium">Keep notes filled</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Fill every empty cell with the engine&rsquo;s candidates, and keep them up to date as
              you play.
            </span>
          </span>
        </label>
      </fieldset>

      <fieldset className="mt-4 border-t pt-4">
        <legend className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Auto-solve
        </legend>
        <p className="mt-1 text-xs text-muted-foreground">
          Once you can spot a technique reliably, let the app handle it. Turning one on is meant to
          be something you earn, not a shortcut.
        </p>
        <div className="mt-2 flex flex-col gap-1">
          {AUTO_SOLVE_TECHNIQUES.map((technique) => (
            <label key={technique} className="flex items-center gap-2 py-1">
              <input
                type="checkbox"
                checked={settings.autoSolve.includes(technique)}
                onChange={() => onToggleAutoSolve(technique)}
                className="h-4 w-4"
              />
              <span>{TECHNIQUE_LABELS[technique] ?? technique}</span>
              <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                SE {TECHNIQUE_DIFFICULTY[technique as keyof typeof TECHNIQUE_DIFFICULTY]}
              </span>
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Not wired up yet — this records the preference so the setting is here when the behaviour
          lands.
        </p>
      </fieldset>
    </div>
  );
}
