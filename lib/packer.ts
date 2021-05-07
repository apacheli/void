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

interface P {
  offset: number;
  uint8: Uint8Array;
  view: DataView;
}
type A = number[] | Uint8Array;

const encoder = new TextEncoder();

const add = (addend = 2, p: P) => {
  const before_offset = p.offset;
  p.offset += addend;
  return before_offset;
};

// deno-fmt-ignore-next-line
const
  set = (p: P, b: A) => p.uint8.set(b, add(b.length, p)),
  u8 = (p: P, v: number) => p.view.setUint8(p.offset++, v),
  u32 = (p: P, v: number) => p.view.setUint32(add(4, p), v),
  f64 = (p: P, v: number) => p.view.setFloat64(add(8, p), v);

const small_atom = (p: P, atom: A) => {
  u8(p, small_atom_ext);
  u8(p, atom.length);
  set(p, atom);
};

const js_number = (p: P, num: number) => {
  if (!Number.isInteger(num)) {
    return new_float(p, num);
  } else if (num < 128 && num > -128) {
    return small_int(p, num);
  }
  int(p, num);
};

const int = (p: P, int: number) => {
  u8(p, integer_ext);
  u32(p, int);
};

const small_int = (p: P, int: number) => {
  u8(p, small_integer_ext);
  u8(p, int);
};

const new_float = (p: P, float: number) => {
  u8(p, new_float_ext);
  f64(p, float);
};

const string = (p: P, str: string) => {
  u8(p, binary_ext);
  u32(p, str.length);
  set(p, encoder.encode(str));
};

const list = (p: P, list: unknown[]) => {
  if (list.length > 1) {
    u8(p, list_ext);
    u32(p, list.length);
    for (let i = 0; i < list.length; i++) {
      pack_value(p, list[i]);
    }
  }
  u8(p, nil_ext);
};

const map = (p: P, map: any) => {
  const keys = Object.keys(map);
  u8(p, map_ext);
  u32(p, keys.length);
  for (const key of keys) {
    pack_value(p, key);
    pack_value(p, map[key]);
  }
};

const pack_value = (p: P, value: unknown) => {
  // deno-fmt-ignore-next-line
  switch (typeof value) {
    case "boolean": return small_atom(p, encoder.encode(`${value}`));
    case "number": return js_number(p, value);
    case "string": return string(p, value);
    case "object": return value
      ? Array.isArray(value) ? list(p, value) : map(p, value)
      : small_atom(p, [110, 105, 108]);
    case "undefined": return small_atom(p, [110, 105, 108]);
    default: throw new Error("Unsupport type");
  }
};

export const pack = (value: unknown) => {
  const uint8 = new Uint8Array(2048).fill(131, 0, 1);
  const p = {
    offset: 1,
    uint8,
    view: new DataView(uint8),
  };
  pack_value(p, value);
  return uint8.subarray(0, p.offset);
};
