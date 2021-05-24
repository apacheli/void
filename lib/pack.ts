import {
  binary_ext,
  integer_ext,
  large_big_ext,
  list_ext,
  map_ext,
  new_float_ext,
  nil_ext,
  small_atom_ext,
  small_integer_ext,
} from "./terms.ts";
import { add, E } from "./util.ts";

type A = number[] | Uint8Array;

const encode = (globalThis as any).Deno?.core.encode ??
  ((c) => (input?: string) => c.encode(input))(new TextEncoder());

// deno-fmt-ignore-next-line
const
  set = (e: E, b: A) => e.uint8.set(b, add(e, b.length)),
  u8 = (e: E, v: number) => e.view.setUint8(e.offset++, v),
  u32 = (e: E, v: number) => e.view.setUint32(add(e, 4), v),
  f64 = (e: E, v: number) => e.view.setFloat64(add(e, 8), v);

const bigint = (e: E, int: bigint) => {
  u8(e, large_big_ext);
  const index = add(e, 4);
  u8(e, int < 0n ? 1 : 0);
  let i = 0;
  for (; int > 0; i++, int /= 256n) {
    u8(e, Number(int % 256n));
  }
  e.view.setUint32(index, i);
};

const small_atom = (e: E, atom: A) => {
  u8(e, small_atom_ext);
  u8(e, atom.length);
  set(e, atom);
};

const js_number = (e: E, num: number) =>
  (Number.isInteger(num)
    ? num < 128 && num > -128 ? small_int : int
    : new_float)(e, num);

const new_float = (e: E, float: number) => {
  u8(e, new_float_ext);
  f64(e, float);
};

const small_int = (e: E, int: number) => {
  u8(e, small_integer_ext);
  u8(e, int);
};

const int = (e: E, int: number) => {
  u8(e, integer_ext);
  u32(e, int);
};

const list = (e: E, list: unknown[]) => {
  if (list.length > 0) {
    u8(e, list_ext);
    u32(e, list.length);
    for (let i = 0; i < list.length; i++) {
      pack_value(e, list[i]);
    }
  }
  u8(e, nil_ext);
};

const map = (e: E, map: any) => {
  const keys = Object.keys(map);
  u8(e, map_ext);
  u32(e, keys.length);
  for (let i = 0, k = keys[i]; i < keys.length; k = keys[++i]) {
    pack_value(e, k);
    pack_value(e, map[k]);
  }
};

const string = (e: E, str: string) => {
  u8(e, binary_ext);
  u32(e, str.length);
  set(e, encode(str));
};

const nil_utf8 = [110, 105, 108];

const pack_value = (e: E, value: unknown) => {
  // deno-fmt-ignore-next-line
  switch (typeof value) {
    case "bigint": return bigint(e, value);
    case "boolean": return small_atom(e, encode(`${value}`));
    case "number": return js_number(e, value);
    case "object": return value
      ? value.constructor === Array ? list(e, value) : map(e, value)
      : small_atom(e, nil_utf8);
    case "string": return string(e, value);
    default: throw new Error(`Unsupported type '${typeof value}'`);
  }
};

export const pack = (value: unknown) => {
  const uint8 = new Uint8Array(2048).fill(131, 0, 1);
  const e = {
    offset: 1,
    uint8,
    view: new DataView(uint8.buffer),
  };
  pack_value(e, value);
  return uint8.subarray(0, e.offset);
};
