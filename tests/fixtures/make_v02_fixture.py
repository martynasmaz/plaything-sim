#!/usr/bin/env python3
"""Build tests/fixtures/python-v02-traits-seeds-0-199.json from the reference sim.

Run: SIM_DIR=/workspace/sim python3 tests/fixtures/make_v02_fixture.py
Per seed and strategy (none, helped, cruel; 60 days, v0.2 + traits) it stores
the summary facts plus SHA-256 digests of the day-by-day history, every trait
effect (uncapped), the internal-log lines kept (at most 3 a day) and every trait assignment, in a canonical text form that
tests/strategies.js rebuilds from the JS sim.
"""
import hashlib, json, os, sys
from pathlib import Path
sys.path.insert(0, os.environ.get('SIM_DIR', '/workspace/sim'))
import gourdling_v02 as v02

KEY = {'rain': 'rain', 'drought': 'drought', 'bless': 'bless', 'plague': 'plague', 'fire': 'teach fire',
       'harvest': 'harvest', 'heal': 'heal', 'sow': 'teach farming', None: ''}
WEATHER = {'normal': 'normal', 'rain': 'rain', 'drought': 'drought', 'cold': 'cold'}
sha = lambda text: hashlib.sha256(text.encode()).hexdigest()

class Recorded(v02.Sim02):
    def __init__(self, *a, **k):
        self.events, self.meta, self.lines = [], [], []
        super().__init__(*a, **k)
    def fire_trait(self, p, trait, text):
        key = f'{self.day}:{p.id + 1}:{trait}'  # JS numbers Gourdlings from 1
        self.events.append(key); self.meta.append(key)
        super().fire_trait(p, trait, text)
    def flush_log(self):
        # The internal-log lines actually kept (at most 3 a day, by priority).
        for _, seq, _ in sorted(self.day_lines)[:v02.LOG_MAX_PER_DAY]:
            self.lines.append(self.meta[seq])
        self.meta = []
        super().flush_log()

FIELDS = ['wipeout_day', 'population30', 'population60', 'deaths30', 'deaths60', 'births60', 'peak_population',
          'bonfire_day', 'cap_day', 'farming_day', 'cap12_day', 'shed_built', 'line_count', 'history', 'events', 'lines', 'traits']
def run(seed, mode):
    s = Recorded(seed, v02.Config02(), 'v0.2', True)
    for _ in range(60):
        if not s.step(mode): break
    r = s.result()
    hist = ';'.join(','.join(str(x) for x in (h['day'], WEATHER[h['weather']], h['population'], h['food'], h['wood'],
        h['wonder'], h['min_health'], h['births'], h['deaths'], int(h['fire']), KEY[h['command']])) for h in s.history)
    traits = ';'.join(f'{i + 1}:{a}+{b}' for i, (a, b) in sorted(s.traits.items()))
    return [r['wipeout_day'], r['population30'], r['population60'], r['deaths30'], r['deaths60'], r['births60'],
            r['peak_population'], r['bonfire_day'], r['cap_day'], r['farming_day'], r['cap12_day'], r['shed_built'],
            len(s.lines), sha(hist), sha(';'.join(s.events)), sha(';'.join(s.lines)), sha(traits)], r

out = {'source': 'tests/fixtures/make_v02_fixture.py over /workspace/sim/gourdling_v02.py (v0.2 + traits, seeds 0-199, 60 days)',
       'fields': FIELDS, 'runs': {}, 'results': {}}
for mode in ('none', 'helped', 'cruel'):
    rows, raw = [], []
    for seed in range(200):
        row, r = run(seed, mode); rows.append(row); raw.append(r)
    out['runs'][mode] = rows
    s = v02.summarise(raw)
    out['results'][mode] = {k: s[k] for k in ('survive60_pct', 'wipeout_by60_pct', 'death_by60_pct', 'bonfire_by60_pct',
        'median_bonfire_day_among_discoverers', 'cap_by60_pct', 'median_wipeout_day_among_wiped_by60', 'farming_by60_pct',
        'median_farming_day', 'shed_by60_pct', 'cap12_by60_pct', 'mean_deaths60', 'mean_population60_all_runs')}
    fires = {}
    for r in raw:
        for k, v in r['trait_fires'].items(): fires[k] = fires.get(k, 0) + v
    out['results'][mode]['trait_fires'] = dict(sorted(fires.items()))
    out['results'][mode]['log_lines'] = sum(row[FIELDS.index('line_count')] for row in rows)
Path(__file__).with_name('python-v02-traits-seeds-0-199.json').write_text(json.dumps(out, separators=(',', ':')) + '\n')
print(json.dumps(out['results'], indent=1))
