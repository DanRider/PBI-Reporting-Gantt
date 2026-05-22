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

export interface MonthBand {
    year: number;
    month: number;       // 1-12
    start: Date;
    end: Date;
}

const MONTH_LETTERS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

export function monthLetter(month: number): string {
    return MONTH_LETTERS[(month - 1) % 12];
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
            end: new Date(y + 1, 0, 1),  // next year's Jan 1 — adjacent ticks share boundary x
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
        const nextStart = new Date(d.getFullYear(), d.getMonth() + 3, 1);
        out.push({
            year: d.getFullYear(),
            quarter: q,
            start: new Date(d),
            end: nextStart,  // next quarter's start — adjacent ticks share boundary x
        });
        d = nextStart;
    }
    return out;
}

export function monthsInRange([start, end]: [Date, Date]): MonthBand[] {
    const out: MonthBand[] = [];
    const begin = new Date(start.getFullYear(), start.getMonth(), 1);
    const finish = new Date(end.getFullYear(), end.getMonth() + 1, 0);
    let d = new Date(begin);
    while (d <= finish) {
        const nextStart = new Date(d.getFullYear(), d.getMonth() + 1, 1);
        out.push({
            year: d.getFullYear(),
            month: d.getMonth() + 1,
            start: new Date(d),
            end: nextStart,  // next month's start — adjacent ticks share boundary x
        });
        d = nextStart;
    }
    return out;
}
