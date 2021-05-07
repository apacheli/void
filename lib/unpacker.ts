import {
  atom_ext,
  binary_ext,
  float_ext,
  integer_ext,
  large_big_ext,
  large_tuple_ext,
  list_ext,
  map_ext,
  new_float_ext,
  nil_ext,
  small_atom_ext,
  small_big_ext,
  small_integer_ext,
  small_tuple_ext,
  string_ext,
} from "./terms.ts";
import { add, E } from "./util.ts";

const decoder = new TextDecoder();

const i8 = (e: E) => e.view.getInt8(e.offset++),
  u8 = (e: E) => e.view.getUint8(e.offset++),
  u16 = (e: E) => e.view.getUint16(add(e)),
  i32 = (e: E) => e.view.getInt32(add(e, 4)),
  u32 = (e: E) => e.view.getUint32(add(e, 4)),
  f64 = (e: E) => e.view.getFloat64(add(e, 8));

const unpack_list = (e: E, len: number) => {
  const list = new Array(len);
  for (let i = 0; i < len; i++) {
    list[i] = unpack_term(e);
  }
  return list;
};

const unpack_list_ext = (e: E, len: number) => {
  const list = unpack_list(e, len);
  e.offset++;
  return list;
};

const unpack_map = (e: E, len: number) => {
  const map: any = {};
  for (let i = 0; i < len; i++) {
    map[unpack_term(e)] = unpack_term(e);
  }
  return map;
};

const unpack_string = (e: E, len: number) => {
  const sub = e.uint8.subarray(add(e, len), e.offset);
  return decoder.decode(sub);
};

const unpack_large_big = (e: E, digits: number) => {
  const sign = u8(e);
  let int = 0n;
  for (let i = 0, b = 1n; i < digits; i++, b <<= 8n) {
    int += BigInt(u8(e)) * b;
  }
  int = sign ? -int : int;
  return e.stringify_bigints ? `${int}` : int;
};

const unpack_small_big = (e: E, digits: number) => {
  const sign = u8(e);
  let int = 0;
  for (let i = 0, b = 1; i < digits; i++, b <<= 8) {
    int += u8(e) * b;
  }
  return sign ? -int : int;
};

const unpack_term = (e: E) => {
  const term = u8(e);
  // deno-fmt-ignore-next-line
  switch (term) {
    case atom_ext: return unpack_atom(unpack_string(e, u16(e)));
    case binary_ext: return unpack_string(e, u32(e));
    case float_ext: return parseFloat(unpack_string(e, 31));
    case integer_ext: return i32(e);
    case large_big_ext: return unpack_large_big(e, u32(e));
    case large_tuple_ext: return unpack_list(e, u32(e));
    case list_ext: return unpack_list_ext(e, u32(e));
    case map_ext: return unpack_map(e, u32(e));
    case new_float_ext: return f64(e);
    case nil_ext: return [];
    case small_atom_ext: return unpack_string(e, u8(e));
    case small_big_ext: return unpack_small_big(e, u8(e));
    case small_integer_ext: return i8(e);
    case small_tuple_ext: return unpack_list(e, u8(e));
    case string_ext: return unpack_string(e, u16(e));
  }
  throw new Error(`Unsupported term '${term}'`);
};

const unpack_atom = (atom: string) => {
  // deno-fmt-ignore-next-line
  switch (atom) {
    case "false": return false;
    case "nil": return null;
    case "true": return true;
    default: return atom;
  }
};

export const unpack = (uint8: Uint8Array, stringify_bigints = true) => {
  const e = {
    offset: 1,
    stringify_bigints,
    uint8,
    view: new DataView(uint8.buffer),
  };
  return unpack_term(e);
};
