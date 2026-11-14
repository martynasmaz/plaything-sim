"""Create a reproducible outcome report and paired chart from measured JSON."""
import json
import math
import sys
from pathlib import Path
from reportlab.graphics.shapes import Drawing, String, Line
from reportlab.graphics.charts.lineplots import LinePlot
from reportlab.graphics import renderSVG
from reportlab.lib.colors import HexColor

path = Path(sys.argv[1])
data = json.loads(path.read_text(encoding="utf-8"))
baseline_path = path.parent / "population-audit-10-20261114.json"
baseline = json.loads(baseline_path.read_text(encoding="utf-8"))
labels = {"extinct": "Extinct", "at_risk": "Alive, but at risk", "recovering": "Small / recovering", "continuing": "Continuing generations"}
n = len(data["runs"])
def interval(k):
    z = 1.96
    p = k / n
    denominator = 1 + z*z/n
    center = (p + z*z/(2*n)) / denominator
    half = z * math.sqrt(p*(1-p)/n + z*z/(4*n*n)) / denominator
    return [100*(center-half), 100*(center+half)]

odds = {key: {"count": data["endings"][key], "percent": 100*data["endings"][key]/n, "wilson95": interval(data["endings"][key])} for key in labels}
path.with_name(path.stem+"-odds.json").write_text(json.dumps(odds, indent=2)+"\n", encoding="utf-8")
lines = ["# Local village outcomes — 14 November 2026", "", f"{n} fresh, independent seeds ({data['seeds'][0]}–{data['seeds'][-1]}), six founders each, up to day {data['horizon']:,}. No god commands, gifts, immigration, magic unlock or rescue rules.", "",
         "## Observed outcome frequencies", "", "| Outcome at day 3,000 | Villages | Observed frequency | Approx. 95% sampling interval |", "|---|---:|---:|---:|"]
for key, label in labels.items():
    o=odds[key]
    lines.append(f"| {label} | {o['count']}/{n} | {o['percent']:.0f}% | {o['wilson95'][0]:.1f}–{o['wilson95'][1]:.1f}% |")
lines += ["", "**The balance target is not met yet:** most villages still die out in this sample. Better access to food and earlier housing permit more births, but do not establish a sustainable food economy. Continuing generations at the horizon should not be read as a guaranteed successful ending.", "",
          "These categories are mutually exclusive. Surviving a finite test is not permanent survival. The intervals are binomial sampling guides, assuming the tested seeds are representative; they do not cover future rule changes or other settings. Zero observations do not mean an outcome is impossible.", "",
          "- **Extinct:** nobody remains at or before the horizon.",
          "- **At risk:** alive, but no birth in the last 300 days or no unrelated opposite-sex pair with overlapping potential reproductive ages. Children who could mature are included in that check.",
          "- **Small / recovering:** fewer than six residents, recent births and a potentially viable next generation.",
          "- **Continuing:** at least six residents, recent births and a potentially viable next generation. This is not a permanent win or proof of a balanced food economy.", "",
          "## Same ten seeds as the original audit", "", "| Seed | Earlier outcome | Updated outcome | Earlier peak | Updated peak |", "|---|---|---|---:|---:|"]
by_seed={r["seed"]:r for r in data["runs"]}
for before in baseline["runs"]:
    if before["seed"] not in by_seed: continue
    after=by_seed[before["seed"]]
    old=f"Extinct day {before['observed_day']:,}" if before["extinct"] else f"{before['population_final']} alive"
    new=f"Extinct day {after['observed_day']:,}" if after["extinct"] else f"{after['population_final']} alive"
    lines.append(f"| {before['seed']} | {old} | {new} | {before['peak']} | {after['peak']} |")
paired=data["matchedTen"]
lines += ["", f"Earlier: {data['baseline']['survived']}/10 survived day 3,000. Updated: {paired['survived']}/{paired['runs']} survived. These are paired starting seeds, but all implementation changes were tested together, so the comparison does not isolate any single change.", "",
          "## What is implemented", "",
          "- Finished local food counts toward family readiness. Each camp's stores cover its own needs; the main pantry covers remaining deficits. Empty and abandoned stores or food still drying do not become available meals.",
          "- During a shared-pantry shortfall, residents who have preserved food use enough of it to leave shared meals for residents without stores. Fresh pantry food is otherwise eaten first. This does not create food or move private stores between camps.",
          "- Household food security follows that same allocation. Recent hunger or declining reserves delay births; stable full stores qualify. Experienced food preservers can plan and pay for more storage using observed winter intake.",
          "- Huts are planned with two places remaining. Completed communal shelter, usable tools, clearing, materials and workdays still matter; plans grant no beds.",
          "- Neighboring settlements exchange paid visits, practiced techniques and family connections. Parents can join a household or remain in separate communities following real recent contact. Close relatives remain excluded. There are no outside rescue settlers.",
          "- Three-day birth readiness, seven-day maternal recovery, lifespan and food yields retain their configured values. These changes do not guarantee that a village discovers effective long-term food management.", "",
          "## Further observations", "",
          f"Across all {n} updated runs: {data['current']['births']:,} births; {data['current']['deaths']:,} deaths; {data['meetings']:,} neighboring-village meetings; {data['householdMoves']:,} household moves after visits; {data['crossVillageBirths']:,} births linked to parents from different communities; {data['techniquesLearnedOnVisits']:,} techniques learned on visits.", "",
          f"Deaths involving hunger: {data['current']['hungerDeaths']:,}; cold: {data['current']['coldDeaths']:,}; old age: {data['current']['oldAgeDeaths']:,}. Causes can overlap. Counts span differing amounts of surviving population-time, so raw totals alone are not mortality rates.", "",
          "Early trial versions produced faster growth but severe famine or excessive reproductive caution. Those experimental logs are separate from this final measured source version; they are not pooled into the odds above. The final version keeps ecological limits and genuine demographic failure rather than forcing successful endings.", "",
          "## Recommended next balance work", "",
          "1. Make family planning consider the next lean season and expected dependent mouths, rather than treating a short run of stable stocks as sufficient. Use villagers' observed experience and available stores, preserving independent discoveries and occasional failure.",
          "2. Measure winter production, preservation work and storage separately. Build a reserve before expanding the household; extra empty storage alone cannot supply meals. Audit whether urgent food work interrupts optional tasks early enough.",
          "3. Keep neighboring families and knowledge exchange, but diagnose how often safe visits are unavailable before kinship becomes limiting. These are connections between existing communities, not a source of free rescue settlers.",
          "These are recommendations, not additional unmeasured rule changes in this batch. Repeat the same ten comparison seeds and a separate larger sample after the next balance change.", "",
          "## Validation and reproduction", "",
          f"Current source SHA-256: `{data['sourceSha256']}`.", f"Archived baseline SHA-256: `{data['baselineSourceSha256']}`.", "",
          "The runner directly calls the live simulation and verifies population conservation (`6 + births − deaths`) and nonnegative food stocks. It checks that its decision modules did not change during the batch. The original ten-seed audit and its data are preserved. New data is in the CSV and JSON sharing this report's prefix.", "",
          "```", f"node scripts/population-followup.mjs {path.stem} {n} {data['seeds'][0]}", "```", "",
          "The separate full unit suite and native Canvas checks cover compatibility, real construction, food accounting, visits, family relationships and save/load behavior. No publishing or player-save changes are part of the audit."]
path.with_suffix(".md").write_text("\n".join(lines)+"\n", encoding="utf-8")

drawing=Drawing(1000,970)
ink,muted,grid=(HexColor(c) for c in ["#233a39","#516564","#dbe3df"])
drawing.add(String(28,938,"The same ten villages · before and after",fontName="Helvetica-Bold",fontSize=23,fillColor=ink))
drawing.add(String(28,910,"Six founders each · up to 3,000 days · no god interventions",fontName="Helvetica",fontSize=15,fillColor=muted))
drawing.add(String(28,885,"Gray: earlier rules     Green: updated survivor     Rust: updated extinction",fontName="Helvetica",fontSize=13,fillColor=muted))
ymax=10*math.ceil(max([r["peak"] for r in baseline["runs"]]+[by_seed[r["seed"]]["peak"] for r in baseline["runs"]])/10)
for i,before in enumerate(baseline["runs"]):
    if before["seed"] not in by_seed:continue
    after=by_seed[before["seed"]];x,y=64+(i%2)*490,725-(i//2)*168
    color=HexColor("#9e573c" if after["extinct"] else "#26735d")
    drawing.add(String(x-22,y+128,f"Seed {before['seed']} · peak {before['peak']} → {after['peak']}",fontName="Helvetica-Bold",fontSize=15,fillColor=ink))
    caption=f"Updated: extinct day {after['observed_day']:,}" if after["extinct"] else f"Updated: {after['population_final']} alive at day 3,000"
    drawing.add(String(x-22,y+109,caption,fontName="Helvetica",fontSize=12,fillColor=color))
    plot=LinePlot();plot.x,plot.y,plot.width,plot.height=x,y,400,92
    series=[]
    for r in [before,after]:
        points=[(0,6)]+[(p["day"],p["population"]) for p in r["snapshots"] if p["day"]>0]
        if r["extinct"]:points.append((data["horizon"],0))
        series.append(points)
    plot.data=series
    for index,c in enumerate([HexColor("#9ca9a3"),color]):plot.lines[index].strokeColor=c;plot.lines[index].strokeWidth=1 if index==0 else 1.6;plot.lines[index].fillColor=None
    plot.xValueAxis.valueMin=0;plot.xValueAxis.valueMax=3000;plot.xValueAxis.valueSteps=[0,1000,2000,3000]
    plot.yValueAxis.valueMin=0;plot.yValueAxis.valueMax=ymax;plot.yValueAxis.valueSteps=list(range(0,ymax+1,10))
    for axis in [plot.xValueAxis,plot.yValueAxis]:axis.labels.fontName="Helvetica";axis.labels.fontSize=11;axis.labels.fillColor=muted;axis.strokeColor=grid;axis.tickStrokeColor=grid
    plot.yValueAxis.visibleGrid=True;plot.yValueAxis.gridStrokeColor=grid;drawing.add(plot)
    drawing.add(Line(x,y+92*6/ymax,x+400,y+92*6/ymax,strokeColor=muted,strokeWidth=.5,strokeDashArray=[3,3]))
drawing.add(String(28,20,"Horizontal: days · Vertical: villagers · Dashed line: starting population",fontName="Helvetica",fontSize=12,fillColor=muted))
output=path.with_suffix(".svg");renderSVG.drawToFile(drawing,str(output));output.write_text(output.read_text(encoding="utf-8").replace("fill: None","fill: none"),encoding="utf-8")
print(json.dumps({"odds":odds,"matchedTen":paired,"allRuns":data["current"]},indent=2))
