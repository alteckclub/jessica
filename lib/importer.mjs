import tagString from './tag-string.mjs';
function makeImporter(readInput, languageTag) {
    const importCache = makeMap();
    const IMPORT_RECURSION = {
        toString: () => 'IMPORT_RECURSION',
    };
    function importer(file, evaluator) {
        let val;
        if (!importCache.has(file)) {
            try {
                importCache.set(file, IMPORT_RECURSION);
                const src = readInput(file);
                const strParser = tagString(languageTag, file);
                const ast = strParser `${src}`;
                val = evaluator(ast);
            }
            catch (e) {
                // Clean up our recursion tag on error.
                importCache.delete(file);
                throw e;
            }
            importCache.set(file, val);
        }
        else {
            val = importCache.get(file);
            if (val === IMPORT_RECURSION) {
                slog.error `Import recursion while resolving ${{ file }}`;
            }
        }
        return val;
    }
    return harden(importer);
}
export default harden(makeImporter);