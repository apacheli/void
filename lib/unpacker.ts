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

interface UnpackerOptions {
  bigint_string?: boolean;
}

export class Unpacker {
  #decoder = new TextDecoder();
  #offset = 1;
  #uint8!: Uint8Array;
  #view!: DataView;

  constructor(public options: UnpackerOptions = { bigint_string: true }) {
  }

  #i8 = () => this.#view.getInt8(this.#offset++);
  #u8 = () => this.#view.getUint8(this.#offset++);
  #u16 = () => this.#view.getUint16(this.add());
  #i32 = () => this.#view.getInt32(this.add(4));
  #u32 = () => this.#view.getUint32(this.add(4));
  #f64 = () => this.#view.getFloat64(this.add(8));

  add(addend = 2) {
    const before_offset = this.#offset;
    this.#offset += addend;
    return before_offset;
  }

  unpack_list(len: number) {
    const list = new Array(len);
    for (let i = 0; i < len; i++) {
      list[i] = this.#unpack();
    }
    return list;
  }

  unpack_list_ext(len: number) {
    const list = this.unpack_list(len);
    this.#offset++;
    return list;
  }

  unpack_map(len: number) {
    const map: any = {};
    for (let i = 0; i < len; i++) {
      map[this.#unpack()] = this.#unpack();
    }
    return map;
  }

  unpack_string(len: number) {
    const sub = this.#uint8.subarray(this.add(len), this.#offset);
    return this.#decoder.decode(sub);
  }

  unpack_large_big(digits: number) {
    const sign = this.#u8();
    let int = 0n;
    for (let i = 0, b = 1n; i < digits; i++, b <<= 8n) {
      int += BigInt(this.#u8()) * b;
    }
    int = sign ? -int : int;
    return this.options?.bigint_string ? `${int}` : int;
  }

  unpack_small_big(digits: number) {
    if (digits > 6) {
      return this.unpack_large_big(digits);
    }
    const sign = this.#u8();
    let value = 0;
    for (let i = 0, b = 1; i < digits; i++, b <<= 8) {
      value += this.#u8() * b;
    }
    return sign ? -value : value;
  }

  #unpack = () => {
    const term = this.#u8();
    // deno-fmt-ignore-next-line
    switch (term) {
      case atom_ext: return unpack_atom(this.unpack_string(this.#u16()));
      case binary_ext: return this.unpack_string(this.#u32());
      case float_ext: return parseFloat(this.unpack_string(31));
      case integer_ext: return this.#i32();
      case large_big_ext: return this.unpack_large_big(this.#u32());
      case large_tuple_ext: return this.unpack_list(this.#u32());
      case list_ext: return this.unpack_list_ext(this.#u32());
      case map_ext: return this.unpack_map(this.#u32());
      case new_float_ext: return this.#f64();
      case nil_ext: return [];
      case small_atom_ext: return this.unpack_string(this.#u8());
      case small_big_ext: return this.unpack_small_big(this.#u8());
      case small_integer_ext: return this.#i8();
      case small_tuple_ext: return this.unpack_list(this.#u8());
      case string_ext: return this.unpack_string(this.#u16());
    }
    throw new Error(`Unsupported term '${term}'`);
  };

  unpack(uint8: Uint8Array) {
    this.#offset = 1;
    this.#uint8 = uint8;
    this.#view = new DataView(uint8.buffer);
    return this.#unpack();
  }
}

const unpack_atom = (atom: string) => {
  // deno-fmt-ignore-next-line
  switch (atom) {
    case "false": return false;
    case "nil": return null;
    case "true": return true;
    default: return atom;
  }
};
