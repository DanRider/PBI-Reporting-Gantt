"use strict";

import { scaleTime, ScaleTime } from "d3-scale";

export interface YearBand {
    year: number;
    start: Date;
    end: Date;
}

export interface QuarterBand {
    year: number;
    quarter: 1 | 2 | 3 | 4;
    start: Date;
    end: Date;
}

export function buildScale(
    domain: [Date, Date],
    width: number,
    leftMargin: number,
    rightMargin: number
): ScaleTime<number, number> {
    const right = Math.max(width - rightMargin, leftMargin + 1);
    return scaleTime()
        .domain(domain)
        .range([leftMargin, right]);
}

export function quarterAlignedExtent([start, end]: [Date, Date]): [Date, Date] {
    return [startOfQuarter(start), endOfQuarter(end)];
}

export function startOfQuarter(d: Date): Date {
    const q = Math.floor(d.getMonth() / 3);
    return new Date(d.getFullYear(), q * 3, 1);
}

export function endOfQuarter(d: Date): Date {
    const q = Math.floor(d.getMonth() / 3);
    return new Date(d.getFullYear(), q * 3 + 3, 0);
}

export function yearsInRange([start, end]: [Date, Date]): YearBand[] {
    const out: YearBand[] = [];
    for (let y = start.getFullYear(); y <= end.getFullYear(); y++) {
        out.push({
            year: y,
            start: new Date(y, 0, 1),
            end: new Date(y, 11, 31),
        });
    }
    return out;
}

export function quartersInRange([start, end]: [Date, Date]): QuarterBand[] {
    const out: QuarterBand[] = [];
    const begin = startOfQuarter(start);
    const finish = endOfQuarter(end);
    let d = new Date(begin);
    while (d <= finish) {
        const q = (Math.floor(d.getMonth() / 3) + 1) as 1 | 2 | 3 | 4;
        out.push({
            year: d.getFullYear(),
            quarter: q,
            start: new Date(d),
            end: endOfQuarter(d),
        });
        d = new Date(d.getFullYear(), d.getMonth() + 3, 1);
    }
    return out;
}
