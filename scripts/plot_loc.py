#!/usr/bin/env python3
"""Plots loc_history.txt (from scripts/loc_history.py): the lines of code per area over time, and code against tests.

python3 scripts/plot_loc.py [loc_history.txt]
"""

import csv
import sys
from datetime import datetime

import matplotlib.dates as mdates
import matplotlib.pyplot as plt

AREAS = ("backend", "web", "mobile", "packages", "other")
COLORS = {"backend": "#3572A5", "web": "#41b883", "mobile": "#e8a33d", "packages": "#9b59b6", "other": "#b0b0b0"}


def read(path: str) -> tuple[list[datetime], dict[str, list[int]]]:
    dates: list[datetime] = []
    columns: dict[str, list[int]] = {}
    with open(path) as file:
        for row in csv.DictReader(file):
            dates.append(datetime.strptime(row["Date"], "%Y-%m-%d"))
            for name, value in row.items():
                if name not in ("Date", "Commit"):
                    columns.setdefault(name, []).append(int(value))
    return dates, columns


def plot_loc(path: str = "loc_history.txt") -> None:
    dates, columns = read(path)
    per_area = "backend_code" in columns

    fig, axes = plt.subplots(2 if per_area else 1, 1, figsize=(12, 10 if per_area else 6), squeeze=False)
    top = axes[0][0]

    if per_area:
        # The size of each area, code and tests together, stacked: the height is the whole code base
        totals = [[c + t for c, t in zip(columns[f"{a}_code"], columns[f"{a}_test"], strict=True)] for a in AREAS]
        top.stackplot(dates, totals, labels=AREAS, colors=[COLORS[a] for a in AREAS], alpha=0.85)
        top.set_title("Jotter code base by area (code + tests)", fontsize=15, fontweight="bold", pad=12)

        # Code against tests, per area: solid is code, dashed is tests
        bottom = axes[1][0]
        for area in AREAS:
            if max(columns[f"{area}_code"]) == 0:
                continue
            bottom.plot(dates, columns[f"{area}_code"], color=COLORS[area], linewidth=2, label=f"{area} code")
            bottom.plot(
                dates, columns[f"{area}_test"], color=COLORS[area], linewidth=1.5, linestyle="--", label=f"{area} tests"
            )
        bottom.set_title("Code (solid) and tests (dashed) per area", fontsize=13, pad=10)
        bottom.set_ylabel("Lines of Code (LOC)")
        bottom.grid(True, linestyle=":", alpha=0.6)
        bottom.legend(loc="upper left", ncol=2, fontsize=9, frameon=True)
        bottom.xaxis.set_major_formatter(mdates.DateFormatter("%Y-%m-%d"))
    else:
        # An older file without areas: the total and the non-test lines
        top.plot(dates, columns["Total_LOC"], label="Total LOC (code + tests)", color="#1f77b4", linewidth=2.5)
        top.plot(dates, columns["Code_LOC"], label="Non-test LOC", color="#2ca02c", linewidth=1.8, linestyle="--")
        top.set_title("Jotter Codebase Growth Over Time", fontsize=16, fontweight="bold", pad=15)

    top.set_ylabel("Lines of Code (LOC)")
    top.xaxis.set_major_locator(mdates.AutoDateLocator())
    top.xaxis.set_major_formatter(mdates.DateFormatter("%Y-%m-%d"))
    top.grid(True, linestyle=":", alpha=0.6)
    top.legend(loc="upper left", fontsize=10, frameon=True, facecolor="white", edgecolor="#e2e2e2")
    fig.autofmt_xdate()
    plt.tight_layout()

    output_image = "loc_chart.png"
    plt.savefig(output_image, dpi=200)
    print(f"Success! Plot saved as {output_image}")


if __name__ == "__main__":
    plot_loc(sys.argv[1] if len(sys.argv) > 1 else "loc_history.txt")
