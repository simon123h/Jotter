#!/usr/bin/env python3
import csv
from datetime import datetime
import matplotlib.pyplot as plt
import matplotlib.dates as mdates

def plot_loc():
    dates = []
    go_loc = []
    frontend_loc = []
    total_loc = []

    # Read the data from the CSV file
    with open('loc_history.txt', mode='r') as file:
        reader = csv.DictReader(file)
        for row in reader:
            # Parse the date
            date_val = datetime.strptime(row['Date'], '%Y-%m-%d')
            dates.append(date_val)
            go_loc.append(int(row['Go_LOC']))
            frontend_loc.append(int(row['TS_Vue_CSS_LOC']))
            total_loc.append(int(row['Total_LOC']))

    # Create the plot
    fig, ax = plt.subplots(figsize=(12, 6))

    # Plot each line
    ax.plot(dates, total_loc, label='Total LOC', color='#1f77b4', linewidth=2.5)
    ax.plot(dates, go_loc, label='Go (Backend) LOC', color='#2ca02c', linewidth=1.8, linestyle='--')
    ax.plot(dates, frontend_loc, label='TS/Vue/CSS (Frontend) LOC', color='#d62728', linewidth=1.8, linestyle=':')

    # Format the title and labels
    ax.set_title('Jotter Codebase Growth Over Time', fontsize=16, fontweight='bold', pad=15)
    ax.set_xlabel('Date', fontsize=12, labelpad=10)
    ax.set_ylabel('Lines of Code (LOC)', fontsize=12, labelpad=10)

    # Format x-axis with dates
    ax.xaxis.set_major_locator(mdates.AutoDateLocator())
    ax.xaxis.set_major_formatter(mdates.DateFormatter('%Y-%m-%d'))
    fig.autofmt_xdate() # Rotate dates for better readability

    # Add grid, legend and layout adjustments
    ax.grid(True, linestyle=':', alpha=0.6)
    ax.legend(loc='upper left', fontsize=11, frameon=True, facecolor='white', edgecolor='#e2e2e2')
    
    plt.tight_layout()

    # Save the chart
    output_image = 'loc_chart.png'
    plt.savefig(output_image, dpi=300)
    print(f"Success! Plot saved as {output_image}")

if __name__ == '__main__':
    plot_loc()
