# Void

Packs and unpacks [ETF](https://erlang.org/doc/apps/erts/erl_ext_dist.html)
data. Written in [TypeScript](https://www.typescriptlang.org/) for
[Deno](https://deno.land/).

This can pack most JavaScript types except `symbol` and `undefined`.

```ts
import { pack, unpack } from "https://deno.land/x/void@1.0.3/mod.ts";

const packed = pack({
  a: true,
  list: ["of", 3, "things", "to", "unpack"],
});

const unpacked = unpack(packed);
```

Unpacking a `LARGE_BIG_EXT` will stringify it by default. If you need `bigint`s,
you can pass `false` into `unpack`.

```ts
// unpack(uint8: Uint8Array, stringify_bigints?: boolean)
const unpacked = unpack(uint8, false);
```
