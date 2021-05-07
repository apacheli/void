import {
  binary_ext,
  integer_ext,
  list_ext,
  map_ext,
  new_float_ext,
  nil_ext,
  small_atom_ext,
  small_integer_ext,
} from "./terms.ts";
import { add, E } from "./util.ts";

type A = number[] | Uint8Array;

const encoder = new TextEncoder();

// deno-fmt-ignore-next-line
const
  set = (e: E, b: A) => e.uint8.set(b, add(e, b.length)),
  u8 = (e: E, v: number) => e.view.setUint8(e.offset++, v),
  u32 = (e: E, v: number) => e.view.setUint32(add(e, 4), v),
  f64 = (e: E, v: number) => e.view.setFloat64(add(e, 8), v);

const small_atom = (e: E, atom: A) => {
  u8(e, small_atom_ext);
  u8(e, atom.length);
  set(e, atom);
};

const js_number = (e: E, num: number) => {
  if (!Number.isInteger(num)) {
    return new_float(e, num);
  } else if (num < 128 && num > -128) {
    return small_int(e, num);
  }
  int(e, num);
};

const int = (e: E, int: number) => {
  u8(e, integer_ext);
  u32(e, int);
};

const small_int = (e: E, int: number) => {
  u8(e, small_integer_ext);
  u8(e, int);
};

const new_float = (e: E, float: number) => {
  u8(e, new_float_ext);
  f64(e, float);
};

const string = (e: E, str: string) => {
  u8(e, binary_ext);
  u32(e, str.length);
  set(e, encoder.encode(str));
};

const list = (e: E, list: unknown[]) => {
  if (list.length > 1) {
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
  for (const key of keys) {
    pack_value(e, key);
    pack_value(e, map[key]);
  }
};

const pack_value = (e: E, value: unknown) => {
  // deno-fmt-ignore-next-line
  switch (typeof value) {
    case "boolean": return small_atom(e, encoder.encode(`${value}`));
    case "number": return js_number(e, value);
    case "string": return string(e, value);
    case "object": return value
      ? Array.isArray(value) ? list(e, value) : map(e, value)
      : small_atom(e, [110, 105, 108]);
    case "undefined": return small_atom(e, [110, 105, 108]);
    default: throw new Error("Unsupport type");
  }
};

export const pack = (value: unknown) => {
  const uint8 = new Uint8Array(2048).fill(131, 0, 1);
  const e = {
    offset: 1,
    uint8,
    view: new DataView(uint8),
  };
  pack_value(e, value);
  return uint8.subarray(0, e.offset);
};
