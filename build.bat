:; cd `dirname "$0"` || exit $?
:; (cd lang/nodejs && npm run build)
:; tsc
:; for f in lib/*.mjs.js; do test -f "$f" || continue; mv "$f" `echo "$f" | sed -e 's/\.js$//'`; done
:; for f in lib/*.mjs.js.map; do test -f "$f" || continue; mjs=`echo "$f" | sed -e 's/\.js\.map$//'`; test -f "$mjs" || rm "$f"; done
