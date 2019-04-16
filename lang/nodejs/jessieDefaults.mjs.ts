/// <reference path="../../typings/ses.d.ts"/>
/// <reference path="node_modules/@types/node/ts3.1/index.d.ts"/>

import makeInsulate from './insulate.mjs';
import sesshim from './sesshim.mjs';

const {confine, harden} = sesshim;

const globalEnv: Record<string, any> = {};

export const applyMethod = harden(<T>(thisObj: any, method: (...args: any) => T, args: any[]): T =>
    Reflect.apply(method, thisObj, args));

export const setComputedIndex = harden(<T>(obj: any, index: string | number, val: T) => {
    if (index === '__proto__') {
        slog.error`Cannot set ${{index}} object member`;
    }
    return obj[index] = val;
});

globalEnv.makeMap = harden((...args: any[]) => harden(new Map(...args)));
globalEnv.makeSet = harden((...args: any[]) => harden(new Set(...args)));
globalEnv.makePromise = harden((executor: any) => harden(new Promise(executor)));
globalEnv.makeWeakMap = harden((...args: any[]) => harden(new WeakMap(...args)));
globalEnv.makeWeakSet = harden((...args: any[]) => harden(new WeakSet(...args)));

// Don't insulate the arguments to setComputedIndex or the primitive endowments.
const nonMapped = new WeakSet();
nonMapped.add(setComputedIndex);
export const insulate = makeInsulate(nonMapped);

// Needed by the parser.
globalEnv.confine = harden(confine);
globalEnv.insulate = (obj: any) => obj;

export default globalEnv;
