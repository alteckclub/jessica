// TODO: Implement Jessie interpreter.
import makeStructuredClone from './struct-clone.mjs';
var Binding;
(function (Binding) {
    Binding[Binding["parent"] = 0] = "parent";
    Binding[Binding["name"] = 1] = "name";
    Binding[Binding["getter"] = 2] = "getter";
    Binding[Binding["setter"] = 3] = "setter";
})(Binding || (Binding = {}));
function makeHardenedBinding(ctx, name, init) {
    const immutableSlot = harden(init);
    return harden([ctx.envp, name, () => immutableSlot]);
}
function makeMutableBinding(ctx, name, init) {
    let slot = init;
    return harden([ctx.envp, name,
        () => slot, (val) => slot = val,
    ]);
}
function doEval(ctx, ...nameArgs) {
    // slog.info`eval ${nameArgs}`;
    const [name, ...args] = nameArgs;
    const ee = ctx.actions[name];
    if (!ee) {
        slog.error `No ${{ name }} implemented in ${ctx.name} context`;
    }
    return ee(ctx, ...args);
}
function doApply(ctx, args, formals, body) {
    // Bind the formals.
    // TODO: Rest arguments.
    formals.forEach((f, i) => ctx.envp = makeMutableBinding(ctx, f, args[i]));
    // Evaluate the body.
    return doEval(ctx, ...body);
}
function evalCall(ctx, func, args) {
    const lambda = doEval(ctx, ...func);
    if (typeof lambda !== 'function') {
        slog.error `Expected a function, not ${{ lambda }}`;
    }
    const evaledArgs = args.map((a) => doEval(ctx, ...a));
    return lambda(...evaledArgs);
}
function evalUse(ctx, name) {
    let b = ctx.envp;
    while (b !== undefined) {
        if (b[Binding.name] === name) {
            return b[Binding.getter]();
        }
        b = b[Binding.parent];
    }
    slog.error `Cannot find binding for ${name} in current scope`;
}
function evalBlock(ctx, statements) {
    // Produce the final value.
    return statements.reduce((_, s) => doEval(ctx, ...s), undefined);
}
function evalGet(ctx, objExpr, index) {
    const obj = doEval(ctx, ...objExpr);
    return obj[index];
}
function makeInterpJessie(importer) {
    const structuredClone = makeStructuredClone();
    function evalData(ctx, struct) {
        return structuredClone(struct);
    }
    const exprActions = {
        call: evalCall,
        data: evalData,
        get: evalGet,
        use: evalUse,
    };
    const statementActions = {
        ...exprActions,
        block: evalBlock,
        functionDecl: evalFunctionDecl,
    };
    function evalExportDefault(ctx, expr) {
        const exprCtx = { ...ctx, actions: exprActions, name: 'expression' };
        return doEval(exprCtx, ...expr);
    }
    function evalFunctionDecl(ctx, nameDef, argDefs, body) {
        const [_ndef, name] = nameDef;
        const formals = argDefs.map(([_adef, arg]) => arg);
        const lambda = (...args) => {
            // Capture the evalContext here.
            const statementCtx = { ...ctx, actions: statementActions, name: 'statement' };
            return doApply(statementCtx, args, formals, body);
        };
        ctx.envp = makeMutableBinding(ctx, name, harden(lambda));
    }
    // TODO: Hoist all shallow nested function definitions to the block's toplevel.
    function interpJessie(ast, endowments, options) {
        const lastSlash = options.scriptName === undefined ? -1 : options.scriptName.lastIndexOf('/');
        const thisDir = lastSlash < 0 ? '.' : options.scriptName.slice(0, lastSlash);
        const moduleBodyActions = {
            exportDefault: evalExportDefault,
            functionDecl: evalFunctionDecl,
            import: evalImport,
        };
        const moduleActions = {
            module: evalModule,
        };
        function evalModule(ectx, body) {
            const bodyCtx = { ...ectx, actions: moduleBodyActions, name: 'module body' };
            let didExport = false, exported;
            for (const stmt of body) {
                if (stmt[0] === 'exportDefault') {
                    if (didExport) {
                        slog.error `Cannot use more than one "export default" statement`;
                    }
                    exported = doEval(bodyCtx, ...stmt);
                    didExport = true;
                }
                else {
                    doEval(bodyCtx, ...stmt);
                }
            }
            return exported;
        }
        function evalImport(ectx, varBinding, path) {
            if (varBinding[0] !== 'def') {
                slog.error `Unrecognized import variable binding ${{ varBinding }}`;
            }
            if (path[0] === '.') {
                // Take the input relative to our current path.
                path = `${thisDir}${path.slice(1)}`;
            }
            // Interpret with no additional endowments.
            const evaluator = (east) => interpJessie(east, endowments, { scriptName: path });
            const val = importer(path, evaluator);
            ectx.envp = makeHardenedBinding(ectx, varBinding[1], val);
            return val;
        }
        // slog.info`AST: ${JSON.stringify(ast, undefined, 2)}`;
        const ctx = { actions: moduleActions, name: 'module' };
        for (const [name, value] of Object.entries(endowments)) {
            // slog.info`Adding ${name}, ${value} to bindings`;
            ctx.envp = makeHardenedBinding(ctx, name, value);
        }
        return doEval(ctx, ...ast);
    }
    interpJessie.expr = interpJessie;
    return harden(interpJessie);
}
export default harden(makeInterpJessie);
