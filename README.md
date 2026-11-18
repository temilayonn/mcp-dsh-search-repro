# mcp-dsh-search-repro

Minimal reproduction for the stdio disconnect on large search tool responses.

## Steps

    npm install
    npm test          # run 1: builds and caches the ~65KB search payload (passes)
    npm test          # run 2: replays it -> disconnect

The failure fires on the **second** run.
