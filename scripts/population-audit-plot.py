"""Standalone figures from the audit, using ReportLab's plotting library."""
import json
import sys
from pathlib import Path
from reportlab.graphics.shapes import Drawing, String, Line
from reportlab.graphics.charts.lineplots import LinePlot
from reportlab.graphics import renderSVG
from reportlab.lib.colors import HexColor

report_path = Path(sys.argv[1])
report = json.loads(report_path.read_text(encoding="utf-8"))
width, height = 1000, 970
drawing = Drawing(width, height)
ink, muted, grid = (HexColor(c) for c in ["#233a39", "#516564", "#dbe3df"])
drawing.add(String(28, 938, "Ten hands-off villages · current local version", fontName="Helvetica-Bold", fontSize=23, fillColor=ink))
drawing.add(String(28, 910, "6 founders each · up to 3,000 days · no god powers or immigration", fontSize=15, fillColor=muted))
drawing.add(String(28, 885, "Green: alive at day 3,000     Rust: died out     Dashed line: starting population", fontSize=13, fillColor=muted))
for i, run in enumerate(report["runs"]):
    column, row = i % 2, i // 2
    x, y = 64 + column * 490, 725 - row * 168
    color = HexColor("#9e573c" if run["extinct"] else "#26735d")
    label = f'Village {i + 1} (seed {run["seed"]}) · peak {run["peak"]}'
    status = f'Died out on day {run["observed_day"]:,}' if run["extinct"] else f'{run["population_final"]} alive at day 3,000'
    drawing.add(String(x - 22, y + 128, label, fontSize=15, fontName="Helvetica-Bold", fillColor=ink))
    drawing.add(String(x - 22, y + 109, status, fontSize=12, fillColor=color))
    points = [(0, 6)] + [(s["day"], s["population"]) for s in run["snapshots"]]
    if run["extinct"]:
        points.append((report["horizon"], 0))
    plot = LinePlot()
    plot.x, plot.y, plot.width, plot.height = x, y, 400, 92
    plot.data = [points]
    plot.lines[0].strokeColor = color
    plot.lines[0].strokeWidth = 1.5
    plot.lines[0].fillColor = None
    plot.xValueAxis.valueMin, plot.xValueAxis.valueMax = 0, report["horizon"]
    plot.xValueAxis.valueSteps = [0, 1000, 2000, 3000]
    plot.yValueAxis.valueMin, plot.yValueAxis.valueMax = 0, 30
    plot.yValueAxis.valueSteps = [0, 10, 20, 30]
    for axis in [plot.xValueAxis, plot.yValueAxis]:
        axis.labels.fontName = "Helvetica"
        axis.labels.fontSize = 11
        axis.labels.fillColor = muted
        axis.strokeColor = grid
        axis.tickStrokeColor = grid
    plot.yValueAxis.visibleGrid = True
    plot.yValueAxis.gridStrokeColor = grid
    drawing.add(plot)
    drawing.add(Line(x, y + 92 * 6 / 30, x + 400, y + 92 * 6 / 30, strokeColor=muted, strokeWidth=0.5, strokeDashArray=[3, 3]))
drawing.add(String(28, 20, "Horizontal: simulation days · Vertical: villagers · Extinct villages remain at zero after their last day", fontSize=12, fillColor=muted))
output = report_path.with_suffix(".svg")
renderSVG.drawToFile(drawing, str(output))
# ReportLab 4.4.9 emits CSS `fill: None` for unfilled polylines. SVG renderers
# require lowercase `none`; otherwise the default black fill hides the traces.
output.write_text(output.read_text(encoding="utf-8").replace("fill: None", "fill: none"), encoding="utf-8")
print(output)
